-- Seed Default Subscription Plans
-- Creates initial subscription plans: Free, Basic, Pro, Enterprise

INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, max_bots, max_messages, max_storage_gb, is_active)
VALUES
  (
    'Free',
    'Perfect for getting started with basic chatbot functionality',
    0,
    0,
    '["Basic chatbot", "Up to 3 bots", "1,000 messages/month", "1 GB storage", "Email support"]'::jsonb,
    3,
    1000,
    1,
    true
  ),
  (
    'Basic',
    'Ideal for small businesses and personal projects',
    9.00,
    90.00,
    '["All Free features", "Up to 10 bots", "10,000 messages/month", "10 GB storage", "Priority email support", "Custom branding"]'::jsonb,
    10,
    10000,
    10,
    true
  ),
  (
    'Pro',
    'For growing businesses with advanced needs',
    29.00,
    290.00,
    '["All Basic features", "Unlimited bots", "100,000 messages/month", "100 GB storage", "Priority support", "Advanced analytics", "API access", "Custom integrations"]'::jsonb,
    NULL,
    100000,
    100,
    true
  ),
  (
    'Enterprise',
    'For large organizations with custom requirements',
    99.00,
    990.00,
    '["All Pro features", "Unlimited everything", "Unlimited storage", "Dedicated support", "Custom SLA", "On-premise deployment option", "Custom integrations", "Account manager"]'::jsonb,
    NULL,
    NULL,
    NULL,
    true
  )
ON CONFLICT DO NOTHING;

