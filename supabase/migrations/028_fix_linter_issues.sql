-- Fix Linter Issues
-- This migration addresses security warnings and errors from Supabase linter

-- 1. Drop any existing policies on admin_users before disabling RLS
-- (This fixes the "policy_exists_rls_disabled" error)
DROP POLICY IF EXISTS "Super admins can create admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Authenticated users can view admin users" ON admin_users;
DROP POLICY IF EXISTS "Service role can manage admin users" ON admin_users;

-- Ensure RLS is disabled (should already be, but ensure it)
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- 2. Fix function search_path security warnings
-- Set search_path = '' to prevent search path injection attacks
-- Use CURRENT_TIMESTAMP instead of NOW() to avoid needing to qualify it

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Fix update_integrations_updated_at function
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER 
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Fix increment_message_count function
CREATE OR REPLACE FUNCTION increment_message_count(conv_id UUID)
RETURNS void 
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET message_count = message_count + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = conv_id;
END;
$$;

