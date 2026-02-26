import React, { useEffect, useState, FormEvent } from 'react';
import apiClient from '../api/client';
import { Settlement, Wallet, Bank } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const CURRENCY_FLAGS: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', KES: '🇰🇪' };
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', KES: 'KSh' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function statusBadge(status: string) {
  if (status === 'completed') return 'badge badge-success';
  if (status === 'failed')    return 'badge badge-danger';
  return 'badge badge-warning';
}

const Settlements: React.FC = () => {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [walletId, setWalletId] = useState('');
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [sRes, wRes, bRes] = await Promise.all([
        apiClient.get<Settlement[]>('/settlements'),
        apiClient.get<Wallet[]>('/wallets'),
        apiClient.get<Bank[]>('/banks').catch(() => ({ data: [] as Bank[] })),
      ]);
      setSettlements(sRes.data);
      setWallets(wRes.data);
      setBanks(bRes.data);
      if (wRes.data.length > 0) { setWalletId(wRes.data[0].wallet_id); setCurrency(wRes.data[0].currency); }
    } catch {
      setError('Failed to load settlements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setFormMsg({ type: 'error', text: 'Enter a valid amount.' }); return; }
    if (!walletId) { setFormMsg({ type: 'error', text: 'Select a wallet.' }); return; }
    if (!bankId) { setFormMsg({ type: 'error', text: 'Select a bank.' }); return; }
    setSubmitting(true);
    try {
      await apiClient.post('/settlements', { wallet_id: walletId, bank_id: bankId, amount: amt, currency });
      setFormMsg({ type: 'success', text: 'Settlement initiated successfully!' });
      setAmount(''); setBankId('');
      setShowForm(false);
      await fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Settlement failed.';
      setFormMsg({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settlements</h1>
          <p>Initiate and track bank settlements</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Initiate Settlement'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {formMsg && (
        <div className={`alert alert-${formMsg.type === 'success' ? 'success' : 'danger'}`}>
          {formMsg.text}
        </div>
      )}

      {/* Initiate form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">New Settlement</div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Source Wallet</label>
                <select
                  className="form-control"
                  value={walletId}
                  onChange={(e) => {
                    setWalletId(e.target.value);
                    const w = wallets.find((x) => x.wallet_id === e.target.value);
                    if (w) setCurrency(w.currency);
                  }}
                >
                  {wallets.length === 0 && <option value="">No wallets available</option>}
                  {wallets.map((w) => (
                    <option key={w.wallet_id} value={w.wallet_id}>
                      {CURRENCY_FLAGS[w.currency]} {w.currency} — {CURRENCY_SYMBOLS[w.currency]}{w.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Destination Bank</label>
                <select
                  className="form-control"
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                >
                  <option value="">Select bank…</option>
                  {banks.map((b) => (
                    <option key={b.bank_id} value={b.bank_id}>
                      {b.name} ({b.country})
                    </option>
                  ))}
                  {banks.length === 0 && (
                    <option value="default_bank">Default Bank</option>
                  )}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <input
                  type="text"
                  className="form-control"
                  value={currency}
                  readOnly
                  style={{ background: 'var(--color-bg)' }}
                />
                <p className="form-hint">Currency is tied to the selected wallet.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <LoadingSpinner size="sm" /> : 'Initiate Settlement'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Settlements list */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Settlement History</div>
            <div className="card-subtitle">{settlements.length} total settlements</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Settlement ID</th>
                <th>Wallet</th>
                <th>Bank</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Initiated</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No settlements yet. Initiate your first settlement above.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.settlement_id}>
                    <td>
                      <code style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {s.settlement_id.slice(0, 10)}…
                      </code>
                    </td>
                    <td>
                      <code style={{ fontSize: '11px' }}>{s.wallet_id.slice(0, 8)}…</code>
                    </td>
                    <td>
                      <code style={{ fontSize: '11px' }}>{s.bank_id.slice(0, 8)}…</code>
                    </td>
                    <td>
                      <span className="amount">
                        {CURRENCY_SYMBOLS[s.currency] ?? s.currency}{s.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td><span className={statusBadge(s.status)}>{s.status}</span></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{formatDate(s.created_at)}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{formatDate(s.updated_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default Settlements;
