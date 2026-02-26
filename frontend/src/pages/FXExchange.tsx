import React, { useEffect, useState, FormEvent } from 'react';
import apiClient from '../api/client';
import { FXRate, Wallet } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const CURRENCY_FLAGS: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', KES: '🇰🇪' };
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', KES: 'KSh' };
const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const FXExchange: React.FC = () => {
  const [rates, setRates] = useState<FXRate[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Convert form
  const [walletId, setWalletId] = useState('');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertMsg, setConvertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ratesRes, walletsRes] = await Promise.all([
          apiClient.get<{ rates: FXRate[] }>('/v1/fx/rates'),
          apiClient.get<{ wallets: Wallet[] }>('/v1/wallets'),
        ]);
        setRates(ratesRes.data.rates ?? []);
        setWallets(walletsRes.data.wallets ?? []);
        if (walletsRes.data.wallets && walletsRes.data.wallets.length > 0) setWalletId(walletsRes.data.wallets[0].wallet_id);
      } catch {
        setError('Failed to load FX data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Compute preview from loaded rates
  const getRate = (from: string, to: string): number | null => {
    const direct = rates.find((r) => r.currency_from === from && r.currency_to === to);
    if (direct) return direct.rate;
    // Try inverse
    const inverse = rates.find((r) => r.currency_from === to && r.currency_to === from);
    if (inverse) return 1 / inverse.rate;
    return null;
  };

  useEffect(() => {
    if (!amount || isNaN(parseFloat(amount))) { setPreview(null); return; }
    const rate = getRate(fromCurrency, toCurrency);
    if (rate !== null) {
      setPreview(parseFloat(amount) * rate);
    } else {
      setPreview(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromCurrency, toCurrency, rates]);

  const handleConvert = async (e: FormEvent) => {
    e.preventDefault();
    setConvertMsg(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setConvertMsg({ type: 'error', text: 'Enter a valid amount.' }); return; }
    if (fromCurrency === toCurrency) { setConvertMsg({ type: 'error', text: 'Select different currencies.' }); return; }
    if (!walletId) { setConvertMsg({ type: 'error', text: 'Select a wallet.' }); return; }
    setConverting(true);
    try {
      await apiClient.post('/v1/fx/convert', {
        source_wallet_id: walletId,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        amount: amt,
      });
      setConvertMsg({ type: 'success', text: `Converted ${amt} ${fromCurrency} → ${toCurrency} successfully!` });
      setAmount('');
      setPreview(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Conversion failed.';
      setConvertMsg({ type: 'error', text: msg });
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  // Build rate matrix
  const rateMatrix: Record<string, Record<string, number | null>> = {};
  CURRENCIES.forEach((from) => {
    rateMatrix[from] = {};
    CURRENCIES.forEach((to) => {
      rateMatrix[from][to] = from === to ? 1 : getRate(from, to);
    });
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>FX Exchange</h1>
          <p>View real-time rates and convert currencies</p>
        </div>
        <button className="btn btn-secondary" onClick={() => window.location.reload()}>
          🔄 Refresh Rates
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* FX Rates Table */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Live Exchange Rates</div>
              <div className="card-subtitle">
                Last updated: {rates.length > 0 ? formatDate(rates[0].timestamp) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Rate matrix */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>From \ To</th>
                  {CURRENCIES.map((c) => (
                    <th key={c}>{CURRENCY_FLAGS[c]} {c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CURRENCIES.map((from) => (
                  <tr key={from}>
                    <td style={{ fontWeight: 700 }}>{CURRENCY_FLAGS[from]} {from}</td>
                    {CURRENCIES.map((to) => {
                      const r = rateMatrix[from][to];
                      return (
                        <td key={to} style={{ fontFamily: 'monospace', fontWeight: from === to ? 400 : 600 }}>
                          {from === to ? (
                            <span style={{ color: 'var(--color-text-light)' }}>—</span>
                          ) : r !== null ? (
                            <span className="fx-rate-value">{r.toFixed(4)}</span>
                          ) : (
                            <span style={{ color: 'var(--color-text-light)' }}>N/A</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rates.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div className="card-title" style={{ marginBottom: '10px' }}>Rate Details</div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Pair</th>
                      <th>Rate</th>
                      <th>Provider</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={r.fx_rate_id}>
                        <td>
                          <span className="fx-pair">
                            {CURRENCY_FLAGS[r.currency_from]}{r.currency_from} / {CURRENCY_FLAGS[r.currency_to]}{r.currency_to}
                          </span>
                        </td>
                        <td><span className="fx-rate-value">{r.rate.toFixed(4)}</span></td>
                        <td><span className="badge badge-info">{r.provider}</span></td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{formatDate(r.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
              No rate data available.
            </div>
          )}
        </div>

        {/* Convert Form */}
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <div className="card-title">Convert Currency</div>
            </div>

            {convertMsg && (
              <div className={`alert alert-${convertMsg.type === 'success' ? 'success' : 'danger'}`}>
                {convertMsg.text}
              </div>
            )}

            <form onSubmit={handleConvert}>
              <div className="form-group">
                <label className="form-label">Source Wallet</label>
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

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">From</label>
                  <select
                    className="form-control"
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{CURRENCY_FLAGS[c]} {c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">To</label>
                  <select
                    className="form-control"
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{CURRENCY_FLAGS[c]} {c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Amount ({fromCurrency})</label>
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

              {preview !== null && (
                <div className="fx-convert-result">
                  ≈ {CURRENCY_SYMBOLS[toCurrency] ?? toCurrency}{preview.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {toCurrency}
                  {getRate(fromCurrency, toCurrency) && (
                    <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '4px', fontWeight: 400 }}>
                      Rate: 1 {fromCurrency} = {getRate(fromCurrency, toCurrency)!.toFixed(4)} {toCurrency}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={converting || wallets.length === 0}
                style={{ marginTop: '12px' }}
              >
                {converting ? <LoadingSpinner size="sm" /> : '💱 Convert Now'}
              </button>
            </form>
          </div>

          {/* Quick rates reference */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '12px' }}>Popular Pairs</div>
            {(['USD/KES', 'EUR/USD', 'GBP/USD', 'EUR/KES'] as const).map((pair) => {
              const [from, to] = pair.split('/');
              const r = getRate(from, to);
              return (
                <div className="info-row" key={pair}>
                  <span className="info-row-label">
                    {CURRENCY_FLAGS[from]}{from} → {CURRENCY_FLAGS[to]}{to}
                  </span>
                  <span className="info-row-value" style={{ fontFamily: 'monospace' }}>
                    {r !== null ? r.toFixed(4) : 'N/A'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default FXExchange;
