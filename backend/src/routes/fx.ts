import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as fxService from '../services/fxService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Currency } from '../models/types';

const router = Router();

router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ConvertSchema = z.object({
  // Spec field names
  wallet_id:     z.string().uuid().optional(),
  currency_from: z.enum(['USD','EUR','GBP','KES']).optional(),
  currency_to:   z.enum(['USD','EUR','GBP','KES']).optional(),
  // Legacy field names (kept for backward compatibility)
  source_wallet_id: z.string().uuid().optional(),
  target_wallet_id: z.string().uuid().optional(),
  from_currency:    z.enum(['USD','EUR','GBP','KES']).optional(),
  to_currency:      z.enum(['USD','EUR','GBP','KES']).optional(),
  amount:           z.number().positive(),
}).transform((data) => ({
  source_wallet_id: (data.wallet_id ?? data.source_wallet_id)!,
  target_wallet_id: data.target_wallet_id,
  from_currency:    (data.currency_from ?? data.from_currency)!,
  to_currency:      (data.currency_to   ?? data.to_currency)!,
  amount:           data.amount,
})).superRefine((data, ctx) => {
  if (!data.source_wallet_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'wallet_id (or source_wallet_id) is required', path: ['wallet_id'] });
  }
  if (!data.from_currency) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'currency_from (or from_currency) is required', path: ['currency_from'] });
  }
  if (!data.to_currency) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'currency_to (or to_currency) is required', path: ['currency_to'] });
  }
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
      source_wallet_id: body.source_wallet_id,
      target_wallet_id: body.target_wallet_id,
      amount:           body.amount,
      from_currency:    body.from_currency,
      to_currency:      body.to_currency,
      user_id:          req.user!.userId,
    });
    const fx = result.fx_transaction;
    res.status(201).json({
      transaction_id: fx.transaction_id,
      wallet_id:      body.source_wallet_id,
      amount_from:    result.amount_from,
      amount_to:      result.amount_to,
      currency_from:  fx.currency_from,
      currency_to:    fx.currency_to,
      fx_rate:        result.rate,
      fee:            result.fee,
      status:         'completed',
      timestamp:      new Date(fx.timestamp).toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
