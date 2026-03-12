/**
 * Developer Portal — The entry point for WekezaGlobal's developer ecosystem.
 *
 * Shows:
 *  - Quick stats (active API keys, webhooks, requests, events today)
 *  - Getting-started guide (4-step flow)
 *  - Available API domains
 *  - Developer tools (sandbox, analytics, partner APIs, docs links)
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface AnalyticsData {
  api_keys:  { total: number; active: number };
  requests:  { total_in_window: number; window: string };
  webhooks:  { total: number; active: number };
  events:    { total_dispatched: number; dispatched_today: number };
}

const API_DOMAINS = [
  { icon: '👤', label: 'Accounts API',         path: '/v1/core-banking/accounts',         desc: 'Open, manage, and query bank accounts' },
  { icon: '💸', label: 'Payments API',          path: '/v1/partner/payments',              desc: 'SWIFT, SEPA, ACH, M-Pesa, RTGS rails' },
  { icon: '💱', label: 'FX API',                path: '/v1/fx',                            desc: 'Multi-currency exchange at live rates' },
  { icon: '🏦', label: 'Settlements API',       path: '/v1/settlements',                   desc: 'Batch settlement to partner banks' },
  { icon: '💳', label: 'Cards API',             path: '/v1/cards',                         desc: 'Issue virtual and physical cards' },
  { icon: '📋', label: 'Identity API',          path: '/v1/partner/identity/verify',       desc: 'KYC identity verification service' },
  { icon: '🛡️', label: 'Risk API',              path: '/v1/partner/risk/assess',           desc: 'Real-time transaction risk scoring' },
  { icon: '💰', label: 'Lending API',           path: '/v1/core-banking/loans',            desc: 'Loan applications and repayments' },
];

const GETTING_STARTED = [
  {
    step: '1',
    title: 'Register an account',
    desc: 'Create your developer account and get your JWT token.',
    code: `POST /auth/register
{
  "full_name": "Jane Developer",
  "email": "jane@fintech.io",
  "password": "Secure@Pass123"
}`,
    link: '/register',
    linkLabel: 'Register now →',
  },
  {
    step: '2',
    title: 'Create an API key',
    desc: 'Generate an API key to authenticate machine-to-machine requests.',
    code: `POST /v1/api-keys
Authorization: Bearer <jwt>

{ "name": "My Production Key" }`,
    link: '/api-keys',
    linkLabel: 'Manage API Keys →',
  },
  {
    step: '3',
    title: 'Test in the sandbox',
    desc: 'Use the sandbox environment to safely test all API endpoints.',
    code: `GET /v1/sandbox/health
X-API-Key: wgi_<your_key>

# → { "sandbox": true, "status": "ok" }`,
    link: '/sandbox',
    linkLabel: 'Open Sandbox →',
  },
  {
    step: '4',
    title: 'Register a webhook',
    desc: 'Subscribe to banking events and receive real-time notifications.',
    code: `POST /v1/webhooks
Authorization: Bearer <jwt>

{
  "url": "https://yourapp.com/wgi-events",
  "events": ["deposit", "settlement_completed"]
}`,
    link: '/webhooks',
    linkLabel: 'Manage Webhooks →',
  },
];

const DeveloperPortal: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    apiClient
      .get<AnalyticsData>('/v1/developer/analytics')
      .then((r) => setAnalytics(r.data))
      .catch(() => setError('Could not load analytics.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>🚀 Developer Portal</h1>
          <p>Welcome{user ? `, ${user.full_name.split(' ')[0]}` : ''}! Build on WekezaGlobal's banking infrastructure.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/sandbox" className="btn btn-primary">🧪 Open Sandbox</Link>
          <Link to="/developer/analytics" className="btn btn-secondary">📊 Analytics</Link>
        </div>
      </div>

      {error && <div className="alert alert-warning">{error}</div>}

      {/* Quick Stats */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="stats-grid" style={{ marginBottom: '28px' }}>
          <div className="stat-card">
            <div className="stat-card-icon blue">🔑</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Active API Keys</div>
              <div className="stat-card-value">{analytics?.api_keys.active ?? 0}</div>
              <div className="stat-card-sub">{analytics?.api_keys.total ?? 0} total</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon green">📡</div>
            <div className="stat-card-body">
              <div className="stat-card-label">API Requests (1h)</div>
              <div className="stat-card-value">{analytics?.requests.total_in_window ?? 0}</div>
              <div className="stat-card-sub">{analytics?.requests.window}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon yellow">🔗</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Active Webhooks</div>
              <div className="stat-card-value">{analytics?.webhooks.active ?? 0}</div>
              <div className="stat-card-sub">{analytics?.webhooks.total ?? 0} registered</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon purple">⚡</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Events Today</div>
              <div className="stat-card-value">{analytics?.events.dispatched_today ?? 0}</div>
              <div className="stat-card-sub">{analytics?.events.total_dispatched ?? 0} total dispatched</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* Getting Started */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div className="card-title">📖 Getting Started</div>
            <div className="card-subtitle">Four steps to integrate WekezaGlobal APIs</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', padding: '0 4px 4px' }}>
            {GETTING_STARTED.map((gs) => (
              <div
                key={gs.step}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  background: 'var(--color-bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--color-primary)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '13px', flexShrink: 0,
                    }}
                  >
                    {gs.step}
                  </span>
                  <strong style={{ fontSize: '14px' }}>{gs.title}</strong>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '10px' }}>{gs.desc}</p>
                <pre
                  style={{
                    background: '#1a2744', color: '#a8d4f0', borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px', fontSize: '11px', overflowX: 'auto',
                    lineHeight: 1.6, marginBottom: '10px',
                  }}
                >
                  {gs.code}
                </pre>
                <Link to={gs.link} style={{ fontSize: '12px', fontWeight: 600 }}>{gs.linkLabel}</Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* API Domains */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🌐 API Domains</div>
            <div className="card-subtitle">Available banking capabilities</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {API_DOMAINS.map((api) => (
              <div
                key={api.label}
                className="info-row"
                style={{ padding: '10px 4px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>{api.icon}</span>
                  <span>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{api.label}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{api.desc}</div>
                  </span>
                </span>
                <code style={{ fontSize: '11px', color: 'var(--color-primary)' }}>{api.path}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Developer Tools */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🛠 Developer Tools</div>
            <div className="card-subtitle">Everything you need to build</div>
          </div>
          <div className="quick-links" style={{ flexDirection: 'column', gap: '8px' }}>
            <Link to="/api-keys" className="quick-link">
              <span className="quick-link-icon">🔑</span>
              <span>
                <div style={{ fontWeight: 600 }}>API Keys</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Create and manage access tokens</div>
              </span>
            </Link>
            <Link to="/sandbox" className="quick-link">
              <span className="quick-link-icon">🧪</span>
              <span>
                <div style={{ fontWeight: 600 }}>Sandbox Testing</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Test API calls with mock data</div>
              </span>
            </Link>
            <Link to="/webhooks" className="quick-link">
              <span className="quick-link-icon">🔗</span>
              <span>
                <div style={{ fontWeight: 600 }}>Webhooks</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Subscribe to banking events</div>
              </span>
            </Link>
            <Link to="/developer/analytics" className="quick-link">
              <span className="quick-link-icon">📊</span>
              <span>
                <div style={{ fontWeight: 600 }}>Analytics</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Monitor API usage and errors</div>
              </span>
            </Link>
            <Link to="/developer/changelog" className="quick-link">
              <span className="quick-link-icon">📝</span>
              <span>
                <div style={{ fontWeight: 600 }}>Changelog</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>API release history</div>
              </span>
            </Link>
            <Link to="/subscriptions" className="quick-link">
              <span className="quick-link-icon">💎</span>
              <span>
                <div style={{ fontWeight: 600 }}>Subscription Plans</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Upgrade for higher rate limits</div>
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Auth Reference */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🔐 Authentication Reference</div>
          <div className="card-subtitle">Three ways to authenticate with WGI APIs</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', padding: '4px' }}>
          {[
            {
              title: 'JWT Bearer Token',
              icon: '🎟️',
              color: '#eff6ff',
              code: 'Authorization: Bearer <jwt>',
              desc: 'For user-facing requests. Issued on login/register. Expires in 1 hour.',
            },
            {
              title: 'API Key',
              icon: '🔑',
              color: '#f0fdf4',
              code: 'X-API-Key: wgi_<hex>',
              desc: 'For machine-to-machine integrations. Create via the API Keys page.',
            },
            {
              title: 'OAuth2 Client Credentials',
              icon: '🤝',
              color: '#fefce8',
              code: `POST /auth/token
{ "grant_type": "client_credentials",
  "client_id": "wgi-client",
  "client_secret": "..." }`,
              desc: 'For server-to-server partner integrations. Returns a short-lived access token.',
            },
          ].map((auth) => (
            <div
              key={auth.title}
              style={{
                background: auth.color,
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{auth.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '13px' }}>{auth.title}</div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>{auth.desc}</p>
              <pre
                style={{
                  background: '#1a2744', color: '#a8d4f0',
                  borderRadius: 'var(--radius-sm)', padding: '8px 10px',
                  fontSize: '11px', overflowX: 'auto', lineHeight: 1.5,
                }}
              >
                {auth.code}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default DeveloperPortal;
