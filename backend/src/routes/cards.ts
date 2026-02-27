import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as cardService from '../services/cardService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { CardStatus, Currency } from '../models/types';

const router = Router();

router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateCardSchema = z.object({
  wallet_id:      z.string().uuid(),
  // Spec field names
  type:           z.enum(['virtual','physical']).optional(),
  limit:          z.number().positive().optional(),
  // Legacy field names
  card_type:      z.enum(['virtual','physical']).optional(),
  spending_limit: z.number().positive().optional(),
}).superRefine((data, ctx) => {
  if (!data.type && !data.card_type) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'type (or card_type) is required', path: ['type'] });
  }
}).transform((data) => ({
  wallet_id:      data.wallet_id,
  card_type:      (data.type ?? data.card_type) as 'virtual' | 'physical',
  spending_limit: data.limit ?? data.spending_limit,
})) as z.ZodType<{ wallet_id: string; card_type: 'virtual' | 'physical'; spending_limit?: number }>;

const UpdateStatusSchema = z.object({
  status: z.enum(['active','blocked','expired']),
});

const ChargeSchema = z.object({
  amount:   z.number().positive(),
  currency: z.enum(['USD','EUR','GBP','KES']),
  merchant: z.string().min(1),
});


router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cards = await cardService.getUserCards(req.user!.userId);
    res.json({ cards });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/cards ──────────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = CreateCardSchema.parse(req.body);
    const card = await cardService.createCard(
      body.wallet_id,
      body.card_type,
      body.spending_limit
    );
    res.status(201).json({
      ...card,
      // Spec-compliant aliases
      type:  card.card_type,
      limit: parseFloat(card.spending_limit),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/cards/:card_id ──────────────────────────────────────────────────

router.get('/:card_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const card = await cardService.getCard(req.params.card_id);
    res.json(card);
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/cards/:card_id/transactions ────────────────────────────────────

router.get('/:card_id/transactions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const transactions = await cardService.getCardTransactions(
      req.params.card_id,
      limit,
      offset
    );
    res.json({ transactions, limit, offset });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /v1/cards/:card_id/status ───────────────────────────────────────────

router.put('/:card_id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = UpdateStatusSchema.parse(req.body);
    const card = await cardService.updateCardStatus(req.params.card_id, status as CardStatus);
    res.json(card);
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/cards/:card_id/charge ─────────────────────────────────────────
// SDS §2.4 — Card spend monitoring: enforces spending limit, debits wallet,
// and auto-generates an AML alert for high-spend transactions.

router.post('/:card_id/charge', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = ChargeSchema.parse(req.body);
    const tx = await cardService.chargeCard(
      req.params.card_id,
      body.amount,
      body.currency as Currency,
      body.merchant
    );
    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

export default router;
