/**
 * Regression Tests — Developer Ecosystem Flow
 *
 * Validates the complete external-developer lifecycle:
 *
 *   1. Register a developer account  (POST /auth/register)
 *   2. Login and receive JWT token   (POST /auth/login)
 *   3. Retrieve developer profile    (GET  /auth/me)
 *   4. Create an API key             (POST /v1/api-keys)
 *   5. List API keys                 (GET  /v1/api-keys)
 *   6. Inspect API-key usage         (GET  /v1/api-keys/:id/usage)
 *   7. Call sandbox health           (GET  /v1/sandbox/health  — no auth)
 *   8. Call sandbox core-banking endpoints with the API key:
 *        - List accounts
 *        - Open an account
 *        - Get account balance
 *        - Get account statement
 *        - Fund transfer
 *        - M-Pesa deposit
 *        - Apply for a loan
 *        - Repay a loan
 *        - Issue a card
 *        - Cross-bank payment
 *        - M-Pesa STK push
 *   9. Revoke the API key            (DELETE /v1/api-keys/:id)
 *  10. Verify revoked key is rejected (401) on subsequent call
 *
 * Also covers negative / security paths:
 *   - Duplicate registration (409)
 *   - Invalid credentials (401)
 *   - Accessing protected routes without token (401)
 *   - Using a revoked API key (401)
 *   - Creating a second API key and checking both appear in list
 *   - OAuth2 client-credentials flow (POST /auth/token)
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
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import app from '../server';
import { pool, redis } from '../database';

// ── Helpers ────────────────────────────────────────────────────────────────────

const mockPool  = pool  as jest.Mocked<typeof pool>;
const mockRedis = redis as jest.Mocked<typeof redis>;

const JWT_SECRET =
  process.env.JWT_SECRET || 'dev-only-jwt-secret-do-not-use-in-production';

/** Build a signed JWT for any user role */
function makeToken(
  userId = 'dev-user-1',
  email  = 'developer@fintech.io',
  role: string = 'user',
): string {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: 3600 });
}

