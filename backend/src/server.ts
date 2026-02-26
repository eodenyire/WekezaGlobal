import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import { connectDB, connectRedis } from './database';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { metricsMiddleware, metricsHandler } from './metrics';

// ─── Route imports ───────────────────────────────────────────────────────────
import authRoutes       from './routes/auth';
import walletRoutes, { transactionsRouter } from './routes/wallets';
import fxRoutes         from './routes/fx';
import settlementRoutes from './routes/settlements';
import bankRoutes       from './routes/banks';
import cardRoutes       from './routes/cards';
import kycRoutes, { amlRouter, kycReportsRouter } from './routes/kyc';
import creditRoutes     from './routes/credit';
import adminRoutes      from './routes/admin';
import notificationRoutes from './routes/notifications';
import apiKeyRoutes     from './routes/apiKeys';
import webhookRoutes    from './routes/webhooks';
import sandboxRoutes    from './routes/sandbox';

const app = express();

// ─── Security & parsing middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Prometheus metrics middleware ───────────────────────────────────────────
app.use(metricsMiddleware);

// ─── Rate limiting (Redis-backed, fails open) ────────────────────────────────
app.use(rateLimiter);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'wgi-backend', timestamp: new Date().toISOString() });
});

// ─── Prometheus metrics ───────────────────────────────────────────────────────
app.get('/metrics', metricsHandler);

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/auth',           authRoutes);
app.use('/v1/wallets',     walletRoutes);
app.use('/v1/transactions', transactionsRouter);
app.use('/v1/fx',          fxRoutes);
app.use('/v1/settlements', settlementRoutes);
app.use('/v1/banks',       bankRoutes);
app.use('/v1/cards',       cardRoutes);
app.use('/v1/kyc',         kycRoutes);
app.use('/v1/kyc/reports', kycReportsRouter);
app.use('/v1/aml',         amlRouter);
app.use('/v1/credit',         creditRoutes);
app.use('/v1/admin',          adminRoutes);
app.use('/v1/notifications',  notificationRoutes);
app.use('/v1/api-keys',       apiKeyRoutes);
app.use('/v1/webhooks',       webhookRoutes);
app.use('/v1/sandbox',        sandboxRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'NotFound', message: 'The requested resource does not exist' });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  await connectDB();
  await connectRedis();

  app.listen(config.port, () => {
    console.log(
      `[WGI] Server running on port ${config.port} (${config.nodeEnv})`
    );
  });
}

bootstrap().catch((err) => {
  console.error('[WGI] Fatal startup error:', err);
  process.exit(1);
});

export default app;
