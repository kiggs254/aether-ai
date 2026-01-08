-- Add 'deepseek' to the provider check constraint
ALTER TABLE bots DROP CONSTRAINT IF EXISTS bots_provider_check;
ALTER TABLE bots ADD CONSTRAINT bots_provider_check CHECK (provider IN ('gemini', 'openai', 'deepseek'));