/** A developer user row returned by the DB */
function makeDeveloperUser(overrides: Record<string, unknown> = {}) {
  return {
    user_id:      'dev-user-1',
    full_name:    'Alice Developer',
    email:        'developer@fintech.io',
    phone_number: '+254700000099',
    password_hash: '$2a$12$hashvalue',
    kyc_status:   'verified',
    role:         'user',
    account_type: 'startup',
    created_at:   new Date('2024-01-01T00:00:00Z'),
    updated_at:   new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** An API key row */
function makeApiKey(overrides: Record<string, unknown> = {}) {
  return {
    api_key_id: 'key-1',
    user_id:    'dev-user-1',
    api_key:    'wgi_abcdef1234…',
    name:       'My Fintech App',
    status:     'active',
    created_at: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  };
}

/** Minimal DB row returned when authenticating via an API key */
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
// 1. DEVELOPER REGISTRATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Step 1: Account Registration', () => {
  it('registers a new developer account and returns 201 with JWT', async () => {
    const newDev = makeDeveloperUser({ email: 'alice@fintech.io' });

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })          // findByEmail → no existing user
      .mockResolvedValueOnce({ rows: [newDev] });   // INSERT user

    const res = await request(app)
      .post('/auth/register')
      .send({
        full_name:    'Alice Developer',
        email:        'alice@fintech.io',
        password:     'Secure@Pass123',
        phone_number: '+254700000099',
        account_type: 'startup',
      });

    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.token_type).toBe('Bearer');
    expect(res.body.user.email).toBe('alice@fintech.io');
    expect(res.body.user.password_hash).toBeUndefined(); // Never expose hash
  });

  it('returns 409 when email is already registered', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [makeDeveloperUser()] }); // email already exists

    const res = await request(app)
      .post('/auth/register')
      .send({
        full_name: 'Alice Developer',
        email:     'developer@fintech.io',
        password:  'Secure@Pass123',
      });

    expect(res.status).toBe(409);
  });

  it('returns 400 when password is too short (< 8 chars)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ full_name: 'A', email: 'a@b.com', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ full_name: 'Alice', password: 'Secure@Pass123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when full_name is missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'dev@fintech.io', password: 'Secure@Pass123' });

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. DEVELOPER LOGIN
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Step 2: Login', () => {
  it('returns 200 with access_token for valid credentials', async () => {
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const hash   = await bcrypt.hash('Secure@Pass123', 1);
    const devUser = makeDeveloperUser({ password_hash: hash });

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [devUser] }); // findByEmail

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'developer@fintech.io', password: 'Secure@Pass123' });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.token_type).toBe('Bearer');
    expect(res.body.user.email).toBe('developer@fintech.io');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('returns 401 for wrong password', async () => {
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const hash   = await bcrypt.hash('CorrectPass@123', 1);

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [makeDeveloperUser({ password_hash: hash })] });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'developer@fintech.io', password: 'WrongPass@999' });

    expect(res.status).toBe(401);
  });

  it('returns 401 when developer account is not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // user not found

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ghost@nowhere.io', password: 'SomePass@123' });

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. OAUTH2 CLIENT CREDENTIALS (Machine-to-Machine)
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — OAuth2 Client Credentials Flow', () => {
  it('returns access_token for valid client_id + client_secret', async () => {
    const res = await request(app)
      .post('/auth/token')
      .send({
        client_id:     'wgi-client',
        client_secret: 'wgi-client-secret',
        grant_type:    'client_credentials',
      });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.token_type).toBe('Bearer');
  });

  it('returns 401 for invalid client credentials', async () => {
    const res = await request(app)
      .post('/auth/token')
      .send({
        client_id:     'bad-client',
        client_secret: 'bad-secret',
        grant_type:    'client_credentials',
      });

    expect(res.status).toBe(401);
  });

  it('returns 401 for unsupported grant_type', async () => {
    const res = await request(app)
      .post('/auth/token')
      .send({
        client_id:     'wgi-client',
        client_secret: 'wgi-client-secret',
        grant_type:    'authorization_code',
      });

    // The service throws 401 for any unsupported or invalid credential combination
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. DEVELOPER PROFILE
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Step 3: Profile Access', () => {
  const token = makeToken();

  it('returns full profile for authenticated developer', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [makeDeveloperUser()] });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('developer@fintech.io');
    expect(res.body.password_hash).toBeUndefined();
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a tampered/expired token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.token.value');

    expect(res.status).toBe(401);
  });

  it('allows developer to update their profile', async () => {
    const updated = makeDeveloperUser({ full_name: 'Alice Updated', phone_number: '+254711111111' });

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [updated] });

    const res = await request(app)
      .put('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_name: 'Alice Updated', phone_number: '+254711111111' });

    expect(res.status).toBe(200);
    expect(res.body.full_name).toBe('Alice Updated');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. API KEY CREATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Step 4: API Key Creation', () => {
  const token = makeToken();

  it('creates an API key for the authenticated developer', async () => {
    const apiKeyRow = {
      api_key_id: 'key-abc-1',
      user_id:    'dev-user-1',
      api_key:    'wgi_abc123def456789012345678901234567890123456789012345678901234',
      name:       'My Fintech App',
      status:     'active',
      created_at: new Date(),
    };

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [apiKeyRow] }); // INSERT api_key

    const res = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Fintech App' });

    expect(res.status).toBe(201);
    expect(res.body.api_key_id).toBeDefined();
    expect(res.body.name).toBe('My Fintech App');
    expect(res.body.status).toBe('active');
    expect(res.body.raw_key).toMatch(/^wgi_/);   // Raw key only on creation
  });

  it('requires authentication to create an API key', async () => {
    const res = await request(app)
      .post('/v1/api-keys')
      .send({ name: 'No Auth Key' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when key name is missing', async () => {
    const res = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('creates a second API key for the same developer', async () => {
    const apiKeyRow2 = {
      api_key_id: 'key-abc-2',
      user_id:    'dev-user-1',
      api_key:    'wgi_second_key_abc123456789012345678901234567890123456789012345',
      name:       'My Payment Integration',
      status:     'active',
      created_at: new Date(),
    };

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [apiKeyRow2] });

    const res = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Payment Integration' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Payment Integration');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. API KEY LISTING
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Step 5: List API Keys', () => {
  const token = makeToken();

  it('returns all API keys for the developer', async () => {
    const keys = [
      makeApiKey({ api_key_id: 'key-1', name: 'My Fintech App' }),
      makeApiKey({ api_key_id: 'key-2', name: 'My Payment Integration' }),
    ];

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: keys });

    const res = await request(app)
      .get('/v1/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.api_keys).toHaveLength(2);
    expect(res.body.api_keys[0].name).toBe('My Fintech App');
    expect(res.body.api_keys[1].name).toBe('My Payment Integration');
    // Raw key must never appear in list response
    res.body.api_keys.forEach((k: Record<string, unknown>) => {
      expect(k.api_key).not.toMatch(/^wgi_[a-f0-9]{64}$/);
    });
  });

  it('returns empty list when developer has no keys', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.api_keys).toHaveLength(0);
  });

  it('requires authentication to list API keys', async () => {
    const res = await request(app).get('/v1/api-keys');
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. API KEY USAGE TRACKING
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Step 6: API Key Usage Tracking', () => {
  const token = makeToken();

  it('returns usage count for owned API key', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ user_id: 'dev-user-1' }] }); // ownership check
    (mockRedis.get as jest.Mock).mockResolvedValueOnce('42');         // usage count

    const res = await request(app)
      .get('/v1/api-keys/key-1/usage')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.api_key_id).toBe('key-1');
    expect(res.body.usage_count).toBe(42);
    expect(res.body.window).toBe('1 hour');
  });

  it('returns 0 usage when no Redis key exists', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ user_id: 'dev-user-1' }] });
    (mockRedis.get as jest.Mock).mockResolvedValueOnce(null); // no usage recorded

    const res = await request(app)
      .get('/v1/api-keys/key-1/usage')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.usage_count).toBe(0);
  });

  it('returns 404 when API key does not exist', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }); // key not found

    const res = await request(app)
      .get('/v1/api-keys/non-existent-key/usage')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when developer tries to access another user key usage', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ user_id: 'other-user-999' }] }); // different owner

    const res = await request(app)
      .get('/v1/api-keys/key-other/usage')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. SANDBOX HEALTH CHECK (No Auth Required)
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Step 7: Sandbox Health Check', () => {
  it('GET /v1/sandbox/health returns 200 without any credentials', async () => {
    const res = await request(app).get('/v1/sandbox/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.environment).toBe('sandbox');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. SANDBOX CORE BANKING — API KEY AUTHENTICATION
// ═════════════════════════════════════════════════════════════════════════════

const SANDBOX_API_KEY = 'wgi_sandbox_regressionkey_abc123';

describe('Developer Ecosystem — Step 8a: List Sandbox Accounts (API Key)', () => {
  it('returns sandbox account list using API key', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts')
      .set('X-API-Key', SANDBOX_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('returns 401 without an API key', async () => {
    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts');

    expect(res.status).toBe(401);
  });
});

describe('Developer Ecosystem — Step 8b: Get Sandbox Account (API Key)', () => {
  it('returns account details for a valid account number', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts/WKZ-0001-2024')
      .set('X-API-Key', SANDBOX_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.accountNumber).toBe('WKZ-0001-2024');
  });
});

describe('Developer Ecosystem — Step 8c: Open a Sandbox Account (API Key)', () => {
  it('creates a sandbox bank account and returns 201', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/accounts/open')
      .set('X-API-Key', SANDBOX_API_KEY)
      .send({
        full_name:             'Alice Developer',
        identification_number: 'ID-123456789',
        email:                 'alice@fintech.io',
        phone_number:          '+254700000099',
        account_type:          'Current',
        currency:              'KES',
        initial_deposit:       5000,
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.accountNumber).toBeDefined();
    expect(res.body.status).toBe('Active');
  });

  it('returns 400 when required account fields fail Zod validation (live route)', async () => {
    // The live /v1/core-banking/accounts/open validates via Zod before
    // reaching v1-Core — so a 400 is returned even when v1-Core is disabled.
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .post('/v1/core-banking/accounts/open')
      .set('X-API-Key', SANDBOX_API_KEY)
      .send({
        full_name:             'AB',              // ← too short (min 2 is fine, but…)
        identification_number: 'ID-001',
        email:                 'not-a-valid-email', // ← invalid email triggers 400
        phone_number:          '+254700000001',
        account_type:          'InvalidType',       // ← not in enum ['Savings','Current','Business']
        currency:              'KES',
      });

    expect(res.status).toBe(400);
  });
});

describe('Developer Ecosystem — Step 8d: Get Sandbox Account Balance (API Key)', () => {
  it('returns account balance', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts/WKZ-0001-2024/balance')
      .set('X-API-Key', SANDBOX_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(typeof res.body.availableBalance).toBe('number');
    expect(res.body.currency).toBeDefined();
  });
});

describe('Developer Ecosystem — Step 8e: Get Sandbox Account Statement (API Key)', () => {
  it('returns account statement', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts/WKZ-0001-2024/statement')
      .set('X-API-Key', SANDBOX_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });
});

describe('Developer Ecosystem — Step 8f: Sandbox Fund Transfer (API Key)', () => {
  it('performs a fund transfer and returns 201', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/transactions/transfer')
      .set('X-API-Key', SANDBOX_API_KEY)
      .send({
        source_account_number:      'WKZ-0001-2024',
        destination_account_number: 'WKZ-0002-2024',
        amount:                     1000,
        currency:                   'KES',
        narration:                  'Regression test transfer',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.status).toBe('Completed');
    expect(res.body.transactionId).toBeDefined();
  });
});

describe('Developer Ecosystem — Step 8g: Sandbox M-Pesa Deposit (API Key)', () => {
  it('initiates an M-Pesa deposit and returns 201', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/transactions/deposit')
      .set('X-API-Key', SANDBOX_API_KEY)
      .send({
        account_number: 'WKZ-0001-2024',
        phone_number:   '+254700000099',
        amount:         500,
        reference:      'REG-TEST-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    // M-Pesa STK push begins as 'Pending' until the customer confirms on their phone
    expect(res.body.status).toBe('Pending');
  });
});

describe('Developer Ecosystem — Step 8h: Sandbox Loan Application (API Key)', () => {
  it('applies for a sandbox loan and gets approval', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/loans/apply')
      .set('X-API-Key', SANDBOX_API_KEY)
      .send({
        account_number:  'WKZ-0001-2024',
        amount:          50000,
        term_months:     12,
        purpose:         'Business expansion regression test',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.loanId).toBeDefined();
    expect(res.body.status).toBe('Approved');
  });
});

describe('Developer Ecosystem — Step 8i: Sandbox Loan Details & Repayment (API Key)', () => {
  const loanId = uuidv4();

  it('returns sandbox loan details by loanId', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .get(`/v1/sandbox/core-banking/loans/${loanId}`)
      .set('X-API-Key', SANDBOX_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.loanId).toBeDefined();
  });

  it('makes a loan repayment and returns 201', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .post(`/v1/sandbox/core-banking/loans/${loanId}/repay`)
      .set('X-API-Key', SANDBOX_API_KEY)
      .send({ amount: 5000, account_number: 'WKZ-0001-2024' });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    // Loan repayment completes synchronously in sandbox
    expect(res.body.status).toBe('Completed');
  });
});

describe('Developer Ecosystem — Step 8j: Sandbox Card Issuance (API Key)', () => {
  it('issues a sandbox virtual/physical card and returns 201', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/cards/issue')
      .set('X-API-Key', SANDBOX_API_KEY)
      .send({
        account_number:  'WKZ-0001-2024',
        card_type:       'Debit',
        cardholder_name: 'ALICE DEVELOPER',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.cardNumber).toMatch(/^\*{4}-\*{4}-\*{4}-\d{4}$/);
    expect(res.body.status).toBe('Active');
  });
});

describe('Developer Ecosystem — Step 8k: Sandbox Cross-Bank Payment (API Key)', () => {
  it('initiates a cross-bank payment via RTGS and returns 201', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/payments/transfer')
      .set('X-API-Key', SANDBOX_API_KEY)
      .send({
        source_account_number: 'WKZ-0001-2024',
        beneficiary_account:   'BENE-REG-001',
        beneficiary_bank:      'Equity Bank',
        amount:                25000,
        currency:              'KES',
        narration:             'Regression test RTGS payment',
        payment_rail:          'RTGS',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.status).toBe('Accepted');
    expect(res.body.paymentRail).toBe('RTGS');
  });
});

describe('Developer Ecosystem — Step 8l: Sandbox M-Pesa STK Push (API Key)', () => {
  it('initiates an M-Pesa STK push and returns 201', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/payments/mpesa/stk-push')
      .set('X-API-Key', SANDBOX_API_KEY)
      .send({
        account_number: 'WKZ-0001-2024',
        phone_number:   '+254700000099',
        amount:         750,
        reference:      'REG-MPESA-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.responseCode).toBe('0');
    expect(res.body.checkoutRequestId).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. API KEY REVOCATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Step 9: API Key Revocation', () => {
  const token = makeToken();

  it('revokes an API key and returns 200 with revoked status', async () => {
    const revokedKey = makeApiKey({ status: 'revoked' });

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [revokedKey] }); // UPDATE api_key → revoked

    const res = await request(app)
      .delete('/v1/api-keys/key-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('revoked');
  });

  it('returns 404 when key does not exist or belongs to another user', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }); // no matching key

    const res = await request(app)
      .delete('/v1/api-keys/non-existent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11. REVOKED API KEY IS REJECTED
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Step 10: Revoked API Key Rejected', () => {
  it('returns 401 when a revoked API key is used for sandbox calls', async () => {
    // Simulate revoked key in DB
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        api_key_id: 'key-revoked',
        user_id:    'dev-user-1',
        email:      'developer@fintech.io',
        status:     'revoked',   // ← revoked
      }],
    });

    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts')
      .set('X-API-Key', 'wgi_revoked_key_abc123');

    expect(res.status).toBe(401);
  });

  it('returns 401 when an API key that does not exist is used', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // key not found

    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts')
      .set('X-API-Key', 'wgi_completely_unknown_key');

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 12. LIVE CORE BANKING ROUTE — DISABLED / FALLBACK BEHAVIOUR
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Live Core Banking Routes (v1-Core disabled)', () => {
  it('GET /v1/core-banking/health reports disabled or 503 when v1-Core is not running', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .get('/v1/core-banking/health')
      .set('X-API-Key', SANDBOX_API_KEY);

    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.status).toBe('disabled');
    }
  });

  it('GET /v1/core-banking/accounts returns 503 when v1-Core is unreachable', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(ACTIVE_API_KEY_DB_ROW);

    const res = await request(app)
      .get('/v1/core-banking/accounts')
      .set('X-API-Key', SANDBOX_API_KEY);

    expect(res.status).toBe(503);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 13. ADDITIONAL DEVELOPER ECOSYSTEM FEATURES
// ═════════════════════════════════════════════════════════════════════════════

describe('Developer Ecosystem — Webhook Registration', () => {
  const token = makeToken();

  it('creates a webhook endpoint for event notifications', async () => {
    const webhookRow = {
      webhook_id: uuidv4(),
      user_id:    'dev-user-1',
      url:        'https://fintech.io/wgi-callback',
      events:     ['deposit', 'kyc_approved'],
      status:     'active',
      created_at: new Date(),
    };

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [webhookRow] });

    const res = await request(app)
      .post('/v1/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url:    'https://fintech.io/wgi-callback',
        events: ['deposit', 'kyc_approved'],   // Must be in ALLOWED_EVENTS
      });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe('https://fintech.io/wgi-callback');
    expect(res.body.status).toBe('active');
  });

  it('returns 400 for unknown webhook event types', async () => {
    const res = await request(app)
      .post('/v1/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url:    'https://fintech.io/wgi-callback',
        events: ['unknown.event.type'],   // Not in ALLOWED_EVENTS
      });

    expect(res.status).toBe(400);
  });
});

