import { Router, Response, NextFunction } from 'express';
import * as settlementService from '../services/settlementService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── GET /v1/banks ───────────────────────────────────────────────────────────

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const banks = await settlementService.getAllBanks();
    res.json({ banks });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/banks/:bank_id ──────────────────────────────────────────────────

router.get('/:bank_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bank = await settlementService.getBankById(req.params.bank_id);
    res.json(bank);
  } catch (err) {
    next(err);
  }
});

export default router;
