import { PoolClient } from 'pg';
import { pool, redis } from '../database';
import { findWalletById, findWalletsByUserId } from '../models/wallet';
import { findTransactionsByWalletId } from '../models/transaction';
import { Wallet, Transaction, Currency } from '../models/types';
import { createError } from '../middleware/errorHandler';

const BALANCE_TTL = 300; // 5 minutes
const AML_MEDIUM_THRESHOLD = 10_000; // flag withdrawals above this
const AML_HIGH_THRESHOLD   = 50_000; // escalate to high severity above this

function balanceCacheKey(walletId: string): string {
  return `wallet:${walletId}:balance`;
}

async function invalidateBalanceCache(walletId: string): Promise<void> {
  try {
    await redis.del(balanceCacheKey(walletId));
  } catch {
    // Non-fatal — cache miss is acceptable
  }
}

export async function createWallet(
  userId: string,
  currency: Currency
): Promise<Wallet> {
  // One wallet per user per currency
  const { rows: existing } = await pool.query<Wallet>(
    'SELECT * FROM wallets WHERE user_id = $1 AND currency = $2',
    [userId, currency]
  );
  if (existing.length > 0) {
    throw createError(`User already has a ${currency} wallet`, 409);
  }

  const { rows } = await pool.query<Wallet>(
    `INSERT INTO wallets (user_id, currency, balance)
     VALUES ($1, $2, 0)
     RETURNING *`,
    [userId, currency]
  );
  return rows[0];
}

export async function getWallet(walletId: string): Promise<Wallet> {
  const wallet = await findWalletById(walletId);
  if (!wallet) throw createError('Wallet not found', 404);
  return wallet;
}

export async function getUserWallets(userId: string): Promise<Wallet[]> {
  return findWalletsByUserId(userId);
}

export async function getBalance(walletId: string): Promise<{ wallet_id: string; balance: number; currency: string; cached: boolean }> {
  const wallet = await findWalletById(walletId);
  if (!wallet) throw createError('Wallet not found', 404);

  // Try Redis cache first
  try {
    if (redis.status === 'ready') {
      const cached = await redis.get(balanceCacheKey(walletId));
      if (cached !== null) {
        return {
          wallet_id: walletId,
          balance: parseFloat(cached),
          currency: wallet.currency,
          cached: true,
        };
      }
    }
  } catch {
    // Fall through to DB
  }

  const balance = parseFloat(wallet.balance);

  // Store in Redis
  try {
    if (redis.status === 'ready') {
      await redis.setex(balanceCacheKey(walletId), BALANCE_TTL, balance.toString());
    }
  } catch {
    // Non-fatal
  }

  return { wallet_id: walletId, balance, currency: wallet.currency, cached: false };
}

