-- Create Usage Tracking Table
-- Tracks monthly usage for messages, storage, bots, and integrations per user

CREATE TABLE IF NOT EXISTS user_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  messages_count INTEGER DEFAULT 0,
  storage_mb DECIMAL(10, 2) DEFAULT 0,
  bots_count INTEGER DEFAULT 0,
  integrations_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_subscription_id ON user_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_period ON user_usage(period_start, period_end);

-- Enable Row Level Security
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own usage" ON user_usage;
DROP POLICY IF EXISTS "Service role can manage usage" ON user_usage;

-- Users can read their own usage only
CREATE POLICY "Users can view their own usage"
  ON user_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Only system (via edge functions) can create/update usage
CREATE POLICY "Service role can manage usage"
  ON user_usage FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_usage_updated_at ON user_usage;

CREATE TRIGGER update_user_usage_updated_at BEFORE UPDATE ON user_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create current period usage
CREATE OR REPLACE FUNCTION get_or_create_current_usage(p_user_id UUID, p_subscription_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  v_usage_id UUID;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Get current subscription period or use current month
  IF p_subscription_id IS NOT NULL THEN
    SELECT current_period_start, current_period_end
    INTO v_period_start, v_period_end
    FROM user_subscriptions
    WHERE id = p_subscription_id AND status = 'active';
  END IF;

  -- If no subscription period, use current month
  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', NOW());
    v_period_end := (date_trunc('month', NOW()) + interval '1 month' - interval '1 day')::date + interval '23 hours 59 minutes 59 seconds';
  END IF;

  -- Try to get existing usage record
  SELECT id INTO v_usage_id
  FROM user_usage
  WHERE user_id = p_user_id AND period_start = v_period_start;

  -- Create if doesn't exist
  IF v_usage_id IS NULL THEN
    INSERT INTO user_usage (user_id, subscription_id, period_start, period_end)
    VALUES (p_user_id, p_subscription_id, v_period_start, v_period_end)
    RETURNING id INTO v_usage_id;
  END IF;

  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment message count
CREATE OR REPLACE FUNCTION increment_message_count(p_user_id UUID, p_count INTEGER DEFAULT 1)
RETURNS VOID AS $$
DECLARE
  v_subscription_id UUID;
  v_usage_id UUID;
BEGIN
  -- Get active subscription
  SELECT id INTO v_subscription_id
  FROM user_subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  -- Get or create usage record
  v_usage_id := get_or_create_current_usage(p_user_id, v_subscription_id);

  -- Increment message count
  UPDATE user_usage
  SET messages_count = messages_count + p_count,
      updated_at = NOW()
  WHERE id = v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

