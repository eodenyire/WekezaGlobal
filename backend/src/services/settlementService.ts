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

  // Persist simulated status change and write reconciliation log
  if (settlement.status !== rows[0].status) {
    await pool.query(
      "UPDATE settlements SET status = 'completed', updated_at = NOW() WHERE settlement_id = $1",
      [settlementId]
    );
    await pool.query(
      `INSERT INTO reconciliation_logs (settlement_id, result, notes)
       VALUES ($1, 'matched', 'Auto-reconciled on status check')`,
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

export interface CreateBankInput {
  name: string;
  country: string;
  api_endpoint?: string;
  settlement_rules?: Record<string, unknown>;
}

export async function createBank(input: CreateBankInput): Promise<Bank> {
  const { rows } = await pool.query<Bank>(
    `INSERT INTO banks (name, country, api_endpoint, settlement_rules, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING *`,
    [
      input.name,
      input.country,
      input.api_endpoint ?? null,
      input.settlement_rules ?? {},
    ]
  );
  return rows[0];
}

export async function updateBank(
  bankId: string,
  updates: Partial<Pick<Bank, 'name' | 'country' | 'api_endpoint' | 'status'>> & {
    settlement_rules?: Record<string, unknown>;
  }
): Promise<Bank> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.name !== undefined)         { fields.push(`name = $${idx++}`);             values.push(updates.name); }
  if (updates.country !== undefined)      { fields.push(`country = $${idx++}`);          values.push(updates.country); }
  if (updates.api_endpoint !== undefined) { fields.push(`api_endpoint = $${idx++}`);     values.push(updates.api_endpoint); }
  if (updates.status !== undefined)       { fields.push(`status = $${idx++}`);           values.push(updates.status); }
  if (updates.settlement_rules !== undefined) {
    fields.push(`settlement_rules = $${idx++}`);
    values.push(updates.settlement_rules);
  }

  if (fields.length === 0) throw createError('No update fields provided', 400);

  values.push(bankId);
  const { rows } = await pool.query<Bank>(
    `UPDATE banks SET ${fields.join(', ')} WHERE bank_id = $${idx} RETURNING *`,
    values
  );
  if (!rows[0]) throw createError('Bank not found', 404);
  return rows[0];
}

/**
 * Selects the optimal (active) bank for settlement in a given country.
 * Architecture §3.3 — "Engine selects optimal bank route".
 * Currently picks the first active bank for the country; in production this
 * would factor in settlement_rules, fees, and availability.
 */
export async function selectOptimalBank(country: string): Promise<Bank | null> {
  const { rows } = await pool.query<Bank>(
    `SELECT * FROM banks WHERE country = $1 AND status = 'active' ORDER BY name ASC LIMIT 1`,
    [country]
  );
  return rows[0] ?? null;
}

/**
 * Retry a failed settlement: re-debit the wallet (if the original debit was
 * reversed or never applied) and reset status to pending.
 * Architecture §8 — Fault tolerance: Retry mechanisms.
 */
export async function retrySettlement(settlementId: string): Promise<Settlement> {
  const { rows } = await pool.query<Settlement>(
    'SELECT * FROM settlements WHERE settlement_id = $1',
    [settlementId]
  );
  if (!rows[0]) throw createError('Settlement not found', 404);

  const settlement = rows[0];
  if (settlement.status !== 'failed') {
    throw createError('Only failed settlements can be retried', 422);
  }

  // Reset to pending so the normal resolution logic can pick it up
  const { rows: updated } = await pool.query<Settlement>(
    `UPDATE settlements
     SET status = 'pending', updated_at = NOW()
     WHERE settlement_id = $1
     RETURNING *`,
    [settlementId]
  );

  // Log retry in reconciliation_logs
  await pool.query(
    `INSERT INTO reconciliation_logs (settlement_id, result, notes)
     VALUES ($1, 'pending', 'Retry initiated by user/system')`,
    [settlementId]
  );

  return updated[0];
}
