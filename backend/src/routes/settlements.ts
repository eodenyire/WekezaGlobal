import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as settlementService from '../services/settlementService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const InitiateSchema = z.object({
  wallet_id: z.string().uuid(),
  bank_id:   z.string().uuid(),
  amount:    z.number().positive(),
  currency:  z.string().optional(),   // informational; wallet currency is authoritative
});

const AutoSettleSchema = z.object({
  wallet_id: z.string().uuid(),
  amount:    z.number().positive(),
  country:   z.string().regex(/^[A-Z]{2,3}$/, 'country must be a 2- or 3-letter uppercase ISO 3166-1 code (e.g. KE, NGN)'),
});

// ─── GET /v1/settlements  (current user's settlements) ───────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settlements = await settlementService.getUserSettlements(req.user!.userId);
    res.json({ settlements });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/settlements/wallet/:wallet_id  (before /:settlement_id) ─────────

router.get('/wallet/:wallet_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settlements = await settlementService.getWalletSettlements(req.params.wallet_id);
    res.json({ settlements });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/settlements ────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = InitiateSchema.parse(req.body);
    const settlement = await settlementService.initiateSettlement(
      body.wallet_id,
      body.bank_id,
      body.amount
    );
    res.status(201).json({
      ...settlement,
      timestamp: new Date(settlement.created_at).toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/settlements/:settlement_id ──────────────────────────────────────

router.get('/:settlement_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settlement = await settlementService.getSettlement(req.params.settlement_id);
    res.json({
      ...settlement,
      settled_at: settlement.status === 'completed'
        ? new Date(settlement.updated_at).toISOString()
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/settlements/auto ───────────────────────────────────────────────
// Architecture §3.3 — auto-selects the optimal bank for the given country

router.post('/auto', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = AutoSettleSchema.parse(req.body);
    const bank = await settlementService.selectOptimalBank(body.country);
    if (!bank) {
      res.status(422).json({ error: 'NoBank', message: `No active bank found for country: ${body.country}` });
      return;
    }
    const settlement = await settlementService.initiateSettlement(
      body.wallet_id,
      bank.bank_id,
      body.amount
    );
    res.status(201).json({
      ...settlement,
      bank_name:    bank.name,
      bank_country: bank.country,
      timestamp:    new Date(settlement.created_at).toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/settlements/:settlement_id/retry ───────────────────────────────
// Architecture §8 — fault tolerance: retry a failed settlement

router.post('/:settlement_id/retry', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settlement = await settlementService.retrySettlement(req.params.settlement_id);
    res.json(settlement);
  } catch (err) {
    next(err);
  }
});

export default router;
