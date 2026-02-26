/**
 * Unit tests for cardService.chargeCard (SDS §2.4 — spend monitoring & fraud alerts).
 * All DB and wallet dependencies are fully mocked.
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
import { chargeCard } from './cardService';
import { pool } from '../database';
import { withdraw } from './walletService';
import { Card, Currency } from '../models/types';

const mockPool  = pool  as jest.Mocked<typeof pool>;
const mockWithdraw = withdraw as jest.MockedFunction<typeof withdraw>;

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    card_id:        'card-1',
    wallet_id:      'wallet-1',
    card_type:      'virtual',
    status:         'active',
    spending_limit: '500.00',
    created_at:     new Date(),
    ...overrides,
  };
}

function makeCardTransaction() {
  return {
    card_tx_id: 'ctx-1',
    card_id:    'card-1',
    amount:     '100.00',
    currency:   'USD' as Currency,
    merchant:   'Amazon',
    status:     'completed',
    timestamp:  new Date(),
  };
}

// ── Input validation ──────────────────────────────────────────────────────────

describe('chargeCard — input validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 400 when amount is zero', async () => {
    await expect(chargeCard('card-1', 0, 'USD', 'Shop')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when amount is negative', async () => {
    await expect(chargeCard('card-1', -10, 'USD', 'Shop')).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── Card status checks ────────────────────────────────────────────────────────

describe('chargeCard — card status enforcement', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 400 when card is blocked', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeCard({ status: 'blocked' })] });
    await expect(chargeCard('card-1', 50, 'USD', 'Shop')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when card is expired', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeCard({ status: 'expired' })] });
    await expect(chargeCard('card-1', 50, 'USD', 'Shop')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when card does not exist', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await expect(chargeCard('nonexistent', 50, 'USD', 'Shop')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── Spending limit enforcement ────────────────────────────────────────────────

describe('chargeCard — spending limit enforcement', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 422 when amount exceeds spending limit', async () => {
    // spending_limit = 500, amount = 600
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeCard({ spending_limit: '500.00' })] });
    await expect(chargeCard('card-1', 600, 'USD', 'Shop'))
      .rejects.toMatchObject({ statusCode: 422 });
    // walletService.withdraw should NOT be called
    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it('allows a charge exactly equal to the spending limit', async () => {
    const card = makeCard({ spending_limit: '500.00' });
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [card] })                       // getCard SELECT
      .mockResolvedValueOnce({ rows: [makeCardTransaction()] });     // INSERT card_transactions

    mockWithdraw.mockResolvedValueOnce({
      transaction:   { transaction_id: 'tx-1' } as any,
      balance_after: 0,
    });

    const result = await chargeCard('card-1', 500, 'USD', 'Amazon');
    expect(result.card_tx_id).toBe('ctx-1');
    // amount == limit exactly (100% of limit ≥ 80%), so AML alert should be inserted
    const queryCalls = (mockPool.query as jest.Mock).mock.calls;
    const amlInsert = queryCalls.find((c) =>
      (c[0] as string).toLowerCase().includes('aml_alerts')
    );
    expect(amlInsert).toBeDefined();
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('chargeCard — happy path', () => {
  beforeEach(() => jest.clearAllMocks());

  it('processes a normal charge and does NOT create an AML alert when spend is below 80%', async () => {
    const card = makeCard({ spending_limit: '500.00' });
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [card] })                   // getCard SELECT
      .mockResolvedValueOnce({ rows: [makeCardTransaction()] }); // INSERT card_transactions

    mockWithdraw.mockResolvedValueOnce({
      transaction:   { transaction_id: 'tx-1' } as any,
      balance_after: 900,
    });

    // amount=100 → 100/500 = 20% < 80% — no AML alert
    const result = await chargeCard('card-1', 100, 'USD', 'Amazon');

    expect(result.card_tx_id).toBe('ctx-1');
    expect(mockWithdraw).toHaveBeenCalledWith('wallet-1', 100, expect.objectContaining({
      reason:  'card_charge',
      card_id: 'card-1',
    }));

    const queryCalls = (mockPool.query as jest.Mock).mock.calls;
    const amlInsert = queryCalls.find((c) =>
      (c[0] as string).toLowerCase().includes('aml_alerts')
    );
    expect(amlInsert).toBeUndefined();
  });

  it('creates an AML alert when spend is 80% or more of the spending limit', async () => {
    const card = makeCard({ spending_limit: '500.00' });
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [card] })                    // getCard SELECT
      .mockResolvedValueOnce({ rows: [makeCardTransaction()] })   // INSERT card_transactions
      .mockResolvedValueOnce({ rows: [] });                       // INSERT aml_alerts

    mockWithdraw.mockResolvedValueOnce({
      transaction:   { transaction_id: 'tx-1' } as any,
      balance_after: 100,
    });

    // amount=450 → 90% of limit → should trigger AML alert
    await chargeCard('card-1', 450, 'USD', 'BigStore');

    const queryCalls = (mockPool.query as jest.Mock).mock.calls;
    const amlInsert = queryCalls.find((c) =>
      (c[0] as string).toLowerCase().includes('aml_alerts')
    );
    expect(amlInsert).toBeDefined();
    expect(amlInsert![0]).toMatch(/high_card_spend/);
  });
});
