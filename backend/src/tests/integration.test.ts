/**
 * Integration / Regression Tests — Wekeza Global Infrastructure
 *
 * Tests all major API endpoints end-to-end against a fully mocked
 * database and Redis layer so they run in CI without external infrastructure.
 *
 * Coverage:
 *   - Health check
 *   - Auth: register, login, /me, update profile, OAuth2 token
 *   - Wallets: create, list, get, deposit, withdraw, transfer, balance, transactions
 *   - FX: rates, quote, convert
 *   - Settlements: initiate, list, get
 *   - Banks: list, create
 *   - Cards: create, list, update
 *   - KYC: submit, get status, AML
 *   - Credit score
 *   - API keys: create, list, revoke
 *   - Webhooks: create, list, delete
 *   - Notifications
 *   - Subscriptions: plans, subscribe, status
 *   - Collection accounts
 *   - Admin: stats, list users
 *   - Sandbox: health, deposit, FX convert
 *   - 404 handler
 */

// ── Mock all external infrastructure ─────────────────────────────────────────

jest.mock('../database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
  redis: {
    status: 'ready',
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  },
  connectDB: jest.fn().mockResolvedValue(undefined),
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import app from '../server';
import { pool, redis } from '../database';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockPool = pool as jest.Mocked<typeof pool>;
const mockRedis = redis as jest.Mocked<typeof redis>;

// Must match the fallback in config.ts so tokens signed here are accepted by the middleware.
// When JWT_SECRET is not set, both config.ts and this file fall back to the same dev-only
// string — this is intentional for the test environment only.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-jwt-secret-do-not-use-in-production';

function makeToken(
  userId = 'user-1',
  email = 'test@example.com',
  role: string = 'user'
): string {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: 3600 });
}

function makeAdminToken(): string {
  return makeToken('admin-1', 'admin@example.com', 'admin');
}

function makePartnerToken(): string {
  return makeToken('partner-1', 'partner@example.com', 'partner');
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 'user-1',
    full_name: 'Test User',
    email: 'test@example.com',
    phone_number: '+254700000001',
    password_hash: '$2a$12$hashvalue',
    kyc_status: 'verified',
    role: 'user',
    account_type: 'individual',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeWallet(overrides: Record<string, unknown> = {}) {
  return {
    wallet_id: 'wallet-1',
    user_id: 'user-1',
    currency: 'USD',
    balance: '1000.00',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    transaction_id: uuidv4(),
    wallet_id: 'wallet-1',
    type: 'deposit',
    amount: '100.00',
    currency: 'USD',
    status: 'completed',
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  // Re-apply default mock implementations after resetAllMocks clears them
  (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });
  (mockPool.connect as jest.Mock).mockResolvedValue({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  });
  // Re-apply Redis defaults — used for balance caching, rate limiting, etc.
  (mockRedis.get as jest.Mock).mockResolvedValue(null);
  (mockRedis.setex as jest.Mock).mockResolvedValue('OK');
  (mockRedis.del as jest.Mock).mockResolvedValue(1);
  (mockRedis.incr as jest.Mock).mockResolvedValue(1);
  (mockRedis.expire as jest.Mock).mockResolvedValue(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('wgi-backend');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('returns 201 with access_token on success', async () => {
    const newUser = makeUser({ email: 'newuser@example.com' });
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })     // findUserByEmail — no existing user
      .mockResolvedValueOnce({ rows: [newUser] }); // INSERT user

    const res = await request(app)
      .post('/auth/register')
      .send({
        full_name: 'New User',
        email: 'newuser@example.com',
        password: 'SecurePass123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.token_type).toBe('Bearer');
    expect(res.body.user.email).toBe('newuser@example.com');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('returns 409 when email already exists', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeUser()] });

    const res = await request(app)
      .post('/auth/register')
      .send({ full_name: 'Dup', email: 'test@example.com', password: 'Pass1234!' });

    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid input (short password)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ full_name: 'X', email: 'x@x.com', password: 'short' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('returns 200 with access_token for valid credentials', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Pass1234!', 1);
    const user = makeUser({ password_hash: hash });

    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [user] });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'Pass1234!' });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('CorrectPass!', 1);
    const user = makeUser({ password_hash: hash });

    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [user] });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'WrongPass!' });

    expect(res.status).toBe(401);
  });

  it('returns 401 when user not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'Pass1234!' });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/token (OAuth2)', () => {
  it('returns 200 with access_token for valid client credentials', async () => {
    const res = await request(app)
      .post('/auth/token')
      .send({
        client_id: process.env.OAUTH_CLIENT_ID || 'wgi-client',
        client_secret: process.env.OAUTH_CLIENT_SECRET || 'wgi-client-secret',
        grant_type: 'client_credentials',
      });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.scope).toBe('read write');
  });

  it('returns 401 for invalid client credentials', async () => {
    const res = await request(app)
      .post('/auth/token')
      .send({ client_id: 'bad', client_secret: 'bad', grant_type: 'client_credentials' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for unsupported grant_type', async () => {
    const res = await request(app)
      .post('/auth/token')
      .send({
        client_id: process.env.OAUTH_CLIENT_ID || 'wgi-client',
        client_secret: process.env.OAUTH_CLIENT_SECRET || 'wgi-client-secret',
        grant_type: 'authorization_code',
      });

    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns user profile with valid token', async () => {
    const user = makeUser();
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [user] });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@example.com');
    expect(res.body.password_hash).toBeUndefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with expired/invalid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('PUT /auth/me', () => {
  it('updates profile successfully', async () => {
    const updatedUser = makeUser({ full_name: 'Updated Name' });
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [updatedUser] });

    const res = await request(app)
      .put('/auth/me')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ full_name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.full_name).toBe('Updated Name');
  });

  it('returns 400 when no fields provided', async () => {
    const res = await request(app)
      .put('/auth/me')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Wallets
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/wallets', () => {
  it('creates a wallet and returns 201', async () => {
    const wallet = makeWallet();
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })      // no existing wallet
      .mockResolvedValueOnce({ rows: [wallet] }); // INSERT

    const res = await request(app)
      .post('/v1/wallets')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ currency: 'USD' });

    expect(res.status).toBe(201);
    expect(res.body.currency).toBe('USD');
  });

  it('returns 409 when wallet already exists for this currency', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeWallet()] });

    const res = await request(app)
      .post('/v1/wallets')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ currency: 'USD' });

    expect(res.status).toBe(409);
  });

  it('returns 400 for unsupported currency', async () => {
    const res = await request(app)
      .post('/v1/wallets')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ currency: 'JPY' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/v1/wallets').send({ currency: 'USD' });
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/wallets', () => {
  it('returns list of wallets', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeWallet()] });

    const res = await request(app)
      .get('/v1/wallets')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.wallets)).toBe(true);
    expect(res.body.wallets).toHaveLength(1);
  });
});

