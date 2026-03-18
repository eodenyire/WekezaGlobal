/**
 * Developer Portal API — /v1/developer
 *
 * Routes exposing analytics, event history, and changelog to authenticated
 * developers.  This is the programmatic backbone of the WekezaGlobal
 * Developer Portal (developer.wekezabank.com).
 *
 * Routes:
 *   GET /v1/developer/analytics   — per-key usage stats, webhook counts, events
 *   GET /v1/developer/events      — recent banking event stream for this developer
 *   GET /v1/developer/changelog   — API version history / release notes
 *
 * Mounted at: /v1/developer
 */

import { Router, Response, NextFunction } from 'express';
import { pool, redis } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── GET /v1/developer/analytics ─────────────────────────────────────────────
/**
 * Returns aggregate API-usage analytics for the authenticated developer:
 *  - all API keys with their rolling 1-hour request counts (from Redis)
 *  - webhook registration summary
 *  - event dispatch summary
 */
router.get('/analytics', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // All API keys for this developer
    const { rows: keys } = await pool.query<{
      api_key_id: string;
      name: string | null;
      status: string;
      created_at: Date;
    }>(
      `SELECT api_key_id, name, status, created_at
         FROM api_keys
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );

    // Gather per-key usage from Redis (Schema §2: per-API-key usage count)
    const keyUsage: Array<{
      api_key_id: string;
      name: string | null;
      status: string;
      usage_count: number;
      created_at: Date;
    }> = [];

    for (const key of keys) {
      let usage_count = 0;
      try {
        if (redis.status === 'ready') {
          const val = await redis.get(`api_key:${key.api_key_id}:usage`);
          usage_count = val ? parseInt(val, 10) : 0;
        }
      } catch {
        // Non-fatal — Redis unavailability must not block the response
      }
      keyUsage.push({ ...key, usage_count });
    }

    // Webhook stats
    const { rows: webhookStats } = await pool.query<{
      total: string;
      active: string;
    }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'active') AS active
         FROM webhooks
        WHERE user_id = $1`,
      [userId]
    );

    // Event dispatch stats (sourced from notification log — type = webhook_dispatch)
    const { rows: eventStats } = await pool.query<{
      total_events: string;
      events_today: string;
    }>(
      `SELECT COUNT(*) AS total_events,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS events_today
         FROM notifications
        WHERE user_id = $1
          AND type = 'webhook_dispatch'`,
      [userId]
    );

    const totalRequests = keyUsage.reduce((sum, k) => sum + k.usage_count, 0);

    res.json({
      api_keys: {
        total: keys.length,
        active: keys.filter((k) => k.status === 'active').length,
        keys: keyUsage,
      },
      requests: {
        total_in_window: totalRequests,
        window: '1 hour (rolling)',
      },
      webhooks: {
        total:  parseInt(webhookStats[0]?.total  ?? '0', 10),
        active: parseInt(webhookStats[0]?.active ?? '0', 10),
      },
      events: {
        total_dispatched: parseInt(eventStats[0]?.total_events ?? '0', 10),
        dispatched_today: parseInt(eventStats[0]?.events_today ?? '0', 10),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/developer/events ─────────────────────────────────────────────────
/**
 * Returns the most recent banking events published for the authenticated
 * developer (sourced from the notifications + webhook_dispatch log).
 *
 * Query params:
 *   limit  (default 20, max 100)
 */
router.get('/events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const limit  = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const { rows } = await pool.query<{
      notification_id: string;
      type: string;
      title: string;
      message: string;
      metadata: Record<string, unknown>;
      created_at: Date;
    }>(
      `SELECT notification_id, type, title, message, metadata, created_at
         FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, limit]
    );

    res.json({
      events: rows.map((r) => ({
        event_id:  r.notification_id,
        type:      r.type,
        title:     r.title,
        message:   r.message,
        metadata:  r.metadata,
        timestamp: r.created_at,
      })),
      count: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/developer/changelog ─────────────────────────────────────────────
/**
 * Returns the WGI API changelog in reverse-chronological order.
 * Useful for developer portals and SDK release notes.
 */
router.get('/changelog', (_req: AuthRequest, res: Response) => {
  res.json({
    changelog: [
      {
        version: '1.4.0',
        date: '2026-03-12',
        type: 'feature',
        changes: [
          'Added Developer Portal analytics dashboard (/v1/developer/analytics)',
          'Added event stream history endpoint (/v1/developer/events)',
          'Added API changelog endpoint (/v1/developer/changelog)',
          'Added Partner Integration Layer (/v1/partner/*) — Payments, Risk, Identity',
          'Added interactive sandbox testing UI',
          'Added Developer Analytics page in the portal',
        ],
      },
      {
        version: '1.3.0',
        date: '2026-02-28',
        type: 'feature',
        changes: [
          'Added Core Banking proxy routes (/v1/core-banking/*) — Wekeza v1-Core integration',
          'Added API key scopes for fine-grained access control (migration 013)',
          'Added Prometheus metrics endpoint (/metrics)',
          'Fixed: OAuth2 client credentials aligned with CI environment',
        ],
      },
      {
        version: '1.2.0',
        date: '2026-02-15',
        type: 'feature',
        changes: [
          'Added subscription plans — Standard, Premium, Enterprise',
          'Added collection accounts (ACH, SWIFT, SEPA payment rails)',
          'Added audit log for compliance tracking',
          'Added MFA token support',
          'Added transaction limits per account type',
          'Added comprehensive seed data for sandbox testing',
        ],
      },
      {
        version: '1.1.0',
        date: '2026-01-30',
        type: 'feature',
        changes: [
          'Added webhook event delivery with HMAC-SHA256 signatures',
          'Added sandbox environment for safe API testing (/v1/sandbox/*)',
          'Added credit scoring service',
          'Added KYC/AML compliance pipeline',
          'Added PayPal, Stripe, Payoneer, Wise integration adapters in sandbox',
          'Added founding partner program',
        ],
      },
      {
        version: '1.0.0',
        date: '2026-01-15',
        type: 'release',
        changes: [
          'Initial WekezaGlobal Infrastructure (WGI) release',
          'Multi-currency wallet management (USD, EUR, GBP, KES)',
          'FX exchange with live rates and 0.5% fee',
          'Bank settlement engine with SWIFT/SEPA/ACH rails',
          'Card management — virtual and physical cards',
          'JWT authentication and API key management',
          'OAuth2 client credentials flow for server-to-server integrations',
          'Rate limiting (Redis-backed, per-API-key)',
        ],
      },
    ],
  });
});

export default router;
