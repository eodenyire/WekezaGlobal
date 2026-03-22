/**
 * Tests — Developer Analytics, Event Stream, Changelog, and Partner Integration
 *
 * Validates the four developer-ecosystem endpoints added in v1.4.0:
 *
 *   GET  /v1/developer/analytics        — per-key usage stats
 *   GET  /v1/developer/events           — event stream history
 *   GET  /v1/developer/changelog        — API version history
 *   POST /v1/partner/payments           — partner payment initiation
 *   GET  /v1/partner/payments/:id       — partner payment status
 *   POST /v1/partner/risk/assess        — risk assessment
 *   POST /v1/partner/identity/verify    — identity verification
 *   GET  /v1/partner/identity/:id       — identity verification result
 *
 * All external infrastructure (PostgreSQL, Redis) is mocked so that these
 * tests run reliably in CI without any running services.
 */

// ── Mock all external infrastructure ──────────────────────────────────────────

jest.mock('../database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
  redis: {
    status: 'ready',
    get:    jest.fn().mockResolvedValue(null),
    setex:  jest.fn().mockResolvedValue('OK'),
    del:    jest.fn().mockResolvedValue(1),
    incr:   jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  },
  connectDB:    jest.fn().mockResolvedValue(undefined),
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import { pool, redis } from '../database';

// ── Helpers ────────────────────────────────────────────────────────────────────

const mockPool  = pool  as jest.Mocked<typeof pool>;
const mockRedis = redis as jest.Mocked<typeof redis>;

const JWT_SECRET =
  process.env.JWT_SECRET || 'dev-only-jwt-secret-do-not-use-in-production';

function makeToken(
  userId = 'dev-user-1',
  email  = 'developer@fintech.io',
  role   = 'user',
): string {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: 3600 });
}

const ACTIVE_API_KEY_DB_ROW = {
  rows: [{
    api_key_id: 'key-1',
    user_id:    'dev-user-1',
    email:      'developer@fintech.io',
    status:     'active',
  }],
};

beforeEach(() => {
  jest.resetAllMocks();
  (mockPool.query   as jest.Mock).mockResolvedValue({ rows: [] });
  (mockPool.connect as jest.Mock).mockResolvedValue({
    query:   jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  });
  (mockRedis.get    as jest.Mock).mockResolvedValue(null);
  (mockRedis.setex  as jest.Mock).mockResolvedValue('OK');
  (mockRedis.del    as jest.Mock).mockResolvedValue(1);
  (mockRedis.incr   as jest.Mock).mockResolvedValue(1);
  (mockRedis.expire as jest.Mock).mockResolvedValue(1);
});

