import { pool } from '../database';

export type AuditAction =
  | 'user.register'
  | 'user.login'
  | 'user.profile_update'
  | 'wallet.deposit'
  | 'wallet.withdrawal'
  | 'wallet.transfer'
  | 'fx.convert'
  | 'card.issue'
  | 'card.activate'
  | 'card.deactivate'
  | 'card.charge'
  | 'kyc.submit'
  | 'kyc.approve'
  | 'kyc.reject'
  | 'api_key.create'
  | 'api_key.revoke'
  | 'mfa.generate'
  | 'mfa.verify';

export interface AuditEventInput {
  userId?: string;
  action: AuditAction | string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Persists an audit event to the audit_logs table.
 *
 * Non-fatal: if the insert fails (e.g. DB unavailable), the error is swallowed
 * so that audit logging never blocks core business operations.
 *
 * Security Model §5 — "All system, transaction, and API activity logged for 7+ years"
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.userId ?? null,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.ipAddress ?? null,
      ]
    );
  } catch {
    // Non-fatal — audit logging must not block business operations
  }
}
