import React, { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const ACCOUNT_TYPES = [
  { value: 'freelancer',  label: '👨‍💻 Freelancer',             desc: 'Remote worker earning USD/EUR/GBP' },
  { value: 'sme',         label: '🏢 SME / Business',          desc: 'Small or medium-sized business' },
  { value: 'exporter',    label: '📦 Exporter',                desc: 'Exporting goods and receiving foreign currency' },
  { value: 'ecommerce',   label: '🛒 E-Commerce Seller',       desc: 'Selling on Amazon, Shopify, etc.' },
  { value: 'ngo',         label: '🌍 NGO / Non-profit',        desc: 'Receiving international grants' },
  { value: 'startup',     label: '🚀 Startup / Tech Agency',   desc: 'Tech agency billing global clients' },
  { value: 'individual',  label: '👤 Individual',              desc: 'Personal use' },
];

const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accountType, setAccountType] = useState('individual');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName || !email || !password) {
      setError('Full name, email, and password are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(fullName, email, phone, password, accountType);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <div className="auth-logo-icon">🌍</div>
          <h1>WekezaGlobal</h1>
          <p>Infrastructure Platform</p>
        </div>

        <div className="auth-card">
          <h2>Create an account</h2>
          <p className="auth-subtitle">Start managing your finances globally</p>

          {error && <div className="alert alert-danger">⚠️ {error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            {/* Account type selector */}
            <div className="form-group">
              <label className="form-label">I am a…</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.25rem' }}>
                {ACCOUNT_TYPES.map(({ value, label, desc }) => (
                  <label
                    key={value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.6rem 0.75rem',
                      border: `2px solid ${accountType === value ? '#4F46E5' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: accountType === value ? '#EEF2FF' : 'white',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="account_type"
                      value={value}
                      checked={accountType === value}
                      onChange={() => setAccountType(value)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="full_name">Full Name</label>
              <input
                id="full_name"
                type="text"
                className="form-control"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="phone">Phone (optional)</label>
                <input
                  id="phone"
                  type="tel"
                  className="form-control"
                  placeholder="+254 700 000 000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirm">Confirm Password</label>
                <input
                  id="confirm"
                  type="password"
                  className="form-control"
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
              style={{ marginTop: '8px' }}
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
