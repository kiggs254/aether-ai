-- Drop existing policies if they exist (to allow re-running this migration)
DROP POLICY IF EXISTS "Allow anonymous to check bot existence" ON bots;
DROP POLICY IF EXISTS "Allow widget conversations to be created" ON conversations;
DROP POLICY IF EXISTS "Allow messages in widget conversations" ON messages;
DROP POLICY IF EXISTS "Allow reading messages from widget conversations" ON messages;
DROP POLICY IF EXISTS "Allow reading widget conversations" ON conversations;

-- First, allow anonymous users to check if a bot exists (needed for the EXISTS check in conversation policy)
-- This is a minimal read policy that only allows checking bot existence by ID
CREATE POLICY "Allow anonymous to check bot existence"
  ON bots FOR SELECT
  TO anon
  USING (true); -- Allow anonymous users to read any bot (needed for widget to verify bot exists)

-- Allow anonymous users (widget) to create conversations
-- This policy allows widget conversations (user_id is null) to be created for any bot
CREATE POLICY "Allow widget conversations to be created"
  ON conversations FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Allow if user_id is null (widget conversation) and bot exists
    user_id IS NULL
    AND EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = conversations.bot_id
    )
  );

-- Allow anonymous users (widget) to insert messages into widget conversations
-- This policy allows messages to be added to conversations where user_id is null
CREATE POLICY "Allow messages in widget conversations"
  ON messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Allow if the conversation exists and is a widget conversation (user_id is null)
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id IS NULL
    )
  );

-- Allow anonymous users (widget) to read messages from widget conversations
-- This is needed for the widget to potentially load conversation history
CREATE POLICY "Allow reading messages from widget conversations"
  ON messages FOR SELECT
  TO anon, authenticated
  USING (
    -- Allow if the conversation is a widget conversation (user_id is null)
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id IS NULL
    )
  );

-- Allow anonymous users (widget) to read widget conversations
-- This allows the widget to verify conversation creation
CREATE POLICY "Allow reading widget conversations"
  ON conversations FOR SELECT
  TO anon, authenticated
  USING (
    -- Allow if user_id is null (widget conversation)
    user_id IS NULL
  );

