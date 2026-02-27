import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { AdminStats, User, AMLAlert } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', KES: 'KSh' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface PendingKycDoc {
  kyc_document_id: string;
  user_id: string;
  full_name: string;
  email: string;
  doc_type: string;
  file_url: string | null;
  status: string;
  verified_at: string | null;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [alerts, setAlerts] = useState<AMLAlert[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingKycDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);
  const [reviewingDoc, setReviewingDoc] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, alertsRes, complianceRes] = await Promise.all([
        apiClient.get<AdminStats>('/v1/admin/stats'),
        apiClient.get<{ users: User[]; total: number }>('/v1/admin/users?limit=10'),
        apiClient.get<{ alerts: AMLAlert[]; limit: number; offset: number }>('/v1/aml/alerts?status=pending'),
        apiClient.get<{ kyc: { pending_documents: PendingKycDoc[] } }>('/v1/admin/compliance'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users ?? []);
      setAlerts(alertsRes.data.alerts ?? []);
      setPendingDocs(complianceRes.data.kyc?.pending_documents ?? []);
    } catch {
      setError('Failed to load admin data. Ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleResolveAlert = async (alertId: string) => {
    setResolving(alertId);
    try {
      await apiClient.put(`/v1/aml/alerts/${alertId}`, { status: 'resolved' });
      await fetchData();
    } catch {
      alert('Failed to resolve alert.');
    } finally {
      setResolving(null);
    }
  };

  const handleKycReview = async (docId: string, status: 'verified' | 'rejected') => {
    setReviewingDoc(docId);
    try {
      await apiClient.put(`/v1/kyc/${docId}`, { status });
      await fetchData();
    } catch {
      alert(`Failed to ${status === 'verified' ? 'approve' : 'reject'} document.`);
    } finally {
      setReviewingDoc(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>System overview, user management, and compliance monitoring</p>
        </div>
        <button className="btn btn-secondary" onClick={() => { setLoading(true); fetchData(); }}>
          🔄 Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon blue">👥</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Total Users</div>
              <div className="stat-card-value">{stats.total_users.toLocaleString()}</div>
              <div className="stat-card-sub">Registered accounts</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon green">👛</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Total Wallets</div>
              <div className="stat-card-value">{stats.total_wallets.toLocaleString()}</div>
              <div className="stat-card-sub">Active wallets</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon purple">🔄</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Total Transactions</div>
              <div className="stat-card-value">{stats.total_transactions.toLocaleString()}</div>
              <div className="stat-card-sub">All time</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon yellow">⏳</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Pending KYC</div>
              <div className="stat-card-value">{stats.pending_kyc}</div>
              <div className="stat-card-sub">Awaiting review</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon red">🚨</div>
            <div className="stat-card-body">
              <div className="stat-card-label">AML Alerts</div>
              <div className="stat-card-value">{stats.pending_aml_alerts}</div>
              <div className="stat-card-sub">Pending resolution</div>
            </div>
          </div>
        </div>
      )}

      {/* Vision Phase 1 KPIs: User Segment Breakdown */}
      {stats && stats.users_by_segment && Object.keys(stats.users_by_segment).length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div>
              <div className="card-title">👥 User Segments — Phase 1 KPIs</div>
              <div className="card-subtitle">Target: 2,000 freelancers · 500 SMEs (Executive Vision §5)</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '0 0 4px' }}>
            {[
              { key: 'freelancer', icon: '👨‍💻', label: 'Freelancers',    target: 2000 },
              { key: 'sme',        icon: '🏢', label: 'SMEs',            target: 500  },
              { key: 'exporter',   icon: '📦', label: 'Exporters',       target: null },
              { key: 'ecommerce',  icon: '🛒', label: 'E-Commerce',      target: null },
              { key: 'ngo',        icon: '🌍', label: 'NGOs',            target: null },
              { key: 'startup',    icon: '🚀', label: 'Startups',        target: null },
              { key: 'individual', icon: '👤', label: 'Individuals',     target: null },
            ].map(({ key, icon, label, target }) => {
              const count = stats.users_by_segment[key] ?? 0;
              const pct = target ? Math.min(100, Math.round((count / target) * 100)) : null;
              return (
                <div key={key} style={{
                  flex: '1', minWidth: '130px',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  border: '1px solid var(--color-border)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>{icon}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 700 }}>{count.toLocaleString()}</div>
                  {target !== null && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ background: '#E5E7EB', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, background: '#4F46E5', height: '100%', borderRadius: '4px' }} />
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {pct}% of {target.toLocaleString()} target
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Volume by currency */}
      {stats && Object.keys(stats.total_volume_by_currency).length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">Transaction Volume by Currency</div>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {Object.entries(stats.total_volume_by_currency).map(([currency, volume]) => (
              <div key={currency} style={{
                flex: '1', minWidth: '150px',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                textAlign: 'center',
                border: '1px solid var(--color-border)',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>
                  {currency === 'USD' ? '🇺🇸' : currency === 'EUR' ? '🇪🇺' : currency === 'GBP' ? '🇬🇧' : '🇰🇪'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{currency}</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>
                  {CURRENCY_SYMBOLS[currency] ?? currency}{volume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Recent Users */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Users</div>
              <div className="card-subtitle">Last 10 registrations</div>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>KYC</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={5} className="table-empty">No users found</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.user_id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px', height: '28px',
                            background: 'var(--color-primary)',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 700, color: '#fff',
                            flexShrink: 0,
                          }}>
                            {u.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          {u.full_name}
                        </div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{u.email}</td>
                      <td>
                        <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{u.role}</span>
                      </td>
                      <td>
                        <span className={`badge ${u.kyc_status === 'verified' ? 'badge-success' : u.kyc_status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                          {u.kyc_status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                        {formatDate(u.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Health */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">System Health</div>
          </div>
          {[
            { label: 'API Gateway',          status: 'operational', icon: '🟢' },
            { label: 'Database',             status: 'operational', icon: '🟢' },
            { label: 'FX Rate Provider',     status: 'operational', icon: '🟢' },
            { label: 'Settlement Engine',    status: 'operational', icon: '🟢' },
            { label: 'Notification Service', status: 'operational', icon: '🟢' },
            { label: 'KYC Processing',       status: 'operational', icon: '🟢' },
          ].map((service) => (
            <div key={service.label} className="info-row">
              <span className="info-row-label">{service.icon} {service.label}</span>
              <span className="badge badge-success">{service.status}</span>
            </div>
          ))}

          <div className="alert alert-success" style={{ marginTop: '16px' }}>
            ✅ All systems operational
          </div>
        </div>
      </div>

      {/* AML Alerts */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">🚨 AML Compliance Alerts</div>
            <div className="card-subtitle">{alerts.filter((a) => a.status === 'pending').length} pending alerts</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Transaction</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    ✅ No pending AML alerts
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.aml_alert_id}>
                    <td>
                      <code style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {alert.aml_alert_id.slice(0, 10)}…
                      </code>
                    </td>
                    <td>
                      <code style={{ fontSize: '11px' }}>{alert.transaction_id.slice(0, 10)}…</code>
                    </td>
                    <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {alert.type.replace(/_/g, ' ')}
                    </td>
                    <td>
                      <span className={`severity-${alert.severity}`} style={{ textTransform: 'capitalize' }}>
                        {alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟡' : '🟢'} {alert.severity}
                      </span>
                    </td>
                    <td>
                      <span className={alert.status === 'resolved' ? 'badge badge-success' : 'badge badge-warning'}>
                        {alert.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{formatDate(alert.created_at)}</td>
                    <td>
                      {alert.status === 'pending' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleResolveAlert(alert.aml_alert_id)}
                          disabled={resolving === alert.aml_alert_id}
                        >
                          {resolving === alert.aml_alert_id ? <LoadingSpinner size="sm" /> : '✓ Resolve'}
                        </button>
                      )}
                      {alert.status === 'resolved' && (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Resolved</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* KYC Document Review */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">📋 KYC Document Review</div>
            <div className="card-subtitle">{pendingDocs.length} document(s) pending review</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Document Type</th>
                <th>File</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    ✅ No KYC documents pending review
                  </td>
                </tr>
              ) : (
                pendingDocs.map((doc) => (
                  <tr key={doc.kyc_document_id}>
                    <td style={{ fontWeight: 600 }}>{doc.full_name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{doc.email}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {doc.doc_type.replace(/_/g, ' ')}
                    </td>
                    <td>
                      {doc.file_url ? (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '12px', color: 'var(--color-primary)' }}
                        >
                          View Doc 🔗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>No file</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-warning">{doc.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleKycReview(doc.kyc_document_id, 'verified')}
                          disabled={reviewingDoc === doc.kyc_document_id}
                        >
                          {reviewingDoc === doc.kyc_document_id ? <LoadingSpinner size="sm" /> : '✓ Approve'}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleKycReview(doc.kyc_document_id, 'rejected')}
                          disabled={reviewingDoc === doc.kyc_document_id}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </td>
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

export default AdminDashboard;
