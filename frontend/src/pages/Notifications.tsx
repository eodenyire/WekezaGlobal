import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

interface Notification {
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  deposit:    '💰',
  withdrawal: '↑',
  transfer:   '⇄',
  fx:         '💱',
  kyc:        '📋',
  settlement: '🏦',
  card:       '💳',
  aml:        '🚨',
  system:     'ℹ️',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get<{ notifications: Notification[]; unread_count: number }>(
        '/v1/notifications?limit=50'
      );
      setNotifications(res.data.notifications ?? []);
      setUnreadCount(res.data.unread_count ?? 0);
    } catch {
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await apiClient.put(`/v1/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => n.notification_id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiClient.put('/v1/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      alert('Failed to mark all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>{unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'All caught up!'}</p>
        </div>
        {unreadCount > 0 && (
          <button
            className="btn btn-secondary"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? <LoadingSpinner size="sm" /> : '✓ Mark all read'}
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
            <h3 style={{ marginBottom: '8px' }}>No notifications yet</h3>
            <p>Activity from your account will appear here.</p>
          </div>
        ) : (
          <div>
            {notifications.map((n) => (
              <div
                key={n.notification_id}
                style={{
                  display: 'flex',
                  gap: '14px',
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--color-border)',
                  background: n.is_read ? 'transparent' : 'var(--color-primary-light, rgba(99,102,241,0.05))',
                  cursor: n.is_read ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
                onClick={() => !n.is_read && handleMarkRead(n.notification_id)}
              >
                <div style={{
                  width: '36px', height: '36px', flexShrink: 0,
                  background: 'var(--color-bg-alt, #f1f5f9)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px',
                }}>
                  {TYPE_ICONS[n.type] ?? '🔔'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontWeight: n.is_read ? 400 : 700, fontSize: '14px' }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                      {formatDate(n.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {n.message}
                  </div>
                </div>
                {!n.is_read && (
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: 'var(--color-primary)',
                    flexShrink: 0, marginTop: '6px',
                  }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Notifications;
