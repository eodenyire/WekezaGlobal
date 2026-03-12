/**
 * Core Banking Developer API — `/v1/core-banking`
 *
 * This router exposes the Wekeza v1-Core banking system to external developers
 * (fintech partners, app builders, corporate clients) who have obtained a WGI
 * API key or JWT token.  WekezaGlobal acts as a secure API gateway:
 *
 *   External Developer  →  [WGI API Key / JWT]  →  WekezaGlobal  →  Wekeza v1-Core (.NET)
 *
 * Authentication:
 *   • API key:   X-API-Key: wgi_<hex>          (for machine-to-machine / partner integrations)
 *   • JWT bearer: Authorization: Bearer <token> (for user-context requests)
 *
 * When the v1-Core service is unreachable or disabled, all endpoints return
 * HTTP 503 with a pointer to the sandbox alternatives.
 *
 * v1-Core source: github.com/eodenyire/Wekeza/APIs/v1-Core
 *
 * Mounted at: /v1/core-banking
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  authenticate,
  authenticateApiKey,
  AuthRequest,
} from '../middleware/auth';
import * as core from '../services/coreBankingService';

const router = Router();

// ─── Auth: any valid WGI credential (API key OR JWT bearer) ──────────────────

function apiKeyOrJwt(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.headers['x-api-key']) {
    // API key path (async) — must return void, chain via next
    (authenticateApiKey as (r: Request, s: Response, n: NextFunction) => Promise<void>)(req, res, next);
  } else {
    authenticate(req, res, next);
  }
}

router.use(apiKeyOrJwt as (req: Request, res: Response, next: NextFunction) => void);

// ─── Health / connection check ────────────────────────────────────────────────

/**
 * GET /v1/core-banking/health
 * Verifies that WekezaGlobal can reach the Wekeza v1-Core system and obtain a
 * service token.  Useful for integration diagnostics.
 */
