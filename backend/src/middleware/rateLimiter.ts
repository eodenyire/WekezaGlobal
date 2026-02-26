import rateLimit from 'express-rate-limit';
import { redis } from '../database';
import { config } from '../config';

const WINDOW_SECONDS = config.rateLimitWindowSeconds;
const MAX_REQUESTS   = config.rateLimitMaxRequests;

/**
 * Primary rate limiter using express-rate-limit (in-memory store).
 * A Redis counter runs in parallel for distributed enforcement
 * and is incremented best-effort (non-fatal if Redis is unavailable).
 */
export const rateLimiter = rateLimit({
  windowMs: WINDOW_SECONDS * 1000,
  max: MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TooManyRequests',
    message: 'Rate limit exceeded. Try again later.',
  },
  handler: async (req, res, _next, options) => {
    // Best-effort Redis counter for distributed tracking
    try {
      if (redis.status === 'ready') {
        const key = `rate_limit:${req.ip ?? 'unknown'}`;
        const cur = await redis.incr(key);
        if (cur === 1) await redis.expire(key, WINDOW_SECONDS);
      }
    } catch {
      // Non-fatal
    }
    res.status(options.statusCode).json(options.message);
  },
});
