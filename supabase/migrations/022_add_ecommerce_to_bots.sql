-- Add e-commerce fields to bots table
-- This enables product recommendations and catalog management

ALTER TABLE bots 
ADD COLUMN IF NOT EXISTS ecommerce_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE bots 
ADD COLUMN IF NOT EXISTS product_feed_url TEXT;

ALTER TABLE bots 
ADD COLUMN IF NOT EXISTS ecommerce_settings JSONB DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN bots.ecommerce_enabled IS 'Whether e-commerce product recommendations are enabled for this bot';
COMMENT ON COLUMN bots.product_feed_url IS 'URL to XML product feed (RSS, Google Shopping, or custom format)';
COMMENT ON COLUMN bots.ecommerce_settings IS 'E-commerce configuration settings (max products, visible products, filters, etc.)';

