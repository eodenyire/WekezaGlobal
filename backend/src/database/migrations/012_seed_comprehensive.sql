-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Migration 012
--  Comprehensive seed data for sandbox, compliance, and dev use
--
--  Adds:
--    • sandbox.partner and compliance officer user accounts
--    • 3 additional Kenyan banks
--    • Active sandbox API key for the sandbox partner
--    • Subscription plan seed rows (standard / premium / enterprise)
--    • Notification records for demo users
--    • Full FX rate pairs (USD, EUR, GBP, KES)
--    • 2 sandbox API keys for developer accounts
--
--  Password for all seeded accounts: Test@1234
--  Hash: $2a$12$41n4d5T5FADCOhCc1OaWz.k.FrsILlyisDBqHsc0IaEKTnOJ7lepu
--
--  All INSERTs use ON CONFLICT DO NOTHING (idempotent).
-- ============================================================

-- ─── Additional Users ─────────────────────────────────────────────────────────

INSERT INTO users (user_id, full_name, email, phone_number, password_hash, kyc_status, role)
VALUES
  (
    '44444444-4444-4444-8444-444444444444',
    'Sandbox Partner',
    'sandbox.partner@wekeza.test',
    '+254700000004',
    '$2a$12$41n4d5T5FADCOhCc1OaWz.k.FrsILlyisDBqHsc0IaEKTnOJ7lepu',
    'verified',
    'partner'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'Compliance Officer',
    'compliance@wekeza.test',
    '+254700000005',
    '$2a$12$41n4d5T5FADCOhCc1OaWz.k.FrsILlyisDBqHsc0IaEKTnOJ7lepu',
    'verified',
    'compliance'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'Developer One',
    'developer1@wekeza.test',
    '+254700000006',
    '$2a$12$41n4d5T5FADCOhCc1OaWz.k.FrsILlyisDBqHsc0IaEKTnOJ7lepu',
    'verified',
    'user'
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    'Developer Two',
    'developer2@wekeza.test',
    '+254700000007',
    '$2a$12$41n4d5T5FADCOhCc1OaWz.k.FrsILlyisDBqHsc0IaEKTnOJ7lepu',
    'verified',
    'user'
  )
ON CONFLICT (email) DO NOTHING;

-- ─── Wallets for new users ────────────────────────────────────────────────────

INSERT INTO wallets (wallet_id, user_id, currency, balance)
SELECT 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1', '44444444-4444-4444-8444-444444444444', 'USD', 0
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE wallet_id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1');

INSERT INTO wallets (wallet_id, user_id, currency, balance)
SELECT 'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2', '55555555-5555-4555-8555-555555555555', 'USD', 0
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE wallet_id = 'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2');

INSERT INTO wallets (wallet_id, user_id, currency, balance)
SELECT 'ccccccc3-cccc-4ccc-8ccc-ccccccccccc3', '66666666-6666-4666-8666-666666666666', 'USD', 0
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE wallet_id = 'ccccccc3-cccc-4ccc-8ccc-ccccccccccc3');

INSERT INTO wallets (wallet_id, user_id, currency, balance)
SELECT 'ccccccc4-cccc-4ccc-8ccc-ccccccccccc4', '77777777-7777-4777-8777-777777777777', 'USD', 0
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE wallet_id = 'ccccccc4-cccc-4ccc-8ccc-ccccccccccc4');

-- ─── Additional Banks ─────────────────────────────────────────────────────────

INSERT INTO banks (bank_id, name, country, api_endpoint, status)
VALUES
  (
    'ba000001-ba00-4ba0-8ba0-ba0000000001',
    'Standard Bank Kenya',
    'KE',
    'https://api.standardbank.co.ke/v1',
    'active'
  ),
  (
    'ba000002-ba00-4ba0-8ba0-ba0000000002',
    'Equity Bank Kenya',
    'KE',
    'https://api.equitybank.co.ke/v1',
    'active'
  ),
  (
    'ba000003-ba00-4ba0-8ba0-ba0000000003',
    'Co-operative Bank of Kenya',
    'KE',
    'https://api.co-opbank.co.ke/v1',
    'active'
  )
ON CONFLICT DO NOTHING;

-- ─── API Keys ─────────────────────────────────────────────────────────────────

-- Active key for sandbox partner
INSERT INTO api_keys (api_key_id, user_id, api_key, name, status)
VALUES (
  'a0000001-0000-4000-8000-000000000001',
  '44444444-4444-4444-8444-444444444444',
  'wgi_sandbox_partner_key_xyz789',
  'Sandbox Partner Primary Key',
  'active'
)
ON CONFLICT DO NOTHING;

-- Developer 1 sandbox key
INSERT INTO api_keys (api_key_id, user_id, api_key, name, status)
VALUES (
  'a0000002-0000-4000-8000-000000000002',
  '66666666-6666-4666-8666-666666666666',
  'wgi_sandbox_dev1_key_abc123',
  'Developer 1 Sandbox Key',
  'active'
)
ON CONFLICT DO NOTHING;

-- Developer 2 sandbox key
INSERT INTO api_keys (api_key_id, user_id, api_key, name, status)
VALUES (
  'a0000003-0000-4000-8000-000000000003',
  '77777777-7777-4777-8777-777777777777',
  'wgi_sandbox_dev2_key_def456',
  'Developer 2 Sandbox Key',
  'active'
)
ON CONFLICT DO NOTHING;

