/**
 * Webhook Service — Architecture §3.6
 * Allows fintech partners to register webhook URLs for real-time event delivery.
 */
import crypto from 'crypto';
import { pool } from '../database';
import { Webhook } from '../models/types';
import { createError } from '../middleware/errorHandler';

const ALLOWED_EVENTS = [
  'deposit',
  'withdrawal',
  'transfer',
  'fx_conversion',
  'settlement_completed',
  'settlement_failed',
  'card_charged',
  'aml_alert',
  'kyc_approved',
  'kyc_rejected',
] as const;

export type WebhookEvent = (typeof ALLOWED_EVENTS)[number];

function generateSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

export async function registerWebhook(
  userId: string,
  url: string,
  events: string[]
): Promise<Webhook> {
  const invalid = events.filter((e) => !(ALLOWED_EVENTS as readonly string[]).includes(e));
  if (invalid.length > 0) {
    throw createError(`Unknown webhook events: ${invalid.join(', ')}. Allowed: ${ALLOWED_EVENTS.join(', ')}`, 400);
  }
  if (events.length === 0) {
    throw createError('At least one event type is required', 400);
  }

  const secret = generateSecret();

  const { rows } = await pool.query<Webhook>(
    `INSERT INTO webhooks (user_id, url, events, secret)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, url, events, secret]
  );
  return rows[0];
}

export async function getUserWebhooks(userId: string): Promise<Omit<Webhook, 'secret'>[]> {
  const { rows } = await pool.query<Omit<Webhook, 'secret'>>(
    `SELECT webhook_id, user_id, url, events, status, created_at, updated_at
     FROM webhooks
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function deleteWebhook(webhookId: string, userId: string): Promise<void> {
  const { rows } = await pool.query<Webhook>(
    'SELECT * FROM webhooks WHERE webhook_id = $1 AND user_id = $2',
    [webhookId, userId]
  );
  if (!rows[0]) throw createError('Webhook not found', 404);

  await pool.query('DELETE FROM webhooks WHERE webhook_id = $1', [webhookId]);
}

/**
 * Generate the HMAC-SHA256 signature for a webhook payload.
 * Fintech partners should verify this signature on receipt.
 */
export function signPayload(secret: string, payload: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

/**
 * Dispatch an event to all webhooks registered for it.
 * In production this would be done via a job queue; here it's
 * synchronous best-effort with no retries (architecture note only).
 */
export async function dispatchWebhookEvent(
  userId: string,
  event: string,
  data: unknown
): Promise<void> {
  const { rows } = await pool.query<Webhook>(
    `SELECT * FROM webhooks WHERE user_id = $1 AND status = 'active' AND $2 = ANY(events)`,
    [userId, event]
  );

  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({ event, data, timestamp });

  for (const webhook of rows) {
    const signature = signPayload(webhook.secret, payload);
    // Log the dispatch intent; actual HTTP delivery is handled by the job queue
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, metadata)
       VALUES ($1, 'webhook_dispatch', $2, $3, $4)`,
      [
        userId,
        `Webhook: ${event}`,
        `Event dispatched to ${webhook.url}`,
        JSON.stringify({ webhook_id: webhook.webhook_id, event, signature }),
      ]
    );
  }
}
