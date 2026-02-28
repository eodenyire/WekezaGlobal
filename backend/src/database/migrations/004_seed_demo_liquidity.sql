-- ============================================================
--  Seed additional funded demo wallets for QA and demos
-- ============================================================

-- Demo Operations wallets
INSERT INTO wallets (wallet_id, user_id, currency, balance)
SELECT 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '22222222-2222-4222-8222-222222222222', 'KES', 0
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE wallet_id = 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2');

-- Demo Admin wallets
INSERT INTO wallets (wallet_id, user_id, currency, balance)
SELECT 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1', '33333333-3333-4333-8333-333333333333', 'USD', 0
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE wallet_id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1');

INSERT INTO wallets (wallet_id, user_id, currency, balance)
SELECT 'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2', '33333333-3333-4333-8333-333333333333', 'KES', 0
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE wallet_id = 'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2');

-- Seed initial deposits (idempotent transaction IDs)
INSERT INTO transactions (transaction_id, wallet_id, type, amount, currency, status, metadata)
SELECT
  'ddddddd2-dddd-4ddd-8ddd-ddddddddddd2',
  'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'deposit',
  3500.00,
  'USD',
  'completed',
  '{"reason":"seed_funds","source":"system"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM transactions WHERE transaction_id = 'ddddddd2-dddd-4ddd-8ddd-ddddddddddd2'
);

INSERT INTO ledger_entries (ledger_entry_id, transaction_id, wallet_id, credit, balance_after)
SELECT
  'eeeeeee2-eeee-4eee-8eee-eeeeeeeeeee2',
  'ddddddd2-dddd-4ddd-8ddd-ddddddddddd2',
  'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  3500.00,
  3500.00
WHERE NOT EXISTS (
  SELECT 1 FROM ledger_entries WHERE ledger_entry_id = 'eeeeeee2-eeee-4eee-8eee-eeeeeeeeeee2'
);

UPDATE wallets
SET balance = 3500.00, updated_at = NOW()
WHERE wallet_id = 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  AND balance = 0;

INSERT INTO transactions (transaction_id, wallet_id, type, amount, currency, status, metadata)
SELECT
  'ddddddd3-dddd-4ddd-8ddd-ddddddddddd3',
  'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'deposit',
  275000.00,
  'KES',
  'completed',
  '{"reason":"seed_funds","source":"system"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM transactions WHERE transaction_id = 'ddddddd3-dddd-4ddd-8ddd-ddddddddddd3'
);

INSERT INTO ledger_entries (ledger_entry_id, transaction_id, wallet_id, credit, balance_after)
SELECT
  'eeeeeee3-eeee-4eee-8eee-eeeeeeeeeee3',
  'ddddddd3-dddd-4ddd-8ddd-ddddddddddd3',
  'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  275000.00,
  275000.00
WHERE NOT EXISTS (
  SELECT 1 FROM ledger_entries WHERE ledger_entry_id = 'eeeeeee3-eeee-4eee-8eee-eeeeeeeeeee3'
);

UPDATE wallets
SET balance = 275000.00, updated_at = NOW()
WHERE wallet_id = 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
  AND balance = 0;

INSERT INTO transactions (transaction_id, wallet_id, type, amount, currency, status, metadata)
SELECT
  'ddddddd4-dddd-4ddd-8ddd-ddddddddddd4',
  'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1',
  'deposit',
  10000.00,
  'USD',
  'completed',
  '{"reason":"seed_funds","source":"system"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM transactions WHERE transaction_id = 'ddddddd4-dddd-4ddd-8ddd-ddddddddddd4'
);

INSERT INTO ledger_entries (ledger_entry_id, transaction_id, wallet_id, credit, balance_after)
SELECT
  'eeeeeee4-eeee-4eee-8eee-eeeeeeeeeee4',
  'ddddddd4-dddd-4ddd-8ddd-ddddddddddd4',
  'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1',
  10000.00,
  10000.00
WHERE NOT EXISTS (
  SELECT 1 FROM ledger_entries WHERE ledger_entry_id = 'eeeeeee4-eeee-4eee-8eee-eeeeeeeeeee4'
);

UPDATE wallets
SET balance = 10000.00, updated_at = NOW()
WHERE wallet_id = 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1'
  AND balance = 0;

INSERT INTO transactions (transaction_id, wallet_id, type, amount, currency, status, metadata)
SELECT
  'ddddddd5-dddd-4ddd-8ddd-ddddddddddd5',
  'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2',
  'deposit',
  450000.00,
  'KES',
  'completed',
  '{"reason":"seed_funds","source":"system"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM transactions WHERE transaction_id = 'ddddddd5-dddd-4ddd-8ddd-ddddddddddd5'
);

INSERT INTO ledger_entries (ledger_entry_id, transaction_id, wallet_id, credit, balance_after)
SELECT
  'eeeeeee5-eeee-4eee-8eee-eeeeeeeeeee5',
  'ddddddd5-dddd-4ddd-8ddd-ddddddddddd5',
  'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2',
  450000.00,
  450000.00
WHERE NOT EXISTS (
  SELECT 1 FROM ledger_entries WHERE ledger_entry_id = 'eeeeeee5-eeee-4eee-8eee-eeeeeeeeeee5'
);

UPDATE wallets
SET balance = 450000.00, updated_at = NOW()
WHERE wallet_id = 'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2'
  AND balance = 0;