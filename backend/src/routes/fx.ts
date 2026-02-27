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

// ─── GET /v1/fx/liquidity-providers ─────────────────────────────────────────
// Architecture §3.2 — expose the available liquidity providers used for routing

router.get('/liquidity-providers', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const providers = await fxService.getAvailableLiquidityProviders();
    res.json({ providers });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/fx/best-route/:from/:to  ────────────────────────────────────────
// Architecture §3.2 — returns the optimal liquidity provider for a currency pair

router.get('/best-route/:from/:to', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const route = await fxService.selectOptimalLiquidityRoute(
      req.params.from as Currency,
      req.params.to   as Currency
    );
    if (!route) {
      // Fall back to system FX rate if no provider has this pair
      const rate = await fxService.getRate(req.params.from as Currency, req.params.to as Currency);
      res.json({ provider: 'WGI', rate: parseFloat(rate.rate), source: 'system_fx_table' });
    } else {
      res.json({ provider: route.provider_name, provider_id: route.provider_id, rate: route.rate, source: 'liquidity_provider' });
    }
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/fx/hedge-quote ──────────────────────────────────────────────────
// BRD BR-009 — hedge exposure for large settlements using algorithmic routing
// Returns the optimal hedge strategy (split across liquidity providers) for
// large conversions to minimise slippage and FX risk.

const HEDGE_THRESHOLD_USD = 10000; // conversions above this amount get multi-route hedging

router.post('/hedge-quote', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, from_currency, to_currency } = z.object({
      amount:        z.number().positive(),
      from_currency: z.string().length(3),
      to_currency:   z.string().length(3),
    }).parse(req.body);

    const rate = await fxService.getRate(from_currency as Currency, to_currency as Currency);
    const rateNum = parseFloat(rate.rate);

    // For large settlements, attempt multi-route split to reduce slippage
    if (amount >= HEDGE_THRESHOLD_USD) {
      const providers = await fxService.getAvailableLiquidityProviders();
      const routes = providers
        .map((p) => {
          const rates = p.rates as Record<string, number>;
          const pairRate = rates[`${from_currency}_${to_currency}`];
          return pairRate ? { provider_id: p.provider_id, name: p.name, rate: pairRate } : null;
        })
        .filter((r): r is { provider_id: string; name: string; rate: number } => r !== null)
        .sort((a, b) => b.rate - a.rate);

      if (routes.length >= 2) {
        // Split 60/40 across best two routes to hedge slippage
        const split = [
          { ...routes[0], allocation_pct: 60, allocated_amount: amount * 0.6, converted: amount * 0.6 * routes[0].rate },
          { ...routes[1], allocation_pct: 40, allocated_amount: amount * 0.4, converted: amount * 0.4 * routes[1].rate },
        ];
        const blended_rate = split.reduce((acc, r) => acc + r.rate * (r.allocation_pct / 100), 0);
        const total_converted = split.reduce((acc, r) => acc + r.converted, 0);
        // Savings = multi-route output (target currency) minus what the system spot rate would yield
        const spot_converted = amount * rateNum;
        return res.json({
          strategy: 'multi_route_hedge',
          from_currency,
          to_currency,
          amount,
          hedge_threshold_usd: HEDGE_THRESHOLD_USD,
          blended_rate,
          total_converted,
          spot_converted,
          routes: split,
          estimated_savings_vs_spot: parseFloat((total_converted - spot_converted).toFixed(4)),
          generated_at: new Date().toISOString(),
        });
      }
    }

    // Below threshold or insufficient providers: single-route spot quote
    res.json({
      strategy: 'spot',
      from_currency,
      to_currency,
      amount,
      hedge_threshold_usd: HEDGE_THRESHOLD_USD,
      blended_rate: rateNum,
      total_converted: amount * rateNum,
      routes: [{ name: 'WGI System Rate', rate: rateNum, allocation_pct: 100, allocated_amount: amount, converted: amount * rateNum }],
      estimated_savings_vs_spot: 0,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
