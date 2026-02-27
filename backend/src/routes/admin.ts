import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { User, Transaction } from '../models/types';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

// ─── GET /v1/admin/stats ─────────────────────────────────────────────────────

router.get('/stats', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      usersRes, txRes, walletRes, alertRes, pendingKycRes,
      volByCurrencyRes, segmentRes,
      // Proposal §10 Key Metrics
      settlementSpeedRes, bankRes, apiPartnerRes, creditDataRes,
    ] = await Promise.all([
      pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM users'),
      pool.query<{ count: string; total_volume: string }>(
        `SELECT COUNT(*) AS count,
                COALESCE(SUM(amount), 0) AS total_volume
         FROM transactions
         WHERE status = 'completed'`
      ),
      pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM wallets'),
      pool.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM aml_alerts WHERE status = 'pending'"
      ),
      pool.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM users WHERE kyc_status = 'pending'"
      ),
      pool.query<{ currency: string; total: string }>(
        `SELECT currency, COALESCE(SUM(amount), 0) AS total
         FROM transactions
         WHERE status = 'completed'
         GROUP BY currency`
      ),
      // Vision Executive Document §5 — user segments for Phase 1 KPIs
      pool.query<{ account_type: string; count: string }>(
        `SELECT COALESCE(account_type, 'individual') AS account_type, COUNT(*) AS count
         FROM users
         GROUP BY account_type
         ORDER BY count DESC`
      ),
      // Proposal §10: Settlement speed — avg minutes from created to completed
      pool.query<{ avg_minutes: string }>(
        `SELECT COALESCE(
           ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 1),
           0
         ) AS avg_minutes
         FROM settlements
         WHERE status = 'completed'`
      ),
      // Proposal §10: Multi-bank API uptime & reliability
      pool.query<{ total: string; active: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'active') AS active
         FROM banks`
      ),
      // Proposal §10: Platform integration with fintech partners
      pool.query<{ api_keys: string; webhooks: string }>(
        `SELECT
           (SELECT COUNT(*) FROM api_keys  WHERE status = 'active') AS api_keys,
           (SELECT COUNT(*) FROM webhooks  WHERE status = 'active') AS webhooks`
      ),
      // Proposal §10: Early data for credit intelligence engine
      pool.query<{ count: string }>(
        'SELECT COUNT(DISTINCT user_id) AS count FROM credit_scores'
      ),
    ]);

    const total_volume_by_currency: Record<string, number> = {};
    for (const row of volByCurrencyRes.rows) {
      total_volume_by_currency[row.currency] = parseFloat(row.total);
    }

    const users_by_segment: Record<string, number> = {};
    for (const row of segmentRes.rows) {
      users_by_segment[row.account_type] = parseInt(row.count, 10);
    }

    res.json({
      total_users:          parseInt(usersRes.rows[0].count, 10),
      total_transactions:   parseInt(txRes.rows[0].count, 10),
      total_volume_all_currencies: parseFloat(txRes.rows[0].total_volume),
      total_volume_by_currency,
      total_wallets:        parseInt(walletRes.rows[0].count, 10),
      pending_aml_alerts:   parseInt(alertRes.rows[0].count, 10),
      pending_kyc:          parseInt(pendingKycRes.rows[0].count, 10),
      // Phase 1 Vision KPIs: segment breakdown
      users_by_segment,
      // Proposal §10 Key Metrics
      key_metrics: {
        avg_settlement_minutes:   parseFloat(settlementSpeedRes.rows[0]?.avg_minutes ?? '0'),
        total_banks:              parseInt(bankRes.rows[0]?.total ?? '0', 10),
        active_banks:             parseInt(bankRes.rows[0]?.active ?? '0', 10),
        active_api_keys:          parseInt(apiPartnerRes.rows[0]?.api_keys ?? '0', 10),
        active_webhooks:          parseInt(apiPartnerRes.rows[0]?.webhooks ?? '0', 10),
        credit_intelligence_users: parseInt(creditDataRes.rows[0]?.count ?? '0', 10),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/admin/users ─────────────────────────────────────────────────────

router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { rows } = await pool.query<User>(
      `SELECT user_id, full_name, email, phone_number, kyc_status, role, created_at, updated_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: countRows } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM users'
    );

    res.json({
      users: rows,
      total: parseInt(countRows[0].count, 10),
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/admin/transactions ──────────────────────────────────────────────

router.get('/transactions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { rows } = await pool.query<Transaction>(
      `SELECT * FROM transactions
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: countRows } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM transactions'
    );

    res.json({
      transactions: rows,
      total: parseInt(countRows[0].count, 10),
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/admin/compliance ────────────────────────────────────────────────

router.get('/compliance', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [kycRes, amlRes, verifiedRes, pendingKycRes, pendingDocsRes] = await Promise.all([
      pool.query<{ count: string; kyc_status: string }>(
        `SELECT kyc_status, COUNT(*) AS count
         FROM users
         GROUP BY kyc_status`
      ),
      pool.query<{ count: string; severity: string }>(
        `SELECT severity, COUNT(*) AS count
         FROM aml_alerts
         WHERE status = 'pending'
         GROUP BY severity`
      ),
      pool.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM kyc_documents WHERE status = 'verified'"
      ),
      pool.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM kyc_documents WHERE status = 'pending'"
      ),
      pool.query(
        `SELECT kd.kyc_document_id, kd.user_id, u.full_name, u.email,
                kd.doc_type, kd.file_url, kd.status, kd.verified_at
         FROM kyc_documents kd
         JOIN users u ON kd.user_id = u.user_id
         WHERE kd.status = 'pending'
         ORDER BY kd.kyc_document_id ASC
         LIMIT 20`
      ),
    ]);

    const kycBreakdown: Record<string, number> = {};
    for (const row of kycRes.rows) {
      kycBreakdown[row.kyc_status] = parseInt(row.count, 10);
    }

    const amlBreakdown: Record<string, number> = {};
    for (const row of amlRes.rows) {
      amlBreakdown[row.severity] = parseInt(row.count, 10);
    }

    res.json({
      kyc: {
        breakdown:        kycBreakdown,
        verified_docs:    parseInt(verifiedRes.rows[0].count, 10),
        pending_docs:     parseInt(pendingKycRes.rows[0].count, 10),
        pending_documents: pendingDocsRes.rows,
      },
      aml: {
        pending_alerts_by_severity: amlBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/admin/reports ───────────────────────────────────────────────────

router.get('/reports', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit  = parseInt(req.query.limit  as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const { rows } = await pool.query(
      `SELECT * FROM regulatory_reports
       ORDER BY generated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: countRows } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM regulatory_reports'
    );

    res.json({
      reports: rows,
      total: parseInt(countRows[0].count, 10),
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/admin/reports ──────────────────────────────────────────────────

const CreateReportSchema = z.object({
  period:  z.string().min(1),
  type:    z.string().min(1),
  content: z.record(z.unknown()).optional(),
});

router.post('/reports', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { period, type, content } = CreateReportSchema.parse(req.body);

    const { rows } = await pool.query(
      `INSERT INTO regulatory_reports (period, type, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [period, type, JSON.stringify(content ?? {})]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/admin/fx-analytics ──────────────────────────────────────────────
// Proposal §9 Admin & Analytics Dashboards: "FX reports, compliance monitoring"
// Proposal §10 Key Metrics: "Settlement speed & FX savings"

router.get('/fx-analytics', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const FX_BENCHMARK_SPREAD = 0.03; // 3% — conservative PayPal/bank benchmark (Proposal §7)

    const [volumeRes, pairRes, providerRes, subscriptionRes] = await Promise.all([
      // Total FX volume and fee collected
      pool.query<{ total_converted: string; total_fee: string; count: string }>(
        `SELECT COALESCE(SUM(amount_from), 0) AS total_converted,
                COALESCE(SUM(fee), 0) AS total_fee,
                COUNT(*) AS count
         FROM fx_transactions`
      ),
      // Volume by currency pair
      pool.query<{ currency_from: string; currency_to: string; volume: string; avg_rate: string; count: string }>(
        `SELECT currency_from, currency_to,
                COALESCE(SUM(amount_from), 0) AS volume,
                ROUND(AVG(amount_to::DECIMAL / amount_from::DECIMAL), 6) AS avg_rate,
                COUNT(*) AS count
         FROM fx_transactions
         WHERE amount_from::DECIMAL > 0
         GROUP BY currency_from, currency_to
         ORDER BY volume DESC`
      ),
      // Top liquidity providers by usage
      pool.query<{ provider: string; count: string; volume: string }>(
        `SELECT COALESCE(route, 'unknown') AS provider,
                COUNT(*) AS count,
                COALESCE(SUM(amount_from), 0) AS volume
         FROM fx_transactions
         GROUP BY route
         ORDER BY volume DESC
         LIMIT 10`
      ),
      // Subscription revenue breakdown (Proposal §7 Revenue Stream 3)
      pool.query<{ plan_name: string; active_count: string; monthly_revenue: string }>(
        `SELECT sp.name AS plan_name,
                COUNT(us.subscription_id) FILTER (WHERE us.status = 'active') AS active_count,
                COALESCE(SUM(sp.price_usd) FILTER (WHERE us.status = 'active'), 0) AS monthly_revenue
         FROM subscription_plans sp
         LEFT JOIN user_subscriptions us ON sp.plan_id = us.plan_id
         GROUP BY sp.plan_id, sp.name, sp.price_usd
         ORDER BY sp.price_usd ASC`
      ),
    ]);

    const totalConverted  = parseFloat(volumeRes.rows[0]?.total_converted ?? '0');
    const totalFee        = parseFloat(volumeRes.rows[0]?.total_fee ?? '0');
    const wgiFeeRate      = 0.005; // 0.5% — Proposal §7
    const benchmarkFeeEst = totalConverted * FX_BENCHMARK_SPREAD;
    const estimatedSavings = Math.max(0, benchmarkFeeEst - totalFee);

    const pairBreakdown = pairRes.rows.map((r) => ({
      pair:      `${r.currency_from}/${r.currency_to}`,
      volume:    parseFloat(r.volume),
      avg_rate:  parseFloat(r.avg_rate ?? '0'),
      count:     parseInt(r.count, 10),
    }));

    const subscriptionRevenue = subscriptionRes.rows.map((r) => ({
      plan:            r.plan_name,
      active_count:    parseInt(r.active_count, 10),
      monthly_revenue: parseFloat(r.monthly_revenue),
    }));

    res.json({
      fx_volume: {
        total_converted_usd:    totalConverted,
        total_fee_collected:    totalFee,
        total_conversions:      parseInt(volumeRes.rows[0]?.count ?? '0', 10),
        wgi_fee_rate_pct:       wgiFeeRate * 100,
        benchmark_fee_rate_pct: FX_BENCHMARK_SPREAD * 100,
        estimated_user_savings: parseFloat(estimatedSavings.toFixed(2)),
      },
      volume_by_pair:        pairBreakdown,
      liquidity_providers:   providerRes.rows.map((r) => ({
        provider: r.provider,
        count:    parseInt(r.count, 10),
        volume:   parseFloat(r.volume),
      })),
      subscription_revenue:  subscriptionRevenue,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
