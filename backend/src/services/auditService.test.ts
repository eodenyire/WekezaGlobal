/**
 * Unit tests for auditService.logAuditEvent
 * Security Model §5 — "All system, transaction, and API activity logged for 7+ years"
 */

jest.mock('../database', () => ({
  pool: { query: jest.fn() },
}));

import { logAuditEvent } from './auditService';
import { pool } from '../database';

const mockQuery = pool.query as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('logAuditEvent', () => {
  it('inserts an audit record with all provided fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await logAuditEvent({
      userId: 'user-1',
      action: 'wallet.withdrawal',
      entityType: 'wallet',
      entityId: 'wallet-1',
      metadata: { amount: 500 },
      ipAddress: '192.168.1.1',
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO audit_logs');
    expect(params[0]).toBe('user-1');
    expect(params[1]).toBe('wallet.withdrawal');
    expect(params[2]).toBe('wallet');
    expect(params[4]).toBe(JSON.stringify({ amount: 500 }));
    expect(params[5]).toBe('192.168.1.1');
  });

  it('uses NULL for optional fields when omitted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await logAuditEvent({ action: 'user.login' });

    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBeNull(); // userId
    expect(params[2]).toBeNull(); // entityType
    expect(params[3]).toBeNull(); // entityId
    expect(params[5]).toBeNull(); // ipAddress
  });

  it('is non-fatal when the database insert fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    // Should not throw
    await expect(
      logAuditEvent({ action: 'user.register', userId: 'user-2' })
    ).resolves.toBeUndefined();
  });

  it('records default empty metadata when none provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await logAuditEvent({ action: 'kyc.submit', userId: 'user-3' });

    const [, params] = mockQuery.mock.calls[0];
    expect(params[4]).toBe(JSON.stringify({}));
  });
});
