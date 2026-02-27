-- ============================================================
--  WekezaGlobal Infrastructure (WGI) — Migration 008
--  Adds: subscription_plans and user_subscriptions tables
--
--  Proposal §7 Revenue Stream 3: "Subscription Services —
--  premium wallets, card issuance, analytics"
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  plan_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(50)  NOT NULL UNIQUE, -- 'standard', 'premium', 'enterprise'
  display_name  VARCHAR(100) NOT NULL,
  price_usd     DECIMAL(10,2) NOT NULL DEFAULT 0,
  billing_cycle VARCHAR(20)  NOT NULL DEFAULT 'monthly', -- 'monthly' | 'annual'
  features      JSONB        NOT NULL DEFAULT '[]',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  plan_id         UUID        NOT NULL REFERENCES subscription_plans(plan_id),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','cancelled','expired','past_due')),
  started_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMP,                     -- NULL = ongoing until cancelled
  cancelled_at    TIMESTAMP,
  created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Only one active subscription per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_one_active
  ON user_subscriptions(user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user  ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan  ON user_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- Seed the three plans defined in Proposal §7
INSERT INTO subscription_plans (name, display_name, price_usd, billing_cycle, features)
SELECT v.name, v.display_name, v.price_usd::DECIMAL, v.billing_cycle, v.features::JSONB
FROM (VALUES
  (
    'standard',
    'Standard (Free)',
    '0.00',
    'monthly',
    '["Multi-currency wallet (USD/EUR/GBP/KES)","Global collection account","FX conversion","Bank settlement","Basic API access","Community support"]'
  ),
  (
    'premium',
    'Premium',
    '29.00',
    'monthly',
    '["Everything in Standard","Virtual USD card issuance","Physical card issuance","Advanced FX analytics dashboard","Priority settlement routing","Dedicated support","Higher API rate limits"]'
  ),
  (
    'enterprise',
    'Enterprise',
    '299.00',
    'monthly',
    '["Everything in Premium","Unlimited API calls","Custom bank integrations","White-label ready","Credit intelligence access","Dedicated account manager","SLA guarantee","Custom reporting"]'
  )
) AS v(name, display_name, price_usd, billing_cycle, features)
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans LIMIT 1);
