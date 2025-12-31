-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  system_instruction TEXT NOT NULL,
  knowledge_base TEXT,
  avatar_color TEXT DEFAULT 'from-blue-500 to-cyan-500',
  total_interactions INTEGER DEFAULT 0,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  model TEXT DEFAULT 'gemini-3-flash-preview',
  provider TEXT DEFAULT 'gemini' CHECK (provider IN ('gemini', 'openai')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'training')),
  collect_leads BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot actions table
CREATE TABLE IF NOT EXISTS bot_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('link', 'phone', 'whatsapp', 'handoff', 'custom')),
  label TEXT NOT NULL,
  payload TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_phone TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'model')),
  text TEXT NOT NULL,
  action_invoked TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_actions_bot_id ON bot_actions(bot_id);
CREATE INDEX IF NOT EXISTS idx_conversations_bot_id ON conversations(bot_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Enable Row Level Security (RLS)
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bots
CREATE POLICY "Users can view their own bots"
  ON bots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bots"
  ON bots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bots"
  ON bots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bots"
  ON bots FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for bot_actions
CREATE POLICY "Users can view actions of their bots"
  ON bot_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_actions.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create actions for their bots"
  ON bot_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_actions.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update actions of their bots"
  ON bot_actions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_actions.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete actions of their bots"
  ON bot_actions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_actions.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations of their bots"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = conversations.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create conversations for their bots"
  ON conversations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = conversations.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update conversations of their bots"
  ON conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = conversations.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- RLS Policies for messages
CREATE POLICY "Users can view messages of their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      JOIN bots ON bots.id = conversations.bot_id
      WHERE conversations.id = messages.conversation_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages for their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      JOIN bots ON bots.id = conversations.bot_id
      WHERE conversations.id = messages.conversation_id
      AND bots.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_bots_updated_at BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment message count
CREATE OR REPLACE FUNCTION increment_message_count(conv_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE conversations
  SET message_count = message_count + 1,
      updated_at = NOW()
  WHERE id = conv_id;
END;
$$ LANGUAGE plpgsql;