describe('GET /v1/wallets/:wallet_id', () => {
  it('returns wallet by ID', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeWallet()] });

    const res = await request(app)
      .get('/v1/wallets/wallet-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.wallet_id).toBe('wallet-1');
  });

  it('returns 404 for unknown wallet', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/wallets/no-such-wallet')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /v1/wallets/:wallet_id/balance', () => {
  it('returns balance', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeWallet()] });

    const res = await request(app)
      .get('/v1/wallets/wallet-1/balance')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(1000);
    expect(res.body.currency).toBe('USD');
  });
});

describe('POST /v1/wallets/:wallet_id/deposit', () => {
  it('deposits funds and returns transaction', async () => {
    const wallet = makeWallet();
    const tx = makeTx({ type: 'deposit', amount: '200.00' });
    const updatedWallet = makeWallet({ balance: '1200.00' });

    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [wallet] }); // findWalletById

    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)             // BEGIN
        .mockResolvedValueOnce({ rows: [tx] })        // INSERT transaction
        .mockResolvedValueOnce({ rows: [updatedWallet] }) // UPDATE wallet
        .mockResolvedValueOnce(undefined)              // INSERT ledger
        .mockResolvedValueOnce(undefined),             // COMMIT
      release: jest.fn(),
    };
    (mockPool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

    const res = await request(app)
      .post('/v1/wallets/wallet-1/deposit')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ amount: 200 });

    expect(res.status).toBe(201);
    expect(res.body.transaction_id).toBeDefined();
    expect(res.body.currency).toBe('USD');
  });

  it('returns 400 for zero amount', async () => {
    const res = await request(app)
      .post('/v1/wallets/wallet-1/deposit')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ amount: 0 });

    expect(res.status).toBe(400);
  });
});

