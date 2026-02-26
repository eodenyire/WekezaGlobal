import { pool } from '../database';
import { KycDocument, AmlAlert, AlertStatus, AlertSeverity, DocStatus } from '../models/types';
import { createError } from '../middleware/errorHandler';

// ─── KYC ─────────────────────────────────────────────────────────────────────

export async function uploadDocument(
  userId: string,
  docType: string,
  fileUrl: string
): Promise<KycDocument> {
  if (!docType || !fileUrl) throw createError('doc_type and file_url are required', 400);

  const { rows } = await pool.query<KycDocument>(
    `INSERT INTO kyc_documents (user_id, doc_type, file_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, docType, fileUrl]
  );
  return rows[0];
}

export async function getKycStatus(userId: string): Promise<{
  user_id: string;
  kyc_status: string;
  documents: KycDocument[];
}> {
  // Check user exists
  const { rows: userRows } = await pool.query(
    'SELECT user_id, kyc_status FROM users WHERE user_id = $1',
    [userId]
  );
  if (!userRows[0]) throw createError('User not found', 404);

  const { rows: docs } = await pool.query<KycDocument>(
    'SELECT * FROM kyc_documents WHERE user_id = $1 ORDER BY kyc_document_id ASC',
    [userId]
  );

  return {
    user_id: userId,
    kyc_status: userRows[0].kyc_status,
    documents: docs,
  };
}

export async function updateKycDocumentStatus(
  kycDocumentId: string,
  status: DocStatus
): Promise<KycDocument> {
  const validStatuses: DocStatus[] = ['pending', 'verified', 'rejected'];
  if (!validStatuses.includes(status)) {
    throw createError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
  }

  const verifiedAt = status === 'verified' ? new Date() : null;

  const { rows } = await pool.query<KycDocument>(
    `UPDATE kyc_documents
     SET status = $1, verified_at = $2
     WHERE kyc_document_id = $3
     RETURNING *`,
    [status, verifiedAt, kycDocumentId]
  );
  if (!rows[0]) throw createError('KYC document not found', 404);

  // Aggregate user KYC status: verified if at least one doc is verified
  const { rows: docs } = await pool.query(
    'SELECT status FROM kyc_documents WHERE user_id = $1',
    [rows[0].user_id]
  );
  const allRejected = docs.every((d) => d.status === 'rejected');
  const anyVerified = docs.some((d) => d.status === 'verified');
  const userKycStatus = anyVerified ? 'verified' : allRejected ? 'rejected' : 'pending';

  await pool.query(
    'UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE user_id = $2',
    [userKycStatus, rows[0].user_id]
  );

  return rows[0];
}

// ─── AML ─────────────────────────────────────────────────────────────────────

export async function getAmlAlerts(filters: {
  status?: AlertStatus;
  severity?: AlertSeverity;
  limit?: number;
  offset?: number;
}): Promise<AmlAlert[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.severity) {
    conditions.push(`severity = $${idx++}`);
    params.push(filters.severity);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  params.push(limit, offset);

  const { rows } = await pool.query<AmlAlert>(
    `SELECT * FROM aml_alerts ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );
  return rows;
}

export async function resolveAmlAlert(alertId: string): Promise<AmlAlert> {
  const { rows } = await pool.query<AmlAlert>(
    `UPDATE aml_alerts SET status = 'resolved' WHERE aml_alert_id = $1 RETURNING *`,
    [alertId]
  );
  if (!rows[0]) throw createError('AML alert not found', 404);
  return rows[0];
}
