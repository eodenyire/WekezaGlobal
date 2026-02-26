import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  full_name:    z.string().min(2),
  email:        z.string().email(),
  phone_number: z.string().optional(),
  password:     z.string().min(8),
  role:         z.enum(['user','admin','compliance','operations','partner']).optional(),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const TokenSchema = z.object({
  client_id:     z.string(),
  client_secret: z.string(),
  grant_type:    z.string(),
});

// ─── POST /auth/register ─────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterSchema.parse(req.body);
    const result = await authService.register(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/login ────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = LoginSchema.parse(req.body);
    const result = await authService.login(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/token (OAuth2 client credentials) ───────────────────────────

router.post('/token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = TokenSchema.parse(req.body);
    const result = await authService.clientCredentialsToken(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/me ────────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await authService.getProfile(req.user!.userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

export default router;
