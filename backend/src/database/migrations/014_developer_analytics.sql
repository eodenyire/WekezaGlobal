-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Migration 014
--  Developer Ecosystem — Analytics Event Log
--
--  Adds a dedicated developer_events table that records API
--  gateway events (requests, errors, latency) per API key.
--  This powers the Developer Analytics dashboard
--  (GET /v1/developer/analytics) and the Event Stream
--  (GET /v1/developer/events).
--
--  All INSERTs use ON CONFLICT DO NOTHING (idempotent).
-- ============================================================

-- ─── developer_events table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS developer_events (
  event_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  api_key_id      UUID        REFERENCES api_keys(api_key_id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,                   -- e.g. 'api_request', 'webhook_dispatch', 'error'
  endpoint        TEXT,                                   -- e.g. '/v1/wallets'
  http_method     TEXT,                                   -- 'GET' | 'POST' | ...
  status_code     INTEGER,                                -- HTTP response code
  latency_ms      INTEGER,                                -- response time in ms
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_developer_events_user_id
  ON developer_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_developer_events_api_key_id
  ON developer_events (api_key_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_developer_events_event_type
  ON developer_events (event_type);

COMMENT ON TABLE developer_events IS
  'Records API gateway events per developer for the analytics dashboard. '
  'Populated by the event-tracking middleware; rows older than 90 days may be purged.';

-- ─── partner_verifications table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_verifications (
  verification_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id   UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  full_name         TEXT        NOT NULL,
  id_type           TEXT        NOT NULL,
  id_number_masked  TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'verified',
  confidence_score  INTEGER     NOT NULL DEFAULT 97,
  verified_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_review_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_verifications_partner
  ON partner_verifications (partner_user_id, created_at DESC);

COMMENT ON TABLE partner_verifications IS
  'Stores identity verification results from the Partner Identity API (/v1/partner/identity/verify).';
