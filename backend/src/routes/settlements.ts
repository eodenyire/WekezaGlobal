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

export default router;
