-- Allow anonymous users (widget) to read bot_actions
-- This is needed for the widget to fetch actions when loading bot configuration
-- Actions are public-facing UI elements (links, phone numbers) meant to be displayed in the widget

CREATE POLICY "Allow anonymous to read bot_actions"
  ON bot_actions
  FOR SELECT
  TO anon
  USING (true); -- Allow anonymous users to read any bot_actions (they're public-facing UI elements)

