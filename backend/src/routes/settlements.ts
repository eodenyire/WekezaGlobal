import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as settlementService from '../services/settlementService';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { pool } from '../database';
import { config } from '../config';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const InitiateSchema = z.object({
  wallet_id: z.string().uuid(),
  bank_id:   z.string().uuid(),
  amount:    z.number().positive(),
  currency:  z.string().optional(),   // informational; wallet currency is authoritative
  idempotency_key: z.string().min(8).max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const AutoSettleSchema = z.object({
  wallet_id: z.string().uuid(),
  amount:    z.number().positive(),
  country:   z.string().regex(/^[A-Z]{2,3}$/, 'country must be a 2- or 3-letter uppercase ISO 3166-1 code (e.g. KE, NGN)'),
});

const WebhookSchema = z.object({
  settlement_id: z.string().uuid().optional(),
  provider_reference: z.string().min(4).max(128).optional(),
  status: z.enum(['pending', 'completed', 'failed']),
  failure_reason: z.string().max(500).optional(),
});

const ReconciliationQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// ─── POST /v1/settlements/webhooks/banks/:bank_id ──────────────────────────

router.post('/webhooks/banks/:bank_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sharedSecret = req.headers['x-settlement-webhook-secret'];
    if (typeof sharedSecret !== 'string' || sharedSecret !== config.settlementWebhookSecret) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid webhook secret' });
      return;
    }

    const body = WebhookSchema.parse(req.body);
    const settlement = await settlementService.finalizeSettlementFromWebhook(
      req.params.bank_id,
      body
    );
    res.json(settlement);
  } catch (err) {
    next(err);
  }
});

router.use(authenticate);

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

// ─── GET /v1/settlements/reconciliation (admin summary) — BRD BR-015 ─────────
// Must be before /:settlement_id to avoid being swallowed by the param route

router.get(
  '/reconciliation',
  requireRole('admin', 'compliance'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const limit  = parseInt(req.query.limit  as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const result = req.query.result as string | undefined;

      const conditions: string[] = [];
      const params: unknown[] = [];
      if (result) {
        params.push(result);
        conditions.push(`rl.result = $${params.length}`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit, offset);

      const { rows } = await pool.query(
        `SELECT rl.log_id, rl.settlement_id, rl.result, rl.notes, rl.created_at,
                s.amount, s.currency, s.status AS settlement_status
         FROM reconciliation_logs rl
         JOIN settlements s ON rl.settlement_id = s.settlement_id
         ${where}
         ORDER BY rl.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) AS count FROM reconciliation_logs rl ${where}`,
        conditions.length ? params.slice(0, -2) : []
      );

      res.json({
        reconciliation_logs: rows,
        total: parseInt(countRows[0].count, 10),
        limit,
        offset,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /v1/settlements ────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = InitiateSchema.parse(req.body);
    const settlement = await settlementService.initiateSettlement(
      body.wallet_id,
      body.bank_id,
      body.amount,
      {
        idempotencyKey: body.idempotency_key,
        metadata: body.metadata,
      }
    );
    res.status(201).json({
      ...settlement,
      timestamp: new Date(settlement.created_at).toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/settlements/reconciliation/daily ───────────────────────────────

router.get(
  '/reconciliation/daily',
  requireRole('admin', 'operations', 'compliance'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = ReconciliationQuerySchema.parse(req.query);
      const date = parsed.date || new Date().toISOString().slice(0, 10);
      const snapshot = await settlementService.getDailySettlementReconciliation(date);
      res.json(snapshot);
    } catch (err) {
      next(err);
    }
  }
);

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

// ─── GET /v1/settlements/:settlement_id/reconciliation ───────────────────────
// BRD BR-015 — settlement reporting for compliance and reconciliation

router.get('/:settlement_id/reconciliation', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT log_id, settlement_id, result, notes, created_at
       FROM reconciliation_logs
       WHERE settlement_id = $1
       ORDER BY created_at DESC`,
      [req.params.settlement_id]
    );
    res.json({ reconciliation_logs: rows, settlement_id: req.params.settlement_id });
  } catch (err) {
    next(err);
  }
});

export default router;