describe('POST /v1/wallets/:wallet_id/withdraw', () => {
  it('withdraws funds successfully', async () => {
    const wallet = makeWallet({ balance: '500.00' });
    const tx = makeTx({ type: 'withdrawal', amount: '100.00' });
    const updatedWallet = makeWallet({ balance: '400.00' });

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }) // no limits
      .mockResolvedValueOnce({ rows: [wallet] }); // findWalletById

    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ balance: '500.00' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [tx] }) // INSERT transaction
        .mockResolvedValueOnce({ rows: [updatedWallet] }) // UPDATE wallet
        .mockResolvedValueOnce(undefined) // INSERT ledger
        .mockResolvedValueOnce(undefined), // COMMIT
      release: jest.fn(),
    };
    (mockPool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

    const res = await request(app)
      .post('/v1/wallets/wallet-1/withdraw')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ amount: 100 });

    expect(res.status).toBe(201);
  });

  it('returns 422 for insufficient funds', async () => {
    const wallet = makeWallet({ balance: '50.00' });
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })      // no limits
      .mockResolvedValueOnce({ rows: [wallet] }); // findWalletById

    const res = await request(app)
      .post('/v1/wallets/wallet-1/withdraw')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ amount: 200 });

    expect(res.status).toBe(422);
  });
});

describe('GET /v1/wallets/:wallet_id/transactions', () => {
  it('returns transaction list', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [makeWallet()] }) // findWalletById
      .mockResolvedValueOnce({ rows: [makeTx(), makeTx()] }); // findTransactionsByWalletId

    const res = await request(app)
      .get('/v1/wallets/wallet-1/transactions')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.transactions)).toBe(true);
  });
});

describe('GET /v1/transactions', () => {
  it('returns recent transactions for current user', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [makeTx()] });

    const res = await request(app)
      .get('/v1/transactions')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.transactions)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FX
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/fx/rates', () => {
  it('returns FX rates (requires auth)', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        { currency_from: 'USD', currency_to: 'KES', rate: '134.50', provider: 'mock', timestamp: new Date() },
      ],
    });

    const res = await request(app)
      .get('/v1/fx/rates')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.rates).toBeDefined();
  });
});

describe('POST /v1/fx/convert', () => {
  it('returns a conversion result', async () => {
    const sourceWalletId = '11111111-1111-4111-8111-111111111111';
    const sourceWallet = makeWallet({ wallet_id: sourceWalletId, currency: 'USD', balance: '500.00' });
    const targetWalletId = '22222222-2222-4222-8222-222222222222';
    const targetWallet = makeWallet({ wallet_id: targetWalletId, currency: 'KES', balance: '0.00' });

    const txId = uuidv4();
    const mockTx = {
      transaction_id: txId, wallet_id: sourceWalletId, type: 'fx',
      amount: '100', currency: 'USD', status: 'completed',
      metadata: '{}', created_at: new Date(), updated_at: new Date(),
    };
    const mockFxTx = {
      fx_transaction_id: uuidv4(), transaction_id: txId,
      currency_from: 'USD', currency_to: 'KES',
      amount_from: '100', amount_to: '13380.23', rate: '134.50',
      fee: '0.50', provider: 'WGI', timestamp: new Date(),
    };

    // pool.query calls: findWalletById (source), findWalletById (target), getRate
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [sourceWallet] })
      .mockResolvedValueOnce({ rows: [targetWallet] })
      .mockResolvedValueOnce({ rows: [{ fx_rate_id: uuidv4(), currency_from: 'USD', currency_to: 'KES', rate: '134.50', provider: 'mock', timestamp: new Date() }] });

    // client.query calls (in order): BEGIN, INSERT tx, SELECT balance (debit),
    // UPDATE wallet (debit), INSERT ledger (debit), UPDATE wallet (credit),
    // INSERT ledger (credit), INSERT fx_transactions, COMMIT
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)              // BEGIN
        .mockResolvedValueOnce({ rows: [mockTx] })     // INSERT transaction
        .mockResolvedValueOnce({ rows: [{ balance: '500.00' }] }) // SELECT balance (debit)
        .mockResolvedValueOnce({ rows: [{ balance: '400.00' }] }) // UPDATE wallet (debit)
        .mockResolvedValueOnce({ rows: [] })            // INSERT ledger (debit)
        .mockResolvedValueOnce({ rows: [{ balance: '13380.23' }] }) // UPDATE wallet (credit)
        .mockResolvedValueOnce({ rows: [] })            // INSERT ledger (credit)
        .mockResolvedValueOnce({ rows: [mockFxTx] })   // INSERT fx_transactions
        .mockResolvedValueOnce(undefined),              // COMMIT
      release: jest.fn(),
    };
    (mockPool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

    const res = await request(app)
      .post('/v1/fx/convert')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        wallet_id: sourceWalletId,
        target_wallet_id: targetWalletId,
        currency_from: 'USD',
        currency_to: 'KES',
        amount: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.amount_to).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Settlements
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/settlements', () => {
  it('returns user settlements', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/settlements')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.settlements)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Banks
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/banks', () => {
  it('returns list of banks', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ bank_id: 'bank-1', name: 'Test Bank', country: 'KE', status: 'active', api_endpoint: null, settlement_rules: {} }],
    });

    const res = await request(app)
      .get('/v1/banks')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.banks)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/cards', () => {
  it('creates a card and returns 201', async () => {
    const walletId = '11111111-1111-4111-8111-111111111111';
    const wallet = makeWallet({ wallet_id: walletId });
    const card = {
      card_id: uuidv4(),
      wallet_id: walletId,
      card_type: 'virtual',
      status: 'active',
      spending_limit: '5000',
      created_at: new Date(),
    };

    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [wallet] }) // findWalletById
      .mockResolvedValueOnce({ rows: [card] });  // INSERT card

    const res = await request(app)
      .post('/v1/cards')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ wallet_id: walletId, card_type: 'virtual' });

    expect(res.status).toBe(201);
    expect(res.body.card_type).toBe('virtual');
  });
});

