-- Add Feature Management Columns to Subscription Plans
-- Extends subscription_plans table with detailed feature controls

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS allowed_models JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_integrations INTEGER,
  ADD COLUMN IF NOT EXISTS max_knowledge_chars INTEGER,
  ADD COLUMN IF NOT EXISTS max_storage_mb INTEGER,
  ADD COLUMN IF NOT EXISTS allow_actions BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_lead_collection BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_ecommerce BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_departmental_bots BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN subscription_plans.allowed_models IS 'Array of allowed model identifiers (e.g., ["deepseek-fast", "openai-fast", "gemini-fast", "deepseek-reasoning", "openai-reasoning", "gemini-reasoning"])';
COMMENT ON COLUMN subscription_plans.max_integrations IS 'Maximum number of integrations allowed (NULL = unlimited)';
COMMENT ON COLUMN subscription_plans.max_knowledge_chars IS 'Maximum knowledge base characters per bot (NULL = unlimited)';
COMMENT ON COLUMN subscription_plans.max_storage_mb IS 'Storage limit in MB (NULL = unlimited). Note: max_storage_gb is kept for backward compatibility';
COMMENT ON COLUMN subscription_plans.allow_actions IS 'Whether custom actions are allowed';
COMMENT ON COLUMN subscription_plans.allow_lead_collection IS 'Whether lead collection is enabled';
COMMENT ON COLUMN subscription_plans.allow_ecommerce IS 'Whether ecommerce functionality is enabled';
COMMENT ON COLUMN subscription_plans.allow_departmental_bots IS 'Whether departmental bots are allowed';

