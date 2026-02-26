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
} as const;
