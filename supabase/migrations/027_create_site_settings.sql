-- Site Settings Table
-- Stores SMTP configuration and other site-wide settings (admin only)

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('smtp', 'general', 'email', 'security', 'features')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);
CREATE INDEX IF NOT EXISTS idx_site_settings_category ON site_settings(category);

-- Enable Row Level Security
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can manage settings (enforced via edge functions)
-- RLS allows authenticated users to read, but edge functions verify admin status
CREATE POLICY "Authenticated users can view site settings"
  ON site_settings FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage settings
CREATE POLICY "Service role can manage site settings"
  ON site_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings;
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default SMTP settings (empty, to be configured by admin)
INSERT INTO site_settings (key, value, description, category)
VALUES
  (
    'smtp_config',
    '{
      "host": "",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "",
        "pass": ""
      },
      "from_email": "",
      "from_name": ""
    }'::jsonb,
    'SMTP server configuration for sending emails',
    'smtp'
  ),
  (
    'site_config',
    '{
      "site_name": "Aether AI",
      "site_url": "",
      "support_email": "",
      "maintenance_mode": false,
      "allow_registration": true
    }'::jsonb,
    'General site configuration',
    'general'
  )
ON CONFLICT (key) DO NOTHING;

