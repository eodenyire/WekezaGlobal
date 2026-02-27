/**
 * Subscriptions API — Proposal §7 Revenue Stream 3
 * "Subscription Services — premium wallets, card issuance, analytics"
 *
 * Routes:
 *   GET  /v1/subscriptions/plans       — list available plans (public after auth)
 *   GET  /v1/subscriptions/my          — current user's active subscription
 *   POST /v1/subscriptions             — subscribe to a plan
 *   PUT  /v1/subscriptions/:id/cancel  — cancel subscription
 */
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { SubscriptionPlan, UserSubscription } from '../models/types';
import { createError } from '../middleware/errorHandler';

const router = Router();

router.use(authenticate);

// ─── GET /v1/subscriptions/plans ────────────────────────────────────────────

router.get('/plans', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query<SubscriptionPlan>(
      `SELECT * FROM subscription_plans
       WHERE is_active = TRUE
       ORDER BY price_usd ASC`
    );
    res.json({ plans: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/subscriptions/my ───────────────────────────────────────────────

router.get('/my', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query<UserSubscription & { plan_name: string; display_name: string; price_usd: string; features: string[] }>(
      `SELECT us.*, sp.name AS plan_name, sp.display_name, sp.price_usd, sp.features
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.plan_id
       WHERE us.user_id = $1
         AND us.status = 'active'
       ORDER BY us.created_at DESC
       LIMIT 1`,
      [req.user!.userId]
    );

    if (rows.length === 0) {
      // Return the standard (free) plan as default
      const { rows: defaultPlan } = await pool.query<SubscriptionPlan>(
        "SELECT * FROM subscription_plans WHERE name = 'standard' LIMIT 1"
      );
      return res.json({
        subscription: null,
        effective_plan: defaultPlan[0] ?? null,
      });
    }

    return res.json({
      subscription: rows[0],
      effective_plan: {
        plan_id:      rows[0].plan_id,
        name:         rows[0].plan_name,
        display_name: rows[0].display_name,
        price_usd:    rows[0].price_usd,
        features:     rows[0].features,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/subscriptions ─────────────────────────────────────────────────

const CreateSubscriptionSchema = z.object({
  plan_id: z.string().uuid(),
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { plan_id } = CreateSubscriptionSchema.parse(req.body);

    // Verify plan exists and is active
    const { rows: planRows } = await pool.query<SubscriptionPlan>(
      'SELECT * FROM subscription_plans WHERE plan_id = $1 AND is_active = TRUE',
      [plan_id]
    );
    if (planRows.length === 0) throw createError('Subscription plan not found', 404);

    // Cancel any existing active subscription
    await pool.query(
      `UPDATE user_subscriptions
          SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND status = 'active'`,
      [req.user!.userId]
    );

    // Calculate expiry (monthly billing: 30 days)
    const plan = planRows[0];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { rows } = await pool.query<UserSubscription>(
      `INSERT INTO user_subscriptions (user_id, plan_id, status, expires_at)
       VALUES ($1, $2, 'active', $3)
       RETURNING *`,
      [req.user!.userId, plan_id, plan.price_usd === '0.00' ? null : expiresAt]
    );

    res.status(201).json({ subscription: rows[0], plan });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /v1/subscriptions/:subscription_id/cancel ──────────────────────────

router.put('/:subscription_id/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query<UserSubscription>(
      `UPDATE user_subscriptions
          SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
        WHERE subscription_id = $1
          AND user_id = $2
          AND status = 'active'
        RETURNING *`,
      [req.params.subscription_id, req.user!.userId]
    );
    if (rows.length === 0) throw createError('Active subscription not found', 404);
    res.json({ subscription: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/subscriptions  (admin: list all) ────────────────────────────────

router.get('/', requireRole('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { rows } = await pool.query(
      `SELECT us.*, sp.name AS plan_name, sp.display_name, sp.price_usd,
              u.full_name, u.email
         FROM user_subscriptions us
         JOIN subscription_plans sp ON us.plan_id = sp.plan_id
         JOIN users u ON us.user_id = u.user_id
        ORDER BY us.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const { rows: countRows } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM user_subscriptions'
    );
    res.json({ subscriptions: rows, total: parseInt(countRows[0].count, 10), limit, offset });
  } catch (err) {
    next(err);
  }
});

export default router;
