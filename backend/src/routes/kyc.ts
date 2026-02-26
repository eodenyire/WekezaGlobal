import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as kycService from '../services/kycService';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { AlertStatus, AlertSeverity, DocStatus } from '../models/types';

const router = Router();

// All KYC/AML routes require authentication
router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const UploadDocSchema = z.object({
  user_id:  z.string().uuid(),
  doc_type: z.string().min(1),
  file_url: z.string().url(),
});

const UpdateKycSchema = z.object({
  status: z.enum(['pending','verified','rejected']),
});

const UpdateAlertSchema = z.object({
  status: z.literal('resolved'),
});

// ─── POST /v1/kyc ────────────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = UploadDocSchema.parse(req.body);
    const doc = await kycService.uploadDocument(body.user_id, body.doc_type, body.file_url);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/kyc/:user_id ────────────────────────────────────────────────────

router.get('/:user_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await kycService.getKycStatus(req.params.user_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /v1/kyc/:kyc_document_id  (admin/compliance only) ──────────────────

router.put(
  '/:kyc_document_id',
  requireRole('admin', 'compliance'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = UpdateKycSchema.parse(req.body);
      const doc = await kycService.updateKycDocumentStatus(
        req.params.kyc_document_id,
        status as DocStatus
      );
      res.json(doc);
    } catch (err) {
      next(err);
    }
  }
);

// ─── AML Alerts ──────────────────────────────────────────────────────────────

// GET /v1/aml/alerts  — served on this router as /aml/alerts via server.ts
// but because this router is mounted at /v1/kyc we use a separate /aml path
// (see server.ts for mounting). However, to keep the file boundary clean we
// export a second mini-router for AML.

export const amlRouter = Router();
amlRouter.use(authenticate);

// GET /v1/aml/alerts
amlRouter.get('/alerts', requireRole('admin','compliance'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status   = req.query.status   as AlertStatus | undefined;
    const severity = req.query.severity as AlertSeverity | undefined;
    const limit    = parseInt(req.query.limit  as string) || 50;
    const offset   = parseInt(req.query.offset as string) || 0;
    const alerts = await kycService.getAmlAlerts({ status, severity, limit, offset });
    res.json({ alerts, limit, offset });
  } catch (err) {
    next(err);
  }
});

// PUT /v1/aml/alerts/:alert_id
amlRouter.put('/alerts/:alert_id', requireRole('admin','compliance'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    UpdateAlertSchema.parse(req.body);
    const alert = await kycService.resolveAmlAlert(req.params.alert_id);
    res.json(alert);
  } catch (err) {
    next(err);
  }
});

// POST /v1/aml/scan  — Architecture §4: continuous compliance monitoring
amlRouter.post('/scan', requireRole('admin','compliance'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const lookbackMinutes = parseInt(req.query.lookback_minutes as string) || 60;
    const result = await kycService.scanTransactionsForAml(lookbackMinutes);
    res.json({ ...result, lookback_minutes: lookbackMinutes });
  } catch (err) {
    next(err);
  }
});

export default router;
