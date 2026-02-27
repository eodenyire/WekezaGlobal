import { randomInt } from 'crypto';
import { pool } from '../database';
import { createError } from '../middleware/errorHandler';

export type MfaPurpose = 'withdrawal' | 'card_activation' | 'fx_conversion' | 'login';

/** OTP validity period in seconds (10 minutes) */
export const OTP_TTL_SECONDS = 600;

/**
 * Generates a 6-digit OTP for the given user and purpose, stores it in
 * mfa_tokens, and returns the plaintext OTP to be sent via SMS/email.
 *
 * Security Model §2 — "OTP via SMS/Email; Mandatory for withdrawals,
 * card activation, FX > threshold"
 */
export async function generateOtp(userId: string, purpose: MfaPurpose): Promise<string> {
  const otp = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await pool.query(
    `INSERT INTO mfa_tokens (user_id, otp, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, otp, purpose, expiresAt]
  );

  return otp;
}

/**
 * Verifies a submitted OTP against an unused, non-expired token for the
 * given user and purpose.  Marks the token as used on success to prevent replay.
 *
 * Throws 401 if the OTP is invalid or expired.
 */
export async function verifyOtp(
  userId: string,
  purpose: MfaPurpose,
  otp: string
): Promise<void> {
  const { rows } = await pool.query<{ token_id: string }>(
    `SELECT token_id
       FROM mfa_tokens
      WHERE user_id    = $1
        AND purpose    = $2
        AND otp        = $3
        AND used       = FALSE
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, purpose, otp]
  );

  if (rows.length === 0) {
    throw createError('Invalid or expired OTP', 401);
  }

  await pool.query(
    'UPDATE mfa_tokens SET used = TRUE WHERE token_id = $1',
    [rows[0].token_id]
  );
}
