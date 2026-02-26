import { Pool } from 'pg';
import Redis from 'ioredis';
import { config } from '../config';

export const pool = new Pool({ connectionString: config.databaseUrl });

export const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

redis.on('error', (err: Error) => {
  console.warn('[Redis] Connection error (non-fatal):', err.message);
});

export async function connectDB(): Promise<void> {
  const client = await pool.connect();
  console.log('[DB] PostgreSQL connected');
  client.release();
}

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    console.log('[Redis] Connected');
  } catch (err) {
    console.warn('[Redis] Could not connect (non-fatal):', (err as Error).message);
  }
}