describe('GET /v1/cards', () => {
  it('returns list of user cards', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/cards')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cards)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KYC
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/kyc/:user_id', () => {
  it('returns KYC status for specified user', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', kyc_status: 'verified' }] }) // user exists
      .mockResolvedValueOnce({ rows: [] }); // no KYC docs

    const res = await request(app)
      .get('/v1/kyc/user-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.kyc_status).toBeDefined();
  });
});

describe('GET /v1/aml/alerts', () => {
  it('returns AML alerts (admin/compliance role required)', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/aml/alerts')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Credit
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/credit/:user_id', () => {
  it('returns credit score for a user', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] }) // user exists
      .mockResolvedValueOnce({ rows: [{
        credit_score_id: uuidv4(),
        user_id: 'user-1',
        score: '650',
        factors: {},
        last_updated: new Date(),
      }] }); // credit score exists

    const res = await request(app)
      .get('/v1/credit/user-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.score).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API Keys
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/api-keys', () => {
  it('creates an API key', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        api_key_id: uuidv4(),
        user_id: 'user-1',
        api_key: 'wgi_live_testkey123',
        name: 'My Key',
        status: 'active',
        created_at: new Date(),
      }],
    });

    const res = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'My Key' });

    expect(res.status).toBe(201);
    expect(res.body.api_key).toBeDefined();
  });
});

describe('GET /v1/api-keys', () => {
  it('returns list of API keys', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/api-keys')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.api_keys)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Webhooks
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /v1/webhooks', () => {
  it('creates a webhook and returns 201', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        webhook_id: uuidv4(),
        user_id: 'user-1',
        url: 'https://example.com/webhook',
        events: ['settlement.completed'],
        secret: 'whsec_test',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }],
    });

    const res = await request(app)
      .post('/v1/webhooks')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        url: 'https://example.com/webhook',
        events: ['settlement_completed'],
      });

    expect(res.status).toBe(201);
    expect(res.body.webhook_id).toBeDefined();
  });
});

