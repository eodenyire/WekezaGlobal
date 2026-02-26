import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as walletService from '../services/walletService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateWalletSchema = z.object({
  user_id:  z.string().uuid(),
  currency: z.enum(['USD','EUR','GBP','KES']),
});

const DepositSchema = z.object({
  amount:   z.number().positive(),
  metadata: z.record(z.unknown()).optional(),
});

const WithdrawSchema = z.object({
  amount:   z.number().positive(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── GET /v1/wallets/user/:user_id  (must come before /:wallet_id) ───────────

router.get('/user/:user_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallets = await walletService.getUserWallets(req.params.user_id);
    res.json({ wallets });
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/wallets ────────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = CreateWalletSchema.parse(req.body);
    // Only allow users to create wallets for themselves (unless admin)
    if (req.user?.role !== 'admin' && body.user_id !== req.user?.userId) {
      res.status(403).json({ error: 'Forbidden', message: 'Cannot create wallet for another user' });
      return;
    }
    const wallet = await walletService.createWallet(body.user_id, body.currency);
    res.status(201).json(wallet);
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/wallets/:wallet_id ──────────────────────────────────────────────

router.get('/:wallet_id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await walletService.getWallet(req.params.wallet_id);
    res.json(wallet);
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/wallets/:wallet_id/balance ─────────────────────────────────────

router.get('/:wallet_id/balance', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await walletService.getBalance(req.params.wallet_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/wallets/:wallet_id/deposit ────────────────────────────────────

router.post('/:wallet_id/deposit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = DepositSchema.parse(req.body);
    const result = await walletService.deposit(
      req.params.wallet_id,
      body.amount,
      body.metadata
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /v1/wallets/:wallet_id/withdraw ───────────────────────────────────

router.post('/:wallet_id/withdraw', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = WithdrawSchema.parse(req.body);
    const result = await walletService.withdraw(
      req.params.wallet_id,
      body.amount,
      body.metadata
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /v1/wallets/:wallet_id/transactions ─────────────────────────────────

router.get('/:wallet_id/transactions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const transactions = await walletService.getTransactions(
      req.params.wallet_id,
      limit,
      offset
    );
    res.json({ transactions, limit, offset });
  } catch (err) {
    next(err);
  }
});

export default router;
