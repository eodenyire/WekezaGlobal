/**
 * Collection Accounts Routes — BRD §4.4
 * BR-010: Global receiving accounts for freelancers, SMEs, exporters
 * BR-011: ACH, SWIFT, SEPA protocol support
 * BR-012: Inbound payment credited to wallet in near-real-time
 */
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as collectionAccountService from '../services/collectionAccountService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  wallet_id: z.string().uuid(),
  rail:      z.enum(['ACH', 'SWIFT', 'SEPA']),
  label:     z.string().optional(),
});

const ReceiveSchema = z.object({
  amount:   z.number().positive(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── GET /v1/collection-accounts ─────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const accounts = await collectionAccountService.getUserCollectionAccounts(req.user!.userId);
    res.json({ collection_accounts: accounts });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/collection-accounts ────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = CreateSchema.parse(req.body);
    const account = await collectionAccountService.createCollectionAccount({
      user_id:   req.user!.userId,
      wallet_id: body.wallet_id,
      rail:      body.rail,
      label:     body.label,
    });
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/collection-accounts/:id ─────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const account = await collectionAccountService.getCollectionAccount(req.params.id);
    res.json(account);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /v1/collection-accounts/:id ──────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const account = await collectionAccountService.closeCollectionAccount(
      req.params.id,
      req.user!.userId
    );
    res.json(account);
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/collection-accounts/:id/receive ────────────────────────────────
// Simulates an inbound payment arriving on this collection account (BR-012).
// In production this would be triggered by a bank webhook.

router.post('/:id/receive', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, metadata } = ReceiveSchema.parse(req.body);
    const result = await collectionAccountService.receivePayment(req.params.id, amount, metadata);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
