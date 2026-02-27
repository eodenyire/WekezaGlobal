-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Migration 004
--  Adds: webhooks table (Architecture §3.6 — fintech integration)
-- ============================================================

CREATE TABLE IF NOT EXISTS webhooks (
  webhook_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(user_id) ON DELETE CASCADE,
  url          VARCHAR(500) NOT NULL,
  events       TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {deposit,withdrawal,settlement}
  secret       VARCHAR(255) NOT NULL,          -- HMAC signing secret
  status       VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status  ON webhooks(status);