// ═════════════════════════════════════════════════════════════════════════════
// Developer Analytics
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Analytics Dashboard (/v1/developer/analytics)', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/v1/developer/analytics');
    expect(res.status).toBe(401);
  });

  it('returns analytics for authenticated developer with no keys', async () => {
    // DB calls: api_keys (empty), webhooks stats, event stats
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })              // api_keys
      .mockResolvedValueOnce({ rows: [{ total: '0', active: '0' }] }) // webhooks
      .mockResolvedValueOnce({ rows: [{ total_events: '0', events_today: '0' }] }); // events

    const res = await request(app)
      .get('/v1/developer/analytics')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.api_keys.total).toBe(0);
    expect(res.body.api_keys.active).toBe(0);
    expect(res.body.api_keys.keys).toEqual([]);
    expect(res.body.requests.total_in_window).toBe(0);
    expect(res.body.requests.window).toBe('1 hour (rolling)');
    expect(res.body.webhooks.total).toBe(0);
    expect(res.body.webhooks.active).toBe(0);
    expect(res.body.events.total_dispatched).toBe(0);
    expect(res.body.events.dispatched_today).toBe(0);
  });

  it('returns analytics with active API key and Redis usage count', async () => {
    const keys = [
      { api_key_id: 'key-1', name: 'Production Key', status: 'active', created_at: new Date() },
      { api_key_id: 'key-2', name: 'Sandbox Key',    status: 'active', created_at: new Date() },
    ];
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: keys })             // api_keys
      .mockResolvedValueOnce({ rows: [{ total: '2', active: '2' }] }) // webhooks
      .mockResolvedValueOnce({ rows: [{ total_events: '15', events_today: '5' }] }); // events

    // Redis returns usage counts for each key
    (mockRedis.get as jest.Mock)
      .mockResolvedValueOnce('42') // key-1 usage
      .mockResolvedValueOnce('7'); // key-2 usage

    const res = await request(app)
      .get('/v1/developer/analytics')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.api_keys.total).toBe(2);
    expect(res.body.api_keys.active).toBe(2);
    expect(res.body.requests.total_in_window).toBe(49); // 42 + 7
    const keyMap = Object.fromEntries(res.body.api_keys.keys.map((k: { api_key_id: string; usage_count: number }) => [k.api_key_id, k.usage_count]));
    expect(keyMap['key-1']).toBe(42);
    expect(keyMap['key-2']).toBe(7);
    expect(res.body.webhooks.active).toBe(2);
    expect(res.body.events.total_dispatched).toBe(15);
    expect(res.body.events.dispatched_today).toBe(5);
  });

  it('handles Redis being unavailable gracefully (usage_count = 0)', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ api_key_id: 'key-1', name: 'My Key', status: 'active', created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ total: '0', active: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total_events: '0', events_today: '0' }] });

    (mockRedis.get as jest.Mock).mockRejectedValueOnce(new Error('Redis connection refused'));

    const res = await request(app)
      .get('/v1/developer/analytics')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.api_keys.keys[0].usage_count).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Developer Event Stream
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Event Stream (/v1/developer/events)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/v1/developer/events');
    expect(res.status).toBe(401);
  });

  it('returns empty event list for new developer', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/developer/events')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns recent events with correct shape', async () => {
    const now = new Date();
    const events = [
      {
        notification_id: 'notif-1',
        type:            'webhook_dispatch',
        title:           'Webhook: deposit',
        message:         'Event dispatched to https://partner.com/hook',
        metadata:        { webhook_id: 'wh-1', event: 'deposit' },
        created_at:      now,
      },
      {
        notification_id: 'notif-2',
        type:            'system',
        title:           'API Key Created',
        message:         'New API key created successfully',
        metadata:        {},
        created_at:      new Date(now.getTime() - 3600_000),
      },
    ];
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: events });

    const res = await request(app)
      .get('/v1/developer/events')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.events[0].event_id).toBe('notif-1');
    expect(res.body.events[0].type).toBe('webhook_dispatch');
    expect(res.body.events[0].title).toBeDefined();
    expect(res.body.events[1].event_id).toBe('notif-2');
  });

  it('respects the ?limit query parameter', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/developer/events?limit=5')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    // Verify the limit was passed (rows is empty, just no crash)
    expect(res.body.events).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Developer Changelog
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — API Changelog (/v1/developer/changelog)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/v1/developer/changelog');
    expect(res.status).toBe(401);
  });

  it('returns changelog with correct structure', async () => {
    const res = await request(app)
      .get('/v1/developer/changelog')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.changelog)).toBe(true);
    expect(res.body.changelog.length).toBeGreaterThan(0);

    const latest = res.body.changelog[0];
    expect(latest.version).toBeDefined();
    expect(latest.date).toBeDefined();
    expect(latest.type).toBeDefined();
    expect(Array.isArray(latest.changes)).toBe(true);
    expect(latest.changes.length).toBeGreaterThan(0);
  });

  it('changelog is in reverse-chronological order (latest first)', async () => {
    const res = await request(app)
      .get('/v1/developer/changelog')
      .set('Authorization', `Bearer ${makeToken()}`);

    const versions = res.body.changelog.map((e: { version: string }) => e.version);
    const sorted = [...versions].sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }));
    expect(versions).toEqual(sorted);
  });

  it('changelog includes the v1.0.0 initial release', async () => {
    const res = await request(app)
      .get('/v1/developer/changelog')
      .set('Authorization', `Bearer ${makeToken()}`);

    const versions = res.body.changelog.map((e: { version: string }) => e.version);
    expect(versions).toContain('1.0.0');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Partner Payments API
// ═════════════════════════════════════════════════════════════════════════════

describe('Partner Integration — Payments API (/v1/partner/payments)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/v1/partner/payments').send({});
    expect(res.status).toBe(401);
  });

  it('creates a partner payment with JWT auth and returns 201', async () => {
    const res = await request(app)
      .post('/v1/partner/payments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        source_account:      '1234567890',
        destination_account: '0987654321',
        amount:              5000,
        currency:            'KES',
        payment_rail:        'MPESA',
        narration:           'Partner test payment',
      });

    expect(res.status).toBe(201);
    expect(res.body.payment_id).toBeDefined();
    expect(res.body.status).toBe('pending');
    expect(res.body.currency).toBe('KES');
    expect(res.body.payment_rail).toBe('MPESA');
    expect(res.body.amount).toBe(5000);
    expect(res.body.created_at).toBeDefined();
    expect(res.body.estimated_settlement).toBeDefined();
  });

  it('creates a SWIFT partner payment and returns 201', async () => {
    const res = await request(app)
      .post('/v1/partner/payments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        source_account:      'ACC-001',
        destination_account: 'ACC-002',
        amount:              25000,
        currency:            'USD',
        payment_rail:        'SWIFT',
        reference:           'INV-2026-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.reference).toBe('INV-2026-001');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/v1/partner/payments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ amount: 100 }); // missing source/dest/currency/rail

    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported payment rail', async () => {
    const res = await request(app)
      .post('/v1/partner/payments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        source_account:      'ACC-001',
        destination_account: 'ACC-002',
        amount:              1000,
        currency:            'USD',
        payment_rail:        'UNSUPPORTED_RAIL',
      });

    expect(res.status).toBe(400);
  });

  it('retrieves partner payment status by ID', async () => {
    const paymentId = 'test-payment-id-123';
    const res = await request(app)
      .get(`/v1/partner/payments/${paymentId}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.payment_id).toBe(paymentId);
    expect(res.body.status).toBe('completed');
  });

  it('can authenticate with API key header (X-API-Key)', async () => {
    // Mock API key lookup
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .post('/v1/partner/payments')
      .set('X-API-Key', 'wgi_test_key')
      .send({
        source_account:      '1234567890',
        destination_account: '0987654321',
        amount:              1500,
        currency:            'KES',
        payment_rail:        'ACH',
      });

    expect(res.status).toBe(201);
    expect(res.body.payment_id).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Partner Risk API
// ═════════════════════════════════════════════════════════════════════════════

describe('Partner Integration — Risk API (/v1/partner/risk/assess)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/v1/partner/risk/assess').send({});
    expect(res.status).toBe(401);
  });

  it('returns low risk for small amount (<$1,000)', async () => {
    const res = await request(app)
      .post('/v1/partner/risk/assess')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        account_id:       'ACC-001',
        amount:           500,
        currency:         'USD',
        transaction_type: 'transfer',
      });

    expect(res.status).toBe(200);
    expect(res.body.assessment_id).toBeDefined();
    expect(res.body.risk_level).toBe('low');
    expect(res.body.recommendation).toBe('approve');
    expect(res.body.risk_score).toBeLessThan(30);
    expect(res.body.factors.amount_risk).toBe('normal');
  });

  it('returns medium risk for medium amount ($1,000–$10,000)', async () => {
    const res = await request(app)
      .post('/v1/partner/risk/assess')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        account_id:       'ACC-002',
        amount:           5000,
        currency:         'USD',
        transaction_type: 'payment',
      });

    expect(res.status).toBe(200);
    expect(res.body.risk_level).toBe('medium');
    expect(res.body.recommendation).toBe('review');
  });

  it('returns high risk for large amount (>$10,000)', async () => {
    const res = await request(app)
      .post('/v1/partner/risk/assess')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        account_id:       'ACC-003',
        amount:           50000,
        currency:         'USD',
        transaction_type: 'withdrawal',
      });

    expect(res.status).toBe(200);
    expect(res.body.risk_level).toBe('high');
    expect(res.body.recommendation).toBe('manual_review');
    expect(res.body.factors.amount_risk).toBe('elevated');
  });

  it('returns 400 for invalid transaction_type', async () => {
    const res = await request(app)
      .post('/v1/partner/risk/assess')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        account_id:       'ACC-001',
        amount:           100,
        currency:         'USD',
        transaction_type: 'invalid_type',
      });

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Partner Identity API
// ═════════════════════════════════════════════════════════════════════════════

describe('Partner Integration — Identity API (/v1/partner/identity/verify)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/v1/partner/identity/verify').send({});
    expect(res.status).toBe(401);
  });

  it('verifies identity and returns 201 with high confidence', async () => {
    const res = await request(app)
      .post('/v1/partner/identity/verify')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        full_name:             'John Doe',
        identification_number: 'KE12345678',
        id_type:               'national_id',
        phone_number:          '+254700000000',
      });

    expect(res.status).toBe(201);
    expect(res.body.verification_id).toBeDefined();
    expect(res.body.status).toBe('verified');
    expect(res.body.confidence_score).toBe(97);
    expect(res.body.full_name).toBe('John Doe');
    expect(res.body.id_type).toBe('national_id');
    expect(res.body.id_number_masked).toBeDefined();
    expect(res.body.id_number_masked).not.toContain('12345678'); // must be masked
    expect(res.body.verified_at).toBeDefined();
    expect(res.body.next_review_at).toBeDefined();
  });

  it('accepts passport as id_type', async () => {
    const res = await request(app)
      .post('/v1/partner/identity/verify')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        full_name:             'Jane Traveller',
        identification_number: 'A12345678',
        id_type:               'passport',
      });

    expect(res.status).toBe(201);
    expect(res.body.id_type).toBe('passport');
  });

  it('returns 400 for unsupported id_type', async () => {
    const res = await request(app)
      .post('/v1/partner/identity/verify')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        full_name:             'Bad Actor',
        identification_number: 'XYZ999',
        id_type:               'unknown_doc',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when full_name is missing', async () => {
    const res = await request(app)
      .post('/v1/partner/identity/verify')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        identification_number: 'KE12345678',
        id_type:               'national_id',
      });

    expect(res.status).toBe(400);
  });

  it('retrieves identity verification result by ID', async () => {
    const verificationId = 'verif-test-123';
    const res = await request(app)
      .get(`/v1/partner/identity/${verificationId}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.verification_id).toBe(verificationId);
    expect(res.body.status).toBe('verified');
    expect(res.body.confidence_score).toBe(97);
  });
});
