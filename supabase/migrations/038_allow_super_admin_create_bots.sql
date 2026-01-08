-- Allow super admins to create, update, and delete bots
-- This migration adds RLS policies that allow super admins to bypass user_id restrictions for write operations

-- Add INSERT policy for super admins
CREATE POLICY "Super admins can create bots"
  ON bots FOR INSERT
  WITH CHECK (is_super_admin());

-- Add UPDATE policy for super admins
CREATE POLICY "Super admins can update all bots"
  ON bots FOR UPDATE
  USING (is_super_admin());

-- Add DELETE policy for super admins
CREATE POLICY "Super admins can delete all bots"
  ON bots FOR DELETE
  USING (is_super_admin());

-- Also allow super admins to create, update, and delete integrations
CREATE POLICY "Super admins can create integrations"
  ON integrations FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update all integrations"
  ON integrations FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "Super admins can delete all integrations"
  ON integrations FOR DELETE
  USING (is_super_admin());

