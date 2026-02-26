import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Wallet, Transaction, Bank } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', KES: 'KSh' };
const CURRENCY_FLAGS: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', KES: '🇰🇪' };
const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatAmount(amount: number, currency: string) {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function txBadgeClass(status: string) {
  if (status === 'completed') return 'badge badge-success';
  if (status === 'failed')    return 'badge badge-danger';
  return 'badge badge-warning';
}

const WalletDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'deposit' | 'withdraw' | 'transfer'>('deposit');
  const [page, setPage] = useState(1);

  // Deposit form state
  const [depAmount, setDepAmount] = useState('');
  const [depRef, setDepRef] = useState('');
  const [depLoading, setDepLoading] = useState(false);
  const [depMsg, setDepMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Withdrawal form state
  const [wdAmount, setWdAmount] = useState('');
  const [wdBank, setWdBank] = useState('');
  const [wdLoading, setWdLoading] = useState(false);
  const [wdMsg, setWdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Transfer form state
  const [trAmount, setTrAmount] = useState('');
  const [trDestWallet, setTrDestWallet] = useState('');
  const [trLoading, setTrLoading] = useState(false);
  const [trMsg, setTrMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [walletRes, txRes, banksRes] = await Promise.all([
        apiClient.get<Wallet>(`/v1/wallets/${id}`),
        apiClient.get<{ transactions: Transaction[] }>(`/v1/wallets/${id}/transactions`),
        apiClient.get<{ banks: Bank[] }>('/v1/banks').catch(() => ({ data: { banks: [] as Bank[] } })),
      ]);
      setWallet(walletRes.data);
      setTransactions(txRes.data.transactions ?? []);
      setBanks(banksRes.data.banks ?? []);
    } catch {
      setError('Failed to load wallet details.');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [id]);

  const handleDeposit = async (e: FormEvent) => {
    e.preventDefault();
    setDepMsg(null);
    const amount = parseFloat(depAmount);
    if (!amount || amount <= 0) { setDepMsg({ type: 'error', text: 'Enter a valid amount.' }); return; }
    setDepLoading(true);
    try {
      await apiClient.post(`/v1/wallets/${id}/deposit`, {
        amount,
        currency: wallet?.currency,
        reference: depRef || undefined,
      });
      setDepMsg({ type: 'success', text: `Deposited ${formatAmount(amount, wallet?.currency ?? '')} successfully!` });
      setDepAmount(''); setDepRef('');
      await fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Deposit failed.';
      setDepMsg({ type: 'error', text: msg });
    } finally {
      setDepLoading(false);
    }
  };

  const handleWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    setWdMsg(null);
    const amount = parseFloat(wdAmount);
    if (!amount || amount <= 0) { setWdMsg({ type: 'error', text: 'Enter a valid amount.' }); return; }
    if (!wdBank) { setWdMsg({ type: 'error', text: 'Select a bank.' }); return; }
    setWdLoading(true);
    try {
      await apiClient.post(`/v1/wallets/${id}/withdraw`, {
        amount,
        currency: wallet?.currency,
        bank_id: wdBank,
      });
      setWdMsg({ type: 'success', text: `Withdrawal of ${formatAmount(amount, wallet?.currency ?? '')} initiated!` });
      setWdAmount(''); setWdBank('');
      await fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Withdrawal failed.';
      setWdMsg({ type: 'error', text: msg });
    } finally {
      setWdLoading(false);
    }
  };

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault();
    setTrMsg(null);
    const amount = parseFloat(trAmount);
    if (!amount || amount <= 0) { setTrMsg({ type: 'error', text: 'Enter a valid amount.' }); return; }
    if (!trDestWallet.trim()) { setTrMsg({ type: 'error', text: 'Enter a destination wallet ID.' }); return; }
    if (trDestWallet.trim() === id!) { setTrMsg({ type: 'error', text: 'Cannot transfer to the same wallet.' }); return; }
    setTrLoading(true);
    try {
      await apiClient.post(`/v1/wallets/${id}/transfer`, {
        destination_wallet_id: trDestWallet.trim(),
        amount,
      });
      setTrMsg({ type: 'success', text: `Transferred ${formatAmount(amount, wallet?.currency ?? '')} successfully!` });
      setTrAmount(''); setTrDestWallet('');
      await fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Transfer failed.';
      setTrMsg({ type: 'error', text: msg });
    } finally {
      setTrLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!wallet) return <div className="alert alert-warning">Wallet not found.</div>;

  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const pageTx = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/wallets" style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
            ← Back to Wallets
          </Link>
          <h1 style={{ marginTop: '4px' }}>
            {CURRENCY_FLAGS[wallet.currency]} {wallet.currency} Wallet
          </h1>
          <p>Wallet ID: <code style={{ fontSize: '12px' }}>{wallet.wallet_id}</code></p>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Balance card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Balance</div>
          </div>
          <div style={{ padding: '12px 0' }}>
            <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-text)' }}>
              {formatAmount(wallet.balance, wallet.currency)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
              Last updated: {formatDate(wallet.updated_at)}
            </div>
          </div>
          <hr className="divider" />
          <div className="info-row">
            <span className="info-row-label">Currency</span>
            <span className="info-row-value">{wallet.currency}</span>
          </div>
          <div className="info-row">
            <span className="info-row-label">Created</span>
            <span className="info-row-value">{formatDate(wallet.created_at)}</span>
          </div>
        </div>

        {/* Deposit / Withdraw forms */}
        <div className="card">
          <div className="tabs">
            <button className={`tab-btn ${tab === 'deposit' ? 'active' : ''}`} onClick={() => setTab('deposit')}>
              ↓ Deposit
            </button>
            <button className={`tab-btn ${tab === 'withdraw' ? 'active' : ''}`} onClick={() => setTab('withdraw')}>
              ↑ Withdraw
            </button>
            <button className={`tab-btn ${tab === 'transfer' ? 'active' : ''}`} onClick={() => setTab('transfer')}>
              ⇄ Transfer
            </button>
          </div>

          {tab === 'deposit' && (
            <form onSubmit={handleDeposit}>
              {depMsg && (
                <div className={`alert alert-${depMsg.type === 'success' ? 'success' : 'danger'}`}>
                  {depMsg.text}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Amount ({wallet.currency})</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={depAmount}
                  onChange={(e) => setDepAmount(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reference (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Invoice #123"
                  value={depRef}
                  onChange={(e) => setDepRef(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-success btn-block" disabled={depLoading}>
                {depLoading ? <LoadingSpinner size="sm" /> : '↓ Deposit Funds'}
              </button>
            </form>
          )}

          {tab === 'withdraw' && (
            <form onSubmit={handleWithdraw}>
              {wdMsg && (
                <div className={`alert alert-${wdMsg.type === 'success' ? 'success' : 'danger'}`}>
                  {wdMsg.text}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Amount ({wallet.currency})</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={wdAmount}
                  onChange={(e) => setWdAmount(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Destination Bank</label>
                <select
                  className="form-control"
                  value={wdBank}
                  onChange={(e) => setWdBank(e.target.value)}
                >
                  <option value="">Select a bank…</option>
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
              <button type="submit" className="btn btn-danger btn-block" disabled={wdLoading}>
                {wdLoading ? <LoadingSpinner size="sm" /> : '↑ Withdraw Funds'}
              </button>
            </form>
          )}

          {tab === 'transfer' && (
            <form onSubmit={handleTransfer}>
              {trMsg && (
                <div className={`alert alert-${trMsg.type === 'success' ? 'success' : 'danger'}`}>
                  {trMsg.text}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Amount ({wallet.currency})</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={trAmount}
                  onChange={(e) => setTrAmount(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Destination Wallet ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={trDestWallet}
                  onChange={(e) => setTrDestWallet(e.target.value)}
                />
                <p className="form-hint">
                  Must be a {wallet.currency} wallet. For cross-currency transfers, use FX Exchange.
                </p>
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={trLoading}>
                {trLoading ? <LoadingSpinner size="sm" /> : '⇄ Transfer Funds'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Transaction History</div>
            <div className="card-subtitle">{transactions.length} total transactions</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reference</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {pageTx.length === 0 ? (
                <tr><td colSpan={5} className="table-empty">No transactions yet</td></tr>
              ) : (
                pageTx.map((tx) => (
                  <tr key={tx.transaction_id}>
                    <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{tx.type}</td>
                    <td>
                      <span className={`amount ${tx.type === 'deposit' ? 'amount-positive' : 'amount-negative'}`}>
                        {tx.type === 'deposit' ? '+' : '-'}{formatAmount(tx.amount, tx.currency)}
                      </span>
                    </td>
                    <td><span className={txBadgeClass(tx.status)}>{tx.status}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {tx.metadata?.reference as string || '—'}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                      {formatDate(tx.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              Page {page} of {totalPages} ({transactions.length} total)
            </span>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`pagination-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="pagination-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default WalletDetail;
