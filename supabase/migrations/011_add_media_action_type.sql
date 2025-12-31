-- Add 'media' to bot_actions type constraint and add media metadata columns
ALTER TABLE bot_actions
DROP CONSTRAINT IF EXISTS bot_actions_type_check;

ALTER TABLE bot_actions
ADD CONSTRAINT bot_actions_type_check
CHECK (type IN ('link', 'phone', 'whatsapp', 'handoff', 'custom', 'media'));

-- Add media_type column to store file type (image/audio/pdf/video)
ALTER TABLE bot_actions
ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Add file_size column to track file size in bytes
ALTER TABLE bot_actions
ADD COLUMN IF NOT EXISTS file_size BIGINT;

COMMENT ON COLUMN bot_actions.media_type IS 'File type for media actions: image, audio, pdf, or video';
COMMENT ON COLUMN bot_actions.file_size IS 'File size in bytes for media actions';

