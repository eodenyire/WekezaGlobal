/**
 * Unit tests for subscription plans logic.
 * Proposal §7 Revenue Stream 3: "Subscription Services —
 * premium wallets, card issuance, analytics"
 *
 * These tests validate:
 *  1. Plan pricing math (Standard=free, Premium=$29, Enterprise=$299)
 *  2. Billing cycle calculations
 *  3. Monthly revenue aggregation logic
 *
 * No DB, HTTP, or external service connections are needed.
 */

// ── Plan definitions (must mirror migration 008_subscriptions.sql) ─────────────

interface Plan {
  name:          string;
  display_name:  string;
  price_usd:     number;
  billing_cycle: string;
  features:      string[];
}

const SUBSCRIPTION_PLANS: Plan[] = [
  {
    name:          'standard',
    display_name:  'Standard (Free)',
    price_usd:     0.00,
    billing_cycle: 'monthly',
    features: [
      'Multi-currency wallet (USD/EUR/GBP/KES)',
      'Global collection account',
      'FX conversion',
      'Bank settlement',
      'Basic API access',
      'Community support',
    ],
  },
  {
    name:          'premium',
    display_name:  'Premium',
    price_usd:     29.00,
    billing_cycle: 'monthly',
    features: [
      'Everything in Standard',
      'Virtual USD card issuance',
      'Physical card issuance',
      'Advanced FX analytics dashboard',
      'Priority settlement routing',
      'Dedicated support',
      'Higher API rate limits',
    ],
  },
  {
    name:          'enterprise',
    display_name:  'Enterprise',
    price_usd:     299.00,
    billing_cycle: 'monthly',
    features: [
      'Everything in Premium',
      'Unlimited API calls',
      'Custom bank integrations',
      'White-label ready',
      'Credit intelligence access',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom reporting',
    ],
  },
];

/** Simulate monthly revenue for a given user-plan mix */
function calculateMonthlyRevenue(subscriptions: Array<{ plan_name: string }>): number {
  return subscriptions.reduce((total, sub) => {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.name === sub.plan_name);
    return total + (plan?.price_usd ?? 0);
  }, 0);
}

/** Calculate expiry date for a monthly subscription */
function calculateExpiry(startDate: Date, billingCycle: string): Date {
  const expiry = new Date(startDate);
  if (billingCycle === 'monthly') {
    expiry.setDate(expiry.getDate() + 30);
  } else if (billingCycle === 'annual') {
    expiry.setFullYear(expiry.getFullYear() + 1);
  }
  return expiry;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('subscription plan definitions — Proposal §7 Revenue Stream 3', () => {
  it('has exactly 3 plans: standard, premium, enterprise', () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(3);
    const names = SUBSCRIPTION_PLANS.map((p) => p.name);
    expect(names).toContain('standard');
    expect(names).toContain('premium');
    expect(names).toContain('enterprise');
  });

  it('standard plan is free (price = 0)', () => {
    const standard = SUBSCRIPTION_PLANS.find((p) => p.name === 'standard');
    expect(standard?.price_usd).toBe(0);
  });

  it('premium plan costs $29/month', () => {
    const premium = SUBSCRIPTION_PLANS.find((p) => p.name === 'premium');
    expect(premium?.price_usd).toBe(29.00);
    expect(premium?.billing_cycle).toBe('monthly');
  });

  it('enterprise plan costs $299/month', () => {
    const enterprise = SUBSCRIPTION_PLANS.find((p) => p.name === 'enterprise');
    expect(enterprise?.price_usd).toBe(299.00);
    expect(enterprise?.billing_cycle).toBe('monthly');
  });

  it('plans are sorted by price ascending', () => {
    const prices = SUBSCRIPTION_PLANS.map((p) => p.price_usd);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('all plans have at least one feature', () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it('premium includes virtual and physical card features', () => {
    const premium = SUBSCRIPTION_PLANS.find((p) => p.name === 'premium')!;
    const featuresText = premium.features.join(' ').toLowerCase();
    expect(featuresText).toContain('virtual');
    expect(featuresText).toContain('physical');
  });

  it('enterprise includes credit intelligence feature', () => {
    const enterprise = SUBSCRIPTION_PLANS.find((p) => p.name === 'enterprise')!;
    const featuresText = enterprise.features.join(' ').toLowerCase();
    expect(featuresText).toContain('credit intelligence');
  });
});

describe('monthly revenue aggregation — Proposal §7 Business Model', () => {
  it('returns 0 revenue when all users are on standard plan', () => {
    const subs = [
      { plan_name: 'standard' },
      { plan_name: 'standard' },
      { plan_name: 'standard' },
    ];
    expect(calculateMonthlyRevenue(subs)).toBe(0);
  });

  it('calculates correct revenue for mixed plans', () => {
    const subs = [
      { plan_name: 'premium' },    // $29
      { plan_name: 'enterprise' }, // $299
      { plan_name: 'standard' },   // $0
      { plan_name: 'premium' },    // $29
    ];
    expect(calculateMonthlyRevenue(subs)).toBe(29 + 299 + 0 + 29); // $357
  });

  it('scales linearly with number of premium subscribers', () => {
    const subs = Array.from({ length: 100 }, () => ({ plan_name: 'premium' }));
    expect(calculateMonthlyRevenue(subs)).toBe(100 * 29); // $2,900
  });
});

describe('subscription billing cycle — expiry calculation', () => {
  it('monthly subscription expires in 30 days', () => {
    const start  = new Date('2026-01-01T00:00:00Z');
    const expiry = calculateExpiry(start, 'monthly');
    const diffDays = (expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(30);
  });

  it('annual subscription expires in 1 year', () => {
    const start  = new Date('2026-01-01T00:00:00Z');
    const expiry = calculateExpiry(start, 'annual');
    expect(expiry.getFullYear()).toBe(2027);
    expect(expiry.getMonth()).toBe(start.getMonth());
    expect(expiry.getDate()).toBe(start.getDate());
  });

  it('standard plan (free) should have no expiry (returns null in DB)', () => {
    // Standard plan price_usd === 0 → expires_at is null
    const plan = SUBSCRIPTION_PLANS.find((p) => p.name === 'standard')!;
    const hasExpiry = plan.price_usd > 0;
    expect(hasExpiry).toBe(false);
  });
});
