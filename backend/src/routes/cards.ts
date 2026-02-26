import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as cardService from '../services/cardService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { CardStatus } from '../models/types';

const router = Router();

router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateCardSchema = z.object({
  wallet_id:     z.string().uuid(),
  card_type:     z.enum(['virtual','physical']),
  spending_limit: z.number().positive().optional(),
});

const UpdateStatusSchema = z.object({
  status: z.enum(['active','blocked','expired']),
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
    res.status(201).json(card);
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

export default router;
