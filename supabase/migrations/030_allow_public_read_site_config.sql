-- Allow public (unauthenticated) users to read site_config for header scripts
-- This is needed so the landing page can load the widget scripts

DROP POLICY IF EXISTS "Public can view site_config" ON site_settings;

CREATE POLICY "Public can view site_config"
  ON site_settings FOR SELECT
  TO anon, authenticated
  USING (key = 'site_config');

