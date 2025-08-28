-- Migration: Add billing tables and initial subscription plans
-- Date: 2025-08-28

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL UNIQUE, -- 'free', 'pro', 'enterprise'
    stripe_price_id VARCHAR UNIQUE, -- null for free plan
    monthly_price INTEGER DEFAULT 0, -- price in cents
    features JSONB NOT NULL DEFAULT '{
        "repositories_limit": null,
        "notifications_limit": null,
        "ai_features": false,
        "digest_notifications": false,
        "priority_support": false,
        "team_features": false
    }'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id VARCHAR UNIQUE, -- null for free plan
    stripe_customer_id VARCHAR,
    status VARCHAR DEFAULT 'active', -- active, canceled, past_due, unpaid, incomplete
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create user_usage table for tracking monthly usage
CREATE TABLE IF NOT EXISTS user_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    repositories_tracked INTEGER DEFAULT 0,
    notifications_sent INTEGER DEFAULT 0,
    digest_notifications INTEGER DEFAULT 0,
    keyword_notifications INTEGER DEFAULT 0,
    ai_requests INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period_start, period_end)
);

-- Create triggers for billing tables
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON subscription_plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_usage_updated_at ON user_usage;
CREATE TRIGGER update_user_usage_updated_at
BEFORE UPDATE ON user_usage
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for billing tables
CREATE INDEX IF NOT EXISTS idx_subscription_plans_name ON subscription_plans(name);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_id ON subscription_plans(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_period ON user_usage(period_start, period_end);

-- Enable RLS for billing tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Insert initial subscription plans
INSERT INTO subscription_plans (name, stripe_price_id, monthly_price, features) VALUES
(
    'free',
    NULL,
    0,
    '{
        "repositories_limit": 3,
        "notifications_limit": 100,
        "ai_features": false,
        "digest_notifications": false,
        "priority_support": false,
        "team_features": false
    }'::jsonb
),
(
    'pro',
    NULL, -- Will be updated when Stripe price is created
    900, -- $9.00 in cents
    '{
        "repositories_limit": 25,
        "notifications_limit": null,
        "ai_features": true,
        "digest_notifications": true,
        "priority_support": false,
        "team_features": false
    }'::jsonb
),
(
    'enterprise',
    NULL, -- Will be updated when Stripe price is created
    2900, -- $29.00 in cents
    '{
        "repositories_limit": null,
        "notifications_limit": null,
        "ai_features": true,
        "digest_notifications": true,
        "priority_support": true,
        "team_features": true
    }'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Create default subscriptions for existing users (assign them to free plan)
INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
SELECT 
    u.id,
    sp.id,
    'active',
    NOW(),
    NOW() + INTERVAL '1 month'
FROM users u
CROSS JOIN subscription_plans sp
WHERE sp.name = 'free'
AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions us WHERE us.user_id = u.id
);