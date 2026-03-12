/**
 * Sandbox Testing — Interactive API Playground
 *
 * Allows developers to call sandbox endpoints interactively:
 *  - Select an endpoint from a categorised dropdown
 *  - Edit the JSON request body
 *  - Execute the call (using the developer's API key or JWT)
 *  - Inspect the formatted JSON response
 */
import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

interface ApiKey {
  api_key_id: string;
  name: string | null;
  api_key: string;
  status: string;
}

interface SandboxEndpoint {
  label:   string;
  method:  'GET' | 'POST';
  path:    string;
  auth:    'api_key' | 'jwt';
  body?:   string;
}

const ENDPOINTS: SandboxEndpoint[] = [
  {
    label:  'Health Check (no auth)',
    method: 'GET',
    path:   '/v1/sandbox/health',
    auth:   'api_key',
  },
  {
    label:  'Wallet — Deposit',
    method: 'POST',
    path:   '/v1/sandbox/wallet/deposit',
    auth:   'api_key',
    body:   JSON.stringify({ wallet_id: 'wlt-sandbox-001', amount: 1000, currency: 'USD' }, null, 2),
  },
  {
    label:  'Wallet — Withdraw',
    method: 'POST',
    path:   '/v1/sandbox/wallet/withdraw',
    auth:   'api_key',
    body:   JSON.stringify({ wallet_id: 'wlt-sandbox-001', amount: 200, currency: 'USD' }, null, 2),
  },
  {
    label:  'FX — Convert',
    method: 'POST',
    path:   '/v1/sandbox/fx/convert',
    auth:   'api_key',
    body:   JSON.stringify({ amount: 500, currency_from: 'USD', currency_to: 'KES' }, null, 2),
  },
  {
    label:  'Card — Create',
    method: 'POST',
    path:   '/v1/sandbox/card/create',
    auth:   'api_key',
    body:   JSON.stringify({ type: 'virtual' }, null, 2),
  },
  {
    label:  'Settlement — Initiate',
    method: 'POST',
    path:   '/v1/sandbox/settlements',
    auth:   'api_key',
    body:   JSON.stringify({ amount: 2500, currency: 'KES' }, null, 2),
  },
  {
    label:  'Transaction History',
    method: 'GET',
    path:   '/v1/sandbox/transactions/history',
    auth:   'api_key',
  },
  {
    label:  'PayPal — Payout (adapter)',
    method: 'POST',
    path:   '/v1/sandbox/integrations/paypal/payout',
    auth:   'api_key',
    body:   JSON.stringify({ amount: 100, currency: 'USD', recipient_email: 'test@example.com' }, null, 2),
  },
  {
    label:  'Stripe — Transfer (adapter)',
    method: 'POST',
    path:   '/v1/sandbox/integrations/stripe/transfer',
    auth:   'api_key',
    body:   JSON.stringify({ amount: 250, currency: 'USD', destination: 'acct_test' }, null, 2),
  },
  {
    label:  'Partner — Risk Assessment',
    method: 'POST',
    path:   '/v1/partner/risk/assess',
    auth:   'jwt',
    body:   JSON.stringify({ account_id: 'ACC-001', amount: 5000, currency: 'USD', transaction_type: 'transfer' }, null, 2),
  },
  {
    label:  'Partner — Identity Verify',
    method: 'POST',
    path:   '/v1/partner/identity/verify',
    auth:   'jwt',
    body:   JSON.stringify({ full_name: 'Jane Doe', identification_number: 'KE12345678', id_type: 'national_id' }, null, 2),
  },
  {
    label:  'Developer Analytics',
    method: 'GET',
    path:   '/v1/developer/analytics',
    auth:   'jwt',
  },
  {
    label:  'Developer Event Stream',
    method: 'GET',
    path:   '/v1/developer/events?limit=10',
    auth:   'jwt',
  },
  {
    label:  'API Changelog',
    method: 'GET',
    path:   '/v1/developer/changelog',
    auth:   'jwt',
  },
];

