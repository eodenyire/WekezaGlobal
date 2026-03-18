/**
 * Platform Overview — Visual showcase of all WekezaGlobal modules.
 *
 * Provides a comprehensive tour of every feature area on the platform:
 *   - Core banking (wallets, FX, settlements, cards)
 *   - Identity (KYC, credit score)
 *   - Developer ecosystem (API keys, webhooks, sandbox, developer portal)
 *   - Administration (admin dashboard, developer management)
 *   - Integrations & compliance
 *
 * This page acts as a single-pane-of-glass reference for stakeholders,
 * new users and developers onboarding to the platform.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Module Catalogue ─────────────────────────────────────────────────────────

interface Module {
  id: string;
  icon: string;
  label: string;
  category: string;
  path: string;
  color: string;
  description: string;
  features: string[];
  apiEndpoints?: string[];
  status: 'live' | 'sandbox' | 'admin';
}

const MODULES: Module[] = [
  // ── Core Banking ────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    icon: '🏠',
    label: 'Dashboard',
    category: 'Core Banking',
    path: '/dashboard',
    color: '#2563eb',
    description:
      'Real-time financial overview for every account holder — wallet balances in USD equivalent, recent transactions, live FX rates, and KYC status at a glance.',
    features: [
      'Multi-wallet balance aggregation (USD/EUR/GBP/KES)',
      'Live FX rate ticker',
      'Recent 5 transactions summary',
      'KYC status indicator',
      'Quick-action cards',
    ],
    apiEndpoints: ['GET /v1/wallets', 'GET /v1/transactions', 'GET /v1/fx/rates'],
    status: 'live',
  },
  {
    id: 'wallets',
    icon: '👛',
    label: 'Multi-Currency Wallets',
    category: 'Core Banking',
    path: '/wallets',
    color: '#0891b2',
    description:
      'Manage USD, EUR, GBP and KES wallets. Deposit, withdraw, and transfer funds between wallets. Full transaction ledger with pagination.',
    features: [
      'Create wallets in 4 currencies',
      'Deposit & withdraw funds',
      'Wallet-to-wallet transfers',
      'Per-wallet transaction history',
      'Balance with 2-decimal precision',
    ],
    apiEndpoints: ['GET /v1/wallets', 'POST /v1/wallets', 'POST /v1/wallets/:id/deposit'],
    status: 'live',
  },
  {
    id: 'fx',
    icon: '💱',
    label: 'FX Exchange',
    category: 'Core Banking',
    path: '/fx',
    color: '#7c3aed',
    description:
      'Real-time multi-currency exchange powered by live rate feeds. Get quotes, convert currencies, and track your FX transaction history.',
    features: [
      'Live FX rates across 4 currencies',
      'Instant quote before conversion',
      'Conversion with fee breakdown',
      'FX transaction history',
      'Cross-currency rate matrix',
    ],
    apiEndpoints: ['GET /v1/fx/rates', 'POST /v1/fx/quote', 'POST /v1/fx/convert'],
    status: 'live',
  },
  {
    id: 'settlements',
    icon: '🏦',
    label: 'Settlements',
    category: 'Core Banking',
    path: '/settlements',
    color: '#059669',
    description:
      'Initiate and track settlements to partner banks. Multi-bank redundancy with idempotency keys, failure handling and real-time status updates.',
    features: [
      'Initiate bank settlements',
      'Idempotency-safe requests',
      'Multi-bank routing',
      'Settlement status tracking',
      'Failure reason display',
    ],
    apiEndpoints: ['GET /v1/settlements', 'POST /v1/settlements'],
    status: 'live',
  },
  {
    id: 'cards',
    icon: '💳',
    label: 'Cards',
    category: 'Core Banking',
    path: '/cards',
    color: '#dc2626',
    description:
      'Issue virtual and physical payment cards linked to wallets. Set spending limits, block/unblock cards, and view card transaction history.',
    features: [
      'Virtual card issuance',
      'Physical card management',
      'Spending limits control',
      'Block / unblock cards',
      'Card transaction history',
    ],
    apiEndpoints: ['GET /v1/cards', 'POST /v1/cards', 'PUT /v1/cards/:id'],
    status: 'live',
  },
  {
    id: 'collection-accounts',
    icon: '🌍',
    label: 'Collection Accounts',
    category: 'Core Banking',
    path: '/collection-accounts',
    color: '#d97706',
    description:
      'Virtual collection accounts for receiving payments from global payers. Supports SWIFT, ACH, SEPA, M-Pesa and other payment rails.',
    features: [
      'Global payment rails support',
      'Per-currency account numbers',
      'SWIFT / IBAN / M-Pesa routing',
      'Incoming payment tracking',
      'Account reference codes',
    ],
    apiEndpoints: ['GET /v1/collection-accounts'],
    status: 'live',
  },

  // ── Identity & Compliance ────────────────────────────────────────────────
  {
    id: 'kyc',
    icon: '📋',
    label: 'KYC Verification',
    category: 'Identity & Compliance',
    path: '/kyc',
    color: '#0284c7',
    description:
      'Full Know-Your-Customer document submission and review workflow. Submit passport, national ID or driving licence; track verification status.',
    features: [
      'Document upload (ID, passport, licence)',
      'Verification status tracking',
      'Admin review workflow',
      'AML alert integration',
      'Auto-update on verification',
    ],
    apiEndpoints: ['GET /v1/kyc', 'POST /v1/kyc/submit', 'GET /v1/kyc/aml-alerts'],
    status: 'live',
  },
  {
    id: 'credit',
    icon: '📊',
    label: 'Credit Score',
    category: 'Identity & Compliance',
    path: '/credit',
    color: '#16a34a',
    description:
      'AI-generated credit intelligence — real-time credit score with contributing factors, historical score trend, and activity log.',
    features: [
      'Credit score (300–850 scale)',
      'Score breakdown by factor',
      'Historical trend chart',
      'Activity log (deltas)',
      'Refresh on-demand',
    ],
    apiEndpoints: ['GET /v1/credit-score', 'POST /v1/credit-score/refresh'],
    status: 'live',
  },

  // ── Developer Ecosystem ──────────────────────────────────────────────────
  {
    id: 'api-keys',
    icon: '🔑',
    label: 'API Keys',
    category: 'Developer Ecosystem',
    path: '/api-keys',
    color: '#9333ea',
    description:
      'Self-service API key management. Create named keys with custom scopes, view usage, revoke keys instantly. Keys authenticate all machine-to-machine API calls.',
    features: [
      'Create named API keys',
      'Scope restriction (read/write/admin)',
      'One-time raw key display',
      'Revocation with confirmation',
      'Key usage stats',
    ],
    apiEndpoints: ['GET /v1/api-keys', 'POST /v1/api-keys', 'DELETE /v1/api-keys/:id'],
    status: 'live',
  },
  {
    id: 'webhooks',
    icon: '🔗',
    label: 'Webhooks',
    category: 'Developer Ecosystem',
    path: '/webhooks',
    color: '#0e7490',
    description:
      'Subscribe to real-time banking events — deposits, settlements, FX completions and more. HMAC-signed payloads for security.',
    features: [
      'Event type subscriptions',
      'HMAC-SHA256 signatures',
      'Active / inactive toggle',
      'Delivery status tracking',
      'Webhook secret rotation',
    ],
    apiEndpoints: ['GET /v1/webhooks', 'POST /v1/webhooks', 'DELETE /v1/webhooks/:id'],
    status: 'live',
  },
  {
    id: 'developer',
    icon: '🚀',
    label: 'Developer Portal',
    category: 'Developer Ecosystem',
    path: '/developer',
    color: '#1d4ed8',
    description:
      'The entry point for platform developers — live stats, 4-step getting-started guide, API domain explorer, and direct links to all developer tools.',
    features: [
      'Getting-started guide',
      'API domain catalogue',
      'Live key & webhook stats',
      'OAuth2 token endpoint',
      'Links to Sandbox & Analytics',
    ],
    apiEndpoints: ['GET /v1/developer/analytics', 'GET /v1/developer/changelog'],
    status: 'live',
  },
  {
    id: 'sandbox',
    icon: '🧪',
    label: 'Sandbox Testing',
    category: 'Developer Ecosystem',
    path: '/sandbox',
    color: '#065f46',
    description:
      'Full sandbox environment mirroring production APIs — test accounts, deposits, FX, loans, cards and partner integrations without real money.',
    features: [
      'Sandbox core banking accounts',
      'Simulated deposits & transfers',
      'FX conversion testing',
      'Loan application & repayment',
      'PayPal, Stripe, Wise integrations',
    ],
    apiEndpoints: ['GET /v1/sandbox/health', 'POST /v1/sandbox/core-banking/accounts/open'],
    status: 'sandbox',
  },
  {
    id: 'analytics',
    icon: '📈',
    label: 'Developer Analytics',
    category: 'Developer Ecosystem',
    path: '/developer/analytics',
    color: '#7e22ce',
    description:
      'Real-time API usage analytics — request volume, error rates, latency distribution, and per-key breakdown. Live event stream.',
    features: [
      'Request volume (24h / 7d)',
      'Error rate by endpoint',
      'p95 / p99 latency',
      'Per-API-key usage table',
      'Live event stream',
    ],
    apiEndpoints: ['GET /v1/developer/analytics', 'GET /v1/developer/events'],
    status: 'live',
  },
  {
    id: 'changelog',
    icon: '📝',
    label: 'Changelog',
    category: 'Developer Ecosystem',
    path: '/developer/changelog',
    color: '#475569',
    description:
      'Versioned API changelog — every breaking change, new endpoint, deprecation and security patch across all API versions.',
    features: [
      'Versioned release notes',
      'Breaking change alerts',
      'New feature announcements',
      'Deprecation notices',
      'Full version history',
    ],
    apiEndpoints: ['GET /v1/developer/changelog'],
    status: 'live',
  },

  // ── Account Management ───────────────────────────────────────────────────
  {
    id: 'notifications',
    icon: '🔔',
    label: 'Notifications',
    category: 'Account Management',
    path: '/notifications',
    color: '#b45309',
    description:
      'In-app notification centre for platform events — transaction alerts, KYC updates, settlement confirmations, and system announcements.',
    features: [
      'Real-time notifications',
      'Mark as read individually',
      'Mark all as read',
      'Notification type badges',
      'Timestamp display',
    ],
    apiEndpoints: ['GET /v1/notifications', 'PATCH /v1/notifications/:id/read'],
    status: 'live',
  },
  {
    id: 'subscriptions',
    icon: '💎',
    label: 'Subscriptions',
    category: 'Account Management',
    path: '/subscriptions',
    color: '#a21caf',
    description:
      'Tiered subscription plans — Starter, Professional and Enterprise tiers with API rate limits, feature unlocks and billing management.',
    features: [
      'Starter / Pro / Enterprise tiers',
      'Feature comparison table',
      'One-click plan upgrade',
      'Subscription status tracking',
      'Cancellation flow',
    ],
    apiEndpoints: ['GET /v1/subscriptions/plans', 'POST /v1/subscriptions/subscribe'],
    status: 'live',
  },

  // ── Administration ───────────────────────────────────────────────────────
  {
    id: 'admin',
    icon: '⚙️',
    label: 'Admin Dashboard',
    category: 'Administration',
    path: '/admin',
    color: '#374151',
    description:
      'Platform-wide administration — user counts, transaction volumes by currency, pending KYC queue, AML compliance alerts, and key metrics from the Executive Proposal.',
    features: [
      'Platform KPIs & metrics',
      'User segment breakdown',
      'Volume by currency',
      'AML alert resolution',
      'KYC document review',
    ],
    apiEndpoints: ['GET /v1/admin/stats', 'GET /v1/admin/users', 'GET /v1/admin/kyc-documents'],
    status: 'admin',
  },
  {
    id: 'developer-management',
    icon: '👩‍💻',
    label: 'Developer Management',
    category: 'Administration',
    path: '/admin/developers',
    color: '#1e40af',
    description:
      'Admin-only developer lifecycle management — onboard individuals or bulk-create up to 100 developers, auto-provision API keys, update profiles and KYC status.',
    features: [
      'Search & paginate all developers',
      'Create single developer + API key',
      'Bulk-create up to 100 developers',
      'Profile edit (name, phone, type, KYC)',
      'API key create & revoke per developer',
    ],
    apiEndpoints: [
      'GET /v1/admin/developers',
      'POST /v1/admin/developers',
      'POST /v1/admin/developers/bulk',
    ],
    status: 'admin',
  },
];

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Core Banking',
  'Identity & Compliance',
  'Developer Ecosystem',
  'Account Management',
  'Administration',
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  live:    { label: '🟢 Live',    cls: 'badge badge-success' },
  sandbox: { label: '🧪 Sandbox', cls: 'badge badge-warning' },
  admin:   { label: '⚙️ Admin',   cls: 'badge badge-info'    },
};

// ── Platform Stats ────────────────────────────────────────────────────────────

const PLATFORM_STATS = [
  { icon: '🔌', value: '30+',  label: 'API Endpoints' },
  { icon: '💱', value: '4',    label: 'Currencies' },
  { icon: '🏦', value: '6',    label: 'Payment Rails' },
  { icon: '👥', value: '100+', label: 'Developer Accounts' },
  { icon: '🧪', value: '316',  label: 'Test Coverage' },
  { icon: '🔒', value: 'SOC2', label: 'Security Standard' },
];

// ── Component ─────────────────────────────────────────────────────────────────

const PlatformOverview: React.FC = () => {
  const { isAdmin } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);

  const visibleModules = MODULES.filter((m) => {
    if (m.status === 'admin' && !isAdmin) return false;
    if (activeCategory === 'All') return true;
    return m.category === activeCategory;
  });

  const categoryCounts = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = cat === 'All'
      ? MODULES.filter((m) => !(m.status === 'admin' && !isAdmin)).length
      : MODULES.filter((m) => m.category === cat && !(m.status === 'admin' && !isAdmin)).length;
    return acc;
  }, {});

  return (
    <>
      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a2744 0%, #2563eb 60%, #7c3aed 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '40px 36px',
        marginBottom: '28px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.7, marginBottom: '8px' }}>
            WekezaGlobal Infrastructure
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '10px', color: '#fff' }}>
            🌍 Platform Overview
          </h1>
          <p style={{ fontSize: '15px', opacity: 0.85, maxWidth: '620px', marginBottom: '24px', lineHeight: '1.6' }}>
            WekezaGlobal (WGI) is a developer-first cross-border payments and core banking
            infrastructure. Explore every module — from multi-currency wallets and live FX
            to KYC, cards, sandbox testing, and admin tooling.
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {PLATFORM_STATS.map((s) => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 18px',
                textAlign: 'center',
                backdropFilter: 'blur(4px)',
                minWidth: '80px',
              }}>
                <div style={{ fontSize: '18px', marginBottom: '2px' }}>{s.icon}</div>
                <div style={{ fontSize: '20px', fontWeight: 800 }}>{s.value}</div>
                <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative circles */}
        <div style={{ position: 'absolute', right: '-40px', top: '-40px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', right: '60px', bottom: '-60px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      </div>

      {/* ── Category filter tabs ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: activeCategory === cat ? 'none' : '1px solid var(--color-border)',
              background: activeCategory === cat ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeCategory === cat ? '#fff' : 'var(--color-text)',
              fontWeight: activeCategory === cat ? 700 : 400,
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.15s',
            }}
          >
            {cat} <span style={{ opacity: 0.65 }}>({categoryCounts[cat]})</span>
          </button>
        ))}
      </div>

      {/* ── Module cards grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}>
        {visibleModules.map((mod) => {
          const isOpen = expanded === mod.id;
          const badge = STATUS_BADGE[mod.status];
          return (
            <div
              key={mod.id}
              className="card"
              style={{
                cursor: 'pointer',
                borderTop: `3px solid ${mod.color}`,
                transition: 'box-shadow 0.15s',
                padding: 0,
              }}
              onClick={() => setExpanded(isOpen ? null : mod.id)}
            >
              {/* Card header */}
              <div style={{ padding: '18px 20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 'var(--radius-md)',
                      background: `${mod.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '22px', flexShrink: 0,
                    }}>
                      {mod.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{mod.label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{mod.category}</div>
                    </div>
                  </div>
                  <span className={badge.cls} style={{ fontSize: '10px', flexShrink: 0 }}>{badge.label}</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: '1.55', marginBottom: '12px' }}>
                  {mod.description}
                </p>
              </div>

              {/* Feature list — collapsed */}
              {!isOpen && (
                <div style={{ padding: '0 20px 14px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
                    {mod.features.slice(0, 3).map((f) => (
                      <span key={f} style={{
                        fontSize: '10px', padding: '2px 8px',
                        background: `${mod.color}12`,
                        color: mod.color,
                        borderRadius: 'var(--radius-full)',
                        border: `1px solid ${mod.color}28`,
                        fontWeight: 500,
                      }}>
                        {f}
                      </span>
                    ))}
                    {mod.features.length > 3 && (
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', padding: '2px 6px' }}>
                        +{mod.features.length - 3} more
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link
                      to={mod.path}
                      onClick={(e) => e.stopPropagation()}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '11px' }}
                    >
                      Open {mod.icon}
                    </Link>
                    <button style={{
                      fontSize: '11px', padding: '4px 10px',
                      background: 'none', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-text-muted)',
                    }}>
                      Details ▾
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--color-border)', marginTop: '4px', paddingTop: '14px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                      All Features
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {mod.features.map((f) => (
                        <li key={f} style={{ fontSize: '12px', color: 'var(--color-text)', padding: '3px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: mod.color, fontWeight: 700 }}>✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {mod.apiEndpoints && mod.apiEndpoints.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                        Key API Endpoints
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {mod.apiEndpoints.map((ep) => (
                          <code key={ep} style={{
                            fontSize: '11px', fontFamily: 'monospace',
                            background: 'var(--color-bg)',
                            padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                            color: mod.color, display: 'block',
                          }}>
                            {ep}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link
                      to={mod.path}
                      onClick={(e) => e.stopPropagation()}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '11px' }}
                    >
                      Open Module →
                    </Link>
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpanded(null); }}
                      style={{
                        fontSize: '11px', padding: '4px 10px',
                        background: 'none', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-text-muted)',
                      }}
                    >
                      Collapse ▴
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Architecture summary ── */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">🏗️ Platform Architecture</div>
          <div className="card-subtitle">Technology stack and infrastructure overview</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { layer: 'Frontend',    tech: 'React 18 + TypeScript',         icon: '⚛️',  color: '#0ea5e9' },
            { layer: 'API Gateway', tech: 'Express.js + JWT + OAuth 2.0',  icon: '🔌',  color: '#7c3aed' },
            { layer: 'Database',    tech: 'PostgreSQL 16 + migrations',    icon: '🗄️',  color: '#059669' },
            { layer: 'Cache',       tech: 'Redis 7 (rate limiting + sessions)', icon: '⚡', color: '#dc2626' },
            { layer: 'Containers',  tech: 'Docker Compose + Kubernetes',   icon: '🐳',  color: '#2563eb' },
            { layer: 'Monitoring',  tech: 'Prometheus + Grafana',          icon: '📊',  color: '#d97706' },
          ].map(({ layer, tech, icon, color }) => (
            <div key={layer} style={{
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              borderLeft: `3px solid ${color}`,
            }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color, marginBottom: '4px' }}>{layer}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{tech}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick navigation ── */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">🗺️ Quick Navigation</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
          {MODULES
            .filter((m) => !(m.status === 'admin' && !isAdmin))
            .map((mod) => (
              <Link
                key={mod.id}
                to={mod.path}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: '6px', padding: '14px 10px',
                  background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  textDecoration: 'none', color: 'var(--color-text)',
                  transition: 'all 0.15s',
                  fontSize: '11px', fontWeight: 500, textAlign: 'center',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = mod.color; (e.currentTarget as HTMLElement).style.background = `${mod.color}08`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-bg)'; }}
              >
                <span style={{ fontSize: '22px' }}>{mod.icon}</span>
                {mod.label}
              </Link>
            ))}
        </div>
      </div>
    </>
  );
};

export default PlatformOverview;
