/**
 * Developer Analytics — API Usage Dashboard
 *
 * Shows developers:
 *  - Per-key API usage (rolling 1-hour request counts from Redis)
 *  - Webhook statistics
 *  - Event stream counts
 *  - Recent banking events
 *  - API Changelog
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

interface KeyUsage {
  api_key_id:  string;
  name:        string | null;
  status:      string;
  usage_count: number;
  created_at:  string;
}

interface AnalyticsData {
  api_keys: {
    total:  number;
    active: number;
    keys:   KeyUsage[];
  };
  requests: {
    total_in_window: number;
    window:          string;
  };
  webhooks: {
    total:  number;
    active: number;
  };
  events: {
    total_dispatched: number;
    dispatched_today: number;
  };
}

interface StreamEvent {
  event_id:  string;
  type:      string;
  title:     string;
  message:   string;
  metadata:  Record<string, unknown>;
  timestamp: string;
}

interface ChangelogEntry {
  version: string;
  date:    string;
  type:    'feature' | 'fix' | 'release' | 'deprecation';
  changes: string[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TYPE_COLORS: Record<string, string> = {
  feature:     'badge-success',
  fix:         'badge-warning',
  release:     'badge-info',
  deprecation: 'badge-danger',
};

const DeveloperAnalytics: React.FC = () => {
  const [analytics, setAnalytics]   = useState<AnalyticsData | null>(null);
  const [events, setEvents]         = useState<StreamEvent[]>([]);
  const [changelog, setChangelog]   = useState<ChangelogEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [activeTab, setActiveTab]   = useState<'overview' | 'events' | 'changelog'>('overview');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsRes, eventsRes, changelogRes] = await Promise.all([
        apiClient.get<AnalyticsData>('/v1/developer/analytics'),
        apiClient.get<{ events: StreamEvent[] }>('/v1/developer/events?limit=20'),
        apiClient.get<{ changelog: ChangelogEntry[] }>('/v1/developer/changelog'),
      ]);
      setAnalytics(analyticsRes.data);
      setEvents(eventsRes.data.events ?? []);
      setChangelog(changelogRes.data.changelog ?? []);
    } catch {
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>📊 Developer Analytics</h1>
          <p>Monitor your API usage, event stream, and platform releases.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchAll}>🔄 Refresh</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Stats row */}
      {analytics && (
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card">
            <div className="stat-card-icon blue">🔑</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Active API Keys</div>
              <div className="stat-card-value">{analytics.api_keys.active}</div>
              <div className="stat-card-sub">{analytics.api_keys.total} total</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon green">📡</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Requests (1h)</div>
              <div className="stat-card-value">{analytics.requests.total_in_window}</div>
              <div className="stat-card-sub">{analytics.requests.window}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon yellow">🔗</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Active Webhooks</div>
              <div className="stat-card-value">{analytics.webhooks.active}</div>
              <div className="stat-card-sub">{analytics.webhooks.total} registered</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon purple">⚡</div>
            <div className="stat-card-body">
              <div className="stat-card-label">Events Today</div>
              <div className="stat-card-value">{analytics.events.dispatched_today}</div>
              <div className="stat-card-sub">{analytics.events.total_dispatched} total</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid var(--color-border)', paddingBottom: '0' }}>
        {(['overview', 'events', 'changelog'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 20px', fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-2px', fontSize: '14px', textTransform: 'capitalize',
            }}
          >
            {tab === 'overview' ? '📈 Per-Key Usage' : tab === 'events' ? '⚡ Event Stream' : '📝 Changelog'}
          </button>
        ))}
      </div>

      {/* Overview Tab — Per-key usage */}
      {activeTab === 'overview' && analytics && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">API Key Usage</div>
              <div className="card-subtitle">Rolling 1-hour request counts (tracked in Redis)</div>
            </div>
            <Link to="/api-keys" className="btn btn-primary btn-sm">+ New Key</Link>
          </div>

          {analytics.api_keys.keys.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔑</div>
              <p>No API keys yet.</p>
              <Link to="/api-keys" className="btn btn-primary" style={{ marginTop: '12px', display: 'inline-block' }}>
                Create your first API key
              </Link>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Key Name</th>
                      <th>Status</th>
                      <th>Requests (1h)</th>
                      <th>Usage Bar</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.api_keys.keys.map((k) => {
                      const maxUsage = Math.max(...analytics.api_keys.keys.map((x) => x.usage_count), 1);
                      const pct = Math.round((k.usage_count / maxUsage) * 100);
                      return (
                        <tr key={k.api_key_id}>
                          <td style={{ fontWeight: 600 }}>{k.name ?? <em style={{ color: 'var(--color-text-muted)' }}>Unnamed</em>}</td>
                          <td>
                            <span className={k.status === 'active' ? 'badge badge-success' : 'badge badge-danger'}>
                              {k.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: k.usage_count > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                            {k.usage_count}
                          </td>
                          <td style={{ minWidth: '120px' }}>
                            <div
                              style={{
                                height: '8px', background: 'var(--color-border)',
                                borderRadius: 'var(--radius-full)', overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%', width: `${pct}%`,
                                  background: k.status === 'active' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  borderRadius: 'var(--radius-full)',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          </td>
                          <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                            {formatDate(k.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="alert alert-info" style={{ margin: '16px 4px 4px', fontSize: '12px' }}>
                <strong>💡 Note:</strong> Usage counts reflect the rolling 1-hour window tracked in Redis per API key.
                Counts reset to 0 if the server restarts or Redis is unavailable.
              </div>
            </>
          )}
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Events</div>
              <div className="card-subtitle">Latest {events.length} banking events for your account</div>
            </div>
          </div>

          {events.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚡</div>
              <p>No events yet.</p>
              <p style={{ fontSize: '12px', marginTop: '8px' }}>
                Register a <Link to="/webhooks">webhook</Link> to start receiving banking events.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Message</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.event_id}>
                      <td>
                        <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {ev.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '13px' }}>{ev.title}</td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{ev.message}</td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                        {formatDate(ev.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Changelog Tab */}
      {activeTab === 'changelog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {changelog.map((entry) => (
            <div
              key={entry.version}
              className="card"
              style={{ borderLeft: '4px solid var(--color-primary)' }}
            >
              <div className="card-header" style={{ paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 800, fontSize: '18px' }}>v{entry.version}</span>
                  <span className={`badge ${TYPE_COLORS[entry.type] ?? 'badge-default'}`}>
                    {entry.type}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{entry.date}</span>
                </div>
              </div>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {entry.changes.map((change, i) => (
                  <li key={i} style={{ marginBottom: '4px', fontSize: '13px', color: 'var(--color-text)' }}>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default DeveloperAnalytics;
