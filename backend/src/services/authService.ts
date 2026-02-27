import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../database';
import { config } from '../config';
import { findUserByEmail } from '../models/user';
import { User, UserRole, AccountType, JwtPayload, PublicUser } from '../models/types';
import { createError } from '../middleware/errorHandler';

const SALT_ROUNDS = config.bcryptSaltRounds;

export interface RegisterInput {
  full_name: string;
  email: string;
  phone_number?: string;
  password: string;
  role?: UserRole;
  account_type?: AccountType;
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
  const account_type: AccountType = input.account_type ?? 'individual';

  const { rows } = await pool.query<User>(
    `INSERT INTO users (full_name, email, phone_number, password_hash, role, account_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.full_name, input.email, input.phone_number ?? null, password_hash, role, account_type]
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

export interface UpdateProfileInput {
  full_name?: string;
  phone_number?: string;
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<PublicUser> {
  if (!input.full_name && !input.phone_number) {
    throw createError('At least one field (full_name, phone_number) is required', 400);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.full_name !== undefined) {
    fields.push(`full_name = $${idx++}`);
    values.push(input.full_name);
  }
  if (input.phone_number !== undefined) {
    fields.push(`phone_number = $${idx++}`);
    values.push(input.phone_number);
  }
  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const { rows } = await pool.query<User>(
    `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`,
    values
  );
  if (!rows[0]) throw createError('User not found', 404);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash: _ph, ...publicUser } = rows[0];
  return publicUser;
}
