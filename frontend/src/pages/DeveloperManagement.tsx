/**
 * Developer Management — Admin-only page for onboarding and managing developers.
 *
 * Features:
 *  - Searchable list of all developers with profile, API key count, KYC status
 *  - Bulk-create up to 100 developers (CSV-style entry or form)
 *  - Per-developer profile view with API keys
 *  - Create/revoke API keys for any developer
 *  - Update developer profile (name, phone, account type, KYC status)
 */
import React, { useEffect, useState, FormEvent } from 'react';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

// ── Types ────────────────────────────────────────────────────────────────────

interface Developer {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: string;
  account_type: string;
  kyc_status: string;
  created_at: string;
  updated_at: string;
  api_key_count: number;
  active_key_count: number;
}

interface ApiKey {
  api_key_id: string;
  name: string | null;
  status: string;
  created_at: string;
  api_key: string;
}

interface DeveloperDetail {
  developer: Developer;
  api_keys: ApiKey[];
  wallets: { currency: string; balance: string }[];
}

interface BulkRow {
  full_name: string;
  email: string;
  phone_number: string;
  account_type: string;
}

const ACCOUNT_TYPES = ['individual', 'freelancer', 'sme', 'exporter', 'ecommerce', 'ngo', 'startup'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Component ────────────────────────────────────────────────────────────────

const DeveloperManagement: React.FC = () => {
  // List view state
  const [developers, setDevelopers]   = useState<Developer[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(0);
  const PAGE_SIZE = 50;

  // Detail / profile view state
  const [selected, setSelected]       = useState<DeveloperDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError]  = useState('');

  // Create single developer
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm]   = useState({ full_name: '', email: '', phone_number: '', account_type: 'individual', key_name: '' });
  const [creating, setCreating]       = useState(false);
  const [createMsg, setCreateMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newDevKey, setNewDevKey]     = useState<string | null>(null);

  // Bulk create
  const [showBulk, setShowBulk]       = useState(false);
  const [bulkCount, setBulkCount]     = useState(10);
  const [bulkPrefix, setBulkPrefix]   = useState('Developer');
  const [bulkDomain, setBulkDomain]   = useState('wekeza.dev');
  const [bulkPassword, setBulkPassword] = useState('WekezaDev@2026');
  const [bulkAccountType, setBulkAccountType] = useState('individual');
  const [bulking, setBulking]         = useState(false);
  const [bulkResult, setBulkResult]   = useState<{ created: number; skipped: number } | null>(null);
  const [bulkMsg, setBulkMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit profile
  const [editForm, setEditForm]       = useState<{ full_name: string; phone_number: string; account_type: string; kyc_status: string } | null>(null);
  const [saving, setSaving]           = useState(false);

  // Add key to developer
  const [newKeyName, setNewKeyName]   = useState('');
  const [addingKey, setAddingKey]     = useState(false);
  const [newRawKey, setNewRawKey]     = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchDevelopers = async (q = search, p = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String(p * PAGE_SIZE),
      });
      if (q) params.set('search', q);
      const res = await apiClient.get<{ developers: Developer[]; total: number }>(
        `/v1/admin/developers?${params}`
      );
      setDevelopers(res.data.developers ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      setError('Failed to load developers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevelopers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchDevelopers(search, 0);
  };

  const openDetail = async (userId: string) => {
    setDetailError('');
    setDetailLoading(true);
    setSelected(null);
    setEditForm(null);
    setNewRawKey(null);
    try {
      const res = await apiClient.get<DeveloperDetail>(`/v1/admin/developers/${userId}`);
      setSelected(res.data);
      setEditForm({
        full_name:    res.data.developer.full_name,
        phone_number: res.data.developer.phone_number ?? '',
        account_type: res.data.developer.account_type,
        kyc_status:   res.data.developer.kyc_status,
      });
    } catch {
      setDetailError('Failed to load developer details.');
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Single-create ──────────────────────────────────────────────────────────

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    setNewDevKey(null);
    if (!createForm.full_name.trim() || !createForm.email.trim()) {
      setCreateMsg({ type: 'error', text: 'Full name and email are required.' });
      return;
    }
    setCreating(true);
    try {
      const res = await apiClient.post<{ developer: Developer; api_key: { raw_key: string } }>(
        '/v1/admin/developers',
        {
          full_name:    createForm.full_name.trim(),
          email:        createForm.email.trim(),
          phone_number: createForm.phone_number.trim() || undefined,
          account_type: createForm.account_type,
          key_name:     createForm.key_name.trim() || undefined,
        }
      );
      setNewDevKey(res.data.api_key.raw_key);
      setCreateMsg({ type: 'success', text: `Developer "${res.data.developer.full_name}" created.` });
      setCreateForm({ full_name: '', email: '', phone_number: '', account_type: 'individual', key_name: '' });
      await fetchDevelopers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create developer.';
      setCreateMsg({ type: 'error', text: msg });
    } finally {
      setCreating(false);
    }
  };

  // ── Bulk create ────────────────────────────────────────────────────────────

  const buildBulkPayload = (): BulkRow[] => {
    const rows: BulkRow[] = [];
    for (let i = 1; i <= bulkCount; i++) {
      const firstName = `${bulkPrefix}${i}`;
      rows.push({
        full_name:    `${firstName} User`,
        email:        `${firstName.toLowerCase()}@${bulkDomain}`,
        phone_number: '',
        account_type: bulkAccountType,
      });
    }
    return rows;
  };

  const handleBulk = async (e: FormEvent) => {
    e.preventDefault();
    setBulkMsg(null);
    setBulkResult(null);
    setBulking(true);
    try {
      const res = await apiClient.post<{ created: number; skipped: number }>(
        '/v1/admin/developers/bulk',
        {
          developers:       buildBulkPayload(),
          default_password: bulkPassword,
        }
      );
      setBulkResult({ created: res.data.created, skipped: res.data.skipped });
      setBulkMsg({ type: 'success', text: `Bulk operation complete: ${res.data.created} created, ${res.data.skipped} skipped.` });
      await fetchDevelopers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Bulk create failed.';
      setBulkMsg({ type: 'error', text: msg });
    } finally {
      setBulking(false);
    }
  };

  // ── Profile edit ───────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!selected || !editForm) return;
    setSaving(true);
    try {
      await apiClient.put(`/v1/admin/developers/${selected.developer.user_id}`, {
        full_name:    editForm.full_name,
        phone_number: editForm.phone_number || undefined,
        account_type: editForm.account_type,
        kyc_status:   editForm.kyc_status,
      });
      await openDetail(selected.developer.user_id);
      await fetchDevelopers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save profile changes.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── API key management ────────────────────────────────────────────────────

  const handleAddKey = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setAddingKey(true);
    setNewRawKey(null);
    try {
      const res = await apiClient.post<{ api_key: { raw_key: string } }>(
        `/v1/admin/developers/${selected.developer.user_id}/api-keys`,
        { name: newKeyName.trim() || undefined }
      );
      setNewRawKey(res.data.api_key.raw_key);
      setNewKeyName('');
      await openDetail(selected.developer.user_id);
      await fetchDevelopers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create API key.';
      alert(msg);
    } finally {
      setAddingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!selected) return;
    if (!window.confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/v1/admin/developers/${selected.developer.user_id}/api-keys/${keyId}`);
      await openDetail(selected.developer.user_id);
      await fetchDevelopers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to revoke key.';
      alert(msg);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const kycBadge = (status: string) => {
    if (status === 'verified') return 'badge badge-success';
    if (status === 'rejected') return 'badge badge-danger';
    return 'badge badge-warning';
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1>👩‍💻 Developer Management</h1>
          <p>Onboard, manage profiles and API keys for all platform developers</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => { setShowBulk(!showBulk); setShowCreateForm(false); }}>
            ⚡ Bulk Create
          </button>
          <button className="btn btn-primary" onClick={() => { setShowCreateForm(!showCreateForm); setShowBulk(false); }}>
            + New Developer
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* ── Create Single Developer ── */}
      {showCreateForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">Create Developer Account</div>
          </div>

          {createMsg && (
            <div className={`alert alert-${createMsg.type === 'success' ? 'success' : 'danger'}`}>
              {createMsg.text}
            </div>
          )}
          {newDevKey && (
            <div className="alert alert-warning" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              <strong>🔑 New API key (copy now — shown once):</strong><br />
              <code style={{ fontSize: '13px' }}>{newDevKey}</code>
            </div>
          )}

          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-control" value={createForm.full_name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Jane Developer" required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-control" type="email" value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="jane@fintech.io" required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-control" value={createForm.phone_number}
                  onChange={(e) => setCreateForm((p) => ({ ...p, phone_number: e.target.value }))}
                  placeholder="+254712345678" />
              </div>
              <div className="form-group">
                <label className="form-label">Account Type</label>
                <select className="form-control" value={createForm.account_type}
                  onChange={(e) => setCreateForm((p) => ({ ...p, account_type: e.target.value }))}>
                  {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">API Key Name (optional)</label>
                <input className="form-control" value={createForm.key_name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, key_name: e.target.value }))}
                  placeholder="My Production Key" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? <LoadingSpinner size="sm" /> : 'Create Developer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Bulk Create ── */}
      {showBulk && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">⚡ Bulk Create Developers</div>
            <div className="card-subtitle">Generate up to 100 developer accounts at once</div>
          </div>

          {bulkMsg && (
            <div className={`alert alert-${bulkMsg.type === 'success' ? 'success' : 'danger'}`}>
              {bulkMsg.text}
            </div>
          )}
          {bulkResult && (
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="stat-card" style={{ flex: 1 }}>
                <div className="stat-card-icon green">✅</div>
                <div className="stat-card-body">
                  <div className="stat-card-label">Created</div>
                  <div className="stat-card-value">{bulkResult.created}</div>
                </div>
              </div>
              <div className="stat-card" style={{ flex: 1 }}>
                <div className="stat-card-icon yellow">⏭</div>
                <div className="stat-card-body">
                  <div className="stat-card-label">Skipped</div>
                  <div className="stat-card-value">{bulkResult.skipped}</div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleBulk}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Number of Developers (1–100)</label>
                <input className="form-control" type="number" min={1} max={100}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))} />
              </div>
              <div className="form-group">
                <label className="form-label">Name Prefix</label>
                <input className="form-control" value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value)}
                  placeholder="Developer" />
              </div>
              <div className="form-group">
                <label className="form-label">Email Domain</label>
                <input className="form-control" value={bulkDomain}
                  onChange={(e) => setBulkDomain(e.target.value)}
                  placeholder="wekeza.dev" />
              </div>
              <div className="form-group">
                <label className="form-label">Account Type</label>
                <select className="form-control" value={bulkAccountType}
                  onChange={(e) => setBulkAccountType(e.target.value)}>
                  {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Default Password</label>
                <input className="form-control" value={bulkPassword}
                  onChange={(e) => setBulkPassword(e.target.value)}
                  placeholder="WekezaDev@2026" />
              </div>
            </div>
            <div className="alert alert-info" style={{ marginBottom: '12px' }}>
              Will create {bulkCount} accounts: <code>{bulkPrefix.toLowerCase()}1@{bulkDomain}</code> …{' '}
              <code>{bulkPrefix.toLowerCase()}{bulkCount}@{bulkDomain}</code>. Each receives one API key automatically.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" disabled={bulking}>
                {bulking ? <LoadingSpinner size="sm" /> : `⚡ Create ${bulkCount} Developers`}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowBulk(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Developer List + Detail (side-by-side on wide screens) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '24px', alignItems: 'start' }}>

        {/* Developer List */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">All Developers</div>
              <div className="card-subtitle">{total.toLocaleString()} total</div>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input className="form-control" placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)} />
            <button type="submit" className="btn btn-secondary" style={{ flexShrink: 0 }}>🔍 Search</button>
            {search && (
              <button type="button" className="btn btn-secondary" style={{ flexShrink: 0 }}
                onClick={() => { setSearch(''); setPage(0); fetchDevelopers('', 0); }}>✕</button>
            )}
          </form>

          {loading ? <LoadingSpinner /> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Developer</th>
                    <th>Type</th>
                    <th>KYC</th>
                    <th>Keys</th>
                    <th>Joined</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {developers.length === 0 ? (
                    <tr><td colSpan={6} className="table-empty">No developers found.</td></tr>
                  ) : (
                    developers.map((d) => (
                      <tr key={d.user_id}
                        style={{ cursor: 'pointer', background: selected?.developer.user_id === d.user_id ? 'var(--color-bg)' : undefined }}
                        onClick={() => openDetail(d.user_id)}
                      >
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{d.full_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{d.email}</div>
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '10px' }}>
                            {d.account_type}
                          </span>
                        </td>
                        <td>
                          <span className={kycBadge(d.kyc_status)} style={{ fontSize: '10px' }}>
                            {d.kyc_status}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: d.active_key_count > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                            {d.active_key_count}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}> / {d.api_key_count}</span>
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{formatDate(d.created_at)}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm"
                            onClick={(e) => { e.stopPropagation(); openDetail(d.user_id); }}>
                            View →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 0}
                onClick={() => { const p = page - 1; setPage(p); fetchDevelopers(search, p); }}>
                ← Prev
              </button>
              <span style={{ lineHeight: '32px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Page {page + 1} / {totalPages}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages - 1}
                onClick={() => { const p = page + 1; setPage(p); fetchDevelopers(search, p); }}>
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Developer Detail Panel */}
        {(selected || detailLoading || detailError) && (
          <div>
            {detailLoading && <LoadingSpinner />}
            {detailError && <div className="alert alert-danger">{detailError}</div>}

            {selected && editForm && (
              <>
                {/* Profile Card */}
                <div className="card" style={{ marginBottom: '16px' }}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', marginRight: '10px' }}>
                          {selected.developer.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        {selected.developer.full_name}
                      </div>
                      <div className="card-subtitle">{selected.developer.email}</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕ Close</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Full Name</label>
                      <input className="form-control" value={editForm.full_name}
                        onChange={(e) => setEditForm((p) => p ? { ...p, full_name: e.target.value } : p)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Phone Number</label>
                      <input className="form-control" value={editForm.phone_number}
                        onChange={(e) => setEditForm((p) => p ? { ...p, phone_number: e.target.value } : p)}
                        placeholder="Not set" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Account Type</label>
                      <select className="form-control" value={editForm.account_type}
                        onChange={(e) => setEditForm((p) => p ? { ...p, account_type: e.target.value } : p)}>
                        {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">KYC Status</label>
                      <select className="form-control" value={editForm.kyc_status}
                        onChange={(e) => setEditForm((p) => p ? { ...p, kyc_status: e.target.value } : p)}>
                        <option value="pending">pending</option>
                        <option value="verified">verified</option>
                        <option value="rejected">rejected</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={saving}>
                      {saving ? <LoadingSpinner size="sm" /> : '💾 Save Profile'}
                    </button>
                  </div>

                  {/* Wallets */}
                  {selected.wallets.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px', color: 'var(--color-text-muted)' }}>WALLETS</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {selected.wallets.map((w) => (
                          <div key={w.currency} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{w.currency}</div>
                            <div style={{ fontWeight: 700 }}>{parseFloat(w.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* API Keys Card */}
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">🔑 API Keys</div>
                      <div className="card-subtitle">
                        {selected.api_keys.filter((k) => k.status === 'active').length} active
                        &nbsp;/&nbsp;{selected.api_keys.length} total
                      </div>
                    </div>
                  </div>

                  {/* New raw key banner */}
                  {newRawKey && (
                    <div className="alert alert-warning" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      <strong>🔑 New key (copy now):</strong><br />
                      <code style={{ fontSize: '12px' }}>{newRawKey}</code>
                    </div>
                  )}

                  {/* Add key form */}
                  <form onSubmit={handleAddKey} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input className="form-control" placeholder="Key name (optional)"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)} />
                    <button type="submit" className="btn btn-primary btn-sm" disabled={addingKey} style={{ flexShrink: 0 }}>
                      {addingKey ? <LoadingSpinner size="sm" /> : '+ Add Key'}
                    </button>
                  </form>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Key (masked)</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.api_keys.length === 0 ? (
                          <tr><td colSpan={5} className="table-empty">No API keys yet.</td></tr>
                        ) : (
                          selected.api_keys.map((k) => (
                            <tr key={k.api_key_id}>
                              <td style={{ fontWeight: 600, fontSize: '12px' }}>{k.name ?? '—'}</td>
                              <td><code style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{k.api_key}</code></td>
                              <td>
                                <span className={k.status === 'active' ? 'badge badge-success' : 'badge badge-danger'} style={{ fontSize: '10px' }}>
                                  {k.status}
                                </span>
                              </td>
                              <td style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{formatDate(k.created_at)}</td>
                              <td>
                                {k.status === 'active' && (
                                  <button className="btn btn-danger btn-sm"
                                    onClick={() => handleRevokeKey(k.api_key_id)}>
                                    Revoke
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default DeveloperManagement;
