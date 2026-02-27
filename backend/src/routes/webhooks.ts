/**
 * Webhooks API — Architecture §3.6
 * Allows fintech partners to register webhook endpoints.
 */
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as webhookService from '../services/webhookService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  url:    z.string().url(),
  events: z.array(z.string().min(1)).min(1, 'At least one event is required'),
});

// ─── GET /v1/webhooks ────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const webhooks = await webhookService.getUserWebhooks(req.user!.userId);
    res.json({ webhooks });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/webhooks ───────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { url, events } = RegisterSchema.parse(req.body);
    const webhook = await webhookService.registerWebhook(req.user!.userId, url, events);
    res.status(201).json(webhook);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /v1/webhooks/:webhook_id ────────────────────────────────────────

router.delete('/:webhook_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await webhookService.deleteWebhook(req.params.webhook_id, req.user!.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
