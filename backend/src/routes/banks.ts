import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as settlementService from '../services/settlementService';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateBankSchema = z.object({
  name:             z.string().min(1),
  country:          z.string().regex(/^[A-Z]{2,3}$/, 'country must be a 2- or 3-letter ISO 3166-1 code'),
  api_endpoint:     z.string().url().optional(),
  settlement_rules: z.record(z.unknown()).optional(),
});

const UpdateBankSchema = z.object({
  name:             z.string().min(1).optional(),
  country:          z.string().regex(/^[A-Z]{2,3}$/, 'country must be a 2- or 3-letter ISO 3166-1 code').optional(),
  api_endpoint:     z.string().url().nullable().optional(),
  status:           z.enum(['active','inactive']).optional(),
  settlement_rules: z.record(z.unknown()).optional(),
});

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

// ─── POST /v1/banks  (admin only — SDS §2.3 multi-bank integration) ──────────

router.post(
  '/',
  requireRole('admin', 'operations'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = CreateBankSchema.parse(req.body);
      const bank = await settlementService.createBank(body);
      res.status(201).json(bank);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /v1/banks/:bank_id  (admin only) ────────────────────────────────────

router.put(
  '/:bank_id',
  requireRole('admin', 'operations'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = UpdateBankSchema.parse(req.body);
      const bank = await settlementService.updateBank(req.params.bank_id, body);
      res.json(bank);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