router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { config } = await import('../config');
    if (!config.coreBankingEnabled) {
      res.json({
        status: 'disabled',
        message: 'Core banking integration is disabled (WEKEZA_CORE_ENABLED=false). Use /v1/sandbox/core-banking/* for testing.',
        core_banking_url: null,
      });
      return;
    }
    // Attempt to obtain a service token — this proves end-to-end connectivity
    await core.getServiceToken();
    res.json({
      status: 'ok',
      message: 'WekezaGlobal is connected to Wekeza v1-Core.',
      core_banking_url: config.coreBankingUrl,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Accounts ─────────────────────────────────────────────────────────────────

const OpenAccountSchema = z.object({
  full_name:              z.string().min(2),
  identification_number:  z.string().min(4),
  email:                  z.string().email(),
  phone_number:           z.string().min(7),
  account_type:           z.enum(['Savings', 'Current', 'Business']),
  currency:               z.enum(['KES', 'USD', 'EUR', 'GBP']).default('KES'),
  initial_deposit:        z.number().nonnegative().optional(),
});

/**
 * GET /v1/core-banking/accounts
 * List all accounts (paginated). Requires admin or operations role, or a
 * partner API key.
 */
router.get('/accounts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pageNumber  = parseInt(req.query.page     as string) || 1;
    const pageSize    = parseInt(req.query.per_page as string) || 20;
    const searchTerm  = req.query.search as string | undefined;

    const result = await core.listAccounts({ pageNumber, pageSize, searchTerm });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/core-banking/accounts/:accountNumber
 * Retrieve a single account by account number.
 */
router.get('/accounts/:accountNumber', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const account = await core.getAccount(req.params.accountNumber);
    res.json(account);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/core-banking/accounts/open
 * Open a new bank account in the Wekeza core system.
 *
 * Body:
 *   full_name, identification_number, email, phone_number,
 *   account_type ("Savings"|"Current"|"Business"),
 *   currency (default KES), initial_deposit (optional)
 */
router.post('/accounts/open', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = OpenAccountSchema.parse(req.body);
    const result = await core.openAccount({
      fullName:             body.full_name,
      identificationNumber: body.identification_number,
      email:                body.email,
      phoneNumber:          body.phone_number,
      accountType:          body.account_type,
      currency:             body.currency,
      initialDeposit:       body.initial_deposit,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/core-banking/accounts/:accountNumber/balance
 * Get the current balance for a Wekeza core banking account.
 */
router.get('/accounts/:accountNumber/balance', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const balance = await core.getAccountBalance(req.params.accountNumber);
    res.json(balance);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/core-banking/accounts/:accountNumber/statement
 * Retrieve a paginated account statement.
 *
 * Query params: from (ISO date), to (ISO date), page (default 1)
 */
router.get('/accounts/:accountNumber/statement', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      res.status(400).json({ error: 'BadRequest', message: '`from` and `to` query parameters are required (ISO 8601 date)' });
      return;
    }
    const page = parseInt(req.query.page as string) || 1;
    const statement = await core.getStatement(req.params.accountNumber, from as string, to as string, page);
    res.json(statement);
  } catch (err) {
    next(err);
  }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

const TransferSchema = z.object({
  source_account_number:      z.string().min(4),
  destination_account_number: z.string().min(4),
  amount:                     z.number().positive(),
  currency:                   z.enum(['KES', 'USD', 'EUR', 'GBP']),
  narration:                  z.string().max(200).optional(),
  reference:                  z.string().max(100).optional(),
});

/**
 * POST /v1/core-banking/transactions/transfer
 * Execute a fund transfer between two Wekeza core banking accounts.
 */
router.post('/transactions/transfer', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = TransferSchema.parse(req.body);
    const result = await core.transfer({
      sourceAccountNumber:      body.source_account_number,
      destinationAccountNumber: body.destination_account_number,
      amount:                   body.amount,
      currency:                 body.currency,
      narration:                body.narration,
      reference:                body.reference,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const MobileDepositSchema = z.object({
  account_number: z.string().min(4),
  amount:         z.number().positive(),
  currency:       z.enum(['KES', 'USD', 'EUR', 'GBP']).default('KES'),
  mobile_number:  z.string().min(9),
  provider:       z.enum(['MPESA', 'AIRTEL', 'EQUITEL']).default('MPESA'),
  narration:      z.string().max(200).optional(),
});

/**
 * POST /v1/core-banking/transactions/deposit
 * Initiate a mobile money (M-Pesa / Airtel / Equitel) deposit to a Wekeza account.
 */
router.post('/transactions/deposit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = MobileDepositSchema.parse(req.body);
    const result = await core.mobileDeposit({
      accountNumber: body.account_number,
      amount:        body.amount,
      currency:      body.currency,
      mobileNumber:  body.mobile_number,
      provider:      body.provider,
      narration:     body.narration,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Loans ────────────────────────────────────────────────────────────────────

const LoanApplicationSchema = z.object({
  account_number:  z.string().min(4),
  loan_type:       z.enum(['Personal', 'Business', 'Mortgage', 'AssetFinance']),
  requested_amount: z.number().positive(),
  currency:        z.enum(['KES', 'USD', 'EUR', 'GBP']).default('KES'),
  tenure_months:   z.number().int().min(1).max(360),
  purpose:         z.string().min(5).max(500),
  collateral:      z.string().max(500).optional(),
});

/**
 * POST /v1/core-banking/loans/apply
 * Submit a loan application through the Wekeza core banking system.
 * The system performs an automated credit assessment and returns an instant
 * decision with a credit score for eligible applicants.
 */
router.post('/loans/apply', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = LoanApplicationSchema.parse(req.body);
    const result = await core.applyForLoan({
      accountNumber:   body.account_number,
      loanType:        body.loan_type,
      requestedAmount: body.requested_amount,
      currency:        body.currency,
      tenureMonths:    body.tenure_months,
      purpose:         body.purpose,
      collateral:      body.collateral,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/core-banking/loans/:loanId
 * Get the full details of a loan including repayment schedule and status.
 */
router.get('/loans/:loanId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const loan = await core.getLoan(req.params.loanId);
    res.json(loan);
  } catch (err) {
    next(err);
  }
});

const LoanRepaymentSchema = z.object({
  account_number: z.string().min(4),
  amount:         z.number().positive(),
  currency:       z.enum(['KES', 'USD', 'EUR', 'GBP']).default('KES'),
  reference:      z.string().max(100).optional(),
});

/**
 * POST /v1/core-banking/loans/:loanId/repay
 * Process a loan repayment. Returns allocation breakdown (principal + interest).
 */
router.post('/loans/:loanId/repay', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = LoanRepaymentSchema.parse(req.body);
    const result = await core.repayLoan({
      loanId:        req.params.loanId,
      accountNumber: body.account_number,
      amount:        body.amount,
      currency:      body.currency,
      reference:     body.reference,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Cards ────────────────────────────────────────────────────────────────────

const IssueCardSchema = z.object({
  account_number:         z.string().min(4),
  card_type:              z.enum(['Debit', 'Credit', 'Prepaid']).default('Debit'),
  cardholder_name:        z.string().min(2).max(100),
  currency:               z.enum(['KES', 'USD', 'EUR', 'GBP']).default('KES'),
  daily_withdrawal_limit: z.number().positive().optional(),
});

/**
 * POST /v1/core-banking/cards/issue
 * Issue a new debit, credit, or prepaid card linked to a Wekeza core banking account.
 */
router.post('/cards/issue', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = IssueCardSchema.parse(req.body);
    const result = await core.issueCard({
      accountNumber:        body.account_number,
      cardType:             body.card_type,
      cardholderName:       body.cardholder_name,
      currency:             body.currency,
      dailyWithdrawalLimit: body.daily_withdrawal_limit,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Payments ─────────────────────────────────────────────────────────────────

const CrossBankPaymentSchema = z.object({
  source_account_number: z.string().min(4),
  beneficiary_account:   z.string().min(4),
  beneficiary_bank:      z.string().min(2),
  beneficiary_bank_code: z.string().optional(),
  amount:                z.number().positive(),
  currency:              z.enum(['KES', 'USD', 'EUR', 'GBP']),
  narration:             z.string().min(3).max(200),
  payment_rail:          z.enum(['SWIFT', 'SEPA', 'ACH', 'RTGS', 'MPESA']),
  reference:             z.string().max(100).optional(),
});

/**
 * POST /v1/core-banking/payments/transfer
 * Initiate a cross-bank payment via SWIFT, SEPA, ACH, RTGS, or M-Pesa.
 */
router.post('/payments/transfer', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = CrossBankPaymentSchema.parse(req.body);
    const result = await core.initiatePayment({
      sourceAccountNumber: body.source_account_number,
      beneficiaryAccount:  body.beneficiary_account,
      beneficiaryBank:     body.beneficiary_bank,
      beneficiaryBankCode: body.beneficiary_bank_code,
      amount:              body.amount,
      currency:            body.currency,
      narration:           body.narration,
      paymentRail:         body.payment_rail,
      reference:           body.reference,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const MpesaStkSchema = z.object({
  account_number: z.string().min(4),
  phone_number:   z.string().min(9),
  amount:         z.number().positive(),
  reference:      z.string().min(3).max(100),
  description:    z.string().max(200).optional(),
});

/**
 * POST /v1/core-banking/payments/mpesa/stk-push
 * Trigger an M-Pesa STK push to collect a payment from a customer's phone.
 */
router.post('/payments/mpesa/stk-push', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = MpesaStkSchema.parse(req.body);
    const result = await core.mpesaStkPush({
      accountNumber: body.account_number,
      phoneNumber:   body.phone_number,
      amount:        body.amount,
      reference:     body.reference,
      description:   body.description,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
