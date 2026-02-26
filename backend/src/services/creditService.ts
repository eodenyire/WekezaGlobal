import { pool } from '../database';
import { CreditScore, CreditActivityLog } from '../models/types';
import { createError } from '../middleware/errorHandler';

const BASE_SCORE = 500;
const MAX_SCORE  = 850;
const MIN_SCORE  = 300;

// Scoring weights
const TX_WEIGHT         = 2;   // points per completed transaction
const SETTLEMENT_WEIGHT = 5;   // points per completed settlement
const FX_WEIGHT         = 3;   // points per FX conversion

// Per-factor caps
const TX_CAP         = 200;
const SETTLEMENT_CAP = 100;
const FX_CAP         = 50;

async function computeScore(userId: string): Promise<{
  score: number;
  factors: Record<string, number>;
}> {
  // Completed transaction count across all user wallets
  const { rows: txRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM transactions t
     JOIN wallets w ON t.wallet_id = w.wallet_id
     WHERE w.user_id = $1 AND t.status = 'completed'`,
    [userId]
  );
  const txCount = parseInt(txRows[0]?.count ?? '0', 10);

  // Successful settlement count
  const { rows: sRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM settlements s
     JOIN wallets w ON s.wallet_id = w.wallet_id
     WHERE w.user_id = $1 AND s.status = 'completed'`,
    [userId]
  );
  const settlements = parseInt(sRows[0]?.count ?? '0', 10);

  // FX conversion count
  const { rows: fxRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM fx_transactions ft
     JOIN transactions t ON ft.transaction_id = t.transaction_id
     JOIN wallets w ON t.wallet_id = w.wallet_id
     WHERE w.user_id = $1`,
    [userId]
  );
  const fxConversions = parseInt(fxRows[0]?.count ?? '0', 10);

  const txPoints         = Math.min(TX_CAP,         txCount     * TX_WEIGHT);
  const settlementPoints = Math.min(SETTLEMENT_CAP, settlements * SETTLEMENT_WEIGHT);
  const fxPoints         = Math.min(FX_CAP,         fxConversions * FX_WEIGHT);

  const raw   = BASE_SCORE + txPoints + settlementPoints + fxPoints;
  const score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, raw));

  return {
    score,
    factors: {
      transaction_count:      txCount,
      successful_settlements: settlements,
      fx_conversions:         fxConversions,
      tx_points:              txPoints,
      settlement_points:      settlementPoints,
      fx_points:              fxPoints,
    },
  };
}

export async function getCreditScore(userId: string): Promise<CreditScore> {
  // Check user exists
  const { rows: uRows } = await pool.query(
    'SELECT user_id FROM users WHERE user_id = $1',
    [userId]
  );
  if (!uRows[0]) throw createError('User not found', 404);

  const { rows } = await pool.query<CreditScore>(
    'SELECT * FROM credit_scores WHERE user_id = $1',
    [userId]
  );

  if (rows[0]) return rows[0];

  // First request — compute and persist
  return recalculateCreditScore(userId);
}

export async function recalculateCreditScore(userId: string): Promise<CreditScore> {
  // Check user exists
  const { rows: uRows } = await pool.query(
    'SELECT user_id FROM users WHERE user_id = $1',
    [userId]
  );
  if (!uRows[0]) throw createError('User not found', 404);

  const { score, factors } = await computeScore(userId);

  const { rows } = await pool.query<CreditScore>(
    `INSERT INTO credit_scores (user_id, score, factors, last_updated)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET score = EXCLUDED.score,
                   factors = EXCLUDED.factors,
                   last_updated = NOW()
     RETURNING *`,
    [userId, score, JSON.stringify(factors)]
  );

  // Log credit activity factors for analytics (SDS §2.7)
  await pool.query(
    `INSERT INTO credit_activity_logs (user_id, factor, delta)
     VALUES ($1, 'transaction_points', $2),
            ($1, 'settlement_points', $3),
            ($1, 'fx_points', $4)`,
    [userId, factors.tx_points, factors.settlement_points, factors.fx_points]
  );

  return rows[0];
}

export async function getCreditActivityLogs(
  userId: string,
  limit = 50,
  offset = 0
): Promise<CreditActivityLog[]> {
  const { rows: uRows } = await pool.query(
    'SELECT user_id FROM users WHERE user_id = $1',
    [userId]
  );
  if (!uRows[0]) throw createError('User not found', 404);

  const { rows } = await pool.query<CreditActivityLog>(
    `SELECT * FROM credit_activity_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}
