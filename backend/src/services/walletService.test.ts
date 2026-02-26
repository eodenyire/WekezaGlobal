/**
 * Unit tests for walletService business-rule validation.
 * All database and Redis dependencies are fully mocked so these tests run
 * offline without any external infrastructure.
 */

// ── Mock external dependencies ────────────────────────────────────────────────
jest.mock('../database', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
  redis: { status: 'wait', del: jest.fn(), get: jest.fn(), setex: jest.fn() },
}));

jest.mock('../models/wallet', () => ({
  findWalletById: jest.fn(),
  findWalletsByUserId: jest.fn(),
}));

jest.mock('../models/transaction', () => ({
  findTransactionsByWalletId: jest.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { deposit, withdraw, transfer, createWallet } from './walletService';
import { findWalletById } from '../models/wallet';
import { pool } from '../database';
import { Wallet, Currency } from '../models/types';

const mockFindWalletById = findWalletById as jest.MockedFunction<typeof findWalletById>;
const mockPool = pool as jest.Mocked<typeof pool>;

function makeWallet(overrides: Partial<Wallet> = {}): Wallet {
  return {
    wallet_id: 'wallet-1',
    user_id: 'user-1',
    currency: 'USD' as Currency,
    balance: '1000.00',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ── deposit ───────────────────────────────────────────────────────────────────

describe('deposit — input validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 400 when amount is zero', async () => {
    await expect(deposit('wallet-1', 0)).rejects.toMatchObject({ statusCode: 400 });
    // Should not even reach the DB
    expect(mockFindWalletById).not.toHaveBeenCalled();
  });

  it('throws 400 when amount is negative', async () => {
    await expect(deposit('wallet-1', -50)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockFindWalletById).not.toHaveBeenCalled();
  });

  it('throws 404 when wallet does not exist', async () => {
    mockFindWalletById.mockResolvedValueOnce(null);
    await expect(deposit('wallet-1', 100)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── withdraw ──────────────────────────────────────────────────────────────────

describe('withdraw — input validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 400 when amount is zero', async () => {
    await expect(withdraw('wallet-1', 0)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockFindWalletById).not.toHaveBeenCalled();
  });

  it('throws 400 when amount is negative', async () => {
    await expect(withdraw('wallet-1', -1)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when wallet does not exist', async () => {
    mockFindWalletById.mockResolvedValueOnce(null);
    await expect(withdraw('wallet-1', 50)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 422 when balance is insufficient (pre-lock check)', async () => {
    // balance=10, amount=100 → insufficient before pool.connect
    mockFindWalletById.mockResolvedValueOnce(makeWallet({ balance: '10.00' }));
    await expect(withdraw('wallet-1', 100)).rejects.toMatchObject({ statusCode: 422 });
    // Should not have tried to open a DB transaction
    expect(mockPool.connect).not.toHaveBeenCalled();
  });
});

// ── transfer ──────────────────────────────────────────────────────────────────

describe('transfer — input validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 400 when amount is zero', async () => {
    await expect(transfer('w1', 'w2', 0)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when source and destination wallet IDs are identical', async () => {
    await expect(transfer('wallet-1', 'wallet-1', 100)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when source wallet does not exist', async () => {
    mockFindWalletById.mockResolvedValueOnce(null);
    await expect(transfer('w1', 'w2', 100)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when destination wallet does not exist', async () => {
    mockFindWalletById
      .mockResolvedValueOnce(makeWallet({ wallet_id: 'w1', currency: 'USD' }))
      .mockResolvedValueOnce(null);
    await expect(transfer('w1', 'w2', 100)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when wallets have different currencies', async () => {
    mockFindWalletById
      .mockResolvedValueOnce(makeWallet({ wallet_id: 'w1', currency: 'USD' }))
      .mockResolvedValueOnce(makeWallet({ wallet_id: 'w2', currency: 'KES' as Currency }));
    await expect(transfer('w1', 'w2', 100)).rejects.toMatchObject({ statusCode: 400 });
    // Should not try to open a DB transaction
    expect(mockPool.connect).not.toHaveBeenCalled();
  });
});

// ── createWallet ──────────────────────────────────────────────────────────────

describe('createWallet — duplicate detection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 409 when the user already has a wallet in that currency', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeWallet()] });
    await expect(createWallet('user-1', 'USD')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('creates a wallet when none exists', async () => {
    const newWallet = makeWallet({ wallet_id: 'new-wallet' });
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })        // no existing wallet
      .mockResolvedValueOnce({ rows: [newWallet] }); // insert result
    const result = await createWallet('user-1', 'USD');
    expect(result.wallet_id).toBe('new-wallet');
  });
});
