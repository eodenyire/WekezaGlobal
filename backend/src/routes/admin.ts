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

// ─── GET /v1/admin/developers ────────────────────────────────────────────────
/**
 * List all developer accounts with their profile and API key summary.
 * Query params: limit (default 100), offset (default 0), search (optional)
 */
router.get('/developers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string)?.trim() ?? '';

    const whereClause = search
      ? `WHERE (u.full_name ILIKE $3 OR u.email ILIKE $3)`
      : '';
    const searchParam = search ? `%${search}%` : undefined;
    const params: unknown[] = searchParam
      ? [limit, offset, searchParam]
      : [limit, offset];

    const { rows } = await pool.query<{
      user_id: string;
      full_name: string;
      email: string;
      phone_number: string | null;
      role: string;
      account_type: string;
      kyc_status: string;
      created_at: Date;
      updated_at: Date;
      api_key_count: string;
      active_key_count: string;
    }>(
      `SELECT u.user_id, u.full_name, u.email, u.phone_number,
              u.role, u.account_type, u.kyc_status,
              u.created_at, u.updated_at,
              COUNT(ak.api_key_id)::TEXT                                         AS api_key_count,
              COUNT(ak.api_key_id) FILTER (WHERE ak.status = 'active')::TEXT     AS active_key_count
         FROM users u
         LEFT JOIN api_keys ak ON ak.user_id = u.user_id
         ${whereClause}
         GROUP BY u.user_id
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
      params
    );

    const countParams: unknown[] = searchParam ? [searchParam] : [];
    const countWhere = search
      ? `WHERE (full_name ILIKE $1 OR email ILIKE $1)`
      : '';
    const { rows: countRows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users ${countWhere}`,
      countParams
    );

    res.json({
      developers: rows.map((r) => ({
        ...r,
        api_key_count:    parseInt(r.api_key_count, 10),
        active_key_count: parseInt(r.active_key_count, 10),
      })),
      total: parseInt(countRows[0].count, 10),
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/admin/developers ───────────────────────────────────────────────
/**
 * Create a single developer account.
 * Automatically provisions a default API key for the new developer.
 */
const CreateDeveloperSchema = z.object({
  full_name:    z.string().min(2).max(200),
  email:        z.string().email(),
  phone_number: z.string().optional(),
  password:     z.string().min(8).default('WekezaDev@2026'),
  account_type: z.enum(['freelancer', 'sme', 'exporter', 'ecommerce', 'ngo', 'startup', 'individual']).default('individual'),
  key_name:     z.string().max(100).optional(),
});

router.post('/developers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = CreateDeveloperSchema.parse(req.body);

    // Check for duplicate email
    const existing = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM users WHERE email = $1',
      [body.email]
    );
    if (parseInt(existing.rows[0].count, 10) > 0) {
      res.status(409).json({ error: 'Conflict', message: 'A user with that email already exists' });
      return;
    }

    const bcrypt = await import('bcryptjs');
    const password_hash = await bcrypt.hash(body.password, 10);

    const { rows } = await pool.query<{ user_id: string; full_name: string; email: string; role: string; kyc_status: string; account_type: string; created_at: Date }>(
      `INSERT INTO users (full_name, email, phone_number, password_hash, role, account_type)
       VALUES ($1, $2, $3, $4, 'user', $5)
       RETURNING user_id, full_name, email, role, kyc_status, account_type, created_at`,
      [body.full_name, body.email, body.phone_number ?? null, password_hash, body.account_type]
    );

    const user = rows[0];

    // Provision a default API key
    const crypto = await import('crypto');
    const rawKey = `wgi_${crypto.randomBytes(32).toString('hex')}`;
    const keyName = body.key_name ?? `${body.full_name.split(' ')[0]}'s Default Key`;

    const { rows: keyRows } = await pool.query<{ api_key_id: string; name: string; status: string; created_at: Date }>(
      `INSERT INTO api_keys (user_id, api_key, name, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING api_key_id, name, status, created_at`,
      [user.user_id, rawKey, keyName]
    );

    res.status(201).json({
      developer: user,
      api_key: { ...keyRows[0], raw_key: rawKey },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/admin/developers/bulk ──────────────────────────────────────────
/**
 * Bulk-create up to 100 developer accounts.
 * Each developer automatically receives one API key.
 * Returns per-item success/failure details.
 */
const BulkCreateDeveloperSchema = z.object({
  developers: z.array(
    z.object({
      full_name:    z.string().min(2).max(200),
      email:        z.string().email(),
      phone_number: z.string().optional(),
      account_type: z.enum(['freelancer', 'sme', 'exporter', 'ecommerce', 'ngo', 'startup', 'individual']).default('individual'),
    })
  ).min(1).max(100),
  default_password: z.string().min(8).default('WekezaDev@2026'),
});

router.post('/developers/bulk', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = BulkCreateDeveloperSchema.parse(req.body);

    const bcrypt = await import('bcryptjs');
    const crypto = await import('crypto');
    const password_hash = await bcrypt.hash(body.default_password, 10);

    const results: Array<{
      email: string;
      status: 'created' | 'skipped';
      user_id?: string;
      api_key_id?: string;
      raw_key?: string;
      reason?: string;
    }> = [];

    for (const dev of body.developers) {
      try {
        const existing = await pool.query<{ count: string }>(
          'SELECT COUNT(*) AS count FROM users WHERE email = $1',
          [dev.email]
        );
        if (parseInt(existing.rows[0].count, 10) > 0) {
          results.push({ email: dev.email, status: 'skipped', reason: 'Email already exists' });
          continue;
        }

        const { rows } = await pool.query<{ user_id: string }>(
          `INSERT INTO users (full_name, email, phone_number, password_hash, role, account_type)
           VALUES ($1, $2, $3, $4, 'user', $5)
           RETURNING user_id`,
          [dev.full_name, dev.email, dev.phone_number ?? null, password_hash, dev.account_type]
        );

        const userId = rows[0].user_id;
        const rawKey = `wgi_${crypto.randomBytes(32).toString('hex')}`;
        const keyName = `${dev.full_name.split(' ')[0]}'s Default Key`;

        const { rows: keyRows } = await pool.query<{ api_key_id: string }>(
          `INSERT INTO api_keys (user_id, api_key, name, status)
           VALUES ($1, $2, $3, 'active')
           RETURNING api_key_id`,
          [userId, rawKey, keyName]
        );

        results.push({
          email: dev.email,
          status: 'created',
          user_id: userId,
          api_key_id: keyRows[0].api_key_id,
          raw_key: rawKey,
        });
      } catch {
        results.push({ email: dev.email, status: 'skipped', reason: 'Internal error during creation' });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    res.status(207).json({ created, skipped, results });
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/admin/developers/:userId ────────────────────────────────────────
/**
 * Full profile for a single developer including all API keys.
 */
router.get('/developers/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const { rows: userRows } = await pool.query<{
      user_id: string; full_name: string; email: string;
      phone_number: string | null; role: string; account_type: string;
      kyc_status: string; created_at: Date; updated_at: Date;
    }>(
      `SELECT user_id, full_name, email, phone_number, role, account_type,
              kyc_status, created_at, updated_at
         FROM users WHERE user_id = $1`,
      [userId]
    );

    if (!userRows[0]) {
      res.status(404).json({ error: 'NotFound', message: 'Developer not found' });
      return;
    }

    const { rows: keyRows } = await pool.query<{
      api_key_id: string; name: string | null; status: string;
      created_at: Date; api_key: string;
    }>(
      `SELECT api_key_id, name, status, created_at,
              CONCAT(SUBSTRING(api_key, 1, 10), '…') AS api_key
         FROM api_keys
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );

    const { rows: walletRows } = await pool.query<{ currency: string; balance: string }>(
      'SELECT currency, balance FROM wallets WHERE user_id = $1 ORDER BY currency',
      [userId]
    );

    res.json({
      developer: userRows[0],
      api_keys: keyRows,
      wallets: walletRows,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /v1/admin/developers/:userId ────────────────────────────────────────
/**
 * Update a developer's profile (full_name, phone_number, account_type, kyc_status).
 */
const UpdateDeveloperSchema = z.object({
  full_name:    z.string().min(2).max(200).optional(),
  phone_number: z.string().optional(),
  account_type: z.enum(['freelancer', 'sme', 'exporter', 'ecommerce', 'ngo', 'startup', 'individual']).optional(),
  kyc_status:   z.enum(['pending', 'verified', 'rejected']).optional(),
});

router.put('/developers/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const body = UpdateDeveloperSchema.parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.full_name    !== undefined) { fields.push(`full_name    = $${idx++}`); values.push(body.full_name); }
    if (body.phone_number !== undefined) { fields.push(`phone_number = $${idx++}`); values.push(body.phone_number); }
    if (body.account_type !== undefined) { fields.push(`account_type = $${idx++}`); values.push(body.account_type); }
    if (body.kyc_status   !== undefined) { fields.push(`kyc_status   = $${idx++}`); values.push(body.kyc_status); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'BadRequest', message: 'No updatable fields provided' });
      return;
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const { rows } = await pool.query<{ user_id: string; full_name: string; email: string; role: string; kyc_status: string; account_type: string; updated_at: Date }>(
      `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${idx}
       RETURNING user_id, full_name, email, role, kyc_status, account_type, updated_at`,
      values
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'NotFound', message: 'Developer not found' });
      return;
    }

    res.json({ developer: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/admin/developers/:userId/api-keys ───────────────────────────────
/**
 * Create a new API key on behalf of a developer.
 */
const AdminCreateKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

router.post('/developers/:userId/api-keys', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { name } = AdminCreateKeySchema.parse(req.body);

    const { rows: userCheck } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM users WHERE user_id = $1',
      [userId]
    );
    if (parseInt(userCheck[0].count, 10) === 0) {
      res.status(404).json({ error: 'NotFound', message: 'Developer not found' });
      return;
    }

    const crypto = await import('crypto');
    const rawKey = `wgi_${crypto.randomBytes(32).toString('hex')}`;
    const keyName = name ?? 'Admin-provisioned Key';

    const { rows } = await pool.query<{ api_key_id: string; name: string; status: string; created_at: Date }>(
      `INSERT INTO api_keys (user_id, api_key, name, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING api_key_id, name, status, created_at`,
      [userId, rawKey, keyName]
    );

    res.status(201).json({ api_key: { ...rows[0], raw_key: rawKey } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /v1/admin/developers/:userId/api-keys/:keyId ─────────────────────
/**
 * Revoke a specific API key belonging to a developer.
 */
router.delete('/developers/:userId/api-keys/:keyId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, keyId } = req.params;

    const { rows } = await pool.query<{ api_key_id: string; status: string }>(
      `UPDATE api_keys SET status = 'revoked'
        WHERE api_key_id = $1 AND user_id = $2
        RETURNING api_key_id, status`,
      [keyId, userId]
    );

    if (!rows[0]) {
      res.status(404).json({ error: 'NotFound', message: 'API key not found for this developer' });
      return;
    }

    res.json({ api_key: rows[0] });
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
