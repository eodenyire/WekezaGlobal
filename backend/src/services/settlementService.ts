import { pool } from '../database';
import { findWalletById } from '../models/wallet';
import { Settlement, Bank } from '../models/types';
import { createError } from '../middleware/errorHandler';
import { config } from '../config';
import { withdraw } from './walletService';

const SETTLEMENT_COMPLETION_MS = config.settlementCompletionMs;

/** Simulate async completion: pending → completed after 2 minutes. */
function resolveStatus(s: Settlement): Settlement {
  if (
    s.status === 'pending' &&
    Date.now() - new Date(s.updated_at).getTime() >= SETTLEMENT_COMPLETION_MS
  ) {
    return { ...s, status: 'completed' };
  }
  return s;
}

export async function initiateSettlement(
  walletId: string,
  bankId: string,
  amount: number
): Promise<Settlement> {
  if (amount <= 0) throw createError('Amount must be positive', 400);

  const wallet = await findWalletById(walletId);
  if (!wallet) throw createError('Wallet not found', 404);

  const { rows: bankRows } = await pool.query<Bank>(
    "SELECT * FROM banks WHERE bank_id = $1 AND status = 'active'",
    [bankId]
  );
  if (!bankRows[0]) throw createError('Bank not found or inactive', 404);

  // Debit the wallet (uses ACID transaction internally)
  await withdraw(walletId, amount, { reason: 'settlement', bank_id: bankId });

  const { rows } = await pool.query<Settlement>(
    `INSERT INTO settlements (wallet_id, bank_id, amount, currency, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [walletId, bankId, amount, wallet.currency]
  );

  return rows[0];
}

export async function getSettlement(settlementId: string): Promise<Settlement> {
  const { rows } = await pool.query<Settlement>(
    'SELECT * FROM settlements WHERE settlement_id = $1',
    [settlementId]
  );
  if (!rows[0]) throw createError('Settlement not found', 404);

  const settlement = resolveStatus(rows[0]);

  // Persist simulated status change
  if (settlement.status !== rows[0].status) {
    await pool.query(
      "UPDATE settlements SET status = 'completed', updated_at = NOW() WHERE settlement_id = $1",
      [settlementId]
    );
  }

  return settlement;
}

export async function getWalletSettlements(walletId: string): Promise<Settlement[]> {
  const wallet = await findWalletById(walletId);
  if (!wallet) throw createError('Wallet not found', 404);

  const { rows } = await pool.query<Settlement>(
    'SELECT * FROM settlements WHERE wallet_id = $1 ORDER BY created_at DESC',
    [walletId]
  );
  return rows.map(resolveStatus);
}

export async function getUserSettlements(userId: string): Promise<Settlement[]> {
  const { rows } = await pool.query<Settlement>(
    `SELECT s.*
     FROM settlements s
     JOIN wallets w ON s.wallet_id = w.wallet_id
     WHERE w.user_id = $1
     ORDER BY s.created_at DESC`,
    [userId]
  );
  return rows.map(resolveStatus);
}

export async function getAllBanks(): Promise<Bank[]> {
  const { rows } = await pool.query<Bank>(
    "SELECT * FROM banks ORDER BY name ASC"
  );
  return rows;
}

export async function getBankById(bankId: string): Promise<Bank> {
  const { rows } = await pool.query<Bank>(
    'SELECT * FROM banks WHERE bank_id = $1',
    [bankId]
  );
  if (!rows[0]) throw createError('Bank not found', 404);
  return rows[0];
}
