import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as fxService from '../services/fxService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Currency } from '../models/types';

const router = Router();

router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ConvertSchema = z.object({
  source_wallet_id: z.string().uuid(),
  target_wallet_id: z.string().uuid().optional(),
  amount:           z.number().positive(),
  from_currency:    z.enum(['USD','EUR','GBP','KES']),
  to_currency:      z.enum(['USD','EUR','GBP','KES']),
});

// ─── GET /v1/fx/rates ────────────────────────────────────────────────────────

router.get('/rates', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rates = await fxService.getAllRates();
    res.json({ rates });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/fx/rates/:from/:to ──────────────────────────────────────────────

router.get('/rates/:from/:to', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rate = await fxService.getRate(
      req.params.from as Currency,
      req.params.to as Currency
    );
    res.json(rate);
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/fx/convert ─────────────────────────────────────────────────────

router.post('/convert', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = ConvertSchema.parse(req.body);
    const result = await fxService.convert({
      ...body,
      user_id: req.user!.userId,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
