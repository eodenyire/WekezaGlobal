/**
 * Sandbox API — Architecture §3.6
 * Provides a safe test environment for fintech partners to exercise all API
 * endpoints without affecting production data.  All responses are clearly
 * flagged with "sandbox: true" and use deterministic mock data.
 *
 * Schema §2 Redis: API keys are authenticated via X-API-Key header and their
 * usage is tracked per-key in Redis ("Per API key usage count").
 */
import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateApiKey, AuthRequest } from '../middleware/auth';

const router = Router();

// Sandbox constant for deterministic mock FX rates
const SANDBOX_USD_TO_KES_RATE = 134.5;

// Wise transfer status lifecycle
const WISE_STATUS_WAITING  = 'incoming_payment_waiting';
const WISE_STATUS_SENT     = 'outgoing_payment_sent';

// ── Health (no auth required — lets partners verify connectivity) ─────────────

router.get('/health', (_req: Request, res: Response) => {
  res.json({ sandbox: true, status: 'ok', environment: 'sandbox' });
});

// ── All other sandbox routes require a valid API key ─────────────────────────
// Schema §2: "API Rate Limiting / Throttling: Per API key usage count"
router.use(authenticateApiKey as (req: Request, res: Response, next: NextFunction) => void);

// ── Mock wallet ───────────────────────────────────────────────────────────────

router.post('/wallet/deposit', (req: Request, res: Response) => {
  const { wallet_id, amount, currency } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    transaction_id:  uuidv4(),
    wallet_id:       wallet_id  ?? uuidv4(),
    type:            'deposit',
    amount:          parseFloat(amount)  ?? 100,
    currency:        currency   ?? 'USD',
    status:          'completed',
    balance_after:   1100,
    timestamp:       new Date().toISOString(),
  });
});

router.post('/wallet/withdraw', (req: Request, res: Response) => {
  const { wallet_id, amount, currency } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    transaction_id:  uuidv4(),
    wallet_id:       wallet_id  ?? uuidv4(),
    type:            'withdrawal',
    amount:          parseFloat(amount)  ?? 50,
    currency:        currency   ?? 'USD',
    status:          'completed',
    balance_after:   950,
    timestamp:       new Date().toISOString(),
  });
});

router.get('/transactions/history', (_req: Request, res: Response) => {
  res.json({
    sandbox: true,
    transactions: [
      {
        transaction_id: uuidv4(),
        type: 'deposit',
        amount: '1000.0000',
        currency: 'USD',
        status: 'completed',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        transaction_id: uuidv4(),
        type: 'fx',
        amount: '200.0000',
        currency: 'USD',
        status: 'completed',
        created_at: new Date(Date.now() - 43200000).toISOString(),
      },
    ],
  });
});

// ── Mock FX ───────────────────────────────────────────────────────────────────

router.post('/fx/convert', (req: Request, res: Response) => {
  const { amount, currency_from, currency_to } = req.body as Record<string, string>;
  const amt = parseFloat(amount) ?? 100;
  res.status(201).json({
    sandbox: true,
    transaction_id: uuidv4(),
    amount_from:    amt,
    amount_to:      amt * SANDBOX_USD_TO_KES_RATE,
    currency_from:  currency_from ?? 'USD',
    currency_to:    currency_to   ?? 'KES',
    fx_rate:        SANDBOX_USD_TO_KES_RATE,
    fee:            amt * 0.005,
    status:         'completed',
    timestamp:      new Date().toISOString(),
  });
});

// ── Mock Card ─────────────────────────────────────────────────────────────────

router.post('/card/create', (req: Request, res: Response) => {
  const { type } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    card_id:        uuidv4(),
    card_type:      type ?? 'virtual',
    status:         'active',
    spending_limit: 5000,
    created_at:     new Date().toISOString(),
  });
});

// ── Mock Settlement ───────────────────────────────────────────────────────────

router.post('/settlements', (req: Request, res: Response) => {
  const { amount, currency } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    settlement_id: uuidv4(),
    amount:        parseFloat(amount) ?? 500,
    currency:      currency ?? 'KES',
    status:        'pending',
    bank_name:     'Sandbox Bank',
    timestamp:     new Date().toISOString(),
  });
});

