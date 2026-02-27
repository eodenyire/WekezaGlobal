-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Additional Tables
--  Migration 002: reconciliation_logs, regulatory_reports,
--                 credit_activity_logs, notifications
-- ============================================================

-- Reconciliation Logs (Settlement Engine — SDS 2.3)
CREATE TABLE IF NOT EXISTS reconciliation_logs (
  log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID REFERENCES settlements(settlement_id),
  result        VARCHAR(20) NOT NULL CHECK (result IN ('matched','mismatch','pending')),
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Regulatory Reports (KYC & Compliance Engine — SDS 2.5)
CREATE TABLE IF NOT EXISTS regulatory_reports (
  report_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period       VARCHAR(20) NOT NULL,
  type         VARCHAR(50) NOT NULL,
  status       VARCHAR(20) DEFAULT 'draft'
                 CHECK (status IN ('draft','submitted','accepted','rejected')),
  content      JSONB DEFAULT '{}',
  generated_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP
);

-- Credit Activity Logs (Credit Intelligence Engine — SDS 2.7)
CREATE TABLE IF NOT EXISTS credit_activity_logs (
  log_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(user_id),
  transaction_id UUID REFERENCES transactions(transaction_id),
  factor         VARCHAR(50) NOT NULL,
  delta          DECIMAL(10,4) DEFAULT 0,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(user_id),
  type            VARCHAR(50) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_recon_settlement_id    ON reconciliation_logs(settlement_id);
CREATE INDEX IF NOT EXISTS idx_credit_log_user_id     ON credit_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read  ON notifications(user_id, is_read);
