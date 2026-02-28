-- ============================================================
--  Seed test accounts for demo and QA flows
--  Password for all test users: Test@1234
-- ============================================================

-- Users
INSERT INTO users (user_id, full_name, email, phone_number, password_hash, kyc_status, role)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'Demo User',
    'demo.user@wekeza.test',
    '+254700000001',
    '$2a$12$41n4d5T5FADCOhCc1OaWz.k.FrsILlyisDBqHsc0IaEKTnOJ7lepu',
    'verified',
    'user'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Demo Operations',
    'demo.ops@wekeza.test',
    '+254700000002',
    '$2a$12$41n4d5T5FADCOhCc1OaWz.k.FrsILlyisDBqHsc0IaEKTnOJ7lepu',
    'verified',
    'operations'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Demo Admin',
    'demo.admin@wekeza.test',
    '+254700000003',
    '$2a$12$41n4d5T5FADCOhCc1OaWz.k.FrsILlyisDBqHsc0IaEKTnOJ7lepu',
    'verified',
    'admin'
  )
ON CONFLICT (email) DO NOTHING;

-- Wallets (deterministic IDs for easy testing)
INSERT INTO wallets (wallet_id, user_id, currency, balance)
SELECT 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'USD', 0
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE wallet_id = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1');

INSERT INTO wallets (wallet_id, user_id, currency, balance)
SELECT 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'KES', 0
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE wallet_id = 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2');

INSERT INTO wallets (wallet_id, user_id, currency, balance)
SELECT 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '22222222-2222-4222-8222-222222222222', 'USD', 0
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE wallet_id = 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1');

-- Fund Demo User USD wallet with a seed deposit (idempotent)
INSERT INTO transactions (transaction_id, wallet_id, type, amount, currency, status, metadata)
SELECT
  'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1',
  'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'deposit',
  5000.00,
  'USD',
  'completed',
  '{"reason":"seed_funds","source":"system"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM transactions WHERE transaction_id = 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1'
);

INSERT INTO ledger_entries (ledger_entry_id, transaction_id, wallet_id, credit, balance_after)
SELECT
  'eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1',
  'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1',
  'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  5000.00,
  5000.00
WHERE NOT EXISTS (
  SELECT 1 FROM ledger_entries WHERE ledger_entry_id = 'eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1'
);

UPDATE wallets
SET balance = 5000.00, updated_at = NOW()
WHERE wallet_id = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  AND balance = 0;