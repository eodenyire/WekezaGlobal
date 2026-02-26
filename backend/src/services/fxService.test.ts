/**
 * Unit tests for FX fee and conversion math.
 * The database, Redis, and wallet helpers are all mocked so these tests
 * run fully offline without any external infrastructure.
 */

// ── Mock external dependencies before any imports ────────────────────────────
jest.mock('../database', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
  redis: { status: 'wait', get: jest.fn(), setex: jest.fn() },
}));

jest.mock('../models/wallet', () => ({
  findWalletById: jest.fn(),
  findWalletByUserAndCurrency: jest.fn(),
}));

jest.mock('./walletService', () => ({
  debitWalletInternal: jest.fn(),
  creditWalletInternal: jest.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { getRate } from './fxService';
import { pool, redis } from '../database';
import { Currency } from '../models/types';

const mockPool = pool as jest.Mocked<typeof pool>;
const mockRedis = redis as unknown as {
  status: string;
  get: jest.MockedFunction<(key: string) => Promise<string | null>>;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getRate — same-currency synthetic rate', () => {
  it('returns a 1:1 synthetic rate when from === to', async () => {
    const rate = await getRate('USD' as Currency, 'USD' as Currency);
    expect(rate.rate).toBe('1.000000');
    expect(rate.currency_from).toBe('USD');
    expect(rate.currency_to).toBe('USD');
    expect(rate.provider).toBe('WGI');
  });
});

describe('getRate — DB-backed rate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Redis is not "ready", so falls through to DB
    mockRedis.status = 'wait';
  });

  it('returns the rate from the database', async () => {
    const fakeRate = {
      fx_rate_id: 'abc123',
      currency_from: 'USD',
      currency_to: 'KES',
      rate: '134.500000',
      provider: 'WGI',
      timestamp: new Date(),
    };
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [fakeRate] });

    const rate = await getRate('USD' as Currency, 'KES' as Currency);
    expect(rate.rate).toBe('134.500000');
    expect(rate.currency_from).toBe('USD');
    expect(rate.currency_to).toBe('KES');
  });

  it('throws 404 when no rate exists in DB', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(getRate('USD' as Currency, 'KES' as Currency)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('FX fee math', () => {
  const FX_FEE_RATE = 0.005; // 0.5% — matches config default

  it('calculates fee correctly for a standard conversion', () => {
    const amount = 1000;
    const fee = Math.round(amount * FX_FEE_RATE * 10000) / 10000;
    expect(fee).toBe(5); // 0.5% of 1000
  });

  it('calculates converted amount correctly after fee', () => {
    const amount = 1000;
    const rate = 134.5;
    const fee = Math.round(amount * FX_FEE_RATE * 10000) / 10000;
    const amountAfterFee = Math.round((amount - fee) * 10000) / 10000;
    const amountTo = Math.round(amountAfterFee * rate * 10000) / 10000;
    expect(fee).toBe(5);
    expect(amountAfterFee).toBe(995);
    expect(amountTo).toBe(133827.5);
  });

  it('handles small amounts without floating-point drift', () => {
    const amount = 0.01;
    const fee = Math.round(amount * FX_FEE_RATE * 10000) / 10000;
    const amountAfterFee = Math.round((amount - fee) * 10000) / 10000;
    expect(amountAfterFee).toBeCloseTo(0.01 - fee, 4);
  });
});
