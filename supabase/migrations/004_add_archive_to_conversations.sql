-- Add archive fields to conversations table
-- This allows conversations to be archived when their bot is deleted
-- instead of being permanently deleted

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_bot_id UUID;

-- Add index for faster queries on archived conversations
CREATE INDEX IF NOT EXISTS idx_conversations_archived_at ON conversations(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_archived_bot_id ON conversations(archived_bot_id) WHERE archived_bot_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN conversations.archived_at IS 'Timestamp when conversation was archived (typically when bot was deleted)';
COMMENT ON COLUMN conversations.archived_bot_id IS 'ID of the bot that was archived, if conversation was archived due to bot deletion';

