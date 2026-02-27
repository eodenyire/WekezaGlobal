/**
 * Unit tests for wallet transaction-limit enforcement and management.
 * Security Model §4 — "Daily and per-transaction thresholds, configurable per user or wallet"
 */

jest.mock('../database', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
  redis: { status: 'wait', del: jest.fn() },
}));

jest.mock('../models/wallet', () => ({
  findWalletById: jest.fn(),
  findWalletsByUserId: jest.fn(),
}));

jest.mock('../models/transaction', () => ({
  findTransactionsByWalletId: jest.fn(),
}));

jest.mock('../middleware/errorHandler', () => ({
  createError: (msg: string, status: number) => {
    const err = new Error(msg) as Error & { status: number };
    err.status = status;
    return err;
  },
}));

import { withdraw, setWalletLimits, getWalletLimits } from './walletService';
import { findWalletById } from '../models/wallet';
import { pool } from '../database';
import { Wallet, Currency } from '../models/types';

const mockFindWalletById = findWalletById as jest.MockedFunction<typeof findWalletById>;
const mockPool = pool as jest.Mocked<typeof pool>;

function makeWallet(overrides: Partial<Wallet> = {}): Wallet {
  return {
    wallet_id: 'wallet-1',
    user_id:   'user-1',
    currency:  'USD' as Currency,
    balance:   '5000.00',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
//  Per-transaction limit enforcement (withdraw)
// ─────────────────────────────────────────────────────────────────────────────
describe('withdraw — per-transaction limit', () => {
  it('blocks a withdrawal that exceeds the per-transaction limit', async () => {
    // wallet_limits returns a per_tx_limit of 100
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ daily_limit: null, per_tx_limit: '100.00' }] });

    await expect(withdraw('wallet-1', 200)).rejects.toMatchObject({
      message: expect.stringContaining('per-transaction limit'),
    });
  });

  it('allows a withdrawal within the per-transaction limit', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ daily_limit: null, per_tx_limit: '500.00' }] }); // limits

    mockFindWalletById.mockResolvedValueOnce(makeWallet());

    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)                                        // BEGIN
        .mockResolvedValueOnce({ rows: [{ balance: '5000.00' }] })               // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-1', wallet_id: 'wallet-1', type: 'withdrawal', amount: '100', currency: 'USD', status: 'completed', metadata: '{}', created_at: new Date(), updated_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ balance: '4900.00', wallet_id: 'wallet-1', user_id: 'user-1', currency: 'USD', created_at: new Date(), updated_at: new Date() }] })
        .mockResolvedValueOnce(undefined)                                        // ledger entry
        .mockResolvedValueOnce(undefined),                                       // COMMIT
      release: jest.fn(),
    };
    (mockPool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

    const result = await withdraw('wallet-1', 100);
    expect(result.transaction).toBeDefined();
    expect(result.balance_after).toBe(4900);
  });

  it('allows withdrawal when no limits are configured', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }); // no limits

    mockFindWalletById.mockResolvedValueOnce(makeWallet());

    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ balance: '5000.00' }] })
        .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-1', wallet_id: 'wallet-1', type: 'withdrawal', amount: '50', currency: 'USD', status: 'completed', metadata: '{}', created_at: new Date(), updated_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ balance: '4950.00', wallet_id: 'wallet-1', user_id: 'user-1', currency: 'USD', created_at: new Date(), updated_at: new Date() }] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
      release: jest.fn(),
    };
    (mockPool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

    const result = await withdraw('wallet-1', 50);
    expect(result.balance_after).toBe(4950);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Daily limit enforcement (withdraw)
// ─────────────────────────────────────────────────────────────────────────────
describe('withdraw — daily limit', () => {
  it('blocks a withdrawal when daily limit would be exceeded', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ daily_limit: '1000.00', per_tx_limit: null }] }) // limits
      .mockResolvedValueOnce({ rows: [{ total: '900.00' }] }); // already used today

    await expect(withdraw('wallet-1', 200)).rejects.toMatchObject({
      message: expect.stringContaining('Daily limit'),
    });
  });

  it('allows a withdrawal when daily spend is within limit', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ daily_limit: '1000.00', per_tx_limit: null }] }) // limits
      .mockResolvedValueOnce({ rows: [{ total: '500.00' }] }); // used so far today

    mockFindWalletById.mockResolvedValueOnce(makeWallet());

    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ balance: '5000.00' }] })
        .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-2', wallet_id: 'wallet-1', type: 'withdrawal', amount: '300', currency: 'USD', status: 'completed', metadata: '{}', created_at: new Date(), updated_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ balance: '4700.00', wallet_id: 'wallet-1', user_id: 'user-1', currency: 'USD', created_at: new Date(), updated_at: new Date() }] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
      release: jest.fn(),
    };
    (mockPool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

    const result = await withdraw('wallet-1', 300);
    expect(result.balance_after).toBe(4700);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  setWalletLimits
// ─────────────────────────────────────────────────────────────────────────────
describe('setWalletLimits', () => {
  it('upserts and returns parsed limits', async () => {
    mockFindWalletById.mockResolvedValueOnce(makeWallet());
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ daily_limit: '1000.00', per_tx_limit: '200.00' }],
    });

    const result = await setWalletLimits('wallet-1', { daily_limit: 1000, per_tx_limit: 200 });

    expect(result.daily_limit).toBe(1000);
    expect(result.per_tx_limit).toBe(200);
    const [sql] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toContain('INSERT INTO wallet_limits');
    expect(sql).toContain('ON CONFLICT');
  });

  it('throws 404 when wallet does not exist', async () => {
    mockFindWalletById.mockResolvedValueOnce(null);
    await expect(setWalletLimits('no-such-wallet', { daily_limit: 500 })).rejects.toMatchObject({
      status: 404,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  getWalletLimits
// ─────────────────────────────────────────────────────────────────────────────
describe('getWalletLimits', () => {
  it('returns null when no limits are configured', async () => {
    mockFindWalletById.mockResolvedValueOnce(makeWallet());
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const result = await getWalletLimits('wallet-1');
    expect(result).toBeNull();
  });

  it('returns parsed limits when configured', async () => {
    mockFindWalletById.mockResolvedValueOnce(makeWallet());
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ daily_limit: '500.00', per_tx_limit: null }],
    });

    const result = await getWalletLimits('wallet-1');
    expect(result).toEqual({ daily_limit: 500, per_tx_limit: null });
  });
});
