/**
 * Collection Account Service — BRD §4.4
 *
 * A collection account is a virtual receiving account (ACH routing+account,
 * SWIFT IBAN/BIC, or SEPA IBAN/BIC) that allows external payers to send
 * funds directly into a user's WGI wallet via the standard payment rails.
 *
 * BRD: BR-010 (global accounts for freelancers/SMEs), BR-011 (ACH/SWIFT/SEPA
 * protocol support), BR-012 (funds flow into wallet ledger in near-real-time).
 */

import { pool } from '../database';
import { findWalletById } from '../models/wallet';
import { createError } from '../middleware/errorHandler';
import { deposit } from './walletService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentRail = 'ACH' | 'SWIFT' | 'SEPA';

export interface CollectionAccount {
  collection_account_id: string;
  user_id: string;
  wallet_id: string;
  rail: PaymentRail;
  currency: string;
  label: string | null;
  routing_number: string | null;
  account_number: string | null;
  iban: string | null;
  bic: string | null;
  reference_code: string;
  status: 'active' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionAccountInput {
  user_id: string;
  wallet_id: string;
  rail: PaymentRail;
  label?: string;
}

// ─── Deterministic mock coordinates per rail + currency ──────────────────────
// In production these would be provisioned from a bank partner API.

function mockCoordinates(
  rail: PaymentRail,
  currency: string,
  referenceCode: string
): Partial<CollectionAccount> {
  const ref = referenceCode.padEnd(8, '0');
  if (rail === 'ACH') {
    return {
      routing_number: '021000021',             // JPMorgan sandbox routing
      account_number: `84700${ref}`,
    };
  }
  if (rail === 'SEPA') {
    return {
      iban: `DE89370400440532${ref}`,
      bic: 'COBADEFFXXX',
    };
  }
  // SWIFT
  return {
    iban: currency === 'GBP' ? `GB29NWBK601613${ref}` : `US${ref}123456789`,
    bic: currency === 'GBP' ? 'NWBKGB2L' : 'CHASUS33',
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function createCollectionAccount(
  input: CreateCollectionAccountInput
): Promise<CollectionAccount> {
  const wallet = await findWalletById(input.wallet_id);
  if (!wallet) throw createError('Wallet not found', 404);
  if (wallet.user_id !== input.user_id) throw createError('Wallet does not belong to this user', 403);

  // Validate rail + currency compatibility
  const validRails: Record<PaymentRail, string[]> = {
    ACH:   ['USD'],
    SEPA:  ['EUR'],
    SWIFT: ['USD', 'EUR', 'GBP'],
  };
  if (!validRails[input.rail].includes(wallet.currency)) {
    throw createError(
      `Rail ${input.rail} is not compatible with currency ${wallet.currency}. ` +
      `Supported currencies for ${input.rail}: ${validRails[input.rail].join(', ')}`,
      422
    );
  }

  // Generate a reference code placeholder — DB will assign the final UUID-based code
  const coords = mockCoordinates(input.rail, wallet.currency, 'TEMP0000');

  const { rows } = await pool.query<CollectionAccount>(
    `INSERT INTO collection_accounts
       (user_id, wallet_id, rail, currency, label,
        routing_number, account_number, iban, bic)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.user_id,
      input.wallet_id,
      input.rail,
      wallet.currency,
      input.label ?? `${wallet.currency} ${input.rail} Account`,
      coords.routing_number ?? null,
      coords.account_number ?? null,
      coords.iban ?? null,
      coords.bic ?? null,
    ]
  );

  const account = rows[0];

  // Re-generate coordinates now that we have the real reference_code
  const finalCoords = mockCoordinates(input.rail, wallet.currency, account.reference_code);
  const { rows: updated } = await pool.query<CollectionAccount>(
    `UPDATE collection_accounts
     SET routing_number = $1, account_number = $2, iban = $3, bic = $4, updated_at = NOW()
     WHERE collection_account_id = $5
     RETURNING *`,
    [
      finalCoords.routing_number ?? null,
      finalCoords.account_number ?? null,
      finalCoords.iban ?? null,
      finalCoords.bic ?? null,
      account.collection_account_id,
    ]
  );

  return updated[0];
}

export async function getUserCollectionAccounts(userId: string): Promise<CollectionAccount[]> {
  const { rows } = await pool.query<CollectionAccount>(
    `SELECT ca.*, w.currency AS wallet_currency
     FROM collection_accounts ca
     JOIN wallets w ON ca.wallet_id = w.wallet_id
     WHERE ca.user_id = $1
     ORDER BY ca.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function getCollectionAccount(
  collectionAccountId: string
): Promise<CollectionAccount> {
  const { rows } = await pool.query<CollectionAccount>(
    'SELECT * FROM collection_accounts WHERE collection_account_id = $1',
    [collectionAccountId]
  );
  if (!rows[0]) throw createError('Collection account not found', 404);
  return rows[0];
}

export async function closeCollectionAccount(
  collectionAccountId: string,
  userId: string
): Promise<CollectionAccount> {
  const { rows } = await pool.query<CollectionAccount>(
    `UPDATE collection_accounts
     SET status = 'closed', updated_at = NOW()
     WHERE collection_account_id = $1 AND user_id = $2
     RETURNING *`,
    [collectionAccountId, userId]
  );
  if (!rows[0]) throw createError('Collection account not found or not owned by user', 404);
  return rows[0];
}

/**
 * Simulate an inbound payment received on a collection account (BR-012).
 * Credits the linked wallet in near-real-time.
 * In production this would be triggered by a bank webhook / payment notification.
 */
export async function receivePayment(
  collectionAccountId: string,
  amount: number,
  metadata?: Record<string, unknown>
): Promise<{ transaction_id: string; wallet_id: string; amount: number; currency: string }> {
  const account = await getCollectionAccount(collectionAccountId);
  if (account.status !== 'active') throw createError('Collection account is closed', 422);

  const { transaction } = await deposit(account.wallet_id, amount, {
    type: 'collection_account_receipt',
    collection_account_id: collectionAccountId,
    rail: account.rail,
    reference_code: account.reference_code,
    ...metadata,
  });

  return {
    transaction_id: transaction.transaction_id,
    wallet_id: account.wallet_id,
    amount,
    currency: account.currency,
  };
}