// ── Integration Adapters — Architecture §3.6 (Integration Layer) ─────────────
// Mock adapters for third-party payment platforms: PayPal, Stripe, Payoneer
// and payment rail adapters (SWIFT, SEPA, ACH).
// All responses include {sandbox: true, adapter: "<platform>"} so partners
// can test end-to-end flows against realistic response shapes.

// ─── PayPal adapter ──────────────────────────────────────────────────────────

router.post('/integrations/paypal/payout', (req: Request, res: Response) => {
  const { amount, currency, recipient_email } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    adapter: 'paypal',
    batch_id: `PAYPAL-${uuidv4().split('-')[0].toUpperCase()}`,
    batch_status: 'PENDING',
    sender_item_id: uuidv4(),
    recipient_email: recipient_email ?? 'recipient@example.com',
    amount: parseFloat(amount) || 100,
    currency: currency ?? 'USD',
    estimated_arrival: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(),
  });
});

router.get('/integrations/paypal/payout/:batch_id', (req: Request, res: Response) => {
  res.json({
    sandbox: true,
    adapter: 'paypal',
    batch_id: req.params.batch_id,
    batch_status: 'SUCCESS',
    items: [{ transaction_status: 'SUCCESS', transaction_id: uuidv4() }],
  });
});

// ─── Stripe adapter ──────────────────────────────────────────────────────────

router.post('/integrations/stripe/transfer', (req: Request, res: Response) => {
  const { amount, currency, destination } = req.body as Record<string, string>;
  const amtInt = Math.round((parseFloat(amount) || 100) * 100); // Stripe uses cents
  res.status(201).json({
    sandbox: true,
    adapter: 'stripe',
    id: `tr_${uuidv4().replace(/-/g, '').slice(0, 24)}`,
    object: 'transfer',
    amount: amtInt,
    currency: (currency ?? 'usd').toLowerCase(),
    destination: destination ?? 'acct_sandbox_example',
    status: 'paid',
    created: Math.floor(Date.now() / 1000),
  });
});

router.post('/integrations/stripe/payout', (req: Request, res: Response) => {
  const { amount, currency } = req.body as Record<string, string>;
  const amtInt = Math.round((parseFloat(amount) || 100) * 100);
  res.status(201).json({
    sandbox: true,
    adapter: 'stripe',
    id: `po_${uuidv4().replace(/-/g, '').slice(0, 24)}`,
    object: 'payout',
    amount: amtInt,
    currency: (currency ?? 'usd').toLowerCase(),
    status: 'pending',
    method: 'standard',
    arrival_date: Math.floor((Date.now() + 86400000 * 2) / 1000),
    created: Math.floor(Date.now() / 1000),
  });
});

// ─── Payoneer adapter ─────────────────────────────────────────────────────────

router.post('/integrations/payoneer/payment', (req: Request, res: Response) => {
  const { amount, currency, payee_id } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    adapter: 'payoneer',
    payment_id: `PN-${uuidv4().split('-')[0].toUpperCase()}`,
    payee_id: payee_id ?? 'sandbox-payee-001',
    amount: parseFloat(amount) || 100,
    currency: currency ?? 'USD',
    status: 'PENDING',
    estimated_delivery: new Date(Date.now() + 86400000 * 3).toISOString(),
    created_at: new Date().toISOString(),
  });
});

// ─── SWIFT adapter ────────────────────────────────────────────────────────────

router.post('/integrations/swift/transfer', (req: Request, res: Response) => {
  const { amount, currency, bic, iban } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    adapter: 'swift',
    uetr: uuidv4(),         // Unique End-to-end Transaction Reference
    bic: bic ?? 'AAAABBCC',
    iban: iban ?? 'GB29NWBK60161331926819',
    amount: parseFloat(amount) || 1000,
    currency: currency ?? 'USD',
    status: 'ACCEPTED_WITHOUT_POSTING',
    settlement_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  });
});

// ─── SEPA adapter ─────────────────────────────────────────────────────────────

