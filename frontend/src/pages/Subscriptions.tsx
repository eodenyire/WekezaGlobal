/**
 * Subscriptions Page — Proposal §7 Revenue Stream 3
 * "Subscription Services — premium wallets, card issuance, analytics"
 */
import React, { useEffect, useState, useCallback } from 'react';
import apiClient from '../api/client';
import { SubscriptionPlan, UserSubscription } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

interface MySubResponse {
  subscription: UserSubscription | null;
  effective_plan: SubscriptionPlan | null;
}

const PLAN_ICONS: Record<string, string> = {
  standard:   '🆓',
  premium:    '⭐',
  enterprise: '🏢',
};

const PLAN_COLORS: Record<string, string> = {
  standard:   '#4F46E5',
  premium:    '#0891B2',
  enterprise: '#7C3AED',
};

const Subscriptions: React.FC = () => {
  const [plans, setPlans]           = useState<SubscriptionPlan[]>([]);
  const [mySub, setMySub]           = useState<MySubResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [plansRes, mySubRes] = await Promise.all([
        apiClient.get<{ plans: SubscriptionPlan[] }>('/v1/subscriptions/plans'),
        apiClient.get<MySubResponse>('/v1/subscriptions/my'),
      ]);
      setPlans(plansRes.data.plans ?? []);
      setMySub(mySubRes.data);
    } catch {
      setError('Failed to load subscription data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId);
    setError('');
    setSuccess('');
    try {
      await apiClient.post('/v1/subscriptions', { plan_id: planId });
      setSuccess('Subscription updated successfully!');
      await fetchData();
    } catch {
      setError('Failed to update subscription. Please try again.');
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    if (!mySub?.subscription) return;
    setCancelling(true);
    setError('');
    setSuccess('');
    try {
      await apiClient.put(`/v1/subscriptions/${mySub.subscription.subscription_id}/cancel`);
      setSuccess('Subscription cancelled. You have been moved to the Standard plan.');
      await fetchData();
    } catch {
      setError('Failed to cancel subscription.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const currentPlanName = mySub?.effective_plan?.name ?? 'standard';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Subscription Plans</h1>
          <p>Choose the plan that best fits your needs — Proposal §7 Revenue Stream 3</p>
        </div>
      </div>

      {error   && <div className="alert alert-danger"  style={{ marginBottom: '16px' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{success}</div>}

      {/* Current Plan Banner */}
      {mySub?.effective_plan && (
        <div className="card" style={{ marginBottom: '24px', borderLeft: `4px solid ${PLAN_COLORS[currentPlanName] ?? '#4F46E5'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Current Plan
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{PLAN_ICONS[currentPlanName] ?? '📦'}</span>
                <span style={{ fontSize: '18px', fontWeight: 700 }}>{mySub.effective_plan.display_name}</span>
                {mySub.subscription && (
                  <span className="badge badge-success">{mySub.subscription.status}</span>
                )}
              </div>
              {mySub.subscription?.expires_at && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Renews: {new Date(mySub.subscription.expires_at).toLocaleDateString()}
                </div>
              )}
            </div>
            {mySub.subscription && mySub.subscription.status === 'active' && currentPlanName !== 'standard' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? <LoadingSpinner size="sm" /> : 'Cancel Plan'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {plans.map((plan) => {
          const isCurrentPlan = plan.name === currentPlanName;
          const color = PLAN_COLORS[plan.name] ?? '#4F46E5';
          return (
            <div
              key={plan.plan_id}
              className="card"
              style={{
                border: isCurrentPlan ? `2px solid ${color}` : '1px solid var(--color-border)',
                position: 'relative',
              }}
            >
              {isCurrentPlan && (
                <div style={{
                  position: 'absolute', top: '-1px', right: '16px',
                  background: color, color: '#fff',
                  fontSize: '10px', fontWeight: 700,
                  padding: '2px 8px', borderRadius: '0 0 6px 6px',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Current
                </div>
              )}

              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>{PLAN_ICONS[plan.name] ?? '📦'}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color }}>{plan.display_name}</div>
                <div style={{ marginTop: '8px' }}>
                  {parseFloat(plan.price_usd) === 0 ? (
                    <span style={{ fontSize: '28px', fontWeight: 800 }}>Free</span>
                  ) : (
                    <>
                      <span style={{ fontSize: '28px', fontWeight: 800 }}>${plan.price_usd}</span>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}> / {plan.billing_cycle}</span>
                    </>
                  )}
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', fontSize: '13px' }}>
                {plan.features.map((feature, i) => (
                  <li key={i} style={{ padding: '5px 0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ color, flexShrink: 0, marginTop: '1px' }}>✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`btn btn-primary btn-block`}
                style={{ background: color, borderColor: color }}
                onClick={() => handleSubscribe(plan.plan_id)}
                disabled={isCurrentPlan || subscribing === plan.plan_id}
              >
                {subscribing === plan.plan_id ? (
                  <LoadingSpinner size="sm" />
                ) : isCurrentPlan ? (
                  '✓ Active Plan'
                ) : parseFloat(plan.price_usd) === 0 ? (
                  'Downgrade to Free'
                ) : (
                  `Upgrade to ${plan.display_name}`
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature comparison note */}
      <div className="card" style={{ background: 'var(--color-bg-alt)', textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          🔒 All plans include bank-grade security, AML/KYC compliance, and Wekeza Bank founding partner rates.
          <br />
          Enterprise plans include custom integrations and SLA guarantees for fintech partners.
        </div>
      </div>
    </>
  );
};

export default Subscriptions;
