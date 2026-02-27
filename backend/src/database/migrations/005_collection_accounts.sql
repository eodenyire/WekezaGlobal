-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Migration 005
--  Adds: collection_accounts table (BRD §4.4 — Global Collection Accounts)
--
--  A "collection account" is a virtual receiving account number
--  (e.g. a US routing + account number, IBAN, or SEPA identifier)
--  that external payers (ACH, SWIFT, SEPA) can use to send funds
--  directly into a user's WGI wallet.
--  BRD BR-010, BR-011, BR-012
-- ============================================================

CREATE TABLE IF NOT EXISTS collection_accounts (
  collection_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  wallet_id             UUID NOT NULL REFERENCES wallets(wallet_id) ON DELETE CASCADE,
  -- Payment rail this account accepts: ACH, SWIFT, or SEPA
  rail                  VARCHAR(10) NOT NULL CHECK (rail IN ('ACH','SWIFT','SEPA')),
  currency              VARCHAR(10) NOT NULL,
  -- Human-readable label (e.g. "USD ACH Account")
  label                 VARCHAR(255),
  -- ACH fields
  routing_number        VARCHAR(20),
  account_number        VARCHAR(30),
  -- SWIFT / SEPA fields
  iban                  VARCHAR(40),
  bic                   VARCHAR(15),
  -- Reference number for the beneficiary to include in their transfer
  reference_code        VARCHAR(30) UNIQUE DEFAULT UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
  status                VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_accounts_user_id   ON collection_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_accounts_wallet_id ON collection_accounts(wallet_id);
CREATE INDEX IF NOT EXISTS idx_collection_accounts_rail      ON collection_accounts(rail);
