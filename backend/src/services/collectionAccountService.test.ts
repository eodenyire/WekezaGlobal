/**
 * Unit tests for collectionAccountService.
 * BRD §4.4 — Global Collection Accounts (BR-010, BR-011, BR-012)
 */

jest.mock('../database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../models/wallet', () => ({ findWalletById: jest.fn() }));
jest.mock('./walletService', () => ({
  deposit: jest.fn(),
}));

import {
  createCollectionAccount,
  getUserCollectionAccounts,
  getCollectionAccount,
  closeCollectionAccount,
  receivePayment,
} from './collectionAccountService';
import { pool } from '../database';
import { findWalletById } from '../models/wallet';
import { deposit } from './walletService';

const mockPool = pool as jest.Mocked<typeof pool>;
const mockFindWallet = findWalletById as jest.Mock;
const mockDeposit = deposit as jest.Mock;

// ── helpers ───────────────────────────────────────────────────────────────────

function mockWallet(currency: string) {
  return { wallet_id: 'wallet-1', user_id: 'user-1', currency, balance: 1000, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
}

function mockAccount(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    collection_account_id: 'ca-1',
    user_id: 'user-1',
    wallet_id: 'wallet-1',
    rail: 'ACH',
    currency: 'USD',
    label: 'My USD Account',
    routing_number: '021000021',
    account_number: '84700ABC1234',
    iban: null,
    bic: null,
    reference_code: 'ABC12345',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── createCollectionAccount ───────────────────────────────────────────────────

describe('createCollectionAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an ACH account for a USD wallet', async () => {
    const wallet = mockWallet('USD');
    const initial = mockAccount({ routing_number: null, account_number: null });
    const final   = mockAccount();

    mockFindWallet.mockResolvedValue(wallet);
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [initial] })  // INSERT
      .mockResolvedValueOnce({ rows: [final] });   // UPDATE with real coordinates

    const result = await createCollectionAccount({ user_id: 'user-1', wallet_id: 'wallet-1', rail: 'ACH' });
    expect(result.rail).toBe('ACH');
    expect(result.currency).toBe('USD');
    expect(result.routing_number).toBeTruthy();
  });

  it('creates a SEPA account for a EUR wallet', async () => {
    const wallet = mockWallet('EUR');
    const initial = mockAccount({ rail: 'SEPA', currency: 'EUR', routing_number: null, account_number: null });
    const final   = mockAccount({ rail: 'SEPA', currency: 'EUR', iban: 'DE89370400440532ABC1234', bic: 'COBADEFFXXX' });

    mockFindWallet.mockResolvedValue(wallet);
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [initial] })
      .mockResolvedValueOnce({ rows: [final] });

    const result = await createCollectionAccount({ user_id: 'user-1', wallet_id: 'wallet-1', rail: 'SEPA' });
    expect(result.rail).toBe('SEPA');
    expect(result.iban).toBeTruthy();
  });

  it('throws 404 when wallet not found', async () => {
    mockFindWallet.mockResolvedValue(null);
    await expect(
      createCollectionAccount({ user_id: 'user-1', wallet_id: 'wallet-x', rail: 'ACH' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when wallet belongs to different user', async () => {
    mockFindWallet.mockResolvedValue({ ...mockWallet('USD'), user_id: 'other-user' });
    await expect(
      createCollectionAccount({ user_id: 'user-1', wallet_id: 'wallet-1', rail: 'ACH' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 422 when rail is incompatible with wallet currency (ACH + EUR)', async () => {
    mockFindWallet.mockResolvedValue(mockWallet('EUR'));
    await expect(
      createCollectionAccount({ user_id: 'user-1', wallet_id: 'wallet-1', rail: 'ACH' })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws 422 when SEPA used with GBP wallet', async () => {
    mockFindWallet.mockResolvedValue(mockWallet('GBP'));
    await expect(
      createCollectionAccount({ user_id: 'user-1', wallet_id: 'wallet-1', rail: 'SEPA' })
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

// ── getUserCollectionAccounts ─────────────────────────────────────────────────

describe('getUserCollectionAccounts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a list of collection accounts for a user', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockAccount(), mockAccount({ collection_account_id: 'ca-2' })] });
    const accounts = await getUserCollectionAccounts('user-1');
    expect(accounts).toHaveLength(2);
  });

  it('returns empty array when user has no accounts', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const accounts = await getUserCollectionAccounts('user-1');
    expect(accounts).toEqual([]);
  });
});

// ── getCollectionAccount ──────────────────────────────────────────────────────

describe('getCollectionAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the account when found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockAccount()] });
    const acc = await getCollectionAccount('ca-1');
    expect(acc.collection_account_id).toBe('ca-1');
  });

  it('throws 404 when not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await expect(getCollectionAccount('ca-x')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── closeCollectionAccount ────────────────────────────────────────────────────

describe('closeCollectionAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('closes an account owned by the user', async () => {
    const closed = mockAccount({ status: 'closed' });
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [closed] });
    const result = await closeCollectionAccount('ca-1', 'user-1');
    expect(result.status).toBe('closed');
  });

  it('throws 404 when account not found or not owned by user', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await expect(closeCollectionAccount('ca-x', 'user-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── receivePayment (BR-012) ───────────────────────────────────────────────────

describe('receivePayment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('credits the linked wallet when payment is received (BR-012)', async () => {
    const acc = mockAccount();
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [acc] });
    mockDeposit.mockResolvedValueOnce({
      transaction: { transaction_id: 'tx-1' },
      balance_after: 1100,
    });

    const result = await receivePayment('ca-1', 250);
    expect(result.transaction_id).toBe('tx-1');
    expect(result.amount).toBe(250);
    expect(result.currency).toBe('USD');
    expect(mockDeposit).toHaveBeenCalledWith('wallet-1', 250, expect.objectContaining({ rail: 'ACH' }));
  });

  it('throws 422 when account is closed', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockAccount({ status: 'closed' })] });
    await expect(receivePayment('ca-1', 100)).rejects.toMatchObject({ statusCode: 422 });
  });
});
