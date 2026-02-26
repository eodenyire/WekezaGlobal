import { PoolClient } from 'pg';
import { pool, redis } from '../database';
import { findWalletById, findWalletsByUserId } from '../models/wallet';
import { findTransactionsByWalletId } from '../models/transaction';
import { Wallet, Transaction, Currency } from '../models/types';
import { createError } from '../middleware/errorHandler';

const BALANCE_TTL = 300; // 5 minutes

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

    // Flag large withdrawals as AML alerts (> 10 000 in any currency)
    if (amount > 10000) {
      await client.query(
        `INSERT INTO aml_alerts (transaction_id, type, severity)
         VALUES ($1, 'large_withdrawal', $2)`,
        [tx.transaction_id, amount > 50000 ? 'high' : 'medium']
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
  const balanceAfter = parseFloat(updated[0].balance);

  await client.query(
    `INSERT INTO ledger_entries (transaction_id, wallet_id, credit, balance_after)
     VALUES ($1, $2, $3, $4)`,
    [transactionId, walletId, amount, balanceAfter]
  );

  await invalidateBalanceCache(walletId);
  return balanceAfter;
}
