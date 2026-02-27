-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Initial Database Schema
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone_number  VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  kyc_status    VARCHAR(20) DEFAULT 'pending'
                  CHECK (kyc_status IN ('pending','verified','rejected')),
  role          VARCHAR(20) DEFAULT 'user'
                  CHECK (role IN ('user','admin','compliance','operations','partner')),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
  wallet_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(user_id),
  currency   VARCHAR(5) NOT NULL CHECK (currency IN ('USD','EUR','GBP','KES')),
  balance    DECIMAL(20,4) DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id      UUID REFERENCES wallets(wallet_id),
  type           VARCHAR(20) NOT NULL
                   CHECK (type IN ('deposit','withdrawal','transfer','fx')),
  amount         DECIMAL(20,4) NOT NULL,
  currency       VARCHAR(5) NOT NULL,
  status         VARCHAR(20) DEFAULT 'pending'
                   CHECK (status IN ('pending','completed','failed')),
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

-- Ledger Entries (immutable, append-only double-entry ledger)
CREATE TABLE IF NOT EXISTS ledger_entries (
  ledger_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID REFERENCES transactions(transaction_id),
  wallet_id       UUID REFERENCES wallets(wallet_id),
  debit           DECIMAL(20,4) DEFAULT 0,
  credit          DECIMAL(20,4) DEFAULT 0,
  balance_after   DECIMAL(20,4) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- FX Rates
CREATE TABLE IF NOT EXISTS fx_rates (
  fx_rate_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_from VARCHAR(5) NOT NULL,
  currency_to   VARCHAR(5) NOT NULL,
  rate          DECIMAL(20,6) NOT NULL,
  provider      VARCHAR(255) DEFAULT 'WGI',
  timestamp     TIMESTAMP DEFAULT NOW()
);

-- FX Transactions
CREATE TABLE IF NOT EXISTS fx_transactions (
  fx_transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    UUID REFERENCES transactions(transaction_id),
  amount_from       DECIMAL(20,4) NOT NULL,
  amount_to         DECIMAL(20,4) NOT NULL,
  currency_from     VARCHAR(5) NOT NULL,
  currency_to       VARCHAR(5) NOT NULL,
  route             VARCHAR(255),
  fee               DECIMAL(20,4) DEFAULT 0,
  timestamp         TIMESTAMP DEFAULT NOW()
);

-- Banks
CREATE TABLE IF NOT EXISTS banks (
  bank_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  country      VARCHAR(50) NOT NULL,
  api_endpoint VARCHAR(255),
  status       VARCHAR(20) DEFAULT 'active'
                 CHECK (status IN ('active','inactive'))
);

-- Settlements
CREATE TABLE IF NOT EXISTS settlements (
  settlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     UUID REFERENCES wallets(wallet_id),
  bank_id       UUID REFERENCES banks(bank_id),
  amount        DECIMAL(20,4) NOT NULL,
  currency      VARCHAR(5) NOT NULL,
  status        VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','failed')),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Cards
CREATE TABLE IF NOT EXISTS cards (
  card_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id      UUID REFERENCES wallets(wallet_id),
  card_type      VARCHAR(20) NOT NULL CHECK (card_type IN ('virtual','physical')),
  status         VARCHAR(20) DEFAULT 'active'
                   CHECK (status IN ('active','blocked','expired')),
  spending_limit DECIMAL(20,4) DEFAULT 5000,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Card Transactions
CREATE TABLE IF NOT EXISTS card_transactions (
  card_tx_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID REFERENCES cards(card_id),
  amount     DECIMAL(20,4) NOT NULL,
  currency   VARCHAR(5) NOT NULL,
  merchant   VARCHAR(255),
  status     VARCHAR(20) DEFAULT 'completed',
  timestamp  TIMESTAMP DEFAULT NOW()
);

-- KYC Documents
CREATE TABLE IF NOT EXISTS kyc_documents (
  kyc_document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(user_id),
  doc_type        VARCHAR(50) NOT NULL,
  file_url        VARCHAR(500),
  status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','verified','rejected')),
  verified_at     TIMESTAMP
);

-- AML Alerts
CREATE TABLE IF NOT EXISTS aml_alerts (
  aml_alert_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(transaction_id),
  type           VARCHAR(50) NOT NULL,
  severity       VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high')),
  status         VARCHAR(20) DEFAULT 'pending'
                   CHECK (status IN ('pending','resolved')),
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Credit Scores
CREATE TABLE IF NOT EXISTS credit_scores (
  credit_score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES users(user_id),
  score           DECIMAL(5,2) DEFAULT 500,
  factors         JSONB DEFAULT '{}',
  last_updated    TIMESTAMP DEFAULT NOW()
);

-- API Keys (for partner access)
CREATE TABLE IF NOT EXISTS api_keys (
  api_key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(user_id),
  api_key    VARCHAR(255) UNIQUE NOT NULL,
  name       VARCHAR(255),
  status     VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wallets_user_id        ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id  ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status     ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_id        ON ledger_entries(wallet_id);
CREATE INDEX IF NOT EXISTS idx_fx_rates_pair           ON fx_rates(currency_from, currency_to);
CREATE INDEX IF NOT EXISTS idx_settlements_wallet_id   ON settlements(wallet_id);
CREATE INDEX IF NOT EXISTS idx_cards_wallet_id         ON cards(wallet_id);
CREATE INDEX IF NOT EXISTS idx_card_tx_card_id         ON card_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_kyc_user_id             ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_transaction_id      ON aml_alerts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_aml_status              ON aml_alerts(status);

-- ============================================================
--  Seed Data
-- ============================================================

-- Seed FX rates (only if table is empty to allow re-running safely)
INSERT INTO fx_rates (currency_from, currency_to, rate, provider)
SELECT v.currency_from, v.currency_to, v.rate, v.provider
FROM (VALUES
  ('USD', 'KES', 134.500000, 'WGI'),
  ('EUR', 'KES', 146.200000, 'WGI'),
  ('GBP', 'KES', 170.300000, 'WGI'),
  ('KES', 'USD',   0.007430, 'WGI'),
  ('KES', 'EUR',   0.006840, 'WGI'),
  ('KES', 'GBP',   0.005870, 'WGI'),
  ('USD', 'EUR',   0.920000, 'WGI'),
  ('EUR', 'USD',   1.087000, 'WGI'),
  ('USD', 'GBP',   0.795000, 'WGI'),
  ('GBP', 'USD',   1.257000, 'WGI'),
  ('EUR', 'GBP',   0.866000, 'WGI'),
  ('GBP', 'EUR',   1.154000, 'WGI')
) AS v(currency_from, currency_to, rate, provider)
WHERE NOT EXISTS (SELECT 1 FROM fx_rates LIMIT 1);

-- Seed banks
INSERT INTO banks (name, country, api_endpoint, status)
SELECT v.name, v.country, v.api_endpoint, v.status
FROM (VALUES
  -- Kenya
  ('Wekeza Bank',              'KE', 'https://api.wekezabank.co.ke/v1',         'active'),
  ('Equity Bank',              'KE', 'https://api.equitybank.co.ke/v1',         'active'),
  ('KCB Bank',                 'KE', 'https://api.kcb.co.ke/v1',                'active'),
  ('Standard Chartered Kenya', 'KE', 'https://api.sc.co.ke/v1',                 'active'),
  ('NCBA Bank Kenya',          'KE', 'https://api.ncbabank.co.ke/v1',           'active'),
  -- Nigeria
  ('First Bank Nigeria',       'NG', 'https://api.firstbanknigeria.com/v1',     'active'),
  ('Guaranty Trust Bank',      'NG', 'https://api.gtbank.com/v1',               'active'),
  ('Zenith Bank Nigeria',      'NG', 'https://api.zenithbank.com/v1',           'active'),
  ('Access Bank Nigeria',      'NG', 'https://api.accessbankplc.com/v1',       'active'),
  -- South Africa
  ('Standard Bank SA',         'ZA', 'https://api.standardbank.co.za/v1',      'active'),
  ('Absa Bank',                'ZA', 'https://api.absa.co.za/v1',               'active'),
  -- Ghana
  ('Ecobank Ghana',            'GH', 'https://api.ecobank.com.gh/v1',           'active'),
  ('GCB Bank',                 'GH', 'https://api.gcbbank.com.gh/v1',           'active'),
  -- Tanzania
  ('CRDB Bank',                'TZ', 'https://api.crdbbank.co.tz/v1',           'active'),
  ('NMB Bank Tanzania',        'TZ', 'https://api.nmbbank.co.tz/v1',            'active'),
  -- Uganda
  ('Stanbic Uganda',           'UG', 'https://api.stanbicbank.co.ug/v1',        'active'),
  ('Centenary Bank Uganda',    'UG', 'https://api.centenarybank.co.ug/v1',      'active'),
  -- Ethiopia
  ('Commercial Bank Ethiopia', 'ET', 'https://api.combanketh.et/v1',            'active'),
  -- Rwanda
  ('Bank of Kigali',           'RW', 'https://api.bk.rw/v1',                   'active')
) AS v(name, country, api_endpoint, status)
WHERE NOT EXISTS (SELECT 1 FROM banks LIMIT 1);
