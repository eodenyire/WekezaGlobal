/**
 * Changelog — WekezaGlobal API Release History
 *
 * Shows the complete WGI API changelog pulled from the backend.
 * Developers can track which features and fixes were shipped in each release.
 */
import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

interface ChangelogEntry {
  version: string;
  date:    string;
  type:    'feature' | 'fix' | 'release' | 'deprecation';
  changes: string[];
}

const TYPE_LABELS: Record<string, string> = {
  feature:     '✨ Feature',
  fix:         '🐛 Fix',
  release:     '🚀 Release',
  deprecation: '⚠️ Deprecation',
};

const TYPE_COLORS: Record<string, string> = {
  feature:     'badge-success',
  fix:         'badge-warning',
  release:     'badge-info',
  deprecation: 'badge-danger',
};

const Changelog: React.FC = () => {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    apiClient
      .get<{ changelog: ChangelogEntry[] }>('/v1/developer/changelog')
      .then((r) => setChangelog(r.data.changelog ?? []))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load changelog.';
        setError(msg);
        if (process.env.NODE_ENV === 'development') console.error('[Changelog]', msg);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>📝 API Changelog</h1>
          <p>WekezaGlobal Infrastructure (WGI) release history and API updates.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Summary badges */}
      {changelog.length > 0 && (
        <div className="alert alert-info" style={{ marginBottom: '24px' }}>
          <strong>Latest release:</strong> v{changelog[0].version} — {changelog[0].date}
          &nbsp;·&nbsp;
          {changelog.length} total releases
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {changelog.map((entry, idx) => (
          <div
            key={entry.version}
            className="card"
            style={{
              borderLeft: `4px solid ${idx === 0 ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
          >
            <div className="card-header" style={{ paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '20px', color: 'var(--color-text)' }}>
                  v{entry.version}
                </span>
                {idx === 0 && (
                  <span className="badge badge-success" style={{ fontSize: '11px' }}>Latest</span>
                )}
                <span className={`badge ${TYPE_COLORS[entry.type] ?? 'badge-default'}`}>
                  {TYPE_LABELS[entry.type] ?? entry.type}
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  📅 {entry.date}
                </span>
              </div>
            </div>
            <ul style={{ paddingLeft: '20px', margin: '0 0 4px 0' }}>
              {entry.changes.map((change, i) => (
                <li
                  key={i}
                  style={{ marginBottom: '6px', fontSize: '13px', lineHeight: 1.6 }}
                >
                  {change}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
};

export default Changelog;
