-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Audit Log
--  Migration 009: audit_logs for 7-year activity retention
--  (Security Model §5 — Compliance & Regulatory Controls)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(user_id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  metadata    JSONB DEFAULT '{}',
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
