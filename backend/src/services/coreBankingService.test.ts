/**
 * coreBankingService tests
 *
 * Tests the WGI → Wekeza v1-Core HTTP gateway service in isolation.
 * All network calls are mocked via jest.spyOn so the test suite has no
 * external dependencies.
 */

import http from 'http';
import { EventEmitter } from 'events';
import type { IncomingMessage } from 'http';

// ─── Mock the config with core banking enabled by default ─────────────────────
const mockConfig = {
  coreBankingEnabled: true,
  coreBankingUrl: 'http://localhost:5001',
  coreBankingTimeoutMs: 10000,
  coreBankingServiceUser: 'svc-user',
  coreBankingServicePass: 'svc-pass',
  coreBankingTokenTtlSec: 3000,
};

jest.mock('../config', () => ({ config: mockConfig }));

// ─── Mock database / redis ────────────────────────────────────────────────────
jest.mock('../database', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
  redis: {
    status: 'ready',
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  },
  connectDB: jest.fn(),
  connectRedis: jest.fn(),
}));

import { redis } from '../database';
import * as coreSvc from './coreBankingService';

// ─── Helper: make a mock http.ClientRequest that invokes the response callback ─
//
// http.request(options, callback) — the 2nd argument is the response callback.
// jest.spyOn intercepts the call so we must capture that callback and invoke it
// manually once `req.end()` is called.

