import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Wallet, Transaction } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', KES: 'KSh' };
const CURRENCY_FLAGS: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', KES: '🇰🇪' };

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

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletsRes, txRes] = await Promise.all([
          apiClient.get<Wallet[]>('/wallets'),
          apiClient.get<Transaction[]>('/transactions?limit=5'),
        ]);
        setWallets(walletsRes.data);
        setTransactions(txRes.data);
      } catch {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalUsd = wallets.reduce((sum, w) => {
    const rates: Record<string, number> = { USD: 1, EUR: 1.09, GBP: 1.27, KES: 0.0077 };
    return sum + w.balance * (rates[w.currency] ?? 1);
  }, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Good {getGreeting()}, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p>Here&apos;s your financial overview for today</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue">👛</div>
          <div className="stat-card-body">
            <div className="stat-card-label">Total Wallets</div>
            <div className="stat-card-value">{wallets.length}</div>
            <div className="stat-card-sub">Active accounts</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon green">💰</div>
          <div className="stat-card-body">
            <div className="stat-card-label">Total Balance (USD equiv.)</div>
            <div className="stat-card-value">${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="stat-card-sub">Across all currencies</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon yellow">🔄</div>
          <div className="stat-card-body">
            <div className="stat-card-label">Recent Transactions</div>
            <div className="stat-card-value">{transactions.length}</div>
            <div className="stat-card-sub">Last 5 transactions</div>
          </div>
        </div>

        <div className="stat-card">
          <div className={`stat-card-icon ${user?.kyc_status === 'verified' ? 'green' : user?.kyc_status === 'rejected' ? 'red' : 'yellow'}`}>
            {user?.kyc_status === 'verified' ? '✅' : user?.kyc_status === 'rejected' ? '❌' : '⏳'}
          </div>
          <div className="stat-card-body">
            <div className="stat-card-label">KYC Status</div>
            <div className="stat-card-value" style={{ fontSize: '16px', textTransform: 'capitalize' }}>{user?.kyc_status}</div>
            <div className="stat-card-sub">{user?.kyc_status === 'verified' ? 'Identity verified' : 'Action may be needed'}</div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Wallets summary */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">My Wallets</div>
              <div className="card-subtitle">Currency accounts</div>
            </div>
            <Link to="/wallets" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {wallets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>👛</div>
              <p>No wallets yet.</p>
              <Link to="/wallets" className="btn btn-primary btn-sm" style={{ marginTop: '8px' }}>Create Wallet</Link>
            </div>
          ) : (
            wallets.map((w) => (
              <div key={w.wallet_id} className="info-row">
                <span className="info-row-label">
                  {CURRENCY_FLAGS[w.currency]} {w.currency}
                </span>
                <span className="info-row-value">
                  {formatAmount(w.balance, w.currency)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Quick Links */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Quick Actions</div>
          </div>
          <div className="quick-links">
            <Link to="/wallets" className="quick-link">
              <span className="quick-link-icon">👛</span>Wallets
            </Link>
            <Link to="/fx" className="quick-link">
              <span className="quick-link-icon">💱</span>FX Exchange
            </Link>
            <Link to="/settlements" className="quick-link">
              <span className="quick-link-icon">🏦</span>Settlements
            </Link>
            <Link to="/cards" className="quick-link">
              <span className="quick-link-icon">💳</span>Cards
            </Link>
            <Link to="/kyc" className="quick-link">
              <span className="quick-link-icon">📋</span>KYC
            </Link>
            <Link to="/credit" className="quick-link">
              <span className="quick-link-icon">📊</span>Credit Score
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Transactions</div>
            <div className="card-subtitle">Last 5 activity records</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">No recent transactions</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.transaction_id}>
                    <td style={{ textTransform: 'capitalize' }}>{tx.type}</td>
                    <td>
                      <span className={`amount ${tx.type === 'deposit' ? 'amount-positive' : 'amount-negative'}`}>
                        {tx.type === 'deposit' ? '+' : '-'}{formatAmount(tx.amount, tx.currency)}
                      </span>
                    </td>
                    <td>{tx.currency}</td>
                    <td><span className={txBadgeClass(tx.status)}>{tx.status}</span></td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{formatDate(tx.created_at)}</td>
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export default Dashboard;
