/**
 * Unit tests for webhookService (Architecture §3.6 — fintech integration)
 */

jest.mock('../database', () => ({
  pool: { query: jest.fn() },
}));

import { registerWebhook, deleteWebhook, signPayload, getUserWebhooks } from './webhookService';
import { pool } from '../database';

const mockPool = pool as jest.Mocked<typeof pool>;

const makeWebhook = (overrides: Record<string, unknown> = {}) => ({
  webhook_id: 'wh-1',
  user_id:    'user-1',
  url:        'https://example.com/hook',
  events:     ['deposit', 'settlement_completed'],
  secret:     'whsec_abc123',
  status:     'active' as const,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

// ── registerWebhook ───────────────────────────────────────────────────────────

describe('registerWebhook', () => {
  it('throws 400 for unknown event types', async () => {
    await expect(registerWebhook('u1', 'https://x.com', ['unknown_event']))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('throws 400 when events array is empty', async () => {
    await expect(registerWebhook('u1', 'https://x.com', []))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('inserts and returns the webhook with a generated secret', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeWebhook()] });

    const result = await registerWebhook('user-1', 'https://example.com/hook', ['deposit']);

    expect(result.webhook_id).toBe('wh-1');
    expect(result.secret).toMatch(/^whsec_/);

    const [sql, params] = (mockPool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/INSERT INTO webhooks/i);
    expect(params[0]).toBe('user-1');
    expect(params[1]).toBe('https://example.com/hook');
    expect(params[2]).toContain('deposit');
    expect(params[3]).toMatch(/^whsec_/);
  });
});

// ── getUserWebhooks ───────────────────────────────────────────────────────────

describe('getUserWebhooks', () => {
  it('returns webhooks without secret field', async () => {
    const { secret: _s, ...publicWebhook } = makeWebhook();
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [publicWebhook] });

    const results = await getUserWebhooks('user-1');
    expect(results[0]).not.toHaveProperty('secret');
  });
});

// ── deleteWebhook ─────────────────────────────────────────────────────────────

describe('deleteWebhook', () => {
  it('throws 404 if webhook does not belong to user', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await expect(deleteWebhook('wh-1', 'wrong-user'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('deletes the webhook when ownership is confirmed', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [makeWebhook()] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(deleteWebhook('wh-1', 'user-1')).resolves.toBeUndefined();
    expect(mockPool.query).toHaveBeenCalledTimes(2);
  });
});

// ── signPayload ───────────────────────────────────────────────────────────────

describe('signPayload', () => {
  it('produces a sha256= prefixed HMAC signature', () => {
    const sig = signPayload('mysecret', '{"event":"deposit"}');
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('produces different signatures for different payloads', () => {
    const s1 = signPayload('secret', 'payload-a');
    const s2 = signPayload('secret', 'payload-b');
    expect(s1).not.toBe(s2);
  });

  it('produces different signatures for different secrets', () => {
    const s1 = signPayload('secret-a', 'payload');
    const s2 = signPayload('secret-b', 'payload');
    expect(s1).not.toBe(s2);
  });
});
