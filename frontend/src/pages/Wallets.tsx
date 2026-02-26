import React, { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Wallet } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const CURRENCY_FLAGS: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', KES: '🇰🇪' };
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', KES: 'KSh' };

function formatAmount(amount: number, currency: string) {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const Wallets: React.FC = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'KES'>('USD');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchWallets = async () => {
    try {
      const res = await apiClient.get<Wallet[]>('/wallets');
      setWallets(res.data);
    } catch {
      setError('Failed to load wallets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWallets(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await apiClient.post('/wallets', { currency });
      setShowModal(false);
      await fetchWallets();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create wallet.';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Wallets</h1>
          <p>Manage your multi-currency accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Wallet
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {wallets.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👛</div>
          <h3 style={{ marginBottom: '8px' }}>No wallets yet</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>
            Create your first wallet to start sending and receiving money.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            Create Wallet
          </button>
        </div>
      ) : (
        <div className="wallets-grid">
          {wallets.map((w) => (
            <Link
              key={w.wallet_id}
              to={`/wallets/${w.wallet_id}`}
              className={`wallet-card ${w.currency.toLowerCase()}`}
            >
              <span className="wallet-card-flag">{CURRENCY_FLAGS[w.currency]}</span>
              <div className="wallet-card-currency">{w.currency} Wallet</div>
              <div className="wallet-card-balance">{formatAmount(w.balance, w.currency)}</div>
              <div className="wallet-card-id">ID: {w.wallet_id.slice(0, 8)}…</div>
            </Link>
          ))}
        </div>
      )}

      {/* Summary card */}
      {wallets.length > 0 && (
        <div className="card" style={{ marginTop: '8px' }}>
          <div className="card-header">
            <div className="card-title">Balance Summary</div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Balance</th>
                  <th>Wallet ID</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.wallet_id}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        {CURRENCY_FLAGS[w.currency]} {w.currency}
                      </span>
                    </td>
                    <td>
                      <span className="amount">{formatAmount(w.balance, w.currency)}</span>
                    </td>
                    <td>
                      <code style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {w.wallet_id.slice(0, 12)}…
                      </code>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link to={`/wallets/${w.wallet_id}`} className="btn btn-secondary btn-sm">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Wallet Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Wallet</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {createError && <div className="alert alert-danger">{createError}</div>}
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select
                    className="form-control"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'USD' | 'EUR' | 'GBP' | 'KES')}
                  >
                    <option value="USD">🇺🇸 USD — US Dollar</option>
                    <option value="EUR">🇪🇺 EUR — Euro</option>
                    <option value="GBP">🇬🇧 GBP — British Pound</option>
                    <option value="KES">🇰🇪 KES — Kenyan Shilling</option>
                  </select>
                </div>
                <div className="alert alert-info">
                  ℹ️ A new {currency} wallet will be created with a zero balance.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <LoadingSpinner size="sm" /> : 'Create Wallet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Wallets;