-- ─── Subscription Plans ───────────────────────────────────────────────────────

INSERT INTO subscription_plans (plan_id, name, display_name, price_usd, billing_cycle, features, is_active)
VALUES
  (
    'ba010001-0000-4000-8000-000000000001',
    'standard',
    'Standard',
    0.00,
    'monthly',
    '["Multi-currency wallets","Basic FX conversion","Standard support","1 API key"]'::jsonb,
    TRUE
  ),
  (
    'ba010002-0000-4000-8000-000000000002',
    'premium',
    'Premium',
    9.99,
    'monthly',
    '["Everything in Standard","Virtual card issuance","Priority support","10 API keys","Advanced analytics","Webhook notifications"]'::jsonb,
    TRUE
  ),
  (
    'ba010003-0000-4000-8000-000000000003',
    'enterprise',
    'Enterprise',
    49.99,
    'monthly',
    '["Everything in Premium","Dedicated account manager","Custom FX rates","Unlimited API keys","SLA 99.9% uptime","White-label options","Compliance reporting dashboard"]'::jsonb,
    TRUE
  )
ON CONFLICT (name) DO NOTHING;

-- ─── FX Rates ─────────────────────────────────────────────────────────────────

INSERT INTO fx_rates (fx_rate_id, currency_from, currency_to, rate, provider)
VALUES
  -- USD ↔ KES
  ('d1000001-0000-4000-8000-000000000001', 'USD', 'KES', 134.500000, 'WGI'),
  ('d1000002-0000-4000-8000-000000000002', 'KES', 'USD',   0.007435, 'WGI'),
  -- EUR ↔ KES
  ('d1000003-0000-4000-8000-000000000003', 'EUR', 'KES', 147.200000, 'WGI'),
  ('d1000004-0000-4000-8000-000000000004', 'KES', 'EUR',   0.006794, 'WGI'),
  -- GBP ↔ KES
  ('d1000005-0000-4000-8000-000000000005', 'GBP', 'KES', 170.800000, 'WGI'),
  ('d1000006-0000-4000-8000-000000000006', 'KES', 'GBP',   0.005855, 'WGI'),
  -- EUR ↔ USD
  ('d1000007-0000-4000-8000-000000000007', 'EUR', 'USD',   1.090000, 'WGI'),
  ('d1000008-0000-4000-8000-000000000008', 'USD', 'EUR',   0.917431, 'WGI'),
  -- GBP ↔ USD
  ('d1000009-0000-4000-8000-000000000009', 'GBP', 'USD',   1.270000, 'WGI'),
  ('d1000010-0000-4000-8000-000000000010', 'USD', 'GBP',   0.787402, 'WGI'),
  -- EUR ↔ GBP
  ('d1000011-0000-4000-8000-000000000011', 'EUR', 'GBP',   0.858268, 'WGI'),
  ('d1000012-0000-4000-8000-000000000012', 'GBP', 'EUR',   1.164706, 'WGI')
ON CONFLICT DO NOTHING;

-- ─── Notifications ────────────────────────────────────────────────────────────

INSERT INTO notifications (notification_id, user_id, type, title, message, is_read, metadata)
VALUES
  (
    'c0000001-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'welcome',
    'Welcome to WekezaGlobal!',
    'Your account has been created and verified. Your USD wallet has been seeded with $5,000 for testing.',
    FALSE,
    '{"source":"system","category":"onboarding"}'::jsonb
  ),
  (
    'c0000002-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'deposit',
    'Sandbox Deposit Received',
    'A seed deposit of $5,000.00 USD has been credited to your wallet.',
    TRUE,
    '{"transaction_id":"ddddddd1-dddd-4ddd-8ddd-ddddddddddd1","amount":5000,"currency":"USD"}'::jsonb
  ),
  (
    'c0000003-0000-4000-8000-000000000003',
    '44444444-4444-4444-8444-444444444444',
    'welcome',
    'Welcome, Sandbox Partner!',
    'Your partner account is active. Your sandbox API key is ready to use.',
    FALSE,
    '{"source":"system","category":"onboarding"}'::jsonb
  ),
  (
    'c0000004-0000-4000-8000-000000000004',
    '55555555-5555-4555-8555-555555555555',
    'welcome',
    'Welcome, Compliance Officer!',
    'Your compliance account is active. You have access to AML alerts and KYC review dashboards.',
    FALSE,
    '{"source":"system","category":"onboarding"}'::jsonb
  ),
  (
    'c0000005-0000-4000-8000-000000000005',
    '66666666-6666-4666-8666-666666666666',
    'api_key',
    'API Key Created',
    'Your sandbox API key wgi_sandbox_dev1_key_abc123 has been created and is ready for use.',
    FALSE,
    '{"api_key_id":"a0000002-0000-4000-8000-000000000002","key_preview":"wgi_sandbox_dev1_key_abc123"}'::jsonb
  ),
  (
    'c0000006-0000-4000-8000-000000000006',
    '77777777-7777-4777-8777-777777777777',
    'api_key',
    'API Key Created',
    'Your sandbox API key wgi_sandbox_dev2_key_def456 has been created and is ready for use.',
    FALSE,
    '{"api_key_id":"a0000003-0000-4000-8000-000000000003","key_preview":"wgi_sandbox_dev2_key_def456"}'::jsonb
  )
ON CONFLICT DO NOTHING;
