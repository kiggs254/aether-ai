-- Add header_image_url column to bots table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS header_image_url TEXT;

-- Add comment
COMMENT ON COLUMN bots.header_image_url IS 'URL of the header image for the chat widget';

