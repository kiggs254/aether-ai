# Admin Panel Setup Guide

## How to Create Your First Admin User

### Method 1: Using Supabase Dashboard (Recommended)

1. **Sign up/Login to your app** with the email you want to use as admin
2. **Go to Supabase Dashboard** → Your Project → Authentication → Users
3. **Find your user** and copy the User ID (UUID)
4. **Go to Table Editor** → `admin_users` table
5. **Click "Insert row"** and enter:
   - `user_id`: Paste the User ID you copied
   - `role`: `super_admin`
6. **Click "Save"**

### Method 2: Using SQL Editor

1. **Sign up/Login to your app** with the email you want to use as admin
2. **Go to Supabase Dashboard** → SQL Editor
3. **Run this query** (replace `YOUR_USER_ID_HERE` with your actual user ID):

```sql
INSERT INTO admin_users (user_id, role) 
VALUES ('YOUR_USER_ID_HERE', 'super_admin')
ON CONFLICT (user_id) DO NOTHING;
```

To find your User ID:
- Go to Authentication → Users in Supabase Dashboard
- Or run: `SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';`

### Method 3: Using Supabase CLI

```bash
# Connect to your database
supabase db connect

# Then run:
INSERT INTO admin_users (user_id, role) 
VALUES ('your-user-id-here', 'super_admin')
ON CONFLICT (user_id) DO NOTHING;
```

## How to Access Admin Panel

Once you've created an admin user:

1. **Log in** to your app with the admin account
2. **Look for admin menu items** in the sidebar:
   - **"Manage Plans"** - Create and edit subscription plans
   - **"Subscriptions"** - View and manage all user subscriptions
3. **Click on either menu item** to access the admin panel

## Admin Features

### Manage Plans (`/admin/plans`)
- Create new subscription plans
- Edit existing plans (pricing, features, limits)
- Deactivate plans
- View all plans including inactive ones

### Manage Subscriptions (`/admin/subscriptions`)
- View all user subscriptions
- Filter by status, plan, or user
- Edit subscription status
- Change user plans
- View transaction history per user
- Cancel or reactivate subscriptions

## Security Notes

- Only users with `role = 'super_admin'` in the `admin_users` table can access admin panels
- Admin access is verified both in the frontend and in edge functions
- RLS is disabled on `admin_users` table to avoid infinite recursion
- Admin operations are secured via edge functions that verify admin status

## Troubleshooting

**Can't see admin menu items?**
- Make sure you're logged in with the admin account
- Verify the user exists in `admin_users` table with `role = 'super_admin'`
- Check browser console for any errors
- Try refreshing the page

**Getting "Access Denied" error?**
- Verify your user ID matches exactly in `admin_users` table
- Check that `role` is exactly `'super_admin'` (case-sensitive)
- Make sure you're logged in with the correct account

