/**
 * Unit tests for mfaService (OTP generation & verification)
 * Security Model §2 — "OTP via SMS/Email; Mandatory for withdrawals,
 * card activation, FX > threshold"
 */

jest.mock('../database', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../middleware/errorHandler', () => ({
  createError: (msg: string, status: number) => {
    const err = new Error(msg) as Error & { status: number };
    err.status = status;
    return err;
  },
}));

import { generateOtp, verifyOtp, OTP_TTL_SECONDS } from './mfaService';
import { pool } from '../database';

const mockQuery = pool.query as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('generateOtp', () => {
  it('inserts a 6-digit OTP and returns it', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const otp = await generateOtp('user-1', 'withdrawal');

    expect(otp).toMatch(/^\d{6}$/);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO mfa_tokens');
    expect(params[0]).toBe('user-1');
    expect(params[1]).toBe(otp);
    expect(params[2]).toBe('withdrawal');
    // expires_at should be ~10 minutes from now
    const expiresAt: Date = params[3];
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + (OTP_TTL_SECONDS - 5) * 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + (OTP_TTL_SECONDS + 5) * 1000);
  });

  it('generates a different OTP each time', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const otps = await Promise.all([
      generateOtp('user-1', 'login'),
      generateOtp('user-1', 'login'),
      generateOtp('user-1', 'login'),
    ]);

    const unique = new Set(otps);
    // With 900,000 possible values the probability of collision is negligible
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('verifyOtp', () => {
  it('resolves when a valid, unused, non-expired token exists and marks it used', async () => {
    const tokenId = 'token-abc';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ token_id: tokenId }] }) // SELECT
      .mockResolvedValueOnce({ rows: [] });                      // UPDATE used=true

    await expect(verifyOtp('user-1', 'withdrawal', '123456')).resolves.toBeUndefined();

    const [updateSql, updateParams] = mockQuery.mock.calls[1];
    expect(updateSql).toContain('UPDATE mfa_tokens SET used = TRUE');
    expect(updateParams[0]).toBe(tokenId);
  });

  it('throws 401 when no matching token is found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // token not found

    await expect(verifyOtp('user-1', 'withdrawal', '000000')).rejects.toMatchObject({
      message: 'Invalid or expired OTP',
      status: 401,
    });
  });

  it('throws 401 for expired OTP (no rows returned)', async () => {
    // expired OTPs are filtered by NOW() in the query; DB returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(verifyOtp('user-2', 'card_activation', '999999')).rejects.toMatchObject({
      status: 401,
    });
  });
});
