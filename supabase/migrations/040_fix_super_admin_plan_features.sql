-- Fix get_user_plan_features to return unlimited features for super admins
-- This ensures database functions that check limits will allow super admins

CREATE OR REPLACE FUNCTION get_user_plan_features(p_user_id UUID)
RETURNS TABLE (
  plan_id UUID,
  plan_name TEXT,
  allowed_models JSONB,
  max_bots INTEGER,
  max_integrations INTEGER,
  max_messages INTEGER,
  max_knowledge_chars INTEGER,
  max_storage_mb INTEGER,
  allow_actions BOOLEAN,
  allow_lead_collection BOOLEAN,
  allow_ecommerce BOOLEAN,
  allow_departmental_bots BOOLEAN
) AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  -- First check if user is super admin
  SELECT EXISTS (
    SELECT 1
    FROM admin_users
    WHERE admin_users.user_id = p_user_id
    AND admin_users.role = 'super_admin'
  ) INTO v_is_super_admin;

  -- If super admin, return unlimited features
  IF v_is_super_admin THEN
    RETURN QUERY
    SELECT 
      NULL::UUID as plan_id,
      'Super Admin'::TEXT as plan_name,
      '["deepseek-fast", "openai-fast", "gemini-fast", "deepseek-reasoning", "openai-reasoning", "gemini-reasoning"]'::jsonb as allowed_models,
      NULL::INTEGER as max_bots,
      NULL::INTEGER as max_integrations,
      NULL::INTEGER as max_messages,
      NULL::INTEGER as max_knowledge_chars,
      NULL::INTEGER as max_storage_mb,
      true::BOOLEAN as allow_actions,
      true::BOOLEAN as allow_lead_collection,
      true::BOOLEAN as allow_ecommerce,
      true::BOOLEAN as allow_departmental_bots;
    RETURN;
  END IF;

  -- Otherwise, get user's plan features as normal
  RETURN QUERY
  SELECT 
    sp.id,
    sp.name,
    COALESCE(sp.allowed_models, '[]'::jsonb) as allowed_models,
    sp.max_bots,
    sp.max_integrations,
    sp.max_messages,
    sp.max_knowledge_chars,
    sp.max_storage_mb,
    COALESCE(sp.allow_actions, false) as allow_actions,
    COALESCE(sp.allow_lead_collection, false) as allow_lead_collection,
    COALESCE(sp.allow_ecommerce, false) as allow_ecommerce,
    COALESCE(sp.allow_departmental_bots, false) as allow_departmental_bots
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
  LIMIT 1;

  -- If no active subscription, return free plan defaults
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      NULL::UUID as plan_id,
      'Free'::TEXT as plan_name,
      '["deepseek-fast"]'::jsonb as allowed_models,
      1::INTEGER as max_bots,
      1::INTEGER as max_integrations,
      800::INTEGER as max_messages,
      3000::INTEGER as max_knowledge_chars,
      50::INTEGER as max_storage_mb,
      false::BOOLEAN as allow_actions,
      false::BOOLEAN as allow_lead_collection,
      false::BOOLEAN as allow_ecommerce,
      false::BOOLEAN as allow_departmental_bots;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update can_user_perform_action to check for super admin first
CREATE OR REPLACE FUNCTION can_user_perform_action(
  p_user_id UUID,
  p_action_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_features RECORD;
  v_is_super_admin BOOLEAN;
BEGIN
  -- First check if user is super admin - super admins can do everything
  SELECT EXISTS (
    SELECT 1
    FROM admin_users
    WHERE admin_users.user_id = p_user_id
    AND admin_users.role = 'super_admin'
  ) INTO v_is_super_admin;

  IF v_is_super_admin THEN
    RETURN true;
  END IF;

  -- Get user's plan features
  SELECT * INTO v_features
  FROM get_user_plan_features(p_user_id)
  LIMIT 1;

  -- Check based on action type
  CASE p_action_type
    WHEN 'create_bot' THEN
      -- Check bot count limit
      IF v_features.max_bots IS NULL THEN
        RETURN true;
      END IF;
      RETURN (
        SELECT COUNT(*) < v_features.max_bots
        FROM bots
        WHERE user_id = p_user_id
      );
    
    WHEN 'create_integration' THEN
      -- Check integration count limit
      IF v_features.max_integrations IS NULL THEN
        RETURN true;
      END IF;
      RETURN (
        SELECT COUNT(*) < v_features.max_integrations
        FROM integrations
        WHERE user_id = p_user_id
      );
    
    WHEN 'use_actions' THEN
      RETURN v_features.allow_actions;
    
    WHEN 'collect_leads' THEN
      RETURN v_features.allow_lead_collection;
    
    WHEN 'use_ecommerce' THEN
      RETURN v_features.allow_ecommerce;
    
    WHEN 'use_departmental_bots' THEN
      RETURN v_features.allow_departmental_bots;
    
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

