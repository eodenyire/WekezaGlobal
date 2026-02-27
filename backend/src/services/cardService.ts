import { pool } from '../database';
import { findWalletById } from '../models/wallet';
import { Card, CardTransaction, CardStatus, Currency } from '../models/types';
import { createError } from '../middleware/errorHandler';
import { config } from '../config';
import { withdraw } from './walletService';

const DEFAULT_SPENDING_LIMIT = config.defaultCardSpendingLimit;
// Fraction of the spending limit above which a card charge triggers an AML alert
const CARD_AML_ALERT_THRESHOLD = 0.8;

export async function getUserCards(userId: string): Promise<Card[]> {
  const { rows } = await pool.query<Card>(
    `SELECT c.*
     FROM cards c
     JOIN wallets w ON c.wallet_id = w.wallet_id
     WHERE w.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function createCard(
  walletId: string,
  cardType: 'virtual' | 'physical',
  spendingLimit?: number
): Promise<Card> {
  const wallet = await findWalletById(walletId);
  if (!wallet) throw createError('Wallet not found', 404);

  const limit = spendingLimit ?? DEFAULT_SPENDING_LIMIT;
  if (limit <= 0) throw createError('Spending limit must be positive', 400);

  const { rows } = await pool.query<Card>(
    `INSERT INTO cards (wallet_id, card_type, spending_limit)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [walletId, cardType, limit]
  );
  return rows[0];
}

export async function getCard(cardId: string): Promise<Card> {
  const { rows } = await pool.query<Card>(
    'SELECT * FROM cards WHERE card_id = $1',
    [cardId]
  );
  if (!rows[0]) throw createError('Card not found', 404);
  return rows[0];
}

export async function getCardTransactions(
  cardId: string,
  limit = 50,
  offset = 0
): Promise<CardTransaction[]> {
  // Verify card exists
  const { rows: cardRows } = await pool.query<Card>(
    'SELECT card_id FROM cards WHERE card_id = $1',
    [cardId]
  );
  if (!cardRows[0]) throw createError('Card not found', 404);

  const { rows } = await pool.query<CardTransaction>(
    `SELECT * FROM card_transactions
     WHERE card_id = $1
     ORDER BY timestamp DESC
     LIMIT $2 OFFSET $3`,
    [cardId, limit, offset]
  );
  return rows;
}

export async function updateCardStatus(
  cardId: string,
  status: CardStatus
): Promise<Card> {
  const validStatuses: CardStatus[] = ['active', 'blocked', 'expired'];
  if (!validStatuses.includes(status)) {
    throw createError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
  }

  const { rows } = await pool.query<Card>(
    `UPDATE cards SET status = $1 WHERE card_id = $2 RETURNING *`,
    [status, cardId]
  );
  if (!rows[0]) throw createError('Card not found', 404);
  return rows[0];
}

/**
 * Charge a card: enforces spending limit, debits the linked wallet,
 * records a card_transaction, and generates an AML alert when the amount
 * exceeds 80 % of the spending limit (SDS §2.4 — spend monitoring & fraud alerts).
 */
export async function chargeCard(
  cardId: string,
  amount: number,
  currency: Currency,
  merchant: string
): Promise<CardTransaction> {
  if (amount <= 0) throw createError('Amount must be positive', 400);

  const card = await getCard(cardId);
  if (card.status !== 'active') throw createError('Card is not active', 400);

  const spendingLimit = parseFloat(card.spending_limit);
  if (amount > spendingLimit) {
    throw createError(
      `Transaction amount ${amount} exceeds card spending limit of ${spendingLimit}`,
      422
    );
  }

  // Debit the linked wallet (keeps ledger in sync per SDS §2.4)
  const { transaction } = await withdraw(card.wallet_id, amount, {
    reason: 'card_charge',
    card_id: cardId,
    merchant,
  });

  // Insert card transaction record
  const { rows } = await pool.query<CardTransaction>(
    `INSERT INTO card_transactions (card_id, amount, currency, merchant)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [cardId, amount, currency, merchant]
  );

  // Fraud alert: flag charges exceeding the AML alert threshold (SDS §2.4)
  if (amount >= spendingLimit * CARD_AML_ALERT_THRESHOLD) {
    await pool.query(
      `INSERT INTO aml_alerts (transaction_id, type, severity)
       VALUES ($1, 'high_card_spend', 'medium')`,
      [transaction.transaction_id]
    );
  }

  return rows[0];
}
