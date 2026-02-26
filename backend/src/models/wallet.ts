import { pool } from '../database';
import { Wallet } from './types';

export async function findWalletById(walletId: string): Promise<Wallet | null> {
  const { rows } = await pool.query<Wallet>(
    'SELECT * FROM wallets WHERE wallet_id = $1',
    [walletId]
  );
  return rows[0] ?? null;
}

export async function findWalletsByUserId(userId: string): Promise<Wallet[]> {
  const { rows } = await pool.query<Wallet>(
    'SELECT * FROM wallets WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  return rows;
}

export async function findWalletByUserAndCurrency(
  userId: string,
  currency: string
): Promise<Wallet | null> {
  const { rows } = await pool.query<Wallet>(
    'SELECT * FROM wallets WHERE user_id = $1 AND currency = $2',
    [userId, currency]
  );
  return rows[0] ?? null;
}
