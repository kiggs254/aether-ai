-- Add 'products' to bot_actions type constraint
ALTER TABLE bot_actions
DROP CONSTRAINT IF EXISTS bot_actions_type_check;

ALTER TABLE bot_actions
ADD CONSTRAINT bot_actions_type_check
CHECK (type IN ('link', 'phone', 'whatsapp', 'handoff', 'custom', 'media', 'products'));

COMMENT ON CONSTRAINT bot_actions_type_check ON bot_actions IS 'Allowed action types including products for product carousel actions';

