import { pool } from '../database';
import { Transaction } from './types';

export async function findTransactionById(
  transactionId: string
): Promise<Transaction | null> {
  const { rows } = await pool.query<Transaction>(
    'SELECT * FROM transactions WHERE transaction_id = $1',
    [transactionId]
  );
  return rows[0] ?? null;
}

export async function findTransactionsByWalletId(
  walletId: string,
  limit = 50,
  offset = 0
): Promise<Transaction[]> {
  const { rows } = await pool.query<Transaction>(
    `SELECT * FROM transactions
     WHERE wallet_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [walletId, limit, offset]
  );
  return rows;
}
