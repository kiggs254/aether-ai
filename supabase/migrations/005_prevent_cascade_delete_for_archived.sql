-- Prevent cascade delete for archived conversations
-- This allows bots to be deleted while preserving archived conversations and their messages

-- First, make bot_id nullable for conversations (so archived conversations can have null bot_id)
ALTER TABLE conversations 
ALTER COLUMN bot_id DROP NOT NULL;

-- Drop the existing foreign key constraint with CASCADE
ALTER TABLE conversations 
DROP CONSTRAINT IF EXISTS conversations_bot_id_fkey;

-- Recreate the foreign key constraint with SET NULL instead of CASCADE
-- This way, when a bot is deleted, archived conversations won't be deleted
-- Instead, bot_id will be set to NULL (and archived_bot_id will preserve the original bot_id)
ALTER TABLE conversations 
ADD CONSTRAINT conversations_bot_id_fkey 
FOREIGN KEY (bot_id) 
REFERENCES bots(id) 
ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN conversations.bot_id IS 'Current bot ID. Set to NULL when bot is deleted (archived_bot_id preserves original bot_id)';

