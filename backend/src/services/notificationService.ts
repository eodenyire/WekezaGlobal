import { pool } from '../database';
import { createError } from '../middleware/errorHandler';

export interface Notification {
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export async function getUserNotifications(
  userId: string,
  limit = 50,
  offset = 0,
  unreadOnly = false
): Promise<{ notifications: Notification[]; unread_count: number }> {
  const where = unreadOnly ? 'WHERE user_id = $1 AND is_read = FALSE' : 'WHERE user_id = $1';

  const { rows } = await pool.query<Notification>(
    `SELECT * FROM notifications ${where}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );

  return {
    notifications: rows,
    unread_count: parseInt(countRows[0]?.count ?? '0', 10),
  };
}

export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<Notification> {
  const { rows } = await pool.query<Notification>(
    `UPDATE notifications SET is_read = TRUE
     WHERE notification_id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );
  if (!rows[0]) throw createError('Notification not found', 404);
  return rows[0];
}

export async function markAllAsRead(userId: string): Promise<{ updated: number }> {
  const { rowCount } = await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
  return { updated: rowCount ?? 0 };
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<Notification> {
  const { rows } = await pool.query<Notification>(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, message, JSON.stringify(metadata)]
  );
  return rows[0];
}
