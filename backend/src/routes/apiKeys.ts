import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as apiKeyService from '../services/apiKeyService';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

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
