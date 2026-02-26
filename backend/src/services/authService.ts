import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../database';
import { config } from '../config';
import { findUserByEmail } from '../models/user';
import { User, UserRole, JwtPayload, PublicUser } from '../models/types';
import { createError } from '../middleware/errorHandler';

const SALT_ROUNDS = config.bcryptSaltRounds;

export interface RegisterInput {
  full_name: string;
  email: string;
  phone_number?: string;
  password: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: PublicUser;
}

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
  });
}

export async function register(input: RegisterInput): Promise<AuthTokenResponse> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw createError('A user with that email already exists', 409);
  }

  const password_hash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const role: UserRole = input.role ?? 'user';

  const { rows } = await pool.query<User>(
    `INSERT INTO users (full_name, email, phone_number, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.full_name, input.email, input.phone_number ?? null, password_hash, role]
  );

  const user = rows[0];
  const payload: JwtPayload = { userId: user.user_id, email: user.email, role: user.role };
  const access_token = signToken(payload);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash: _ph, ...publicUser } = user;

  return {
    access_token,
    token_type: 'Bearer',
    expires_in: config.jwtExpiry,
    user: publicUser,
  };
}

export async function login(input: LoginInput): Promise<AuthTokenResponse> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw createError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw createError('Invalid email or password', 401);
  }

  const payload: JwtPayload = { userId: user.user_id, email: user.email, role: user.role };
  const access_token = signToken(payload);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash: _ph, ...publicUser } = user;

  return {
    access_token,
    token_type: 'Bearer',
    expires_in: config.jwtExpiry,
    user: publicUser,
  };
}

export interface OAuthTokenInput {
  client_id: string;
  client_secret: string;
  grant_type: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

export async function clientCredentialsToken(
  input: OAuthTokenInput
): Promise<OAuthTokenResponse> {
  if (
    input.grant_type !== 'client_credentials' ||
    input.client_id !== config.oauthClientId ||
    input.client_secret !== config.oauthClientSecret
  ) {
    throw createError('Invalid client credentials or grant type', 401);
  }

  const payload: JwtPayload = {
    userId: 'system',
    email: 'system@wgi.internal',
    role: 'partner',
  };
  const access_token = signToken(payload);

  return {
    access_token,
    token_type: 'Bearer',
    expires_in: config.jwtExpiry,
    scope: 'read write',
  };
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const { rows } = await pool.query<User>(
    'SELECT * FROM users WHERE user_id = $1',
    [userId]
  );
  const user = rows[0];
  if (!user) {
    throw createError('User not found', 404);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash: _ph, ...publicUser } = user;
  return publicUser;
}
