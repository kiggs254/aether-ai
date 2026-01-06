-- Update Default Plans with New Feature Structure
-- Sets feature values for Free, Pro, and Premium plans based on requirements

-- Update Free Plan
UPDATE subscription_plans
SET
  allowed_models = '["deepseek-fast"]'::jsonb,
  max_bots = 1,
  max_messages = 800,
  max_integrations = 1,
  max_knowledge_chars = 3000,
  max_storage_mb = 50,
  allow_actions = false,
  allow_lead_collection = false,
  allow_ecommerce = false,
  allow_departmental_bots = false,
  features = '["Deepseek fast models only (no reasoning)", "800 messages/month", "1 bot", "1 integration", "50 MB storage", "Up to 3000 characters of AI Knowledge", "No lead collection", "No actions allowed", "No Ecommerce functionality"]'::jsonb
WHERE name = 'Free';

-- Update Pro Plan
UPDATE subscription_plans
SET
  allowed_models = '["deepseek-fast", "openai-fast", "gemini-fast"]'::jsonb,
  max_bots = 3,
  max_messages = 8000,
  max_integrations = 3,
  max_knowledge_chars = 10000,
  max_storage_mb = 100000,
  allow_actions = true,
  allow_lead_collection = true,
  allow_ecommerce = false,
  allow_departmental_bots = true,
  features = '["All Actions allowed", "Premium LLM Models (Deepseek, OpenAI, Gemini fast models only)", "8000 messages/month", "Up to 3 Bots", "10,000 characters of Knowledge per Bot", "Up to 3 integrations", "Lead Collection", "No Ecommerce Function"]'::jsonb
WHERE name = 'Pro';

-- Update Premium Plan (or create if doesn't exist)
-- First try to update existing Premium plan
UPDATE subscription_plans
SET
  allowed_models = '["deepseek-fast", "openai-fast", "gemini-fast", "deepseek-reasoning", "openai-reasoning", "gemini-reasoning"]'::jsonb,
  max_bots = 10,
  max_messages = NULL,
  max_integrations = 10,
  max_knowledge_chars = 20000,
  max_storage_mb = NULL,
  allow_actions = true,
  allow_lead_collection = true,
  allow_ecommerce = true,
  allow_departmental_bots = true,
  features = '["All in Pro plus", "20,000 characters of Knowledge per Bot", "Unlimited messages", "Up to 10 bots and integrations", "All Models and deep thinking ones", "Ecommerce function"]'::jsonb
WHERE name = 'Premium';

-- If Premium doesn't exist, create it
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, max_bots, max_messages, max_storage_gb, allowed_models, max_integrations, max_knowledge_chars, max_storage_mb, allow_actions, allow_lead_collection, allow_ecommerce, allow_departmental_bots, is_active)
SELECT
  'Premium',
  'For large organizations with custom requirements',
  99.00,
  990.00,
  '["All in Pro plus", "20,000 characters of Knowledge per Bot", "Unlimited messages", "Up to 10 bots and integrations", "All Models and deep thinking ones", "Ecommerce function"]'::jsonb,
  10,
  NULL,
  NULL,
  '["deepseek-fast", "openai-fast", "gemini-fast", "deepseek-reasoning", "openai-reasoning", "gemini-reasoning"]'::jsonb,
  10,
  20000,
  NULL,
  true,
  true,
  true,
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Premium');

-- Deactivate old plans that don't match the new structure (Basic, Enterprise)
UPDATE subscription_plans
SET is_active = false
WHERE name IN ('Basic', 'Enterprise')
  AND name NOT IN ('Free', 'Pro', 'Premium');