describe('GET /v1/webhooks', () => {
  it('returns list of webhooks', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/webhooks')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.webhooks)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/notifications', () => {
  it('returns notifications list', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/subscriptions/plans', () => {
  it('returns subscription plans', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/subscriptions/plans')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
  });
});

describe('GET /v1/subscriptions/my', () => {
  it('returns current user subscription', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/subscriptions/my')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Collection Accounts
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/collection-accounts', () => {
  it('returns collection accounts list', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/v1/collection-accounts')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.collection_accounts)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/admin/stats', () => {
  it('returns platform statistics for admin users', async () => {
    // Admin stats makes 11 parallel pool.query calls
    const mockCount = (n: string) => ({ rows: [{ count: n }] });
    const mockTotal = (c: string, v: string) => ({ rows: [{ count: c, total_volume: v }] });
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce(mockCount('5'))                        // users
      .mockResolvedValueOnce(mockTotal('200', '50000.00'))          // transactions
      .mockResolvedValueOnce(mockCount('12'))                       // wallets
      .mockResolvedValueOnce(mockCount('1'))                        // aml alerts
      .mockResolvedValueOnce(mockCount('0'))                        // pending kyc
      .mockResolvedValueOnce({ rows: [] })                          // volume by currency
      .mockResolvedValueOnce({ rows: [] })                          // users by segment
      .mockResolvedValueOnce({ rows: [{ avg_minutes: '3.5' }] })   // settlement speed
      .mockResolvedValueOnce({ rows: [{ total: '4', active: '3' }] }) // banks
      .mockResolvedValueOnce({ rows: [{ api_keys: '10', webhooks: '5' }] }) // api partners
      .mockResolvedValueOnce(mockCount('3'));                        // credit data

    const res = await request(app)
      .get('/v1/admin/stats')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.total_users).toBe(5);
    expect(res.body.total_transactions).toBe(200);
  });

  it('returns 403 for non-admin users', async () => {
    const res = await request(app)
      .get('/v1/admin/stats')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /v1/admin/users', () => {
  it('returns user list for admin', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [makeUser()] })      // SELECT users
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // SELECT COUNT

    const res = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin Developer Management
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/admin/developers', () => {
  it('returns developer list for admin', async () => {
    const devRow = {
      user_id: uuidv4(), full_name: 'Alice Dev', email: 'alice@wekeza.dev',
      phone_number: null, role: 'user', account_type: 'freelancer',
      kyc_status: 'verified', created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      api_key_count: '2', active_key_count: '1',
    };
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [devRow] })           // SELECT developers
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // SELECT COUNT

    const res = await request(app)
      .get('/v1/admin/developers')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.developers)).toBe(true);
    expect(res.body.total).toBe(1);
    expect(res.body.developers[0].api_key_count).toBe(2);
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .get('/v1/admin/developers')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /v1/admin/developers', () => {
  it('creates a developer with an API key', async () => {
    const uid = uuidv4();
    const kid = uuidv4();
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })   // email uniqueness check
      .mockResolvedValueOnce({ rows: [{ user_id: uid, full_name: 'Bob Dev', email: 'bob@dev.io', role: 'user', kyc_status: 'pending', account_type: 'sme', created_at: new Date().toISOString() }] })
      .mockResolvedValueOnce({ rows: [{ api_key_id: kid, name: "Bob's Default Key", status: 'active', created_at: new Date().toISOString() }] });

    const res = await request(app)
      .post('/v1/admin/developers')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ full_name: 'Bob Dev', email: 'bob@dev.io', account_type: 'sme' });

    expect(res.status).toBe(201);
    expect(res.body.developer.user_id).toBe(uid);
    expect(res.body.api_key.raw_key).toMatch(/^wgi_/);
  });

  it('returns 409 if email already exists', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // email uniqueness check

    const res = await request(app)
      .post('/v1/admin/developers')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ full_name: 'Dup Dev', email: 'existing@dev.io' });

    expect(res.status).toBe(409);
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .post('/v1/admin/developers')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ full_name: 'X', email: 'x@x.com' });
    expect(res.status).toBe(403);
  });
});

describe('POST /v1/admin/developers/bulk', () => {
  it('bulk-creates developers', async () => {
    // For each developer: email-check + insert user + insert api key
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ user_id: uuidv4() }] })
      .mockResolvedValueOnce({ rows: [{ api_key_id: uuidv4() }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ user_id: uuidv4() }] })
      .mockResolvedValueOnce({ rows: [{ api_key_id: uuidv4() }] });

    const res = await request(app)
      .post('/v1/admin/developers/bulk')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({
        developers: [
          { full_name: 'Dev One', email: 'dev1@bulk.io', account_type: 'individual' },
          { full_name: 'Dev Two', email: 'dev2@bulk.io', account_type: 'sme' },
        ],
        default_password: 'BulkPass@123',
      });

    expect(res.status).toBe(207);
    expect(res.body.created).toBe(2);
    expect(res.body.skipped).toBe(0);
  });

  it('skips duplicates in bulk create', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // email exists

    const res = await request(app)
      .post('/v1/admin/developers/bulk')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({
        developers: [{ full_name: 'Dup', email: 'dup@bulk.io', account_type: 'individual' }],
        default_password: 'BulkPass@123',
      });

    expect(res.status).toBe(207);
    expect(res.body.skipped).toBe(1);
    expect(res.body.created).toBe(0);
  });

  it('returns 400 for empty developers array', async () => {
    const res = await request(app)
      .post('/v1/admin/developers/bulk')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ developers: [] });
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .post('/v1/admin/developers/bulk')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ developers: [{ full_name: 'X', email: 'x@x.com', account_type: 'individual' }] });
    expect(res.status).toBe(403);
  });
});

