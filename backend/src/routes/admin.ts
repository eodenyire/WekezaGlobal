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
    const [usersRes, txRes, walletRes, alertRes, pendingKycRes, volByCurrencyRes, segmentRes] = await Promise.all([
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

export default router;
