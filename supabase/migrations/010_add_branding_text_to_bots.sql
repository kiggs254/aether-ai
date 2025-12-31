-- Add branding_text column to bots table for premium users
ALTER TABLE bots
ADD COLUMN IF NOT EXISTS branding_text TEXT;

COMMENT ON COLUMN bots.branding_text IS 'Custom "Powered by" text for premium users. If null, defaults to "Powered by Aether AI"';

