import { supabase } from './supabase';

export interface AdminUser {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

/**
 * Check if the current user is a super admin
 * 
 * Security Note: The admin_users table has RLS disabled to prevent infinite recursion
 * when checking admin status in RLS policies. Database functions use SECURITY DEFINER
 * to query this table with elevated privileges. This function queries directly since
 * RLS is disabled, but access is still controlled by authentication (valid JWT required).
 */
export async function isSuperAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    // Since RLS is disabled on admin_users, we can query directly
    // Use maybeSingle() instead of single() to avoid errors when no record exists
    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    const isAdmin = !error && !!data;
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get admin user data for the current user
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    if (error || !data) return null;
    return data as AdminUser;
  } catch (error) {
    console.error('Error fetching admin user:', error);
    return null;
  }
}

