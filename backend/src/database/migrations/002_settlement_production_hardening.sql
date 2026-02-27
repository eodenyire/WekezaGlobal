-- ============================================================
--  Settlement production hardening
-- ============================================================

ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(128),
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128),
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'settlements'
      AND column_name = 'status'
      AND constraint_name LIKE '%status%check%'
  ) THEN
    ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_status_check;
  END IF;
END $$;

ALTER TABLE settlements
  ADD CONSTRAINT settlements_status_check
  CHECK (status IN ('processing', 'pending', 'completed', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_idempotency_key
  ON settlements(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_provider_reference
  ON settlements(provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settlements_status_created
  ON settlements(status, created_at DESC);