-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Migration 013
--  API Key Scopes for Wekeza v1-Core Access Control
--
--  External developers request specific scopes when creating an API key.
--  WGI enforces those scopes at the gateway level before proxying requests
--  to the Wekeza v1-Core banking system.
--
--  Scopes:
--    core_banking  — access to /v1/core-banking/* (v1-Core proxy)
--    fx            — FX conversion and rates
--    payments      — payment initiation (SWIFT/SEPA/ACH/MPESA)
--    lending       — loan application and management
--    cards         — card issuance and management
--    compliance    — KYC/AML endpoints
--    reporting     — read-only reporting and statements
--    webhooks      — webhook registration and management
--
--  All INSERTs use ON CONFLICT DO NOTHING (idempotent).
-- ============================================================

-- ─── Add scopes column to api_keys table ─────────────────────────────────────

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT '{}';

-- Index for fast scope lookups (e.g. WHERE 'core_banking' = ANY(scopes))
CREATE INDEX IF NOT EXISTS idx_api_keys_scopes
  ON api_keys USING gin(scopes);

-- ─── Upgrade existing seeded sandbox API keys with full scopes ────────────────
--
-- The two developer API keys seeded in migration 012 get all scopes so they
-- can be used for end-to-end sandbox testing out of the box.

UPDATE api_keys
SET scopes = ARRAY[
  'core_banking', 'fx', 'payments', 'lending',
  'cards', 'compliance', 'reporting', 'webhooks'
]
WHERE api_key IN (
  'wgi_sandbox_dev1_key_abc123',
  'wgi_sandbox_dev2_key_def456'
);

-- ─── Grant core_banking scope to the sandbox partner user's API key ──────────

UPDATE api_keys
SET scopes = ARRAY[
  'core_banking', 'fx', 'payments', 'lending',
  'cards', 'compliance', 'reporting', 'webhooks'
]
WHERE user_id = '44444444-4444-4444-8444-444444444444'
  AND status = 'active';

-- ─── Function: check_api_key_scope ───────────────────────────────────────────
--
-- Convenience function used by the analytics layer / audit logging to verify
-- that a given API key has a requested scope.
-- Returns TRUE when the scope is present, FALSE otherwise.

CREATE OR REPLACE FUNCTION check_api_key_scope(p_api_key TEXT, p_scope TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT p_scope = ANY(scopes)
  FROM api_keys
  WHERE api_key = p_api_key
    AND status = 'active'
  LIMIT 1;
$$;

-- ─── Comment the new column ───────────────────────────────────────────────────

COMMENT ON COLUMN api_keys.scopes IS
  'Permitted API scopes for this key. '
  'WGI enforces these before proxying to v1-Core or other downstream services. '
  'Valid values: core_banking, fx, payments, lending, cards, compliance, reporting, webhooks.';
