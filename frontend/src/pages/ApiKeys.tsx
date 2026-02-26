import React, { useEffect, useState, FormEvent } from 'react';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

interface ApiKey {
  api_key_id: string;
  user_id: string;
  name: string | null;
  api_key: string;
  status: string;
  created_at: string;
}

interface NewKeyResult extends ApiKey {
  raw_key: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ApiKeys: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await apiClient.get<{ api_keys: ApiKey[] }>('/v1/api-keys');
      setKeys(res.data.api_keys ?? []);
    } catch {
      setError('Failed to load API keys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    setNewKey(null);
    if (!keyName.trim()) { setCreateMsg({ type: 'error', text: 'Enter a key name.' }); return; }
    setCreating(true);
    try {
      const res = await apiClient.post<NewKeyResult>('/v1/api-keys', { name: keyName.trim() });
      setNewKey(res.data);
      setKeyName('');
      setCreateMsg({ type: 'success', text: 'API key created! Copy it now — it will not be shown again.' });
      await fetchKeys();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create key.';
      setCreateMsg({ type: 'error', text: msg });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;
    setRevoking(keyId);
    try {
      await apiClient.delete(`/v1/api-keys/${keyId}`);
      await fetchKeys();
    } catch {
      alert('Failed to revoke key.');
    } finally {
      setRevoking(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>API Keys</h1>
          <p>Manage programmatic access keys for fintech integrations</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Create new key */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">Create New API Key</div>
        </div>

        {createMsg && (
          <div className={`alert alert-${createMsg.type === 'success' ? 'success' : 'danger'}`}>
            {createMsg.text}
          </div>
        )}

        {newKey && (
          <div className="alert alert-warning" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            <strong>🔑 Your new API key (copy now):</strong><br />
            <code style={{ fontSize: '13px' }}>{newKey.raw_key}</code>
          </div>
        )}

        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Key Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. My App Integration"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              maxLength={100}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={creating} style={{ flexShrink: 0 }}>
            {creating ? <LoadingSpinner size="sm" /> : '+ Create Key'}
          </button>
        </form>
      </div>

      {/* Keys list */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Your API Keys</div>
            <div className="card-subtitle">{keys.filter((k) => k.status === 'active').length} active key(s)</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Key (masked)</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No API keys yet. Create one above to enable programmatic access.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.api_key_id}>
                    <td style={{ fontWeight: 600 }}>{k.name ?? '—'}</td>
                    <td>
                      <code style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {k.api_key}
                      </code>
                    </td>
                    <td>
                      <span className={k.status === 'active' ? 'badge badge-success' : 'badge badge-danger'}>
                        {k.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                      {formatDate(k.created_at)}
                    </td>
                    <td>
                      {k.status === 'active' && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRevoke(k.api_key_id)}
                          disabled={revoking === k.api_key_id}
                        >
                          {revoking === k.api_key_id ? <LoadingSpinner size="sm" /> : '🗑 Revoke'}
                        </button>
                      )}
                      {k.status !== 'active' && (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Revoked</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header">
          <div className="card-title">📋 API Usage Guide</div>
        </div>
        <div className="alert alert-info">
          Include your API key as a Bearer token in the <code>Authorization</code> header of every request.
        </div>
        <div style={{ fontFamily: 'monospace', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '13px', overflowX: 'auto' }}>
          <div>curl -X GET https://api.wekeza.com/v1/wallets \</div>
          <div style={{ paddingLeft: '16px' }}>-H &quot;Authorization: Bearer wgi_your_api_key_here&quot;</div>
        </div>
      </div>
    </>
  );
};

export default ApiKeys;
