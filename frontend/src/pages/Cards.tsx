import React, { useEffect, useState, FormEvent } from 'react';
import apiClient from '../api/client';
import { Card, Wallet } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const CURRENCY_FLAGS: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', KES: '🇰🇪' };
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', KES: 'KSh' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function cardStatusBadge(status: string) {
  if (status === 'active')  return 'badge badge-success';
  if (status === 'blocked') return 'badge badge-danger';
  return 'badge badge-default';
}

const Cards: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [walletId, setWalletId] = useState('');
  const [cardType, setCardType] = useState<'virtual' | 'physical'>('virtual');
  const [limit, setLimit] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [cardsRes, walletsRes] = await Promise.all([
        apiClient.get<{ cards: Card[] }>('/v1/cards'),
        apiClient.get<{ wallets: Wallet[] }>('/v1/wallets'),
      ]);
      setCards(cardsRes.data.cards ?? []);
      setWallets(walletsRes.data.wallets ?? []);
      const walletsList = walletsRes.data.wallets ?? [];
      if (walletsList.length > 0) setWalletId(walletsList[0].wallet_id);
    } catch {
      setError('Failed to load cards.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    const spendingLimit = parseFloat(limit);
    if (!spendingLimit || spendingLimit <= 0) {
      setCreateMsg({ type: 'error', text: 'Enter a valid spending limit.' });
      return;
    }
    if (!walletId) {
      setCreateMsg({ type: 'error', text: 'Select a wallet.' });
      return;
    }
    setCreating(true);
    try {
      await apiClient.post('/v1/cards', { wallet_id: walletId, card_type: cardType, spending_limit: spendingLimit });
      setCreateMsg({ type: 'success', text: 'Card created successfully!' });
      setShowModal(false);
      setLimit('');
      await fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create card.';
      setCreateMsg({ type: 'error', text: msg });
    } finally {
      setCreating(false);
    }
  };

  const handleBlock = async (cardId: string, current: string) => {
    const action = current === 'active' ? 'block' : 'unblock';
    try {
      await apiClient.put(`/v1/cards/${cardId}/status`, { status: current === 'active' ? 'blocked' : 'active' });
      await fetchData();
    } catch {
      alert(`Failed to ${action} card.`);
    }
  };

  if (loading) return <LoadingSpinner />;

  const getWallet = (wId: string) => wallets.find((w) => w.wallet_id === wId);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Cards</h1>
          <p>Manage your virtual and physical payment cards</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Create Card
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {createMsg && (
        <div className={`alert alert-${createMsg.type === 'success' ? 'success' : 'danger'}`}>
          {createMsg.text}
        </div>
      )}

      {/* Cards grid */}
      {cards.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
          <h3 style={{ marginBottom: '8px' }}>No cards yet</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>
            Create a virtual or physical card to start spending.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            Create Your First Card
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {cards.map((card) => {
              const wallet = getWallet(card.wallet_id);
              return (
                <div key={card.card_id}>
                  <div className={`payment-card ${card.status === 'blocked' ? 'blocked' : ''}`}>
                    <div className="payment-card-type">
                      <span>{card.card_type === 'virtual' ? '🔵 VIRTUAL' : '🟡 PHYSICAL'}</span>
                      <span>WGI</span>
                    </div>
                    <div className="payment-card-number">
                      •••• •••• •••• {card.card_id.slice(-4).toUpperCase()}
                    </div>
                    <div className="payment-card-footer">
                      <div>
                        <div className="payment-card-label">Card Holder</div>
                        <div className="payment-card-value">
                          {wallet ? `${wallet.currency} Wallet` : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="payment-card-label">Limit</div>
                        <div className="payment-card-value">
                          {wallet ? `${CURRENCY_SYMBOLS[wallet.currency]}${card.spending_limit.toLocaleString()}` : `$${card.spending_limit.toLocaleString()}`}
                        </div>
                      </div>
                      <div>
                        <div className="payment-card-label">Status</div>
                        <div className="payment-card-value" style={{ textTransform: 'capitalize' }}>
                          {card.status}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <span className={cardStatusBadge(card.status)}>{card.status}</span>
                    <button
                      className={`btn btn-sm ${card.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => handleBlock(card.card_id, card.status)}
                    >
                      {card.status === 'active' ? '🔒 Block' : '🔓 Unblock'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cards table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">All Cards</div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Card ID</th>
                    <th>Type</th>
                    <th>Wallet</th>
                    <th>Spending Limit</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => {
                    const wallet = getWallet(card.wallet_id);
                    return (
                      <tr key={card.card_id}>
                        <td>
                          <code style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {card.card_id.slice(0, 10)}…
                          </code>
                        </td>
                        <td>
                          <span style={{ textTransform: 'capitalize' }}>
                            {card.card_type === 'virtual' ? '🔵' : '🟡'} {card.card_type}
                          </span>
                        </td>
                        <td>
                          {wallet ? (
                            <span>{CURRENCY_FLAGS[wallet.currency]} {wallet.currency}</span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>N/A</span>
                          )}
                        </td>
                        <td>
                          <span className="amount">
                            {wallet ? CURRENCY_SYMBOLS[wallet.currency] : '$'}{card.spending_limit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td><span className={cardStatusBadge(card.status)}>{card.status}</span></td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{formatDate(card.created_at)}</td>
                        <td>
                          <button
                            className={`btn btn-sm ${card.status === 'active' ? 'btn-secondary' : 'btn-success'}`}
                            onClick={() => handleBlock(card.card_id, card.status)}
                          >
                            {card.status === 'active' ? '🔒 Block' : '🔓 Unblock'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Create Card Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Card</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {createMsg?.type === 'error' && (
                  <div className="alert alert-danger">{createMsg.text}</div>
                )}
                <div className="form-group">
                  <label className="form-label">Linked Wallet</label>
                  <select
                    className="form-control"
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                  >
                    {wallets.length === 0 && <option value="">No wallets — create one first</option>}
                    {wallets.map((w) => (
                      <option key={w.wallet_id} value={w.wallet_id}>
                        {CURRENCY_FLAGS[w.currency]} {w.currency} — {CURRENCY_SYMBOLS[w.currency]}{w.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Card Type</label>
                  <select
                    className="form-control"
                    value={cardType}
                    onChange={(e) => setCardType(e.target.value as 'virtual' | 'physical')}
                  >
                    <option value="virtual">🔵 Virtual Card (instant)</option>
                    <option value="physical">🟡 Physical Card (5-7 days delivery)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Spending Limit</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 1000"
                    min="1"
                    step="0.01"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                  <p className="form-hint">Maximum amount that can be spent per month.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating || wallets.length === 0}>
                  {creating ? <LoadingSpinner size="sm" /> : 'Create Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Cards;
