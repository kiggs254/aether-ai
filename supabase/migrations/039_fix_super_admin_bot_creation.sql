-- Fix super admin bot creation RLS issue
-- This migration modifies the existing INSERT policy to include super admin check
-- Instead of relying on the function (which may not work in WITH CHECK context),
-- we use an inline EXISTS check for better reliability

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create their own bots" ON bots;

-- Recreate with inline super admin check
-- This allows both regular users (creating their own bots) and super admins (creating any bot)
-- Using inline EXISTS instead of function call for better RLS compatibility
CREATE POLICY "Users can create their own bots"
  ON bots FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- Also fix the UPDATE policy to allow super admins
DROP POLICY IF EXISTS "Users can update their own bots" ON bots;

CREATE POLICY "Users can update their own bots"
  ON bots FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- Also fix the DELETE policy to allow super admins
DROP POLICY IF EXISTS "Users can delete their own bots" ON bots;

CREATE POLICY "Users can delete their own bots"
  ON bots FOR DELETE
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1
      FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- Note: We keep the separate "Super admins can create/update/delete bots" policies from migration 038
-- as they provide additional explicit super admin access, but the combined policies above should work too

