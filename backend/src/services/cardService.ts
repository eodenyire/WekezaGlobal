import { pool } from '../database';
import { findWalletById } from '../models/wallet';
import { Card, CardTransaction, CardStatus } from '../models/types';
import { createError } from '../middleware/errorHandler';
import { config } from '../config';

const DEFAULT_SPENDING_LIMIT = config.defaultCardSpendingLimit;

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
