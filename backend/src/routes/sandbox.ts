/**
 * Sandbox API — Architecture §3.6
 * Provides a safe test environment for fintech partners to exercise all API
 * endpoints without affecting production data.  All responses are clearly
 * flagged with "sandbox: true" and use deterministic mock data.
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Sandbox constant for deterministic mock FX rates
const SANDBOX_USD_TO_KES_RATE = 134.5;

// Wise transfer status lifecycle
const WISE_STATUS_WAITING  = 'incoming_payment_waiting';
const WISE_STATUS_SENT     = 'outgoing_payment_sent';

// ── Health ────────────────────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  res.json({ sandbox: true, status: 'ok', environment: 'sandbox' });
});

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

export default router;
