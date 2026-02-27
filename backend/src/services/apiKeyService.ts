import crypto from 'crypto';
import { pool } from '../database';
import { ApiKey } from '../models/types';
import { createError } from '../middleware/errorHandler';

export async function createApiKey(
  userId: string,
  name: string
): Promise<ApiKey & { raw_key: string }> {
  const rawKey = `wgi_${crypto.randomBytes(32).toString('hex')}`;

  const { rows } = await pool.query<ApiKey>(
    `INSERT INTO api_keys (user_id, api_key, name, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING *`,
    [userId, rawKey, name || null]
  );

  return { ...rows[0], raw_key: rawKey };
}

export async function getUserApiKeys(userId: string): Promise<ApiKey[]> {
  const { rows } = await pool.query<ApiKey>(
    `SELECT api_key_id, user_id, name, status, created_at,
            CONCAT(SUBSTRING(api_key, 1, 10), '…') AS api_key
     FROM api_keys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function revokeApiKey(
  apiKeyId: string,
  userId: string
): Promise<ApiKey> {
  const { rows } = await pool.query<ApiKey>(
    `UPDATE api_keys SET status = 'revoked'
     WHERE api_key_id = $1 AND user_id = $2
     RETURNING api_key_id, user_id, name, status, created_at,
               CONCAT(SUBSTRING(api_key, 1, 10), '…') AS api_key`,
    [apiKeyId, userId]
  );
  if (!rows[0]) throw createError('API key not found', 404);
  return rows[0];
}

export async function getAllApiKeys(limit = 50, offset = 0): Promise<ApiKey[]> {
  const { rows } = await pool.query<ApiKey>(
    `SELECT api_key_id, user_id, name, status, created_at,
            CONCAT(SUBSTRING(api_key, 1, 10), '…') AS api_key
     FROM api_keys
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}