const SandboxTesting: React.FC = () => {
  const [apiKeys, setApiKeys]             = useState<ApiKey[]>([]);
  const [selectedKey, setSelectedKey]     = useState<string>('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<SandboxEndpoint>(ENDPOINTS[0]);
  const [body, setBody]                   = useState<string>('');
  const [response, setResponse]           = useState<unknown>(null);
  const [status, setStatus]               = useState<number | null>(null);
  const [loading, setLoading]             = useState(false);
  const [keysLoading, setKeysLoading]     = useState(true);
  const [error, setError]                 = useState('');
  const [latencyMs, setLatencyMs]         = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get<{ api_keys: ApiKey[] }>('/v1/api-keys')
      .then((r) => {
        const active = (r.data.api_keys ?? []).filter((k) => k.status === 'active');
        setApiKeys(active);
        if (active.length > 0) setSelectedKey(active[0].api_key);
      })
      .catch(() => setError('Could not load API keys. Create one first.'))
      .finally(() => setKeysLoading(false));
  }, []);

  const handleEndpointChange = (label: string) => {
    const ep = ENDPOINTS.find((e) => e.label === label);
    if (ep) {
      setSelectedEndpoint(ep);
      setBody(ep.body ?? '');
      setResponse(null);
      setStatus(null);
      setLatencyMs(null);
    }
  };

  const execute = async () => {
    setLoading(true);
    setError('');
    setResponse(null);
    setStatus(null);
    setLatencyMs(null);

    const t0 = Date.now();

    try {
      let parsedBody: unknown = undefined;
      if (body.trim()) {
        try {
          parsedBody = JSON.parse(body);
        } catch {
          setError('Request body is not valid JSON.');
          setLoading(false);
          return;
        }
      }

      // Build headers
      const headers: Record<string, string> = {};
      if (selectedEndpoint.auth === 'api_key' && selectedKey) {
        headers['X-API-Key'] = selectedKey;
      }
      // JWT is automatically added by the apiClient interceptor

      let res;
      if (selectedEndpoint.method === 'GET') {
        res = await apiClient.get(selectedEndpoint.path, { headers });
      } else {
        res = await apiClient.post(selectedEndpoint.path, parsedBody, { headers });
      }
      setStatus(res.status);
      setResponse(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: unknown } };
      setStatus(axiosErr?.response?.status ?? 0);
      setResponse(axiosErr?.response?.data ?? { error: String(err) });
    } finally {
      setLatencyMs(Date.now() - t0);
      setLoading(false);
    }
  };

  const statusColor = (s: number | null) => {
    if (!s) return 'var(--color-text-muted)';
    if (s >= 200 && s < 300) return 'var(--color-success)';
    if (s >= 400) return 'var(--color-danger)';
    return 'var(--color-warning)';
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>🧪 Sandbox Testing</h1>
          <p>Interactively test WekezaGlobal API endpoints with mock data. No real funds are used.</p>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: '20px' }}>
        <strong>Sandbox Mode:</strong> All responses include <code>{"sandbox: true"}</code> and use deterministic mock data. Safe to test freely.
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px', alignItems: 'flex-start' }}>
        {/* Left panel — controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Endpoint selector */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Endpoint</div>
            </div>
            <div className="form-group">
              <label className="form-label">Select API endpoint</label>
              <select
                className="form-control"
                value={selectedEndpoint.label}
                onChange={(e) => handleEndpointChange(e.target.value)}
              >
                {ENDPOINTS.map((ep) => (
                  <option key={ep.label} value={ep.label}>{ep.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <span
                className={`badge ${selectedEndpoint.method === 'GET' ? 'badge-info' : 'badge-success'}`}
                style={{ fontFamily: 'monospace', fontSize: '11px' }}
              >
                {selectedEndpoint.method}
              </span>
              <code style={{ fontSize: '12px', color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                {selectedEndpoint.path}
              </code>
            </div>
            <div style={{ marginTop: '8px' }}>
              <span className="badge badge-default" style={{ fontSize: '11px' }}>
                Auth: {selectedEndpoint.auth === 'api_key' ? '🔑 X-API-Key' : '🎟️ JWT Bearer'}
              </span>
            </div>
          </div>

          {/* API Key selector */}
          {selectedEndpoint.auth === 'api_key' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">API Key</div>
              </div>
              {keysLoading ? (
                <LoadingSpinner />
              ) : apiKeys.length === 0 ? (
                <div className="alert alert-warning" style={{ fontSize: '12px' }}>
                  No active API keys. <a href="/api-keys">Create one →</a>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Select key</label>
                  <select
                    className="form-control"
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                  >
                    {apiKeys.map((k) => (
                      <option key={k.api_key_id} value={k.api_key}>
                        {k.name ?? k.api_key_id} — {k.api_key}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Request body */}
          {selectedEndpoint.method === 'POST' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Request Body (JSON)</div>
              </div>
              <textarea
                className="form-control"
                style={{ fontFamily: 'monospace', fontSize: '12px', minHeight: '180px', resize: 'vertical' }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}

          {/* Execute button */}
          <button
            className="btn btn-primary"
            onClick={execute}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? <LoadingSpinner size="sm" /> : `▶ Execute ${selectedEndpoint.method}`}
          </button>
        </div>

        {/* Right panel — response */}
        <div className="card" style={{ minHeight: '400px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">Response</div>
            {status !== null && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: statusColor(status), fontSize: '14px' }}>
                  HTTP {status}
                </span>
                {latencyMs !== null && (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {latencyMs} ms
                  </span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <LoadingSpinner />
            </div>
          ) : response !== null ? (
            <pre
              style={{
                background: '#1a2744', color: '#a8d4f0',
                borderRadius: 'var(--radius-sm)', padding: '16px',
                fontSize: '12px', overflowX: 'auto', lineHeight: 1.6,
                margin: '0', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(response, null, 2)}
            </pre>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🧪</div>
              <p>Select an endpoint and click <strong>Execute</strong> to see the response.</p>
              <p style={{ fontSize: '12px', marginTop: '8px' }}>All responses come from the sandbox — no real transactions are created.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SandboxTesting;
