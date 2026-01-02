-- Create product_catalog table for storing parsed products from XML feeds
-- This table stores product information for AI-powered recommendations

CREATE TABLE IF NOT EXISTS product_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE NOT NULL,
  product_id TEXT NOT NULL, -- Unique identifier from feed
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  image_url TEXT,
  product_url TEXT NOT NULL,
  category TEXT,
  keywords TEXT[], -- Array for search indexing
  in_stock BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique product_id per bot
  UNIQUE(bot_id, product_id)
);

-- Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_product_catalog_bot_id ON product_catalog(bot_id);
CREATE INDEX IF NOT EXISTS idx_product_catalog_category ON product_catalog(category);
CREATE INDEX IF NOT EXISTS idx_product_catalog_price ON product_catalog(price);
CREATE INDEX IF NOT EXISTS idx_product_catalog_keywords ON product_catalog USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_product_catalog_in_stock ON product_catalog(in_stock) WHERE in_stock = TRUE;

-- Enable Row Level Security
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_catalog
-- Users can view products of their own bots
CREATE POLICY "Users can view products of their bots"
  ON product_catalog FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = product_catalog.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- Allow anonymous read access for widget (products need to be publicly readable)
CREATE POLICY "Anonymous can view products"
  ON product_catalog FOR SELECT
  USING (true);

-- Users can insert products for their bots
CREATE POLICY "Users can create products for their bots"
  ON product_catalog FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = product_catalog.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- Users can update products of their bots
CREATE POLICY "Users can update products of their bots"
  ON product_catalog FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = product_catalog.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- Users can delete products of their bots
CREATE POLICY "Users can delete products of their bots"
  ON product_catalog FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = product_catalog.bot_id
      AND bots.user_id = auth.uid()
    )
  );