router.post('/integrations/sepa/credit-transfer', (req: Request, res: Response) => {
  const { amount, iban, bic } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    adapter: 'sepa',
    message_id: `SEPA-${uuidv4().split('-')[0].toUpperCase()}`,
    iban: iban ?? 'DE89370400440532013000',
    bic: bic ?? 'COBADEFFXXX',
    amount: parseFloat(amount) || 500,
    currency: 'EUR',
    status: 'ACCP',   // AcceptedCustomerProfile
    execution_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  });
});

// ─── ACH adapter ──────────────────────────────────────────────────────────────

router.post('/integrations/ach/transfer', (req: Request, res: Response) => {
  const { amount, routing_number, account_number } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    adapter: 'ach',
    trace_number: `ACH${Date.now()}`,
    routing_number: routing_number ?? '021000021',
    account_number: account_number && account_number.length >= 4
      ? `****${account_number.slice(-4)}`
      : '****XXXX',
    amount: parseFloat(amount) || 500,
    currency: 'USD',
    sec_code: 'PPD',
    status: 'PENDING',
    effective_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  });
});

// ─── Wise (TransferWise) adapter ──────────────────────────────────────────────
// Vision: "Remote workers paid via PayPal, Wise, etc." — Executive Vision Doc §5

router.post('/integrations/wise/transfer', (req: Request, res: Response) => {
  const { amount, source_currency, target_currency, target_account } = req.body as Record<string, string>;
  const amt = parseFloat(amount) || 100;
  // Wise charges a ~0.5% fee on international transfers
  const fee = parseFloat((amt * 0.005).toFixed(2));
  res.status(201).json({
    sandbox: true,
    adapter: 'wise',
    transfer_id: `WISE-${uuidv4().split('-')[0].toUpperCase()}`,
    quote_id: uuidv4(),
    source_currency: source_currency ?? 'USD',
    target_currency: target_currency ?? 'KES',
    source_amount: amt,
    target_amount: parseFloat(((amt - fee) * SANDBOX_USD_TO_KES_RATE).toFixed(2)),
    fee,
    fee_currency: source_currency ?? 'USD',
    target_account: target_account ?? 'KE-SANDBOX-ACC',
    status: WISE_STATUS_WAITING,
    estimated_delivery: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(),
  });
});

router.get('/integrations/wise/transfer/:transfer_id', (req: Request, res: Response) => {
  res.json({
    sandbox: true,
    adapter: 'wise',
    transfer_id: req.params.transfer_id,
    status: WISE_STATUS_SENT,
    estimated_delivery: new Date(Date.now() + 3600000).toISOString(),
  });
});

// ─── Core Banking Sandbox — github.com/eodenyire/Wekeza/APIs/v1-Core ─────────
//
// These endpoints mirror the Wekeza v1-Core banking system API surface so that
// external developers can build and test their integrations without needing a
// live v1-Core deployment.  Every response carries sandbox: true and
// core_banking: true to distinguish it from production.
//
// Production routes (require v1-Core running):
//   GET/POST /v1/core-banking/accounts/*
//   POST     /v1/core-banking/transactions/*
//   POST     /v1/core-banking/loans/*
//   POST     /v1/core-banking/cards/*
//   POST     /v1/core-banking/payments/*

// Demo account numbers used consistently across all sandbox responses
const SANDBOX_ACCT_1 = 'WKZ-0001-2024';
const SANDBOX_ACCT_2 = 'WKZ-0002-2024';

// ── Accounts ──────────────────────────────────────────────────────────────────

router.get('/core-banking/accounts', (_req: Request, res: Response) => {
  res.json({
    sandbox: true,
    core_banking: true,
    data: [
      {
        id: uuidv4(),
        accountNumber: SANDBOX_ACCT_1,
        accountType: 'Savings',
        balance: 85000.00,
        currency: 'KES',
        status: 'Active',
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      },
      {
        id: uuidv4(),
        accountNumber: SANDBOX_ACCT_2,
        accountType: 'Business',
        balance: 250000.00,
        currency: 'KES',
        status: 'Active',
        createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
      },
    ],
    pagination: { pageNumber: 1, pageSize: 20, totalRecords: 2, totalPages: 1 },
  });
});

