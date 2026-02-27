-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Transaction Limits
--  Migration 011: wallet_limits for daily/per-tx thresholds
--  (Security Model §4 — Transaction & Fraud Security)
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_limits (
  limit_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id        UUID NOT NULL UNIQUE REFERENCES wallets(wallet_id),
  daily_limit      DECIMAL(20,4),
  per_tx_limit     DECIMAL(20,4),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_limits_wallet_id ON wallet_limits(wallet_id);
