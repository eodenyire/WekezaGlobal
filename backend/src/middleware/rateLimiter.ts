import { Request, Response, NextFunction } from 'express';
import { redis } from '../database';
import { config } from '../config';

const WINDOW_SECONDS = config.rateLimitWindowSeconds;
const MAX_REQUESTS   = config.rateLimitMaxRequests;

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // If Redis is not available, fail open (don't block the request)
  if (redis.status !== 'ready') {
    next();
    return;
  }

  const ip = req.ip ?? 'unknown';
  const key = `rate_limit:${ip}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      // First request in this window — set expiry
      await redis.expire(key, WINDOW_SECONDS);
    }

    const ttl = await redis.ttl(key);
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - current));
    res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + ttl);

    if (current > MAX_REQUESTS) {
      res.status(429).json({
        error: 'TooManyRequests',
        message: 'Rate limit exceeded. Try again later.',
      });
      return;
    }

    next();
  } catch {
    // Redis failure — fail open
    next();
  }
}
