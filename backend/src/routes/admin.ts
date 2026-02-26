import { Router, Response, NextFunction } from 'express';
import { pool } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { User, Transaction } from '../models/types';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

// ─── GET /v1/admin/stats ─────────────────────────────────────────────────────

router.get('/stats', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [usersRes, txRes, walletRes, alertRes, settlementRes] = await Promise.all([
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
        "SELECT COUNT(*) AS count FROM settlements WHERE status = 'pending'"
      ),
    ]);

    res.json({
      total_users:          parseInt(usersRes.rows[0].count, 10),
      total_transactions:   parseInt(txRes.rows[0].count, 10),
      total_volume_usd:     parseFloat(txRes.rows[0].total_volume),
      total_wallets:        parseInt(walletRes.rows[0].count, 10),
      pending_aml_alerts:   parseInt(alertRes.rows[0].count, 10),
      pending_settlements:  parseInt(settlementRes.rows[0].count, 10),
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
    const [kycRes, amlRes, verifiedRes, pendingKycRes] = await Promise.all([
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
      },
      aml: {
        pending_alerts_by_severity: amlBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
