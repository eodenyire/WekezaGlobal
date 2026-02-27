-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Migration 006
--  Adds: account_type column to users table
--
--  The Executive Vision Document (Phase 1) defines distinct user segments
--  with different needs and Phase 1 KPIs:
--    • freelancer  — remote workers earning USD/EUR/GBP (target: 2,000)
--    • sme         — SMEs and export businesses      (target: 500)
--    • exporter    — exporters receiving foreign currency
--    • ecommerce   — Amazon/Shopify sellers
--    • ngo         — NGOs receiving international grants
--    • startup     — tech agencies and startups billing global clients
--    • individual  — general personal use (default)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'individual'
    CHECK (account_type IN ('freelancer','sme','exporter','ecommerce','ngo','startup','individual'));

-- Back-fill all existing rows that have no account_type yet
UPDATE users SET account_type = 'individual' WHERE account_type IS NULL;

-- Useful index for admin segment dashboards (Vision success metrics)
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);
