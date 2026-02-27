/**
 * Collection Accounts Page — BRD §4.4
 * BR-010: Global receiving accounts (USD/EUR/GBP)
 * BR-011: ACH, SWIFT, SEPA protocol support
 * BR-012: Inbound payments credited to wallet in near-real-time
 */
import React, { useEffect, useState, FormEvent } from 'react';
import apiClient from '../api/client';
import { CollectionAccount, Wallet, PaymentRail } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const RAIL_ICONS: Record<PaymentRail, string> = {
  ACH:   '🇺🇸',
  SWIFT: '🌐',
  SEPA:  '🇪🇺',
};

const RAIL_DESC: Record<PaymentRail, string> = {
  ACH:   'US domestic transfers (USD only)',
  SWIFT: 'International wire transfers (USD, EUR, GBP)',
  SEPA:  'Euro zone transfers (EUR only)',
};

const RAIL_CURRENCIES: Record<PaymentRail, string[]> = {
  ACH:   ['USD'],
  SEPA:  ['EUR'],
  SWIFT: ['USD', 'EUR', 'GBP'],
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const CollectionAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<CollectionAccount[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Creation form state
  const [selectedWallet, setSelectedWallet] = useState('');
  const [selectedRail, setSelectedRail] = useState<PaymentRail>('ACH');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Simulate inbound payment state
  const [simulateId, setSimulateId] = useState<string | null>(null);
  const [simAmount, setSimAmount] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simMsg, setSimMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [acRes, wRes] = await Promise.all([
        apiClient.get<{ collection_accounts: CollectionAccount[] }>('/v1/collection-accounts'),
        apiClient.get<{ wallets: Wallet[] }>('/v1/wallets'),
      ]);
      setAccounts(acRes.data.collection_accounts ?? []);
      setWallets(wRes.data.wallets ?? []);
    } catch {
      setError('Failed to load collection accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Filter wallets compatible with selected rail
  const compatibleWallets = wallets.filter(w =>
    RAIL_CURRENCIES[selectedRail].includes(w.currency)
  );

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    if (!selectedWallet) { setCreateMsg({ type: 'error', text: 'Select a wallet.' }); return; }
    setCreating(true);
    try {
      await apiClient.post('/v1/collection-accounts', {
        wallet_id: selectedWallet,
        rail: selectedRail,
        label: label.trim() || undefined,
      });
      setCreateMsg({ type: 'success', text: 'Collection account created successfully.' });
      setShowForm(false);
      setLabel('');
      setSelectedWallet('');
      await fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Failed to create account.';
      setCreateMsg({ type: 'error', text: msg });
    } finally {
      setCreating(false);
    }
  };

  const handleClose = async (id: string) => {
    if (!window.confirm('Close this collection account? It cannot be re-activated.')) return;
    try {
      await apiClient.delete(`/v1/collection-accounts/${id}`);
      await fetchData();
    } catch {
      alert('Failed to close account.');
    }
  };

  const handleSimulate = async (e: FormEvent) => {
    e.preventDefault();
    setSimMsg(null);
    const amount = parseFloat(simAmount);
    if (!amount || amount <= 0) { setSimMsg({ type: 'error', text: 'Enter a valid amount.' }); return; }
    setSimLoading(true);
    try {
      const res = await apiClient.post<{ transaction_id: string; amount: number; currency: string }>(
        `/v1/collection-accounts/${simulateId}/receive`,
        { amount }
      );
      setSimMsg({
        type: 'success',
        text: `Payment received! Tx ID: ${res.data.transaction_id} — ${res.data.amount} ${res.data.currency} credited to wallet.`,
      });
      setSimAmount('');
      await fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Simulation failed.';
      setSimMsg({ type: 'error', text: msg });
    } finally {
      setSimLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="page collection-accounts-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Global Collection Accounts</h1>
          <p style={{ margin: '0.3rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            Receive USD, EUR & GBP payments directly from ACH, SWIFT, and SEPA rails into your wallets.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setCreateMsg(null); }}>
          + New Account
        </button>
      </div>

      {createMsg && (
        <div className={`alert alert-${createMsg.type === 'success' ? 'success' : 'danger'}`} style={{ marginBottom: '1rem' }}>
          {createMsg.text}
        </div>
      )}

      {/* Creation Modal */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #4F46E5' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Create Collection Account</h2>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Payment Rail</label>
                <select
                  className="form-control"
                  value={selectedRail}
                  onChange={(e) => { setSelectedRail(e.target.value as PaymentRail); setSelectedWallet(''); }}
                >
                  {(Object.keys(RAIL_ICONS) as PaymentRail[]).map(rail => (
                    <option key={rail} value={rail}>
                      {RAIL_ICONS[rail]} {rail} — {RAIL_DESC[rail]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Link to Wallet ({RAIL_CURRENCIES[selectedRail].join(', ')})</label>
                <select
                  className="form-control"
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                >
                  <option value="">Select wallet…</option>
                  {compatibleWallets.map(w => (
                    <option key={w.wallet_id} value={w.wallet_id}>
                      {w.currency} Wallet — Balance: {w.balance}
                    </option>
                  ))}
                </select>
                {compatibleWallets.length === 0 && (
                  <small style={{ color: '#dc3545' }}>
                    No {RAIL_CURRENCIES[selectedRail].join('/')} wallet found. Create one in Wallets first.
                  </small>
                )}
              </div>
              <div className="form-group">
                <label>Label (optional)</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. My USD Freelance Account"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={creating || !selectedWallet}>
                {creating ? 'Creating…' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Simulate Payment Modal */}
      {simulateId && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #10B981' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>🧪 Simulate Inbound Payment (BR-012)</h2>
            <button className="btn btn-outline" onClick={() => { setSimulateId(null); setSimMsg(null); }}>✕</button>
          </div>
          <div className="card-body">
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Simulates an external sender sending funds to this account — funds are credited to the linked wallet immediately.
            </p>
            {simMsg && (
              <div className={`alert alert-${simMsg.type === 'success' ? 'success' : 'danger'}`} style={{ marginBottom: '0.75rem' }}>
                {simMsg.text}
              </div>
            )}
            <form onSubmit={handleSimulate} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Amount to receive</label>
                <input
                  className="form-control"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="100.00"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-success" disabled={simLoading}>
                {simLoading ? 'Sending…' : 'Receive'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Account List */}
      {accounts.length === 0 ? (
        <div className="empty-state card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌍</div>
          <h3>No collection accounts yet</h3>
          <p style={{ color: '#666' }}>Create a collection account to start receiving global payments.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Account</button>
        </div>
      ) : (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {accounts.map(acc => (
            <div key={acc.collection_account_id} className="card" style={{
              opacity: acc.status === 'closed' ? 0.6 : 1,
              borderLeft: `4px solid ${acc.rail === 'ACH' ? '#10B981' : acc.rail === 'SEPA' ? '#3B82F6' : '#6366F1'}`,
            }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '1.3rem' }}>{RAIL_ICONS[acc.rail as PaymentRail]}</span>
                  <strong style={{ marginLeft: '0.5rem' }}>{acc.rail}</strong>
                  <span className={`badge ${acc.status === 'active' ? 'badge-success' : 'badge-secondary'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                    {acc.status}
                  </span>
                </div>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>{acc.currency}</span>
              </div>

              <div className="card-body" style={{ fontSize: '0.9rem' }}>
                {acc.label && <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{acc.label}</p>}

                <div style={{ background: '#F9FAFB', borderRadius: '6px', padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: '1.8' }}>
                  {acc.routing_number && (
                    <div><span style={{ color: '#6B7280' }}>Routing:</span> {acc.routing_number}</div>
                  )}
                  {acc.account_number && (
                    <div><span style={{ color: '#6B7280' }}>Account:</span> {acc.account_number}</div>
                  )}
                  {acc.iban && (
                    <div><span style={{ color: '#6B7280' }}>IBAN:</span> {acc.iban}</div>
                  )}
                  {acc.bic && (
                    <div><span style={{ color: '#6B7280' }}>BIC:</span> {acc.bic}</div>
                  )}
                  <div><span style={{ color: '#6B7280' }}>Ref:</span> <strong>{acc.reference_code}</strong></div>
                </div>

                <p style={{ color: '#9CA3AF', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Created {formatDate(acc.created_at)}
                </p>
              </div>

              {acc.status === 'active' && (
                <div className="card-footer" style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => { setSimulateId(acc.collection_account_id); setSimMsg(null); }}
                  >
                    🧪 Test Receipt
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleClose(acc.collection_account_id)}
                    style={{ marginLeft: 'auto', color: '#dc3545', borderColor: '#dc3545' }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionAccounts;