function mockHttpRequest(statusCode: number, responseBody: unknown): void {
  jest.spyOn(http, 'request').mockImplementationOnce(
    ((_opts: unknown, callback: ((res: IncomingMessage) => void) | undefined) => {
      const req = new EventEmitter() as http.ClientRequest;
      (req as unknown as { write: () => void }).write = () => undefined;
      (req as unknown as { destroy: () => void }).destroy = () => undefined;
      (req as unknown as { end: () => void }).end = () => {
        process.nextTick(() => {
          if (!callback) return;
          const res = new EventEmitter() as IncomingMessage;
          (res as unknown as { statusCode: number }).statusCode = statusCode;
          callback(res);
          res.emit('data', Buffer.from(JSON.stringify(responseBody)));
          res.emit('end');
        });
      };
      return req;
    }) as typeof http.request
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('coreBankingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig.coreBankingEnabled = true;
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    (redis.del as jest.Mock).mockResolvedValue(1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── getServiceToken ──────────────────────────────────────────────────────────

  describe('getServiceToken()', () => {
    it('returns cached token from Redis when available', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('cached-jwt-token');
      const httpSpy = jest.spyOn(http, 'request');
      const token = await coreSvc.getServiceToken();
      expect(token).toBe('cached-jwt-token');
      expect(httpSpy).not.toHaveBeenCalled();
    });

    it('authenticates with v1-Core and caches token on cache miss', async () => {
      mockHttpRequest(200, { token: 'fresh-jwt-from-core' });
      const token = await coreSvc.getServiceToken();
      expect(token).toBe('fresh-jwt-from-core');
      expect(redis.setex).toHaveBeenCalledWith(
        'wgi:core_banking:service_token',
        expect.any(Number),
        'fresh-jwt-from-core'
      );
    });

    it('accepts PascalCase Token field in v1-Core response', async () => {
      mockHttpRequest(200, { Token: 'pascal-token' });
      const token = await coreSvc.getServiceToken();
      expect(token).toBe('pascal-token');
    });

    it('throws 503 when v1-Core returns non-200', async () => {
      mockHttpRequest(401, { message: 'Invalid credentials' });
      await expect(coreSvc.getServiceToken()).rejects.toMatchObject({ statusCode: 503 });
    });
  });

  // ── invalidateServiceToken ───────────────────────────────────────────────────

  describe('invalidateServiceToken()', () => {
    it('deletes the Redis cache key', async () => {
      await coreSvc.invalidateServiceToken();
      expect(redis.del).toHaveBeenCalledWith('wgi:core_banking:service_token');
    });
  });

  // ── assertEnabled guard ────────────────────────────────────────────────────

  describe('disabled mode', () => {
    it('throws 503 when coreBankingEnabled is false', async () => {
      mockConfig.coreBankingEnabled = false;
      await expect(coreSvc.listAccounts()).rejects.toMatchObject({ statusCode: 503 });
    });
  });

  // ── listAccounts ─────────────────────────────────────────────────────────────

  describe('listAccounts()', () => {
    it('returns paginated account list from v1-Core', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('svc-token');
      const mockAccounts = {
        data: [{ id: 'uuid-1', accountNumber: 'WKZ-001', accountType: 'Savings', balance: 50000, currency: 'KES', status: 'Active', createdAt: '' }],
        pagination: { pageNumber: 1, pageSize: 20, totalRecords: 1, totalPages: 1 },
      };
      mockHttpRequest(200, mockAccounts);
      const result = await coreSvc.listAccounts({ pageNumber: 1, pageSize: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].accountNumber).toBe('WKZ-001');
    });
  });

  // ── getAccount ───────────────────────────────────────────────────────────────

  describe('getAccount()', () => {
    it('returns account details', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('svc-token');
      mockHttpRequest(200, { id: 'uuid-2', accountNumber: 'WKZ-002', accountType: 'Current', balance: 12000, currency: 'KES', status: 'Active', createdAt: '' });
      const account = await coreSvc.getAccount('WKZ-002');
      expect(account.accountNumber).toBe('WKZ-002');
    });

    it('throws 404 when account not found', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('svc-token');
      mockHttpRequest(404, { message: 'Account not found' });
      await expect(coreSvc.getAccount('MISSING')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── getAccountBalance ────────────────────────────────────────────────────────

  describe('getAccountBalance()', () => {
    it('returns balance information', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('svc-token');
      mockHttpRequest(200, { accountNumber: 'WKZ-001', currency: 'KES', availableBalance: 85000, currentBalance: 85000, lastUpdated: new Date().toISOString() });
      const bal = await coreSvc.getAccountBalance('WKZ-001');
      expect(bal.availableBalance).toBe(85000);
    });
  });

  // ── transfer ─────────────────────────────────────────────────────────────────

  describe('transfer()', () => {
    it('executes a fund transfer and returns result', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('svc-token');
      mockHttpRequest(200, { transactionId: 'tx-uuid', reference: 'TRF-001', status: 'Completed', amount: 5000, currency: 'KES', sourceAccount: 'WKZ-001', destinationAccount: 'WKZ-002', timestamp: '' });
      const result = await coreSvc.transfer({ sourceAccountNumber: 'WKZ-001', destinationAccountNumber: 'WKZ-002', amount: 5000, currency: 'KES' });
      expect(result.status).toBe('Completed');
    });
  });

  // ── mobileDeposit ────────────────────────────────────────────────────────────

  describe('mobileDeposit()', () => {
    it('initiates a mobile deposit', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('svc-token');
      mockHttpRequest(200, { transactionId: 'dep-uuid', status: 'Pending', amount: 500, currency: 'KES', accountNumber: 'WKZ-001', provider: 'MPESA', timestamp: '' });
      const result = await coreSvc.mobileDeposit({ accountNumber: 'WKZ-001', amount: 500, currency: 'KES', mobileNumber: '+254700000001', provider: 'MPESA' });
      expect(result.provider).toBe('MPESA');
    });
  });

  // ── applyForLoan ──────────────────────────────────────────────────────────────

  describe('applyForLoan()', () => {
    it('submits a loan application', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('svc-token');
      mockHttpRequest(200, { loanId: 'loan-uuid', loanNumber: 'LN-001', status: 'Approved', requestedAmount: 50000, approvedAmount: 50000, currency: 'KES', tenureMonths: 12, interestRate: 13.5, creditScore: 720, message: 'Approved', createdAt: '' });
      const result = await coreSvc.applyForLoan({ accountNumber: 'WKZ-001', loanType: 'Personal', requestedAmount: 50000, currency: 'KES', tenureMonths: 12, purpose: 'Business expansion' });
      expect(result.loanId).toBe('loan-uuid');
      expect(result.status).toBe('Approved');
    });
  });

  // ── issueCard ─────────────────────────────────────────────────────────────────

  describe('issueCard()', () => {
    it('issues a card linked to an account', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('svc-token');
      mockHttpRequest(200, { cardId: 'card-uuid', cardNumber: '****1234', cardType: 'Debit', accountNumber: 'WKZ-001', cardholderName: 'TEST HOLDER', expiryDate: '12/2027', status: 'Active', dailyWithdrawalLimit: 50000, currency: 'KES', issuedAt: '' });
      const result = await coreSvc.issueCard({ accountNumber: 'WKZ-001', cardType: 'Debit', cardholderName: 'TEST HOLDER' });
      expect(result.cardId).toBe('card-uuid');
    });
  });

  // ── initiatePayment ──────────────────────────────────────────────────────────

  describe('initiatePayment()', () => {
    it('initiates a cross-bank payment', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('svc-token');
      mockHttpRequest(200, { paymentId: 'pmt-uuid', reference: 'PMT-001', status: 'Accepted', amount: 1000, currency: 'KES', paymentRail: 'RTGS', timestamp: '' });
      const result = await coreSvc.initiatePayment({ sourceAccountNumber: 'WKZ-001', beneficiaryAccount: 'BENE-001', beneficiaryBank: 'KCB', amount: 1000, currency: 'KES', narration: 'Invoice payment', paymentRail: 'RTGS' });
      expect(result.paymentId).toBe('pmt-uuid');
    });
  });

  // ── Token auto-refresh on 401 ────────────────────────────────────────────────

  describe('automatic token refresh', () => {
    it('retries with a fresh token when v1-Core returns 401', async () => {
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('stale-token')  // first get from Redis
        .mockResolvedValueOnce(null);           // after invalidate, cache miss

      // First call → 401 (stale token)
      mockHttpRequest(401, { message: 'Token expired' });
      // Re-auth call
      mockHttpRequest(200, { token: 'new-token' });
      // Retry with new token → 200
      mockHttpRequest(200, {
        data: [], pagination: { pageNumber: 1, pageSize: 20, totalRecords: 0, totalPages: 0 },
      });

      const httpSpy = jest.spyOn(http, 'request');
      // Mock the 3 calls (already mocked above via mockHttpRequest which uses mockImplementationOnce)
      // The spy is just to count calls
      const result = await coreSvc.listAccounts();
      expect(result.data).toHaveLength(0);
    });
  });
});
