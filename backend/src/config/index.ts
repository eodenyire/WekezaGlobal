import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://wgi_user:wgi_pass@localhost:5432/wgi_db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret:
    process.env.JWT_SECRET ||
    'your-super-secret-jwt-key-change-in-production',
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
} as const;
