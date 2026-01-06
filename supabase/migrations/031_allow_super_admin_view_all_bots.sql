-- Allow super admins to view all bots
-- This migration adds RLS policies that allow super admins to bypass the user_id restriction

-- First, create a function to check if the current user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policy if it exists (we'll recreate it)
DROP POLICY IF EXISTS "Users can view their own bots" ON bots;

-- Recreate the policy to allow users to view their own bots
CREATE POLICY "Users can view their own bots"
  ON bots FOR SELECT
  USING (auth.uid() = user_id);

-- Add new policy for super admins to view all bots
CREATE POLICY "Super admins can view all bots"
  ON bots FOR SELECT
  USING (is_super_admin());

-- Also update bot_actions policies to allow super admins
DROP POLICY IF EXISTS "Users can view actions of their bots" ON bot_actions;

CREATE POLICY "Users can view actions of their bots"
  ON bot_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_actions.bot_id
      AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all bot actions"
  ON bot_actions FOR SELECT
  USING (is_super_admin());

-- Also allow super admins to view all integrations
DROP POLICY IF EXISTS "Super admins can view all integrations" ON integrations;

CREATE POLICY "Super admins can view all integrations"
  ON integrations FOR SELECT
  USING (is_super_admin());