router.get('/core-banking/accounts/:accountNumber', (req: Request, res: Response) => {
  res.json({
    sandbox: true,
    core_banking: true,
    id: uuidv4(),
    accountNumber: req.params.accountNumber,
    accountType: 'Savings',
    balance: 85000.00,
    currency: 'KES',
    status: 'Active',
    ownerName: 'Sandbox Account Holder',
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  });
});

router.post('/core-banking/accounts/open', (req: Request, res: Response) => {
  const { account_type, currency } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    core_banking: true,
    accountId: uuidv4(),
    accountNumber: `WKZ-${Math.floor(Math.random() * 9000) + 1000}-SAND`,
    accountType: account_type ?? 'Savings',
    currency: currency ?? 'KES',
    status: 'Active',
    createdAt: new Date().toISOString(),
  });
});

router.get('/core-banking/accounts/:accountNumber/balance', (req: Request, res: Response) => {
  res.json({
    sandbox: true,
    core_banking: true,
    accountNumber: req.params.accountNumber,
    currency: 'KES',
    availableBalance: 85000.00,
    currentBalance: 85000.00,
    lastUpdated: new Date().toISOString(),
  });
});

router.get('/core-banking/accounts/:accountNumber/statement', (req: Request, res: Response) => {
  const from = (req.query.from as string) ?? new Date(Date.now() - 2592000000).toISOString().split('T')[0];
  const to   = (req.query.to   as string) ?? new Date().toISOString().split('T')[0];
  res.json({
    sandbox: true,
    core_banking: true,
    accountNumber: req.params.accountNumber,
    currency: 'KES',
    openingBalance: 80000.00,
    closingBalance: 85000.00,
    fromDate: from,
    toDate: to,
    pageNumber: 1,
    totalPages: 1,
    entries: [
      {
        transactionId: uuidv4(),
        date: new Date(Date.now() - 86400000 * 3).toISOString(),
        type: 'Credit',
        amount: 10000.00,
        currency: 'KES',
        runningBalance: 85000.00,
        narration: 'Salary credit',
        reference: 'SAL-SANDBOX-001',
      },
      {
        transactionId: uuidv4(),
        date: new Date(Date.now() - 86400000 * 7).toISOString(),
        type: 'Debit',
        amount: 5000.00,
        currency: 'KES',
        runningBalance: 75000.00,
        narration: 'ATM withdrawal',
        reference: 'ATM-SANDBOX-002',
      },
    ],
  });
});

// ── Transactions ──────────────────────────────────────────────────────────────

router.post('/core-banking/transactions/transfer', (req: Request, res: Response) => {
  const { source_account_number, destination_account_number, amount, currency } =
    req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    core_banking: true,
    transactionId: uuidv4(),
    reference: `TRF-SAND-${Date.now()}`,
    status: 'Completed',
    amount: parseFloat(amount) || 1000,
    currency: currency ?? 'KES',
    sourceAccount: source_account_number ?? SANDBOX_ACCT_1,
    destinationAccount: destination_account_number ?? SANDBOX_ACCT_2,
    timestamp: new Date().toISOString(),
  });
});

router.post('/core-banking/transactions/deposit', (req: Request, res: Response) => {
  const { account_number, amount, currency, mobile_number, provider } =
    req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    core_banking: true,
    transactionId: uuidv4(),
    checkoutRequestId: `SAND-${uuidv4().split('-')[0].toUpperCase()}`,
    status: 'Pending',
    amount: parseFloat(amount) || 500,
    currency: currency ?? 'KES',
    accountNumber: account_number ?? SANDBOX_ACCT_1,
    mobileNumber: mobile_number ?? '+254700000001',
    provider: provider ?? 'MPESA',
    timestamp: new Date().toISOString(),
  });
});

// ── Loans ─────────────────────────────────────────────────────────────────────

router.post('/core-banking/loans/apply', (req: Request, res: Response) => {
  const { loan_type, requested_amount, currency, tenure_months } =
    req.body as Record<string, string>;
  const principal = parseFloat(requested_amount) || 50000;
  res.status(201).json({
    sandbox: true,
    core_banking: true,
    loanId: uuidv4(),
    loanNumber: `LN-SAND-${Math.floor(Math.random() * 90000) + 10000}`,
    status: 'Approved',
    requestedAmount: principal,
    approvedAmount: principal,
    currency: currency ?? 'KES',
    tenureMonths: parseInt(tenure_months) || 12,
    interestRate: 13.5,
    monthlyInstalment: parseFloat((principal / (parseInt(tenure_months) || 12) * 1.135).toFixed(2)),
    creditScore: 720,
    message: 'Loan application approved. Pending disbursement.',
    createdAt: new Date().toISOString(),
    loanType: loan_type ?? 'Personal',
  });
});