export async function deposit(
  walletId: string,
  amount: number,
  metadata: Record<string, unknown> = {}
): Promise<{ transaction: Transaction; balance_after: number }> {
  if (amount <= 0) throw createError('Amount must be positive', 400);

  const wallet = await findWalletById(walletId);
  if (!wallet) throw createError('Wallet not found', 404);

  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert transaction
    const { rows: txRows } = await client.query<Transaction>(
      `INSERT INTO transactions (wallet_id, type, amount, currency, status, metadata)
       VALUES ($1, 'deposit', $2, $3, 'completed', $4)
       RETURNING *`,
      [walletId, amount, wallet.currency, JSON.stringify(metadata)]
    );
    const tx = txRows[0];

    // Update wallet balance
    const { rows: wRows } = await client.query<Wallet>(
      `UPDATE wallets
       SET balance = balance + $1, updated_at = NOW()
       WHERE wallet_id = $2
       RETURNING *`,
      [amount, walletId]
    );
    const updatedWallet = wRows[0];
    const balanceAfter = parseFloat(updatedWallet.balance);

    // Ledger entry (credit)
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, wallet_id, credit, balance_after)
       VALUES ($1, $2, $3, $4)`,
      [tx.transaction_id, walletId, amount, balanceAfter]
    );

    await client.query('COMMIT');
    await invalidateBalanceCache(walletId);

    return { transaction: tx, balance_after: balanceAfter };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function withdraw(
  walletId: string,
  amount: number,
  metadata: Record<string, unknown> = {}
): Promise<{ transaction: Transaction; balance_after: number }> {
  if (amount <= 0) throw createError('Amount must be positive', 400);

  const wallet = await findWalletById(walletId);
  if (!wallet) throw createError('Wallet not found', 404);

  const currentBalance = parseFloat(wallet.balance);
  if (currentBalance < amount) {
    throw createError('Insufficient funds', 422);
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    // Re-check balance inside transaction to avoid race conditions
    const { rows: lockRows } = await client.query<Wallet>(
      'SELECT balance FROM wallets WHERE wallet_id = $1 FOR UPDATE',
      [walletId]
    );
    const lockedBalance = parseFloat(lockRows[0].balance);
    if (lockedBalance < amount) {
      throw createError('Insufficient funds', 422);
    }

    // Insert transaction
    const { rows: txRows } = await client.query<Transaction>(
      `INSERT INTO transactions (wallet_id, type, amount, currency, status, metadata)
       VALUES ($1, 'withdrawal', $2, $3, 'completed', $4)
       RETURNING *`,
      [walletId, amount, wallet.currency, JSON.stringify(metadata)]
    );
    const tx = txRows[0];

    // Update wallet balance
    const { rows: wRows } = await client.query<Wallet>(
      `UPDATE wallets
       SET balance = balance - $1, updated_at = NOW()
       WHERE wallet_id = $2
       RETURNING *`,
      [amount, walletId]
    );
    const updatedWallet = wRows[0];
    const balanceAfter = parseFloat(updatedWallet.balance);

    // Ledger entry (debit)
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, wallet_id, debit, balance_after)
       VALUES ($1, $2, $3, $4)`,
      [tx.transaction_id, walletId, amount, balanceAfter]
    );

    // Flag large withdrawals as AML alerts
    if (amount > AML_MEDIUM_THRESHOLD) {
      await client.query(
        `INSERT INTO aml_alerts (transaction_id, type, severity)
         VALUES ($1, 'large_withdrawal', $2)`,
        [tx.transaction_id, amount > AML_HIGH_THRESHOLD ? 'high' : 'medium']
      );
    }

    await client.query('COMMIT');
    await invalidateBalanceCache(walletId);

    return { transaction: tx, balance_after: balanceAfter };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getTransactions(
  walletId: string,
  limit = 50,
  offset = 0
): Promise<Transaction[]> {
  const wallet = await findWalletById(walletId);
  if (!wallet) throw createError('Wallet not found', 404);
  return findTransactionsByWalletId(walletId, limit, offset);
}

