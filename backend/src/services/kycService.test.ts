/**
 * Unit tests for kycService.scanTransactionsForAml
 * Architecture §4 — continuous compliance monitoring
 */

jest.mock('../database', () => ({
  pool: { query: jest.fn() },
}));

import { scanTransactionsForAml } from './kycService';
import { pool } from '../database';

const mockQuery = pool.query as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('scanTransactionsForAml', () => {
  it('returns zeros when no unscanned transactions exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // No transactions
    const result = await scanTransactionsForAml(60);
    expect(result).toEqual({ scanned: 0, alerts_created: 0 });
  });

  it('creates a HIGH alert for transactions > $10,000', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-1', wallet_id: 'w-1', amount: '15000', currency: 'USD', created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [] }) // rapid-succession batch (no results, single wallet)
      .mockResolvedValueOnce({ rows: [] }); // INSERT aml_alerts

    const result = await scanTransactionsForAml(60);
    expect(result.alerts_created).toBe(1);
    const insertCall = mockQuery.mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes('INSERT INTO aml_alerts')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toContain('high');
  });

  it('creates a MEDIUM alert for transactions between $5,000 and $10,000', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-2', wallet_id: 'w-2', amount: '7500', currency: 'USD', created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [] }) // rapid-succession batch
      .mockResolvedValueOnce({ rows: [] }); // INSERT aml_alerts

    const result = await scanTransactionsForAml(60);
    expect(result.alerts_created).toBe(1);
    const insertCall = mockQuery.mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes('INSERT INTO aml_alerts')
    );
    expect(insertCall![1]).toContain('medium');
  });

  it('creates a LOW alert when rapid-succession rule triggers (>5 tx in 5 min)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-3', wallet_id: 'w-3', amount: '100', currency: 'USD', created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ wallet_id: 'w-3', count: '7' }] }) // rapid-succession batch
      .mockResolvedValueOnce({ rows: [] }); // INSERT aml_alerts

    const result = await scanTransactionsForAml(60);
    expect(result.alerts_created).toBe(1);
    const insertCall = mockQuery.mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes('INSERT INTO aml_alerts')
    );
    expect(insertCall![1]).toContain('low');
  });

  it('does NOT create an alert for normal transactions below thresholds', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-4', wallet_id: 'w-4', amount: '50', currency: 'USD', created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ wallet_id: 'w-4', count: '2' }] }); // rapid-succession: only 2

    const result = await scanTransactionsForAml(60);
    expect(result.scanned).toBe(1);
    expect(result.alerts_created).toBe(0);
    const insertCall = mockQuery.mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes('INSERT INTO aml_alerts')
    );
    expect(insertCall).toBeUndefined();
  });

  it('handles multiple transactions and counts alerts correctly', async () => {
    mockQuery
      // Initial scan query
      .mockResolvedValueOnce({ rows: [
        { transaction_id: 'tx-a', wallet_id: 'w-a', amount: '12000', currency: 'USD', created_at: new Date() },
        { transaction_id: 'tx-b', wallet_id: 'w-b', amount: '200',   currency: 'USD', created_at: new Date() },
      ]})
      // Batch rapid-succession query — w-b has count=2 (not enough to trigger)
      .mockResolvedValueOnce({ rows: [{ wallet_id: 'w-b', count: '2' }] })
      .mockResolvedValueOnce({ rows: [] }); // INSERT for tx-a (high)

    const result = await scanTransactionsForAml(60);
    expect(result.scanned).toBe(2);
    expect(result.alerts_created).toBe(1);
  });
});
