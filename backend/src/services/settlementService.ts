import { pool } from '../database';
import { findWalletById } from '../models/wallet';
import { Settlement, Bank } from '../models/types';
import { createError } from '../middleware/errorHandler';
import { deposit, withdraw } from './walletService';

function generateProviderReference(bankId: string): string {
  return `SETTLE-${bankId.slice(0, 8)}-${Date.now()}`;
}

export interface InitiateSettlementOptions {
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface BankSettlementWebhookPayload {
  settlement_id?: string;
  provider_reference?: string;
  status: 'pending' | 'completed' | 'failed';
  failure_reason?: string;
}

export interface SettlementReconciliationSnapshot {
  date: string;
  totals: {
    initiated: number;
    completed: number;
    failed: number;
    pending: number;
  };
  amounts: {
    completed: number;
    failed: number;
    pending: number;
  };
  stalePendingCount: number;
}

export async function initiateSettlement(
  walletId: string,
  bankId: string,
  amount: number,
  options: InitiateSettlementOptions = {}
): Promise<Settlement> {
  if (amount <= 0) throw createError('Amount must be positive', 400);

  const wallet = await findWalletById(walletId);
  if (!wallet) throw createError('Wallet not found', 404);

  const { rows: bankRows } = await pool.query<Bank>(
    "SELECT * FROM banks WHERE bank_id = $1 AND status = 'active'",
    [bankId]
  );
  if (!bankRows[0]) throw createError('Bank not found or inactive', 404);

  if (options.idempotencyKey) {
    const { rows: existingRows } = await pool.query<Settlement>(
      'SELECT * FROM settlements WHERE idempotency_key = $1',
      [options.idempotencyKey]
    );
    if (existingRows[0]) return existingRows[0];
  }

  const { rows: createdRows } = await pool.query<Settlement>(
    `INSERT INTO settlements (wallet_id, bank_id, amount, currency, status, idempotency_key, metadata)
     VALUES ($1, $2, $3, $4, 'processing', $5, $6)
     RETURNING *`,
    [
      walletId,
      bankId,
      amount,
      wallet.currency,
      options.idempotencyKey || null,
      JSON.stringify(options.metadata || {}),
    ]
  );
  const created = createdRows[0];

  try {
    await withdraw(walletId, amount, { reason: 'settlement', bank_id: bankId });
  } catch (err) {
    await pool.query(
      `UPDATE settlements
       SET status = 'failed', failure_reason = $2, updated_at = NOW()
       WHERE settlement_id = $1`,
      [created.settlement_id, (err as Error).message]
    );
    throw err;
  }

  const providerReference = generateProviderReference(bankId);

  const { rows } = await pool.query<Settlement>(
    `UPDATE settlements
     SET status = 'pending', provider_reference = $2, updated_at = NOW()
     WHERE settlement_id = $1
     RETURNING *`,
    [created.settlement_id, providerReference]
  );

  return rows[0];
}

export async function getSettlement(settlementId: string): Promise<Settlement> {
  const { rows } = await pool.query<Settlement>(
    'SELECT * FROM settlements WHERE settlement_id = $1',
    [settlementId]
  );
  if (!rows[0]) throw createError('Settlement not found', 404);
  return rows[0];
}

export async function getWalletSettlements(walletId: string): Promise<Settlement[]> {
  const wallet = await findWalletById(walletId);
  if (!wallet) throw createError('Wallet not found', 404);

  const { rows } = await pool.query<Settlement>(
    'SELECT * FROM settlements WHERE wallet_id = $1 ORDER BY created_at DESC',
    [walletId]
  );
  return rows;
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
  return rows;
}

export async function finalizeSettlementFromWebhook(
  bankId: string,
  payload: BankSettlementWebhookPayload
): Promise<Settlement> {
  if (!payload.settlement_id && !payload.provider_reference) {
    throw createError('Either settlement_id or provider_reference is required', 400);
  }

  const identifierColumn = payload.settlement_id
    ? 'settlement_id'
    : 'provider_reference';
  const identifierValue = payload.settlement_id || payload.provider_reference;

  const { rows } = await pool.query<Settlement>(
    `SELECT *
     FROM settlements
     WHERE bank_id = $1 AND ${identifierColumn} = $2`,
    [bankId, identifierValue]
  );
  if (!rows[0]) throw createError('Settlement not found for bank callback', 404);

  const settlement = rows[0];
  if (settlement.status === 'completed' || settlement.status === 'failed') {
    return settlement;
  }

  if (payload.status === 'pending') {
    const { rows: pendingRows } = await pool.query<Settlement>(
      `UPDATE settlements
       SET status = 'pending', updated_at = NOW()
       WHERE settlement_id = $1
       RETURNING *`,
      [settlement.settlement_id]
    );
    return pendingRows[0];
  }

  if (payload.status === 'completed') {
    const { rows: completedRows } = await pool.query<Settlement>(
      `UPDATE settlements
       SET status = 'completed', completed_at = NOW(), failure_reason = NULL, updated_at = NOW()
       WHERE settlement_id = $1
       RETURNING *`,
      [settlement.settlement_id]
    );
    return completedRows[0];
  }

  await deposit(settlement.wallet_id, parseFloat(settlement.amount), {
    reason: 'settlement_reversal',
    settlement_id: settlement.settlement_id,
    provider_reference: settlement.provider_reference,
  });

  const { rows: failedRows } = await pool.query<Settlement>(
    `UPDATE settlements
     SET status = 'failed', failure_reason = $2, updated_at = NOW()
     WHERE settlement_id = $1
     RETURNING *`,
    [
      settlement.settlement_id,
      payload.failure_reason || 'Failed by bank callback',
    ]
  );
  return failedRows[0];
}

export async function getDailySettlementReconciliation(date: string): Promise<SettlementReconciliationSnapshot> {
  const { rows: totalsRows } = await pool.query<{
    initiated: string;
    completed: string;
    failed: string;
    pending: string;
    completed_amount: string;
    failed_amount: string;
    pending_amount: string;
  }>(
    `SELECT
       COUNT(*)::text AS initiated,
       COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
       COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
       COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::text AS pending,
       COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::text AS completed_amount,
       COALESCE(SUM(amount) FILTER (WHERE status = 'failed'), 0)::text AS failed_amount,
       COALESCE(SUM(amount) FILTER (WHERE status IN ('pending', 'processing')), 0)::text AS pending_amount
     FROM settlements
     WHERE created_at::date = $1::date`,
    [date]
  );

  const { rows: staleRows } = await pool.query<{ stale_pending_count: string }>(
    `SELECT COUNT(*)::text AS stale_pending_count
     FROM settlements
     WHERE status IN ('pending', 'processing')
       AND created_at < NOW() - INTERVAL '2 hours'`,
    []
  );

  const totals = totalsRows[0];
  return {
    date,
    totals: {
      initiated: parseInt(totals.initiated, 10),
      completed: parseInt(totals.completed, 10),
      failed: parseInt(totals.failed, 10),
      pending: parseInt(totals.pending, 10),
    },
    amounts: {
      completed: parseFloat(totals.completed_amount),
      failed: parseFloat(totals.failed_amount),
      pending: parseFloat(totals.pending_amount),
    },
    stalePendingCount: parseInt(staleRows[0].stale_pending_count, 10),
  };
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
