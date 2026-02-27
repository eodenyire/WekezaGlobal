-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — MFA Tokens
--  Migration 010: mfa_tokens for OTP-based multi-factor auth
--  (Security Model §2 — Authentication & Authorization)
-- ============================================================

CREATE TABLE IF NOT EXISTS mfa_tokens (
  token_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(user_id),
  otp        VARCHAR(6) NOT NULL,
  purpose    VARCHAR(50) NOT NULL
               CHECK (purpose IN ('withdrawal','card_activation','fx_conversion','login')),
  expires_at TIMESTAMP NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_user_id ON mfa_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_expires ON mfa_tokens(expires_at);