describe('Developer Ecosystem — Subscription Plans', () => {
  const token = makeToken();

  it('returns available subscription plans for authenticated developer', async () => {
    const plans = [
      { plan_id: 'starter',    name: 'Starter',    price: '0.00',   currency: 'USD' },
      { plan_id: 'growth',     name: 'Growth',     price: '49.00',  currency: 'USD' },
      { plan_id: 'enterprise', name: 'Enterprise', price: '199.00', currency: 'USD' },
    ];

    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: plans });

    const res = await request(app)
      .get('/v1/subscriptions/plans')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
  });
});

describe('Developer Ecosystem — Admin API Key Overview', () => {
  it('admin can list all API keys across all developers', async () => {
    const adminToken = makeToken('admin-1', 'admin@wekeza.io', 'admin');
    const allKeys = [
      makeApiKey({ api_key_id: 'key-1', user_id: 'dev-user-1' }),
      makeApiKey({ api_key_id: 'key-2', user_id: 'dev-user-2' }),
    ];

    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: allKeys });

    const res = await request(app)
      .get('/v1/api-keys/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.api_keys).toHaveLength(2);
  });

  it('non-admin developer cannot access all-keys list', async () => {
    const devToken = makeToken();

    const res = await request(app)
      .get('/v1/api-keys/all')
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(403);
  });
});