export async function getRecentTransactions(
  userId: string,
  limit = 10
): Promise<Transaction[]> {
  const { rows } = await pool.query<Transaction>(
    `SELECT t.*
     FROM transactions t
     JOIN wallets w ON t.wallet_id = w.wallet_id
     WHERE w.user_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

/**
 * Internal helper used by the FX service to move funds between wallets
 * within a supplied DB transaction (client).
 */
export async function debitWalletInternal(
  client: PoolClient,
  walletId: string,
  amount: number,
  currency: string,
  transactionId: string
): Promise<number> {
  const { rows } = await client.query<Wallet>(
    'SELECT balance FROM wallets WHERE wallet_id = $1 FOR UPDATE',
    [walletId]
  );
  const balance = parseFloat(rows[0].balance);
  if (balance < amount) throw createError('Insufficient funds in source wallet', 422);

  const { rows: updated } = await client.query<Wallet>(
    `UPDATE wallets SET balance = balance - $1, updated_at = NOW()
     WHERE wallet_id = $2 RETURNING balance`,
    [amount, walletId]
  );
  const balanceAfter = parseFloat(updated[0].balance);

  await client.query(
    `INSERT INTO ledger_entries (transaction_id, wallet_id, debit, balance_after)
     VALUES ($1, $2, $3, $4)`,
    [transactionId, walletId, amount, balanceAfter]
  );

  await invalidateBalanceCache(walletId);
  return balanceAfter;
}

export async function transfer(
  sourceWalletId: string,
  destinationWalletId: string,
  amount: number,
  metadata: Record<string, unknown> = {}
): Promise<{ transaction: Transaction; source_balance_after: number; destination_balance_after: number }> {
  if (amount <= 0) throw createError('Amount must be positive', 400);
  if (sourceWalletId === destinationWalletId) throw createError('Source and destination wallets must differ', 400);

  const sourceWallet = await findWalletById(sourceWalletId);
  if (!sourceWallet) throw createError('Source wallet not found', 404);

  const destWallet = await findWalletById(destinationWalletId);
  if (!destWallet) throw createError('Destination wallet not found', 404);

  if (sourceWallet.currency !== destWallet.currency) {
    throw createError(
      `Cannot transfer between wallets with different currencies (${sourceWallet.currency} → ${destWallet.currency}). Use FX convert instead.`,
      400
    );
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock source wallet and check balance
    const { rows: lockRows } = await client.query<Wallet>(
      'SELECT balance FROM wallets WHERE wallet_id = $1 FOR UPDATE',
      [sourceWalletId]
    );
    const lockedBalance = parseFloat(lockRows[0].balance);
    if (lockedBalance < amount) throw createError('Insufficient funds', 422);

    // Insert transfer transaction
    const { rows: txRows } = await client.query<Transaction>(
      `INSERT INTO transactions (wallet_id, type, amount, currency, status, metadata)
       VALUES ($1, 'transfer', $2, $3, 'completed', $4)
       RETURNING *`,
      [sourceWalletId, amount, sourceWallet.currency, JSON.stringify({ ...metadata, destination_wallet_id: destinationWalletId })]
    );
    const tx = txRows[0];

    // Debit source wallet
    const { rows: srcRows } = await client.query<Wallet>(
      `UPDATE wallets SET balance = balance - $1, updated_at = NOW()
       WHERE wallet_id = $2 RETURNING *`,
      [amount, sourceWalletId]
    );
    const srcBalanceAfter = parseFloat(srcRows[0].balance);

    // Credit destination wallet
    const { rows: dstRows } = await client.query<Wallet>(
      `UPDATE wallets SET balance = balance + $1, updated_at = NOW()
       WHERE wallet_id = $2 RETURNING *`,
      [amount, destinationWalletId]
    );
    const dstBalanceAfter = parseFloat(dstRows[0].balance);

    // Ledger entries (debit source, credit destination)
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, wallet_id, debit, balance_after)
       VALUES ($1, $2, $3, $4)`,
      [tx.transaction_id, sourceWalletId, amount, srcBalanceAfter]
    );
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, wallet_id, credit, balance_after)
       VALUES ($1, $2, $3, $4)`,
      [tx.transaction_id, destinationWalletId, amount, dstBalanceAfter]
    );

    await client.query('COMMIT');
    await invalidateBalanceCache(sourceWalletId);
    await invalidateBalanceCache(destinationWalletId);

    return { transaction: tx, source_balance_after: srcBalanceAfter, destination_balance_after: dstBalanceAfter };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function creditWalletInternal(
  client: PoolClient,
  walletId: string,
  amount: number,
  currency: string,
  transactionId: string
): Promise<number> {
  const { rows: updated } = await client.query<Wallet>(
    `UPDATE wallets SET balance = balance + $1, updated_at = NOW()
     WHERE wallet_id = $2 RETURNING balance`,
    [amount, walletId]
  );
  if (updated.length === 0) {
    throw createError('Wallet not found for credit operation', 404);
  }
  const balanceAfter = parseFloat(updated[0].balance);

  await client.query(
    `INSERT INTO ledger_entries (transaction_id, wallet_id, credit, balance_after)
     VALUES ($1, $2, $3, $4)`,
    [transactionId, walletId, amount, balanceAfter]
  );

  await invalidateBalanceCache(walletId);
  return balanceAfter;
}
