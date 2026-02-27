-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Migration 007
--  Adds: is_founding_partner flag to liquidity_providers
--
--  Problem Statement (Document 2) §6 and Business Model Hypothesis
--  (Document 6) both specify Wekeza Bank as the "founding liquidity
--  partner".  This flag allows the FX routing engine to:
--    1. Identify the founding partner for preferential routing
--    2. Expose partner status in the admin API
--    3. Track that founding partner rates are always indexed first
-- ============================================================

ALTER TABLE liquidity_providers
  ADD COLUMN IF NOT EXISTS is_founding_partner BOOLEAN DEFAULT FALSE;

-- Mark Wekeza Bank as the founding liquidity partner
UPDATE liquidity_providers
   SET is_founding_partner = TRUE
 WHERE name = 'Wekeza Bank Liquidity';

-- Index to make "prefer founding partner" queries efficient
CREATE INDEX IF NOT EXISTS idx_lp_founding_partner
  ON liquidity_providers(is_founding_partner);
