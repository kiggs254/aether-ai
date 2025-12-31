-- Add name field to integrations table
ALTER TABLE integrations
ADD COLUMN IF NOT EXISTS name TEXT;

-- Create index for name lookups (optional, but useful if we search by name)
CREATE INDEX IF NOT EXISTS integrations_name_idx ON integrations(name) WHERE name IS NOT NULL;

-- Update existing integrations to have a default name if they don't have one
-- This will be handled by the application, but we can set a default here
COMMENT ON COLUMN integrations.name IS 'User-defined name for the integration';

