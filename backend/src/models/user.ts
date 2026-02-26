import { pool } from '../database';
import { User, PublicUser } from './types';

export async function findUserById(userId: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    'SELECT * FROM users WHERE user_id = $1',
    [userId]
  );
  return rows[0] ?? null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return rows[0] ?? null;
}

export function toPublicUser(user: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...publicUser } = user;
  return publicUser;
}