router.get('/core-banking/loans/:loanId', (req: Request, res: Response) => {
  res.json({
    sandbox: true,
    core_banking: true,
    loanId: req.params.loanId,
    loanNumber: `LN-SAND-12345`,
    accountNumber: SANDBOX_ACCT_1,
    loanType: 'Personal',
    status: 'Active',
    principalAmount: 50000.00,
    outstandingBalance: 42000.00,
    currency: 'KES',
    interestRate: 13.5,
    tenureMonths: 12,
    disbursedAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    nextPaymentDate: new Date(Date.now() + 86400000 * 10).toISOString(),
    nextPaymentAmount: 4729.17,
  });
});

router.post('/core-banking/loans/:loanId/repay', (req: Request, res: Response) => {
  const { amount, currency } = req.body as Record<string, string>;
  const paid = parseFloat(amount) || 4729.17;
  res.status(201).json({
    sandbox: true,
    core_banking: true,
    transactionId: uuidv4(),
    loanId: req.params.loanId,
    amountPaid: paid,
    principalPaid: parseFloat((paid * 0.85).toFixed(2)),
    interestPaid: parseFloat((paid * 0.15).toFixed(2)),
    outstandingBalance: parseFloat((42000 - paid * 0.85).toFixed(2)),
    currency: currency ?? 'KES',
    status: 'Completed',
    timestamp: new Date().toISOString(),
  });
});

// ── Cards ──────────────────────────────────────────────────────────────────────

router.post('/core-banking/cards/issue', (req: Request, res: Response) => {
  const { card_type, cardholder_name, currency } = req.body as Record<string, string>;
  const last4 = String(Math.floor(Math.random() * 9000) + 1000);
  res.status(201).json({
    sandbox: true,
    core_banking: true,
    cardId: uuidv4(),
    cardNumber: `****-****-****-${last4}`,
    cardType: card_type ?? 'Debit',
    accountNumber: SANDBOX_ACCT_1,
    cardholderName: cardholder_name ?? 'SANDBOX HOLDER',
    expiryDate: `${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear() + 3}`,
    status: 'Active',
    dailyWithdrawalLimit: 50000,
    currency: currency ?? 'KES',
    issuedAt: new Date().toISOString(),
  });
});

// ── Payments ──────────────────────────────────────────────────────────────────

router.post('/core-banking/payments/transfer', (req: Request, res: Response) => {
  const { amount, currency, payment_rail, beneficiary_account, beneficiary_bank } =
    req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    core_banking: true,
    paymentId: uuidv4(),
    reference: `PMT-SAND-${Date.now()}`,
    status: 'Accepted',
    amount: parseFloat(amount) || 1000,
    currency: currency ?? 'KES',
    paymentRail: payment_rail ?? 'RTGS',
    beneficiaryAccount: beneficiary_account ?? 'BENE-ACCT-SANDBOX',
    beneficiaryBank: beneficiary_bank ?? 'Sandbox Bank Kenya',
    timestamp: new Date().toISOString(),
    estimatedSettlement: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  });
});

router.post('/core-banking/payments/mpesa/stk-push', (req: Request, res: Response) => {
  const { phone_number, amount, reference } = req.body as Record<string, string>;
  res.status(201).json({
    sandbox: true,
    core_banking: true,
    checkoutRequestId: `ws_CO_${Date.now()}`,
    merchantRequestId: `SAND-${uuidv4().split('-')[0].toUpperCase()}`,
    responseCode: '0',
    responseDescription: 'Success. Request accepted for processing',
    customerMessage: `Please enter your M-Pesa PIN to complete payment of KES ${amount ?? '500'} to ${reference ?? 'WGI-SANDBOX'}.`,
    phoneNumber: phone_number ?? '+254700000001',
    timestamp: new Date().toISOString(),
  });
});

export default router;
