import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://wgi_user:wgi_pass@localhost:5432/wgi_db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable must be set in production');
    }
    return secret || 'dev-only-jwt-secret-do-not-use-in-production';
  })(),
  jwtExpiry: parseInt(process.env.JWT_EXPIRY || '3600', 10),
  oauthClientId: process.env.OAUTH_CLIENT_ID || 'wgi-client',
  oauthClientSecret: process.env.OAUTH_CLIENT_SECRET || 'wgi-client-secret',

  // Auth
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

  // FX
  fxFeeRate: parseFloat(process.env.FX_FEE_RATE || '0.005'), // 0.5%

  // Settlements
  settlementCompletionMs: parseInt(
    process.env.SETTLEMENT_COMPLETION_MS || String(2 * 60 * 1000),
    10
  ),
  settlementWebhookSecret: (() => {
    const secret = process.env.SETTLEMENT_WEBHOOK_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('SETTLEMENT_WEBHOOK_SECRET environment variable must be set in production');
    }
    return secret || 'dev-only-settlement-webhook-secret';
  })(),

  // Cards
  defaultCardSpendingLimit: parseFloat(
    process.env.DEFAULT_CARD_SPENDING_LIMIT || '5000'
  ),

  // Rate limiting
  rateLimitWindowSeconds: parseInt(
    process.env.RATE_LIMIT_WINDOW_SECONDS || String(15 * 60),
    10
  ),
  rateLimitMaxRequests: parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || '100',
    10
  ),

  // ── Wekeza v1-Core banking system integration ─────────────────────────────
  // WekezaGlobal acts as an API gateway that proxies authorized external-developer
  // requests to the Wekeza v1-Core .NET banking system.
  //
  // WEKEZA_CORE_URL          Base URL of the v1-Core API (e.g. http://core:5001)
  // WEKEZA_CORE_ENABLED      Set to 'false' to disable the proxy (sandbox-only mode)
  // WEKEZA_CORE_SERVICE_USER / _PASS  Service-account credentials WGI uses to obtain
  //                          a v1-Core JWT on behalf of every gateway request.
  // WEKEZA_CORE_TOKEN_TTL    How many seconds before WGI refreshes its service token.
  coreBankingUrl: process.env.WEKEZA_CORE_URL || 'http://localhost:5001',
  coreBankingEnabled: process.env.WEKEZA_CORE_ENABLED !== 'false',
  coreBankingServiceUser: process.env.WEKEZA_CORE_SERVICE_USER || 'wgi-gateway',
  coreBankingServicePass: (() => {
    const p = process.env.WEKEZA_CORE_SERVICE_PASS;
    if (!p && process.env.NODE_ENV === 'production') {
      throw new Error(
        'WEKEZA_CORE_SERVICE_PASS must be set in production (service account for v1-Core)'
      );
    }
    return p || 'dev-only-gateway-pass';
  })(),
  coreBankingTokenTtlSec: parseInt(
    process.env.WEKEZA_CORE_TOKEN_TTL || '3000', // refresh 10 min before JWT expires (1h default)
    10
  ),
  // Request timeout for v1-Core HTTP calls (ms)
  coreBankingTimeoutMs: parseInt(
    process.env.WEKEZA_CORE_TIMEOUT_MS || '10000',
    10
  ),
} as const;
