/**
 * Webhooks Management Page — SDS §2.6 API Gateway & Integration
 * Allows fintech partners to register, view, and delete webhook endpoints.
 */
import React, { useEffect, useState, FormEvent } from 'react';
import apiClient from '../api/client';
import { Webhook, WebhookCreationResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const AVAILABLE_EVENTS: { value: string; label: string; desc: string }[] = [
  { value: 'deposit',              label: '💰 Deposit',             desc: 'Wallet funded' },
  { value: 'withdrawal',           label: '💸 Withdrawal',          desc: 'Wallet withdrawal' },
  { value: 'transfer',             label: '↔️ Transfer',            desc: 'Wallet-to-wallet transfer' },
  { value: 'fx_conversion',        label: '💱 FX Conversion',       desc: 'Currency converted' },
  { value: 'settlement_completed', label: '✅ Settlement Completed', desc: 'Settlement succeeded' },
  { value: 'settlement_failed',    label: '❌ Settlement Failed',    desc: 'Settlement failed' },
  { value: 'card_charged',         label: '💳 Card Charged',        desc: 'Card transaction' },
  { value: 'aml_alert',            label: '🚨 AML Alert',           desc: 'AML flag raised' },
  { value: 'kyc_approved',         label: '✔️ KYC Approved',        desc: 'KYC verified' },
  { value: 'kyc_rejected',         label: '✖️ KYC Rejected',        desc: 'KYC rejected' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const Webhooks: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Create form
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    try {
      const res = await apiClient.get<{ webhooks: Webhook[] }>('/v1/webhooks');
      setWebhooks(res.data.webhooks ?? []);
    } catch {
      setError('Failed to load webhooks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWebhooks(); }, []);

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    setNewWebhookSecret(null);

    if (!url.trim()) {
      setCreateMsg({ type: 'error', text: 'A valid URL is required.' });
      return;
    }
    if (selectedEvents.length === 0) {
      setCreateMsg({ type: 'error', text: 'Select at least one event.' });
      return;
    }

    setCreating(true);
    try {
      const res = await apiClient.post<WebhookCreationResponse>('/v1/webhooks', {
        url,
        events: selectedEvents,
      });
      // Store the secret to show once — it won't be returned again
      if (res.data.secret) setNewWebhookSecret(res.data.secret);
      setCreateMsg({ type: 'success', text: 'Webhook registered! Copy the signing secret below — it is shown only once.' });
      setUrl('');
      setSelectedEvents([]);
      setShowForm(false);
      fetchWebhooks();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to register webhook.';
      setCreateMsg({ type: 'error', text: msg });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!window.confirm('Are you sure you want to delete this webhook?')) return;
    setDeletingId(webhookId);
    try {
      await apiClient.delete(`/v1/webhooks/${webhookId}`);
      setWebhooks((prev) => prev.filter((w) => w.webhook_id !== webhookId));
    } catch {
      alert('Failed to delete webhook. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Webhooks</h1>
          <p>Register endpoints to receive real-time event notifications (SDS §2.6)</p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setCreateMsg(null); setNewWebhookSecret(null); }}>
            + Register Webhook
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* One-time secret display */}
      {newWebhookSecret && (
        <div className="alert alert-success" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
          <strong>🔐 Signing Secret (shown once — copy now):</strong>
          <br />
          <code style={{ fontSize: '13px', display: 'block', marginTop: '6px', padding: '8px', background: 'rgba(0,0,0,.06)', borderRadius: '4px' }}>
            {newWebhookSecret}
          </code>
          <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}>
            Use this secret to verify the HMAC-SHA256 <code>X-WGI-Signature</code> header on incoming requests.
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">Register New Webhook</div>
            <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '13px' }} onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>

          {createMsg && (
            <div className={`alert alert-${createMsg.type === 'success' ? 'success' : 'danger'}`}>
              {createMsg.text}
            </div>
          )}

          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Endpoint URL *</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://your-service.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Must be HTTPS. We'll POST a JSON payload with an <code>X-WGI-Signature</code> header.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Events to Subscribe *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px', marginTop: '6px' }}>
                {AVAILABLE_EVENTS.map((ev) => (
                  <label
                    key={ev.value}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                      borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                      border: `1.5px solid ${selectedEvents.includes(ev.value) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: selectedEvents.includes(ev.value) ? 'rgba(99,102,241,.07)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{ev.label}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{ev.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating}
            >
              {creating ? <LoadingSpinner size="sm" /> : '🔗 Register Webhook'}
            </button>
          </form>
        </div>
      )}

      {/* Webhook list */}
      {webhooks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
          <h3>No Webhooks Registered</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>
            Register a webhook endpoint to receive real-time event notifications.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Register Webhook
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Registered Webhooks</div>
              <div className="card-subtitle">{webhooks.length} endpoint{webhooks.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Endpoint URL</th>
                  <th>Events</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.webhook_id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {wh.url}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '280px' }}>
                        {wh.events.map((ev) => (
                          <span key={ev} className="badge badge-info" style={{ fontSize: '10px' }}>
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${wh.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {wh.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                      {formatDate(wh.created_at)}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        disabled={deletingId === wh.webhook_id}
                        onClick={() => handleDelete(wh.webhook_id)}
                      >
                        {deletingId === wh.webhook_id ? '...' : '🗑 Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Integration guide */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-title" style={{ marginBottom: '12px' }}>📖 Integration Guide</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>1. Register an endpoint</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Use the form above to add your HTTPS URL and choose which events to subscribe to.
            </div>
          </div>
          <div style={{ padding: '16px', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>2. Verify signatures</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Each request includes <code>X-WGI-Signature: sha256=&lt;hmac&gt;</code>. Verify it with your signing secret using HMAC-SHA256.
            </div>
          </div>
          <div style={{ padding: '16px', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>3. Respond with 2xx</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Your endpoint must respond with HTTP 2xx within 5 seconds. If delivery fails, WGI retries up to 3 times with exponential backoff (10s, 30s, 90s). Permanent failures are logged in your notifications feed.
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Webhooks;
