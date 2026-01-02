-- Add department_bots JSONB column to integrations table
-- This allows premium users to have multiple bots (one per department)
-- Format: [{"botId": "uuid", "departmentName": "sales", "departmentLabel": "Sales"}, ...]

ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS department_bots JSONB DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN integrations.department_bots IS 'Array of department bots for premium users. Format: [{"botId": "uuid", "departmentName": "sales", "departmentLabel": "Sales"}]';

-- Create index for JSONB queries (optional, but useful for filtering)
CREATE INDEX IF NOT EXISTS integrations_department_bots_idx ON integrations USING GIN (department_bots);

