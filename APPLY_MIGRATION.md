# Apply Migration 038 - Super Admin Bot Creation

## The Problem
Super admins can't create bots because RLS (Row Level Security) policies are blocking the INSERT operation, even though the application-level validation passes.

## The Solution
You need to apply migration `038_allow_super_admin_create_bots.sql` to your Supabase database.

## How to Apply

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/038_allow_super_admin_create_bots.sql`
4. Paste it into the SQL Editor
5. Click **Run** to execute the migration

### Option 2: Via Supabase CLI
If you have Supabase CLI installed:
```bash
supabase db push
```

### Option 3: Manual SQL Execution
Run this SQL in your Supabase SQL Editor:

```sql
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
```

## Verify It Worked
After applying the migration, try creating a bot again. You should see in the console:
- `[saveBot] ✅ Super admin confirmed - bypassing ALL bot limit checks`
- The bot should be created successfully without a 400 error

## Troubleshooting
If you still get errors after applying the migration:
1. Verify the `is_super_admin()` function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'is_super_admin';
   ```
2. Verify you're in the `admin_users` table:
   ```sql
   SELECT * FROM admin_users WHERE role = 'super_admin';
   ```
3. Test the function directly:
   ```sql
   SELECT is_super_admin();
   ```

