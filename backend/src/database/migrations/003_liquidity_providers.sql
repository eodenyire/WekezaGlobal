-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Migration 003
--  Adds: liquidity_providers table (SDS §2.2),
--        settlement_rules column on banks (SDS §2.3)
-- ============================================================

-- Add settlement_rules to banks (SDS §2.3 — settlement routing rules per bank)
ALTER TABLE banks ADD COLUMN IF NOT EXISTS settlement_rules JSONB DEFAULT '{}';

-- Liquidity Providers (SDS §2.2 — FX Engine queries multiple providers)
CREATE TABLE IF NOT EXISTS liquidity_providers (
  provider_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  rates        JSONB DEFAULT '{}',   -- e.g. {"USD_KES": 134.2, "EUR_KES": 146.0}
  availability BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lp_availability ON liquidity_providers(availability);

-- Seed initial liquidity providers
INSERT INTO liquidity_providers (name, rates, availability)
SELECT v.name, v.rates::JSONB, v.availability
FROM (VALUES
  ('Wekeza Bank Liquidity',   '{"USD_KES":134.5,"EUR_KES":146.2,"GBP_KES":170.3,"USD_EUR":0.92,"USD_GBP":0.795}', TRUE),
  ('Equity Markets Desk',     '{"USD_KES":134.1,"EUR_KES":145.9,"GBP_KES":169.8,"USD_EUR":0.919,"USD_GBP":0.794}', TRUE),
  ('Standard Chartered FX',   '{"USD_KES":134.3,"EUR_KES":146.0,"GBP_KES":170.1,"USD_EUR":0.921,"USD_GBP":0.796}', TRUE)
) AS v(name, rates, availability)
WHERE NOT EXISTS (SELECT 1 FROM liquidity_providers LIMIT 1);
