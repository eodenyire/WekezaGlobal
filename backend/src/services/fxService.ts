import { PoolClient } from 'pg';
import { pool, redis } from '../database';
import { findWalletById, findWalletByUserAndCurrency } from '../models/wallet';
import { FxRate, FxTransaction, Currency, Wallet } from '../models/types';
import { createError } from '../middleware/errorHandler';
import { config } from '../config';
import {
  debitWalletInternal,
  creditWalletInternal,
} from './walletService';

const RATE_TTL = 60; // 1 minute

function rateCacheKey(from: string, to: string): string {
  return `fx:${from}:${to}`;
}

export async function getAllRates(): Promise<FxRate[]> {
  // Return the most-recent rate for each pair
  const { rows } = await pool.query<FxRate>(`
    SELECT DISTINCT ON (currency_from, currency_to)
      fx_rate_id, currency_from, currency_to, rate, provider, timestamp
    FROM fx_rates
    ORDER BY currency_from, currency_to, timestamp DESC
  `);
  return rows;
}

export async function getRate(
  from: Currency,
  to: Currency
): Promise<FxRate> {
  if (from === to) {
    // Synthetic 1:1 rate
    return {
      fx_rate_id: 'synthetic',
      currency_from: from,
      currency_to: to,
      rate: '1.000000',
      provider: 'WGI',
      timestamp: new Date(),
    };
  }

  // Try Redis cache
  try {
    if (redis.status === 'ready') {
      const cached = await redis.get(rateCacheKey(from, to));
      if (cached) return JSON.parse(cached) as FxRate;
    }
  } catch {
    // Fall through
  }

  const { rows } = await pool.query<FxRate>(
    `SELECT fx_rate_id, currency_from, currency_to, rate, provider, timestamp
     FROM fx_rates
     WHERE currency_from = $1 AND currency_to = $2
     ORDER BY timestamp DESC
     LIMIT 1`,
    [from, to]
  );

  if (!rows[0]) throw createError(`No FX rate found for ${from}/${to}`, 404);

  try {
    if (redis.status === 'ready') {
      await redis.setex(rateCacheKey(from, to), RATE_TTL, JSON.stringify(rows[0]));
    }
  } catch {
    // Non-fatal
  }

  return rows[0];
}

export interface ConvertInput {
  source_wallet_id: string;
  target_wallet_id?: string; // optional — create if missing
  amount: number;
  from_currency: Currency;
  to_currency: Currency;
  user_id: string; // needed to create target wallet if absent
}

export interface ConvertResult {
  fx_transaction: FxTransaction;
  amount_from: number;
  amount_to: number;
  fee: number;
  rate: number;
  source_balance_after: number;
  target_balance_after: number;
}

const FX_FEE_RATE = config.fxFeeRate;

export async function convert(input: ConvertInput): Promise<ConvertResult> {
  const { source_wallet_id, amount, from_currency, to_currency, user_id } = input;

  if (amount <= 0) throw createError('Amount must be positive', 400);
  if (from_currency === to_currency) throw createError('Source and target currency must differ', 400);

  const sourceWallet = await findWalletById(source_wallet_id);
  if (!sourceWallet) throw createError('Source wallet not found', 404);
  if (sourceWallet.currency !== from_currency) {
    throw createError('Source wallet currency does not match from_currency', 400);
  }

  // Resolve or create target wallet
  let targetWallet: Wallet | null = null;
  if (input.target_wallet_id) {
    targetWallet = await findWalletById(input.target_wallet_id);
    if (!targetWallet) throw createError('Target wallet not found', 404);
    if (targetWallet.currency !== to_currency) {
      throw createError('Target wallet currency does not match to_currency', 400);
    }
  } else {
    targetWallet = await findWalletByUserAndCurrency(user_id, to_currency);
    if (!targetWallet) {
      // Auto-create target wallet
      const { rows } = await pool.query<Wallet>(
        `INSERT INTO wallets (user_id, currency, balance) VALUES ($1, $2, 0) RETURNING *`,
        [user_id, to_currency]
      );
      targetWallet = rows[0];
    }
  }

  const fxRate = await getRate(from_currency, to_currency);
  const rate = parseFloat(fxRate.rate);
  // Use Math.round to 4 decimal places to avoid floating-point drift
  const fee = Math.round(amount * FX_FEE_RATE * 10000) / 10000;
  const amountAfterFee = Math.round((amount - fee) * 10000) / 10000;
  const amountTo = Math.round(amountAfterFee * rate * 10000) / 10000;

  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert the parent transaction (type = 'fx') on the source wallet
    const { rows: txRows } = await client.query(
      `INSERT INTO transactions (wallet_id, type, amount, currency, status, metadata)
       VALUES ($1, 'fx', $2, $3, 'completed', $4)
       RETURNING *`,
      [
        source_wallet_id,
        amount,
        from_currency,
        JSON.stringify({ to_currency, rate, fee, target_wallet_id: targetWallet.wallet_id }),
      ]
    );
    const tx = txRows[0];

    // Debit source wallet
    const sourceBal = await debitWalletInternal(
      client,
      source_wallet_id,
      amount,
      from_currency,
      tx.transaction_id
    );

    // Credit target wallet
    const targetBal = await creditWalletInternal(
      client,
      targetWallet.wallet_id,
      amountTo,
      to_currency,
      tx.transaction_id
    );

    // FX transaction record
    const { rows: fxRows } = await client.query<FxTransaction>(
      `INSERT INTO fx_transactions
         (transaction_id, amount_from, amount_to, currency_from, currency_to, route, fee)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        tx.transaction_id,
        amount,
        amountTo,
        from_currency,
        to_currency,
        `${from_currency}→${to_currency}`,
        fee,
      ]
    );

    await client.query('COMMIT');

    return {
      fx_transaction: fxRows[0],
      amount_from: amount,
      amount_to: amountTo,
      fee,
      rate,
      source_balance_after: sourceBal,
      target_balance_after: targetBal,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
