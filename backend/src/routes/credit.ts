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

export default router;
