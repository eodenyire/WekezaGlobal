import { Router, Response, NextFunction } from 'express';
import * as creditService from '../services/creditService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── GET /v1/credit/:user_id ─────────────────────────────────────────────────

router.get('/:user_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const score = await creditService.getCreditScore(req.params.user_id);
    res.json(score);
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/credit/:user_id/recalculate ────────────────────────────────────

router.post('/:user_id/recalculate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const score = await creditService.recalculateCreditScore(req.params.user_id);
    res.json(score);
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/credit/:user_id/activity  (SDS §2.7 — credit intelligence logs) ─

router.get('/:user_id/activity', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const logs = await creditService.getCreditActivityLogs(req.params.user_id, limit, offset);
    res.json({ logs, limit, offset });
  } catch (err) {
    next(err);
  }
});

export default router;
