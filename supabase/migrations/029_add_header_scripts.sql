-- Add Header Scripts to Site Settings
-- Adds header_scripts field to site_config for custom script injection

-- Update existing site_config to include header_scripts field if it doesn't exist
UPDATE site_settings
SET value = jsonb_set(
  value,
  '{header_scripts}',
  '""'::jsonb,
  true
)
WHERE key = 'site_config'
AND NOT (value ? 'header_scripts');

-- If site_config doesn't exist, create it with header_scripts
INSERT INTO site_settings (key, value, description, category)
SELECT
  'site_config',
  '{
    "site_name": "Aether AI",
    "site_url": "",
    "support_email": "",
    "maintenance_mode": false,
    "allow_registration": true,
    "header_scripts": ""
  }'::jsonb,
  'General site configuration',
  'general'
WHERE NOT EXISTS (
  SELECT 1 FROM site_settings WHERE key = 'site_config'
);

