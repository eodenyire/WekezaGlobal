/**
 * Core Banking Service — Wekeza v1-Core Integration Gateway
 *
 * WekezaGlobal acts as an API gateway for external developers (fintech partners,
 * app builders, corporate clients) who interact with the Wekeza core banking
 * system via WGI API keys and JWT tokens.
 *
 * This service:
 *   1. Authenticates to v1-Core using a WGI service-account (POST /api/authentication/login).
 *   2. Caches the service JWT in Redis to avoid a round-trip on every request.
 *   3. Forwards authorised partner requests to the v1-Core .NET REST API.
 *   4. Translates v1-Core responses into WGI-standard JSON shapes.
 *   5. When WEKEZA_CORE_ENABLED=false (or the URL is unreachable), throws a typed
 *      503 error so callers can route to the sandbox.
 *
 * v1-Core API surface (github.com/eodenyire/Wekeza/APIs/v1-Core):
 *   POST   /api/authentication/login
 *   GET    /api/authentication/me
 *   GET    /api/accounts/list
 *   GET    /api/accounts/:accountNumber
 *   POST   /api/accounts/open
 *   GET    /api/accounts/:id/balance
 *   POST   /api/transactions/transfer
 *   POST   /api/transactions/deposit/mobile
 *   GET    /api/transactions/statement/:accountNumber
 *   POST   /api/loans/apply
 *   POST   /api/loans/approve
 *   POST   /api/loans/disburse
 *   POST   /api/loans/repayment
 *   GET    /api/loans/:loanId
 *   POST   /api/cards/issue
 *   POST   /api/cards/cancel
 *   POST   /api/cards/withdraw
 *   POST   /api/payments/transfer       (cross-bank via M-Pesa / SWIFT / SEPA / ACH)
 *   POST   /api/payments/mpesa/stk-push
 */

import https from 'https';
import http from 'http';
import { IncomingMessage } from 'http';
import { config } from '../config';
import { redis } from '../database';
import { createError } from '../middleware/errorHandler';

// ─── Constants ────────────────────────────────────────────────────────────────

const CORE_TOKEN_REDIS_KEY = 'wgi:core_banking:service_token';

// ─── Internal HTTP helper ─────────────────────────────────────────────────────

interface CoreResponse<T = unknown> {
  status: number;
  body: T;
}

function coreRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<CoreResponse<T>> {
  return new Promise((resolve, reject) => {
    const baseUrl = config.coreBankingUrl;
    const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');

    const payload = body ? JSON.stringify(body) : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload).toString();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout: config.coreBankingTimeoutMs,
      },
      (res: IncomingMessage) => {
        let raw = '';
        res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
        res.on('end', () => {
          try {
            const parsed: T = raw ? (JSON.parse(raw) as T) : ({} as T);
            resolve({ status: res.statusCode ?? 200, body: parsed });
          } catch {
            resolve({ status: res.statusCode ?? 200, body: raw as unknown as T });
          }
        });
      }
    );

    req.on('error', (err: Error) => {
      reject(createError(`Unable to reach v1-Core at ${config.coreBankingUrl}: ${err.message}`, 503));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(createError(
        `v1-Core request timed out after ${config.coreBankingTimeoutMs}ms — check WEKEZA_CORE_URL and network connectivity`,
        503
      ));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Service token management ─────────────────────────────────────────────────

/**
 * Returns a valid service-account JWT for the v1-Core system.
 * The token is cached in Redis (key: wgi:core_banking:service_token) for
 * `config.coreBankingTokenTtlSec` seconds.  On cache miss it authenticates
 * fresh and stores the new token.
 */
export async function getServiceToken(): Promise<string> {
  // Try Redis cache first
  try {
    if (redis.status === 'ready') {
      const cached = await redis.get(CORE_TOKEN_REDIS_KEY);
      if (cached) return cached;
    }
  } catch {
    // Fall through to fresh auth
  }

  const res = await coreRequest<{ token?: string; Token?: string }>(
    'POST',
    '/api/authentication/login',
    {
      username: config.coreBankingServiceUser,
      password: config.coreBankingServicePass,
    }
  );

  if (res.status !== 200 || (!res.body.token && !res.body.Token)) {
    throw createError(
      'Failed to authenticate WGI gateway with v1-Core — check WEKEZA_CORE_SERVICE_USER/PASS',
      503
    );
  }

  const token = (res.body.token ?? res.body.Token) as string;

  try {
    if (redis.status === 'ready') {
      await redis.setex(CORE_TOKEN_REDIS_KEY, config.coreBankingTokenTtlSec, token);
    }
  } catch {
    // Non-fatal
  }

  return token;
}

/**
 * Invalidates the cached service token (e.g. after a 401 from v1-Core).
 */
export async function invalidateServiceToken(): Promise<void> {
  try {
    if (redis.status === 'ready') {
      await redis.del(CORE_TOKEN_REDIS_KEY);
    }
  } catch {
    // Non-fatal
  }
}

// ─── Guard ────────────────────────────────────────────────────────────────────

/**
 * Ensures the core banking integration is enabled; throws a 503 when it is not.
 */
function assertEnabled(): void {
  if (!config.coreBankingEnabled) {
    throw createError(
      'Core banking integration is disabled (WEKEZA_CORE_ENABLED=false). ' +
      'Use the sandbox endpoints (/v1/sandbox/core-banking/*) to test your integration.',
      503
    );
  }
}

/**
 * Calls the v1-Core API, automatically refreshing the service token on 401.
 */
async function callCore<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<CoreResponse<T>> {
  assertEnabled();

  let token = await getServiceToken();
  let res = await coreRequest<T>(method, path, body, token);

  // Retry once on 401 — the cached token may have just expired
  if (res.status === 401) {
    await invalidateServiceToken();
    token = await getServiceToken();
    res = await coreRequest<T>(method, path, body, token);
  }

  return res;
}

// ─── Typed response helpers ───────────────────────────────────────────────────

function assertOk<T>(res: CoreResponse<T>, context: string): T {
  if (res.status === 404) throw createError(`${context}: not found in core banking system`, 404);
  if (res.status === 400) {
    const msg = (res.body as Record<string, string>)?.message ?? 'Bad request to core banking';
    throw createError(`${context}: ${msg}`, 400);
  }
  if (res.status >= 500) {
    throw createError(`${context}: core banking system error (${res.status})`, 502);
  }
  return res.body;
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export interface CoreAccount {
  id: string;
  accountNumber: string;
  accountType: string;
  balance: number;
  currency: string;
  status: string;
  createdAt: string;
  ownerId?: string;
  ownerName?: string;
}

export interface ListAccountsParams {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
}

export interface PaginatedAccounts {
  data: CoreAccount[];
  pagination: {
    pageNumber: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export async function listAccounts(params: ListAccountsParams = {}): Promise<PaginatedAccounts> {
  const qs = new URLSearchParams();
  if (params.pageNumber) qs.set('pageNumber', String(params.pageNumber));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.searchTerm) qs.set('searchTerm', params.searchTerm);

  const res = await callCore<PaginatedAccounts>('GET', `/api/accounts/list?${qs}`);
  return assertOk(res, 'listAccounts');
}

export async function getAccount(accountNumber: string): Promise<CoreAccount> {
  const res = await callCore<CoreAccount>('GET', `/api/accounts/${encodeURIComponent(accountNumber)}`);
  return assertOk(res, 'getAccount');
}

export interface OpenAccountInput {
  /** Customer full name */
  fullName: string;
  /** national ID / passport number */
  identificationNumber: string;
  email: string;
  phoneNumber: string;
  accountType: 'Savings' | 'Current' | 'Business';
  currency?: string;
  initialDeposit?: number;
}

export interface OpenAccountResult {
  accountId: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  status: string;
  createdAt: string;
}

export async function openAccount(input: OpenAccountInput): Promise<OpenAccountResult> {
  const res = await callCore<OpenAccountResult>('POST', '/api/accounts/open', input);
  return assertOk(res, 'openAccount');
}

export interface AccountBalance {
  accountId: string;
  accountNumber: string;
  currency: string;
  availableBalance: number;
  currentBalance: number;
  lastUpdated: string;
}

export async function getAccountBalance(accountNumber: string): Promise<AccountBalance> {
  // v1-Core accepts both ID and account number for the balance endpoint
  const res = await callCore<AccountBalance>('GET', `/api/accounts/${encodeURIComponent(accountNumber)}/balance`);
  return assertOk(res, 'getAccountBalance');
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface TransferInput {
  sourceAccountNumber: string;
  destinationAccountNumber: string;
  amount: number;
  currency: string;
  narration?: string;
  reference?: string;
}

export interface TransferResult {
  transactionId: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  sourceAccount: string;
  destinationAccount: string;
  timestamp: string;
}

export async function transfer(input: TransferInput): Promise<TransferResult> {
  const res = await callCore<TransferResult>('POST', '/api/transactions/transfer', input);
  return assertOk(res, 'transfer');
}

export interface MobileDepositInput {
  accountNumber: string;
  amount: number;
  currency: string;
  mobileNumber: string;
  provider: 'MPESA' | 'AIRTEL' | 'EQUITEL';
  narration?: string;
}

export interface DepositResult {
  transactionId: string;
  checkoutRequestId?: string;
  status: string;
  amount: number;
  currency: string;
  accountNumber: string;
  provider: string;
  timestamp: string;
}

export async function mobileDeposit(input: MobileDepositInput): Promise<DepositResult> {
  const res = await callCore<DepositResult>('POST', '/api/transactions/deposit/mobile', input);
  return assertOk(res, 'mobileDeposit');
}

export interface StatementEntry {
  transactionId: string;
  date: string;
  type: string;
  amount: number;
  currency: string;
  runningBalance: number;
  narration: string;
  reference: string;
}

export interface AccountStatement {
  accountNumber: string;
  currency: string;
  openingBalance: number;
  closingBalance: number;
  entries: StatementEntry[];
  fromDate: string;
  toDate: string;
  pageNumber: number;
  totalPages: number;
}

export async function getStatement(
  accountNumber: string,
  fromDate: string,
  toDate: string,
  page = 1
): Promise<AccountStatement> {
  const qs = new URLSearchParams({ from: fromDate, to: toDate, page: String(page) });
  const res = await callCore<AccountStatement>(
    'GET',
    `/api/transactions/statement/${encodeURIComponent(accountNumber)}?${qs}`
  );
  return assertOk(res, 'getStatement');
}

// ─── Loans ────────────────────────────────────────────────────────────────────

export interface LoanApplicationInput {
  accountNumber: string;
  loanType: 'Personal' | 'Business' | 'Mortgage' | 'AssetFinance';
  requestedAmount: number;
  currency: string;
  tenureMonths: number;
  purpose: string;
  collateral?: string;
}

export interface LoanApplicationResult {
  loanId: string;
  loanNumber: string;
  status: string;
  requestedAmount: number;
  approvedAmount?: number;
  currency: string;
  tenureMonths: number;
  interestRate?: number;
  monthlyInstalment?: number;
  creditScore?: number;
  message: string;
  createdAt: string;
}

export async function applyForLoan(input: LoanApplicationInput): Promise<LoanApplicationResult> {
  const res = await callCore<LoanApplicationResult>('POST', '/api/loans/apply', input);
  return assertOk(res, 'applyForLoan');
}

export interface LoanDetails {
  loanId: string;
  loanNumber: string;
  accountNumber: string;
  loanType: string;
  status: string;
  principalAmount: number;
  outstandingBalance: number;
  currency: string;
  interestRate: number;
  tenureMonths: number;
  disbursedAt?: string;
  nextPaymentDate?: string;
  nextPaymentAmount?: number;
  schedule?: Array<{
    instalment: number;
    dueDate: string;
    principal: number;
    interest: number;
    totalPayment: number;
    balance: number;
    status: string;
  }>;
}

export async function getLoan(loanId: string): Promise<LoanDetails> {
  const res = await callCore<LoanDetails>('GET', `/api/loans/${encodeURIComponent(loanId)}`);
  return assertOk(res, 'getLoan');
}

export interface LoanRepaymentInput {
  loanId: string;
  accountNumber: string;
  amount: number;
  currency: string;
  reference?: string;
}

export interface LoanRepaymentResult {
  transactionId: string;
  loanId: string;
  amountPaid: number;
  principalPaid: number;
  interestPaid: number;
  outstandingBalance: number;
  currency: string;
  status: string;
  timestamp: string;
}

export async function repayLoan(input: LoanRepaymentInput): Promise<LoanRepaymentResult> {
  const res = await callCore<LoanRepaymentResult>('POST', '/api/loans/repayment', input);
  return assertOk(res, 'repayLoan');
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export interface IssueCardInput {
  accountNumber: string;
  cardType: 'Debit' | 'Credit' | 'Prepaid';
  cardholderName: string;
  currency?: string;
  dailyWithdrawalLimit?: number;
}

export interface IssuedCard {
  cardId: string;
  cardNumber: string;    // masked — last 4 digits only
  cardType: string;
  accountNumber: string;
  cardholderName: string;
  expiryDate: string;
  status: string;
  dailyWithdrawalLimit: number;
  currency: string;
  issuedAt: string;
}

export async function issueCard(input: IssueCardInput): Promise<IssuedCard> {
  const res = await callCore<IssuedCard>('POST', '/api/cards/issue', input);
  return assertOk(res, 'issueCard');
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface CrossBankPaymentInput {
  sourceAccountNumber: string;
  /** Beneficiary account number or IBAN */
  beneficiaryAccount: string;
  beneficiaryBank: string;
  /** SWIFT BIC, IBAN routing code, etc. */
  beneficiaryBankCode?: string;
  amount: number;
  currency: string;
  narration: string;
  /** 'SWIFT' | 'SEPA' | 'ACH' | 'RTGS' | 'MPESA' */
  paymentRail: string;
  reference?: string;
}

export interface PaymentResult {
  paymentId: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  paymentRail: string;
  timestamp: string;
  estimatedSettlement?: string;
}

export async function initiatePayment(input: CrossBankPaymentInput): Promise<PaymentResult> {
  const res = await callCore<PaymentResult>('POST', '/api/payments/transfer', input);
  return assertOk(res, 'initiatePayment');
}

export interface MpesaStkPushInput {
  accountNumber: string;
  phoneNumber: string;
  amount: number;
  reference: string;
  description?: string;
}

export interface MpesaStkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export async function mpesaStkPush(input: MpesaStkPushInput): Promise<MpesaStkPushResult> {
  const res = await callCore<MpesaStkPushResult>('POST', '/api/payments/mpesa/stk-push', input);
  return assertOk(res, 'mpesaStkPush');
}
