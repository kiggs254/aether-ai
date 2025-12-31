-- Add trigger_message column to bot_actions table
-- This allows users to customize the message shown when an action is triggered

ALTER TABLE bot_actions
ADD COLUMN IF NOT EXISTS trigger_message TEXT;

COMMENT ON COLUMN bot_actions.trigger_message IS 'Custom message to display when this action is triggered. If null, a default message will be used.';

