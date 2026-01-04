-- Create Admin User
-- This migration helps you create your first super admin user
-- 
-- INSTRUCTIONS:
-- 1. First, sign up/login to your app with the email you want to use as admin
-- 2. Get your user ID from the auth.users table in Supabase Dashboard
-- 3. Replace 'YOUR_USER_ID_HERE' below with your actual user ID
-- 4. Run this migration
--
-- OR use the Supabase SQL Editor to run:
-- INSERT INTO admin_users (user_id, role) 
-- VALUES ('your-user-id-from-auth-users', 'super_admin');

-- Example: Uncomment and modify the line below with your user ID
-- INSERT INTO admin_users (user_id, role) 
-- VALUES ('YOUR_USER_ID_HERE', 'super_admin')
-- ON CONFLICT (user_id) DO NOTHING;

-- Note: You can also create admin users directly via Supabase Dashboard:
-- 1. Go to Table Editor > admin_users
-- 2. Click "Insert row"
-- 3. Enter your user_id (from auth.users table)
-- 4. Set role to 'super_admin'
-- 5. Save