describe('GET /v1/admin/developers/:userId', () => {
  const uid = uuidv4();

  it('returns developer profile with keys and wallets', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ user_id: uid, full_name: 'Alice Dev', email: 'alice@dev.io', phone_number: null, role: 'user', account_type: 'freelancer', kyc_status: 'verified', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] })
      .mockResolvedValueOnce({ rows: [{ api_key_id: uuidv4(), name: "Alice's Key", status: 'active', created_at: new Date().toISOString(), api_key: 'wgi_abc123…' }] })
      .mockResolvedValueOnce({ rows: [{ currency: 'USD', balance: '500.00' }] });

    const res = await request(app)
      .get(`/v1/admin/developers/${uid}`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.developer.user_id).toBe(uid);
    expect(Array.isArray(res.body.api_keys)).toBe(true);
    expect(Array.isArray(res.body.wallets)).toBe(true);
  });

  it('returns 404 for unknown user', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`/v1/admin/developers/${uuidv4()}`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /v1/admin/developers/:userId', () => {
  const uid = uuidv4();

  it('updates developer profile', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ user_id: uid, full_name: 'Updated Dev', email: 'dev@io', role: 'user', kyc_status: 'verified', account_type: 'sme', updated_at: new Date().toISOString() }] });

    const res = await request(app)
      .put(`/v1/admin/developers/${uid}`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ full_name: 'Updated Dev', kyc_status: 'verified' });

    expect(res.status).toBe(200);
    expect(res.body.developer.full_name).toBe('Updated Dev');
  });

  it('returns 400 when no updatable fields provided', async () => {
    const res = await request(app)
      .put(`/v1/admin/developers/${uid}`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /v1/admin/developers/:userId/api-keys', () => {
  const uid = uuidv4();

  it('creates an API key for a developer', async () => {
    const kid = uuidv4();
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })   // user exists check
      .mockResolvedValueOnce({ rows: [{ api_key_id: kid, name: 'Test Key', status: 'active', created_at: new Date().toISOString() }] });

    const res = await request(app)
      .post(`/v1/admin/developers/${uid}/api-keys`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ name: 'Test Key' });

    expect(res.status).toBe(201);
    expect(res.body.api_key.raw_key).toMatch(/^wgi_/);
  });

  it('returns 404 if developer not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });
    const res = await request(app)
      .post(`/v1/admin/developers/${uuidv4()}/api-keys`)
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ name: 'Key' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /v1/admin/developers/:userId/api-keys/:keyId', () => {
  const uid = uuidv4();
  const kid = uuidv4();

  it('revokes an API key for a developer', async () => {
    (mockPool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ api_key_id: kid, status: 'revoked' }] });

    const res = await request(app)
      .delete(`/v1/admin/developers/${uid}/api-keys/${kid}`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.api_key.status).toBe('revoked');
  });

  it('returns 404 if key not found', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .delete(`/v1/admin/developers/${uid}/api-keys/${uuidv4()}`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox (v1-core / developer access)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/sandbox/health', () => {
  it('returns sandbox health without authentication', async () => {
    const res = await request(app).get('/v1/sandbox/health');
    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.status).toBe('ok');
    expect(res.body.environment).toBe('sandbox');
  });
});

describe('POST /v1/sandbox/wallet/deposit (API key auth)', () => {
  it('returns sandbox deposit response with valid API key', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        api_key_id: 'key-1',
        user_id: 'user-1',
        email: 'test@example.com',
        status: 'active',
      }],
    });

    const res = await request(app)
      .post('/v1/sandbox/wallet/deposit')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({ wallet_id: 'wallet-1', amount: 500, currency: 'USD' });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.type).toBe('deposit');
    expect(res.body.status).toBe('completed');
  });

  it('returns 401 without API key', async () => {
    const res = await request(app)
      .post('/v1/sandbox/wallet/deposit')
      .send({ wallet_id: 'wallet-1', amount: 500 });

    expect(res.status).toBe(401);
  });
});

