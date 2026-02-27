import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool, redis } from '../database';
import { JwtPayload, UserRole } from '../models/types';

export interface AuthRequest extends Request {
  user?: JwtPayload;
  /** Populated when request authenticated via X-API-Key header */
  apiKeyId?: string;
}

// Redis TTL for per-API-key usage counters (1 hour sliding window)
export const API_KEY_USAGE_TTL = 3600;

/**
 * Verifies the Bearer JWT and attaches the decoded payload to req.user.
 */
export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

/**
 * Validates the X-API-Key header against the api_keys table and attaches
 * a synthetic req.user (with role='partner').
 *
 * Schema §2 Redis Caching: "API Rate Limiting / Throttling: Per API key usage count"
 * Each valid request increments key  api_key:{api_key_id}:usage  in Redis
 * (TTL = 1 hour) so fintech partners can be tracked and throttled per key.
 */
export async function authenticateApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing X-API-Key header' });
    return;
  }

  try {
    const { rows } = await pool.query<{ api_key_id: string; user_id: string; email: string; status: string }>(
      `SELECT ak.api_key_id, ak.user_id, ak.status, u.email
         FROM api_keys ak
         JOIN users u ON ak.user_id = u.user_id
        WHERE ak.api_key = $1`,
      [apiKey]
    );

    const key = rows[0];
    if (!key || key.status !== 'active') {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or revoked API key' });
      return;
    }

    // Attach full user context for downstream handlers
    req.user    = { userId: key.user_id, email: key.email, role: 'partner' };
    req.apiKeyId = key.api_key_id;

    // Best-effort: increment per-API-key usage counter in Redis (Schema §2)
    try {
      if (redis.status === 'ready') {
        const usageKey = `api_key:${key.api_key_id}:usage`;
        const count = await redis.incr(usageKey);
        if (count === 1) await redis.expire(usageKey, API_KEY_USAGE_TTL);
      }
    } catch {
      // Non-fatal — Redis unavailability must not block the request
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Factory that returns middleware enforcing one of the specified roles.
 * Must be used after authenticate().
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of: ${roles.join(', ')}`,
      });
      return;
    }
    next();
  };
}
