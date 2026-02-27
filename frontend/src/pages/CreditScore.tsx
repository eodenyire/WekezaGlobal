import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CreditScore as CreditScoreType } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

function getScoreCategory(score: number): { label: string; color: string; class: string } {
  if (score >= 750) return { label: 'Excellent', color: 'var(--color-success)', class: 'excellent' };
  if (score >= 670) return { label: 'Good',      color: '#4caf50',               class: 'good' };
  if (score >= 580) return { label: 'Fair',      color: 'var(--color-warning)',  class: 'fair' };
  return               { label: 'Poor',      color: 'var(--color-danger)',   class: 'poor' };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

const FACTOR_LABELS: Record<string, string> = {
  payment_history:     'Payment History',
  credit_utilization:  'Credit Utilization',
  account_age:         'Account Age',
  transaction_volume:  'Transaction Volume',
  kyc_status:          'KYC Compliance',
  wallet_diversity:    'Wallet Diversity',
};

const CreditScore: React.FC = () => {
  const { user } = useAuth();
  const [creditScore, setCreditScore] = useState<CreditScoreType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState('');

  const fetchScore = async () => {
    if (!user?.user_id) { setLoading(false); return; }
    try {
      const res = await apiClient.get<CreditScoreType>(`/v1/credit/${user.user_id}`);
      setCreditScore(res.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setCreditScore(null);
        setError('');
      } else {
        setError('Failed to load credit score.');
      }
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchScore(); }, [user?.user_id]);

  const handleRecalculate = async () => {
    setRecalcMsg('');
    setRecalculating(true);
    try {
      await apiClient.post(`/v1/credit/${user?.user_id}/recalculate`);
      setRecalcMsg('Credit score recalculated successfully!');
      await fetchScore();
    } catch {
      setRecalcMsg('Recalculation failed. Please try again later.');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const category = creditScore ? getScoreCategory(creditScore.score) : null;
  const scorePercent = creditScore ? ((creditScore.score - 300) / (850 - 300)) * 100 : 0;

  const factorEntries = creditScore
    ? Object.entries(creditScore.factors).map(([key, value]) => ({
        key,
        label: FACTOR_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value: typeof value === 'number' ? value : 50,
      }))
    : [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Credit Score</h1>
          <p>Your financial health indicator on WekezaGlobal</p>
        </div>
        <button className="btn btn-primary" onClick={handleRecalculate} disabled={recalculating}>
          {recalculating ? <LoadingSpinner size="sm" /> : '🔄 Recalculate'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {recalcMsg && (
        <div className={`alert ${recalcMsg.includes('success') ? 'alert-success' : 'alert-danger'}`}>
          {recalcMsg}
        </div>
      )}

      {!creditScore ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <h3 style={{ marginBottom: '8px' }}>No Credit Score Yet</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>
            Your credit score is calculated based on your transaction history, KYC status,
            and account activity. Complete your KYC and make transactions to generate a score.
          </p>
          <button className="btn btn-primary" onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? <LoadingSpinner size="sm" /> : '📊 Calculate My Score'}
          </button>
        </div>
      ) : (
        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Score display */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Your Credit Score</div>
            </div>
            <div className="score-display">
              <div className={`score-circle ${category!.class}`}>
                <div className="score-number">{creditScore.score}</div>
                <div className="score-label" style={{ color: category!.color }}>
                  {category!.label}
                </div>
              </div>
              <div className="score-range">Score range: 300 – 850</div>

              {/* Score bar */}
              <div style={{ margin: '20px 0 8px', background: 'linear-gradient(to right, #f44336, #ffc107, #4caf50)', borderRadius: '99px', height: '10px', position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: `calc(${scorePercent}% - 8px)`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '16px',
                  height: '16px',
                  background: '#fff',
                  border: `3px solid ${category!.color}`,
                  borderRadius: '50%',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <span>300 (Poor)</span>
                <span>580 (Fair)</span>
                <span>670 (Good)</span>
                <span>850 (Excellent)</span>
              </div>
            </div>

            <hr className="divider" />

            <div className="info-row">
              <span className="info-row-label">Score ID</span>
              <code style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {creditScore.credit_score_id.slice(0, 12)}…
              </code>
            </div>
            <div className="info-row">
              <span className="info-row-label">User</span>
              <span className="info-row-value">{user?.full_name}</span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Last Updated</span>
              <span className="info-row-value">{formatDate(creditScore.last_updated)}</span>
            </div>
          </div>

          {/* Score factors */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Score Factors</div>
              <div className="card-subtitle">What influences your score</div>
            </div>

            {factorEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                No factor breakdown available.
              </div>
            ) : (
              factorEntries.map((f) => {
                const pct = Math.min(100, Math.max(0, typeof f.value === 'number' ? f.value : 50));
                const color = pct >= 70 ? 'var(--color-success)' : pct >= 40 ? 'var(--color-warning)' : 'var(--color-danger)';
                return (
                  <div key={f.key} className="score-factor">
                    <span className="score-factor-name">{f.label}</span>
                    <div className="score-factor-bar">
                      <div
                        className="score-factor-fill"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <span className="score-factor-value">{pct}%</span>
                  </div>
                );
              })
            )}

            <div className="alert alert-info" style={{ marginTop: '16px' }}>
              💡 <strong>Tip:</strong> Complete your KYC, maintain sufficient wallet balances, and make regular transactions to improve your credit score.
            </div>
          </div>
        </div>
      )}

      {/* Score range guide */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Credit Score Guide</div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Range</th>
                <th>Category</th>
                <th>Meaning</th>
                <th>Benefits</th>
              </tr>
            </thead>
            <tbody>
              {[
                { range: '750 – 850', category: 'Excellent', color: 'var(--color-success)', meaning: 'Outstanding financial health', benefits: 'Premium rates, higher limits, all features' },
                { range: '670 – 749', category: 'Good',      color: '#4caf50',              meaning: 'Above-average reliability',    benefits: 'Competitive rates, standard limits' },
                { range: '580 – 669', category: 'Fair',      color: 'var(--color-warning)', meaning: 'Some financial risk factors',  benefits: 'Basic features, limited credit' },
                { range: '300 – 579', category: 'Poor',      color: 'var(--color-danger)',  meaning: 'High financial risk',          benefits: 'Restricted access, higher fees' },
              ].map((row) => (
                <tr key={row.range}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.range}</td>
                  <td><span className="badge" style={{ background: `${row.color}20`, color: row.color }}>{row.category}</span></td>
                  <td style={{ fontSize: '12px' }}>{row.meaning}</td>
                  <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{row.benefits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default CreditScore;
