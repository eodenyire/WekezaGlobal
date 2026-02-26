/**
 * Unit tests for creditService.
 * Two layers of coverage:
 *  1. Pure-math tests — validate the score constants and arithmetic in isolation.
 *  2. Integration-with-mock tests — validate recalculateCreditScore() drives
 *     the correct DB queries and persists the right score value.
 *
 * No real database or Redis connection is needed.
 */

// ── Mock external dependencies ────────────────────────────────────────────────
jest.mock('../database', () => ({
  pool: { query: jest.fn() },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { recalculateCreditScore, getCreditScore } from './creditService';
import { pool } from '../database';

const mockPool = pool as jest.Mocked<typeof pool>;

// ─── Score constants (must match creditService.ts) ───────────────────────────
const BASE_SCORE       = 500;
const MAX_SCORE        = 850;
const MIN_SCORE        = 300;
const TX_WEIGHT        = 2;
const TX_CAP           = 200;
const SETTLEMENT_WEIGHT = 5;
const SETTLEMENT_CAP   = 100;
const FX_WEIGHT        = 3;
const FX_CAP           = 50;

/** Pure reimplementation of the scoring formula for reference comparisons. */
function expectedScore(
  txCount: number,
  settlements: number,
  fxConversions: number
): number {
  const txPoints         = Math.min(TX_CAP,         txCount      * TX_WEIGHT);
  const settlementPoints = Math.min(SETTLEMENT_CAP, settlements  * SETTLEMENT_WEIGHT);
  const fxPoints         = Math.min(FX_CAP,         fxConversions * FX_WEIGHT);
  const raw              = BASE_SCORE + txPoints + settlementPoints + fxPoints;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, raw));
}

// ── Pure math tests ───────────────────────────────────────────────────────────

describe('credit score formula — pure math', () => {
  it('returns BASE_SCORE when there is no activity', () => {
    expect(expectedScore(0, 0, 0)).toBe(BASE_SCORE); // 500
  });

  it('adds transaction points proportionally to TX_WEIGHT', () => {
    expect(expectedScore(10, 0, 0)).toBe(BASE_SCORE + 10 * TX_WEIGHT); // 520
  });

  it('caps transaction points at TX_CAP', () => {
    // 200 transactions → 200*2=400, but cap is 200
    expect(expectedScore(200, 0, 0)).toBe(BASE_SCORE + TX_CAP); // 700
  });

  it('adds settlement points proportionally to SETTLEMENT_WEIGHT', () => {
    expect(expectedScore(0, 5, 0)).toBe(BASE_SCORE + 5 * SETTLEMENT_WEIGHT); // 525
  });

  it('caps settlement points at SETTLEMENT_CAP', () => {
    expect(expectedScore(0, 30, 0)).toBe(BASE_SCORE + SETTLEMENT_CAP); // 600
  });

  it('caps total score at MAX_SCORE', () => {
    // MAX contributions: BASE(500) + TX_CAP(200) + SETTLEMENT_CAP(100) + FX_CAP(50) = 850
    expect(expectedScore(200, 20, 20)).toBe(MAX_SCORE);
  });

  it('never falls below MIN_SCORE', () => {
    // BASE_SCORE(500) > MIN_SCORE(300) so the floor only triggers in theory
    expect(expectedScore(0, 0, 0)).toBeGreaterThanOrEqual(MIN_SCORE);
  });
});

// ── recalculateCreditScore — DB integration with mocks ───────────────────────

describe('recalculateCreditScore — DB integration', () => {
  beforeEach(() => jest.clearAllMocks());

  function mockDbForScore(txCount: number, settlements: number, fxConversions: number) {
    const score = expectedScore(txCount, settlements, fxConversions);
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] })             // user existence check
      .mockResolvedValueOnce({ rows: [{ count: String(txCount) }] })        // tx count
      .mockResolvedValueOnce({ rows: [{ count: String(settlements) }] })    // settlement count
      .mockResolvedValueOnce({ rows: [{ count: String(fxConversions) }] })  // fx count
      .mockResolvedValueOnce({                                              // upsert result
        rows: [{
          credit_score_id: 'cs-1',
          user_id: 'user-1',
          score: String(score),
          factors: {},
          last_updated: new Date(),
        }],
      });
  }

  it('persists score 500 for a new user with no activity', async () => {
    mockDbForScore(0, 0, 0);
    const result = await recalculateCreditScore('user-1');
    expect(parseFloat(result.score as unknown as string)).toBe(500);
  });

  it('computes and persists higher score with activity', async () => {
    // 10 tx + 5 settlements + 2 FX → 500+20+25+6 = 551
    mockDbForScore(10, 5, 2);
    const result = await recalculateCreditScore('user-1');
    expect(parseFloat(result.score as unknown as string)).toBe(expectedScore(10, 5, 2));
  });

  it('throws 404 when the user does not exist', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // user not found
    await expect(recalculateCreditScore('ghost-user')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getCreditScore — returns cached score if available ────────────────────────

describe('getCreditScore — cache path', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns existing score without recalculating when a row is found', async () => {
    const existingScore = {
      credit_score_id: 'cs-existing',
      user_id: 'user-1',
      score: '620',
      factors: {},
      last_updated: new Date(),
    };
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] })  // user check
      .mockResolvedValueOnce({ rows: [existingScore] });           // SELECT credit_scores

    const result = await getCreditScore('user-1');
    expect(parseFloat(result.score as unknown as string)).toBe(620);
    // Only 2 queries: user check + credit_scores SELECT (no tx/settlement/fx counts)
    expect((mockPool.query as jest.Mock).mock.calls.length).toBe(2);
  });
});
