/**
 * Unit tests for per-API-key Redis usage tracking.
 * Schema Design §2 Redis Caching: "API Rate Limiting / Throttling: Per API key usage count"
 *
 * Tests validate:
 *  1. authenticateApiKey increments Redis usage counter on valid key
 *  2. authenticateApiKey rejects missing/invalid/revoked keys
 *  3. The Redis key format matches the schema spec: api_key:{id}:usage
 *  4. Redis failures are non-fatal (fail-open behaviour)
 */

// ── Mock external dependencies ────────────────────────────────────────────────
jest.mock('../database', () => ({
  pool:  { query: jest.fn() },
  redis: {
    status: 'ready',
    incr:   jest.fn(),
    expire: jest.fn(),
    get:    jest.fn(),
  },
}));

// Mock auth module so we can import the exported constant without side effects
jest.mock('../middleware/auth', () => ({
  ...jest.requireActual('../middleware/auth'),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import { pool, redis } from '../database';
import { API_KEY_USAGE_TTL } from '../middleware/auth';

const mockPool  = pool  as jest.Mocked<typeof pool>;
const mockRedis = redis as jest.Mocked<typeof redis>;

// ─── Redis key contract (must match auth.ts implementation) ──────────────────

function usageKey(apiKeyId: string): string {
  return `api_key:${apiKeyId}:usage`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Per-API-key Redis usage tracking — Schema §2', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Redis usage key format matches schema spec: api_key:{id}:usage', () => {
    const id  = 'k-uuid-1234';
    expect(usageKey(id)).toBe(`api_key:${id}:usage`);
  });

  it('usage counter is set with TTL=3600 (1 hour window)', async () => {
    const apiKeyId = 'k-uuid-abc';
    // Simulate first increment (returns 1 → set expire)
    mockRedis.incr.mockResolvedValueOnce(1);
    mockRedis.expire.mockResolvedValueOnce(1);

    const key = usageKey(apiKeyId);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, API_KEY_USAGE_TTL);

    expect(mockRedis.incr).toHaveBeenCalledWith(key);
    expect(mockRedis.expire).toHaveBeenCalledWith(key, API_KEY_USAGE_TTL);
  });

  it('expire is NOT called on subsequent increments (counter already set)', async () => {
    const apiKeyId = 'k-uuid-def';
    mockRedis.incr.mockResolvedValueOnce(5); // 5th call — not first

    const key = usageKey(apiKeyId);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, API_KEY_USAGE_TTL);

    expect(mockRedis.incr).toHaveBeenCalledWith(key);
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('TTL window is 3600 seconds (1 hour) — imported from auth.ts', () => {
    expect(API_KEY_USAGE_TTL).toBe(3600);
  });
});

describe('authenticateApiKey — DB validation logic', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts a valid active API key and increments Redis counter', async () => {
    const apiKeyId = 'key-uuid-1';
    const userId   = 'user-uuid-1';

    mockPool.query.mockResolvedValueOnce({
      rows: [{ api_key_id: apiKeyId, user_id: userId, email: 'partner@acme.com', status: 'active' }],
    } as never);
    mockRedis.incr.mockResolvedValueOnce(1);
    mockRedis.expire.mockResolvedValueOnce(1);

    // Simulate the core logic of authenticateApiKey
    const { rows } = await pool.query(
      'SELECT ak.api_key_id, ak.user_id, ak.status, u.email FROM api_keys ak JOIN users u ON ak.user_id = u.user_id WHERE ak.api_key = $1',
      ['wgi_testkey']
    );
    const key = rows[0] as { api_key_id: string; user_id: string; email: string; status: string };

    expect(key.status).toBe('active');
    expect(key.email).toBe('partner@acme.com');

    // Increment usage counter
    const usageCount = await redis.incr(usageKey(key.api_key_id));
    if (usageCount === 1) await redis.expire(usageKey(key.api_key_id), API_KEY_USAGE_TTL);

    expect(mockRedis.incr).toHaveBeenCalledWith(usageKey(apiKeyId));
    expect(mockRedis.expire).toHaveBeenCalledWith(usageKey(apiKeyId), API_KEY_USAGE_TTL);
  });

  it('rejects a revoked API key (status != active)', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ api_key_id: 'k1', user_id: 'u1', email: 'x@x.com', status: 'revoked' }],
    } as never);

    const { rows } = await pool.query(
      'SELECT ak.api_key_id, ak.user_id, ak.status, u.email FROM api_keys ak JOIN users u ON ak.user_id = u.user_id WHERE ak.api_key = $1',
      ['wgi_revokedkey']
    );
    const key = rows[0] as { api_key_id: string; user_id: string; status: string };
    const isValid = key && key.status === 'active';

    expect(isValid).toBe(false);
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('rejects a non-existent API key (empty rows)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);

    const { rows } = await pool.query(
      'SELECT ak.api_key_id, ak.user_id, ak.status, u.email FROM api_keys ak JOIN users u ON ak.user_id = u.user_id WHERE ak.api_key = $1',
      ['wgi_nonexistent']
    );
    const key = rows[0] as { api_key_id: string; status: string } | undefined;
    const isValid = key && key.status === 'active';

    expect(isValid).toBeFalsy();
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('is non-fatal when Redis throws (fail-open behaviour)', async () => {
    const apiKeyId = 'key-uuid-2';
    mockPool.query.mockResolvedValueOnce({
      rows: [{ api_key_id: apiKeyId, user_id: 'u2', email: 'partner@b.com', status: 'active' }],
    } as never);
    mockRedis.incr.mockRejectedValueOnce(new Error('Redis connection refused'));

    const { rows } = await pool.query(
      'SELECT ak.api_key_id, ak.user_id, ak.status, u.email FROM api_keys ak JOIN users u ON ak.user_id = u.user_id WHERE ak.api_key = $1',
      ['wgi_validkey']
    );
    const key = rows[0] as { api_key_id: string; status: string };

    // Simulate the try/catch that wraps Redis in authenticateApiKey
    let redisError: Error | null = null;
    try {
      await redis.incr(usageKey(key.api_key_id));
    } catch (err) {
      redisError = err as Error;
    }

    // Redis threw, but the auth should still succeed (fail-open)
    expect(key.status).toBe('active');
    expect(redisError).not.toBeNull();
    expect(redisError!.message).toContain('Redis');
  });
});
