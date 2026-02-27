import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as apiKeyService from '../services/apiKeyService';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { pool, redis } from '../database';

const router = Router();

router.use(authenticate);

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
});

// ─── GET /v1/api-keys/all  (admin only — must be before /:api_key_id) ─────────

router.get('/all', requireRole('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const keys = await apiKeyService.getAllApiKeys(limit, offset);
    res.json({ api_keys: keys, limit, offset });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/api-keys  (current user's keys) ────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const keys = await apiKeyService.getUserApiKeys(req.user!.userId);
    res.json({ api_keys: keys });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/api-keys/:api_key_id/usage ──────────────────────────────────────
// Schema §2 Redis: "API Rate Limiting / Throttling: Per API key usage count"
// Returns the current 1-hour rolling request count for the given API key.
// Caller must own the key or be an admin.

router.get('/:api_key_id/usage', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { api_key_id } = req.params;

    // Verify ownership (or admin)
    const { rows } = await pool.query<{ user_id: string }>(
      'SELECT user_id FROM api_keys WHERE api_key_id = $1',
      [api_key_id]
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'NotFound', message: 'API key not found' });
      return;
    }
    if (req.user!.role !== 'admin' && rows[0].user_id !== req.user!.userId) {
      res.status(403).json({ error: 'Forbidden', message: 'You do not own this API key' });
      return;
    }

    let usage_count = 0;
    try {
      if (redis.status === 'ready') {
        const val = await redis.get(`api_key:${api_key_id}:usage`);
        usage_count = val ? parseInt(val, 10) : 0;
      }
    } catch {
      // Non-fatal — Redis unavailable
    }

    res.json({
      api_key_id,
      usage_count,
      window: '1 hour',
      note: 'Rolling 1-hour request count tracked in Redis per Schema §2',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/api-keys ───────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = CreateKeySchema.parse(req.body);
    const key = await apiKeyService.createApiKey(req.user!.userId, name);
    res.status(201).json(key);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /v1/api-keys/:api_key_id  (revoke) ───────────────────────────────

router.delete('/:api_key_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const key = await apiKeyService.revokeApiKey(req.params.api_key_id, req.user!.userId);
    res.json(key);
  } catch (err) {
    next(err);
  }
});

export default router;
