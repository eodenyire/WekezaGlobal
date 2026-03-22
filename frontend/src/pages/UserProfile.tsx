/**
 * UserProfile — Allows any authenticated developer to view and update
 * their own profile information (name, phone, account type).
 *
 * Calls:
 *   GET  /auth/me          — load current profile
 *   PUT  /auth/me          — save profile changes
 */
import React, { useEffect, useState, FormEvent } from 'react';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { User, AccountType } from '../types';

const ACCOUNT_TYPES: AccountType[] = [
  'individual', 'freelancer', 'sme', 'exporter', 'ecommerce', 'ngo', 'startup',
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

const kycBadge = (status: string) => {
  if (status === 'verified') return <span className="badge badge-success">✅ Verified</span>;
  if (status === 'rejected') return <span className="badge badge-danger">❌ Rejected</span>;
  return <span className="badge badge-warning">⏳ Pending</span>;
};

const UserProfile: React.FC = () => {
  const { updateUser } = useAuth();

  const [profile, setProfile]   = useState<User | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Edit form state
  const [fullName, setFullName]         = useState('');
  const [phone, setPhone]               = useState('');
  const [accountType, setAccountType]   = useState<AccountType>('individual');
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadProfile = async () => {
    try {
      const res = await apiClient.get<User>('/auth/me');
      setProfile(res.data);
      setFullName(res.data.full_name);
      setPhone(res.data.phone_number ?? '');
      setAccountType(res.data.account_type ?? 'individual');
    } catch {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaveMsg(null);
    if (!fullName.trim()) {
      setSaveMsg({ type: 'error', text: 'Full name is required.' });
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.put<User>('/auth/me', {
        full_name:    fullName.trim(),
        phone_number: phone.trim() || undefined,
        account_type: accountType,
      });
      setProfile(res.data);
      updateUser({
        full_name:    res.data.full_name,
        phone_number: res.data.phone_number,
        account_type: res.data.account_type,
      });
      setSaveMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to save changes.';
      setSaveMsg({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My Profile</h1>
          <p>View and manage your developer account information</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {profile && (
        <>
          {/* ── Read-only account summary ─────────────────────────────── */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <div className="card-title">Account Summary</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>User ID</div>
                <code style={{ fontSize: '12px' }}>{profile.user_id}</code>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Email</div>
                <strong>{profile.email}</strong>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Role</div>
                <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{profile.role}</span>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>KYC Status</div>
                {kycBadge(profile.kyc_status)}
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Member Since</div>
                <span>{formatDate(profile.created_at)}</span>
              </div>
            </div>
          </div>

          {/* ── Editable fields ───────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Edit Profile</div>
            </div>

            {saveMsg && (
              <div className={`alert alert-${saveMsg.type === 'success' ? 'success' : 'danger'}`}>
                {saveMsg.text}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Full Name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={120}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="+254700000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={30}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={profile.email}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <small style={{ color: 'var(--color-text-muted)' }}>Email cannot be changed.</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Account Type</label>
                  <select
                    className="form-control"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as AccountType)}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t} style={{ textTransform: 'capitalize' }}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <LoadingSpinner size="sm" /> : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Quick links ───────────────────────────────────────────── */}
          <div className="card" style={{ marginTop: '24px' }}>
            <div className="card-header">
              <div className="card-title">Quick Links</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '4px 0' }}>
              <a className="btn btn-secondary" href="/api-keys">🔑 Manage API Keys</a>
              <a className="btn btn-secondary" href="/kyc">📋 KYC Verification</a>
              <a className="btn btn-secondary" href="/notifications">🔔 Notifications</a>
              <a className="btn btn-secondary" href="/subscriptions">💎 Subscription</a>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default UserProfile;
