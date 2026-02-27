/**
 * Unit tests for settlementService.
 * Focuses on the `resolveStatus` timing logic that automatically marks
 * settlements as completed after the configured window elapses.
 * All database interactions are fully mocked.
 */

// ── Mock external dependencies ────────────────────────────────────────────────
jest.mock('../database', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../models/wallet', () => ({
  findWalletById: jest.fn(),
}));

jest.mock('./walletService', () => ({
  withdraw: jest.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { getWalletSettlements, getSettlement } from './settlementService';
import { findWalletById } from '../models/wallet';
import { pool } from '../database';
import { Settlement, Currency, SettlementStatus } from '../models/types';

const mockFindWalletById = findWalletById as jest.MockedFunction<typeof findWalletById>;
const mockPool = pool as jest.Mocked<typeof pool>;

// SETTLEMENT_COMPLETION_MS from config defaults to 2 * 60 * 1000 = 120 000 ms
const COMPLETION_WINDOW_MS = 2 * 60 * 1000;

function makeSettlement(overrides: Partial<Settlement> = {}): Settlement {
  const now = new Date();
  return {
    settlement_id: 'settle-1',
    wallet_id: 'wallet-1',
    bank_id: 'bank-1',
    amount: '500.00',
    currency: 'KES' as Currency,
    status: 'pending' as SettlementStatus,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeWallet() {
  return {
    wallet_id: 'wallet-1',
    user_id: 'user-1',
    currency: 'KES' as Currency,
    balance: '1000.00',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

// ── resolveStatus via getWalletSettlements ────────────────────────────────────

describe('resolveStatus — settlement completion timing (via getWalletSettlements)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks a pending settlement as completed when the completion window has elapsed', async () => {
    const oldDate = new Date(Date.now() - COMPLETION_WINDOW_MS - 10_000); // 10 s over window
    const settlement = makeSettlement({ status: 'pending', updated_at: oldDate });

    mockFindWalletById.mockResolvedValueOnce(makeWallet());
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [settlement] });

    const results = await getWalletSettlements('wallet-1');
    expect(results[0].status).toBe('completed');
  });

  it('keeps a pending settlement as pending within the completion window', async () => {
    const recentDate = new Date(Date.now() - 30_000); // 30 s ago — within 120 s window
    const settlement = makeSettlement({ status: 'pending', updated_at: recentDate });

    mockFindWalletById.mockResolvedValueOnce(makeWallet());
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [settlement] });

    const results = await getWalletSettlements('wallet-1');
    expect(results[0].status).toBe('pending');
  });

  it('leaves an already-completed settlement as completed regardless of timing', async () => {
    const recentDate = new Date(Date.now() - 1_000);
    const settlement = makeSettlement({ status: 'completed', updated_at: recentDate });

    mockFindWalletById.mockResolvedValueOnce(makeWallet());
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [settlement] });

    const results = await getWalletSettlements('wallet-1');
    expect(results[0].status).toBe('completed');
  });
});

// ── getSettlement — persists auto-completed status ───────────────────────────

describe('getSettlement — auto-completion persistence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates the DB and inserts reconciliation log when a settlement auto-completes', async () => {
    const oldDate = new Date(Date.now() - COMPLETION_WINDOW_MS - 5_000);
    const settlement = makeSettlement({ status: 'pending', updated_at: oldDate });

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [settlement] }) // SELECT settlement
      .mockResolvedValueOnce({ rows: [] })            // UPDATE settlements SET status='completed'
      .mockResolvedValueOnce({ rows: [] });           // INSERT reconciliation_logs

    const result = await getSettlement('settle-1');

    expect(result.status).toBe('completed');
    // Should have issued an UPDATE and an INSERT
    const calls = (mockPool.query as jest.Mock).mock.calls;
    expect(calls.length).toBe(3);
    expect((calls[1][0] as string).toLowerCase()).toContain('update settlements');
    expect((calls[2][0] as string).toLowerCase()).toContain('insert into reconciliation_logs');
  });

  it('does NOT touch the DB when the settlement is already completed', async () => {
    const recentDate = new Date();
    const settlement = makeSettlement({ status: 'completed', updated_at: recentDate });

    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [settlement] });

    const result = await getSettlement('settle-1');
    expect(result.status).toBe('completed');
    // Only the initial SELECT should have run
    expect((mockPool.query as jest.Mock).mock.calls.length).toBe(1);
  });
});