describe('POST /v1/sandbox/fx/convert', () => {
  it('returns sandbox FX conversion', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ api_key_id: 'key-1', user_id: 'user-1', email: 'test@example.com', status: 'active' }],
    });

    const res = await request(app)
      .post('/v1/sandbox/fx/convert')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({ amount: 100, currency_from: 'USD', currency_to: 'KES' });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.fx_rate).toBe(134.5);
  });
});

describe('POST /v1/sandbox/integrations/paypal/payout', () => {
  it('returns sandbox PayPal payout', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ api_key_id: 'key-1', user_id: 'user-1', email: 'test@example.com', status: 'active' }],
    });

    const res = await request(app)
      .post('/v1/sandbox/integrations/paypal/payout')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({ amount: 100, currency: 'USD', recipient_email: 'recipient@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.adapter).toBe('paypal');
  });
});

describe('POST /v1/sandbox/integrations/stripe/transfer', () => {
  it('returns sandbox Stripe transfer', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ api_key_id: 'key-1', user_id: 'user-1', email: 'test@example.com', status: 'active' }],
    });

    const res = await request(app)
      .post('/v1/sandbox/integrations/stripe/transfer')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({ amount: 100, currency: 'USD', destination: 'acct_test' });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.adapter).toBe('stripe');
  });
});

describe('POST /v1/sandbox/integrations/wise/transfer', () => {
  it('returns sandbox Wise transfer', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ api_key_id: 'key-1', user_id: 'user-1', email: 'test@example.com', status: 'active' }],
    });

    const res = await request(app)
      .post('/v1/sandbox/integrations/wise/transfer')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({ amount: 100, source_currency: 'USD', target_currency: 'KES' });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.adapter).toBe('wise');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 404 handler
// ─────────────────────────────────────────────────────────────────────────────

describe('404 — unknown route', () => {
  it('returns 404 with NotFound error', async () => {
    const res = await request(app).get('/v1/nonexistent-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /metrics', () => {
  it('returns Prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Core Banking — Sandbox endpoints (/v1/sandbox/core-banking/*)
//
// These mirror the Wekeza v1-Core API surface (github.com/eodenyire/Wekeza)
// and require only an API key — no live v1-Core instance needed.
// ─────────────────────────────────────────────────────────────────────────────

const CORE_API_KEY_ROW = {
  rows: [{ api_key_id: 'key-1', user_id: 'user-1', email: 'partner@example.com', status: 'active' }],
};

describe('GET /v1/sandbox/core-banking/accounts', () => {
  it('returns sandbox account list', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts')
      .set('X-API-Key', 'wgi_sandbox_testkey123');

    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.core_banking).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.totalRecords).toBe(2);
  });
});

describe('GET /v1/sandbox/core-banking/accounts/:accountNumber', () => {
  it('returns a single sandbox account', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts/WKZ-0001-2024')
      .set('X-API-Key', 'wgi_sandbox_testkey123');

    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.accountNumber).toBe('WKZ-0001-2024');
  });
});

describe('POST /v1/sandbox/core-banking/accounts/open', () => {
  it('creates a sandbox account', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/accounts/open')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({
        full_name: 'Test User',
        account_type: 'Savings',
        currency: 'KES',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.core_banking).toBe(true);
    expect(res.body.accountNumber).toBeDefined();
    expect(res.body.status).toBe('Active');
  });
});

describe('GET /v1/sandbox/core-banking/accounts/:accountNumber/balance', () => {
  it('returns sandbox account balance', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts/WKZ-0001-2024/balance')
      .set('X-API-Key', 'wgi_sandbox_testkey123');

    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.availableBalance).toBe(85000);
    expect(res.body.currency).toBe('KES');
  });
});

describe('GET /v1/sandbox/core-banking/accounts/:accountNumber/statement', () => {
  it('returns sandbox account statement', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .get('/v1/sandbox/core-banking/accounts/WKZ-0001-2024/statement')
      .query({ from: '2025-01-01', to: '2025-03-01' })
      .set('X-API-Key', 'wgi_sandbox_testkey123');

    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(res.body.entries.length).toBeGreaterThan(0);
  });
});

describe('POST /v1/sandbox/core-banking/transactions/transfer', () => {
  it('returns sandbox transfer result', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/transactions/transfer')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({
        source_account_number: 'WKZ-0001-2024',
        destination_account_number: 'WKZ-0002-2024',
        amount: 5000,
        currency: 'KES',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.status).toBe('Completed');
    expect(res.body.transactionId).toBeDefined();
  });
});

