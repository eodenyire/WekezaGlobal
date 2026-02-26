/**
 * Sandbox API — Architecture §3.6
 * Provides a safe test environment for fintech partners to exercise all API
 * endpoints without affecting production data.  All responses are clearly
 * flagged with "sandbox: true" and use deterministic mock data.
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

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
    amount_to:      amt * 134.5,
    currency_from:  currency_from ?? 'USD',
    currency_to:    currency_to   ?? 'KES',
    fx_rate:        134.5,
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

export default router;