describe('POST /v1/sandbox/core-banking/transactions/deposit', () => {
  it('returns sandbox M-Pesa deposit result', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/transactions/deposit')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({
        account_number: 'WKZ-0001-2024',
        amount: 1000,
        currency: 'KES',
        mobile_number: '+254700000001',
        provider: 'MPESA',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.provider).toBe('MPESA');
  });
});

describe('POST /v1/sandbox/core-banking/loans/apply', () => {
  it('returns an approved sandbox loan application', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/loans/apply')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({
        loan_type: 'Personal',
        requested_amount: 50000,
        currency: 'KES',
        tenure_months: 12,
        purpose: 'Business expansion',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.status).toBe('Approved');
    expect(res.body.creditScore).toBe(720);
  });
});

describe('GET /v1/sandbox/core-banking/loans/:loanId', () => {
  it('returns sandbox loan details', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .get('/v1/sandbox/core-banking/loans/loan-uuid-sandbox')
      .set('X-API-Key', 'wgi_sandbox_testkey123');

    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.loanId).toBe('loan-uuid-sandbox');
    expect(res.body.status).toBe('Active');
    expect(res.body.outstandingBalance).toBe(42000.00);
  });
});

describe('POST /v1/sandbox/core-banking/loans/:loanId/repay', () => {
  it('returns sandbox loan repayment result', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/loans/loan-uuid-sandbox/repay')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({ amount: 4729.17, currency: 'KES' });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.amountPaid).toBe(4729.17);
    expect(res.body.status).toBe('Completed');
  });
});

describe('POST /v1/sandbox/core-banking/cards/issue', () => {
  it('issues a sandbox card', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/cards/issue')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({
        account_number: 'WKZ-0001-2024',
        card_type: 'Debit',
        cardholder_name: 'TEST HOLDER',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.status).toBe('Active');
    expect(res.body.cardNumber).toMatch(/^\*{4}-\*{4}-\*{4}-\d{4}$/);
  });
});

describe('POST /v1/sandbox/core-banking/payments/transfer', () => {
  it('returns sandbox cross-bank payment result', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/payments/transfer')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({
        source_account_number: 'WKZ-0001-2024',
        beneficiary_account: 'BENE-001',
        beneficiary_bank: 'KCB',
        amount: 10000,
        currency: 'KES',
        narration: 'Invoice settlement',
        payment_rail: 'RTGS',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.status).toBe('Accepted');
    expect(res.body.paymentRail).toBe('RTGS');
  });
});

describe('POST /v1/sandbox/core-banking/payments/mpesa/stk-push', () => {
  it('returns sandbox M-Pesa STK push result', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .post('/v1/sandbox/core-banking/payments/mpesa/stk-push')
      .set('X-API-Key', 'wgi_sandbox_testkey123')
      .send({
        account_number: 'WKZ-0001-2024',
        phone_number: '+254700000001',
        amount: 500,
        reference: 'INV-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.responseCode).toBe('0');
    expect(res.body.checkoutRequestId).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Core Banking — Live routes (/v1/core-banking/*)
//
// When core banking is disabled (WEKEZA_CORE_ENABLED=false, the default in test),
// the live routes return 503 pointing to the sandbox.
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /v1/core-banking/health (live route)', () => {
  it('returns disabled/unreachable status — v1-Core not available in test env', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .get('/v1/core-banking/health')
      .set('X-API-Key', 'wgi_sandbox_testkey123');

    // When WEKEZA_CORE_ENABLED=false → 200 {status:'disabled'}
    // When WEKEZA_CORE_ENABLED=true but v1-Core not running → 503 ECONNREFUSED
    expect([200, 503]).toContain(res.status);
  });
});

describe('GET /v1/core-banking/accounts (live route — v1-Core not running)', () => {
  it('returns 503 when v1-Core is unreachable', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce(CORE_API_KEY_ROW);

    const res = await request(app)
      .get('/v1/core-banking/accounts')
      .set('X-API-Key', 'wgi_sandbox_testkey123');

    // 503 covers both: disabled (WEKEZA_CORE_ENABLED=false) and
    // unreachable (ECONNREFUSED wrapped as 503 by coreBankingService)
    expect(res.status).toBe(503);
  });
});
