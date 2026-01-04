import { supabase } from './supabase';
import { useState, useEffect } from 'react';

export interface AdminUser {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

/**
 * Check if the current user is a super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    return !error && !!data;
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

/**
 * Hook to use admin status in React components
 * Returns { isAdmin, loading, adminUser }
 */
export function useAdminStatus() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      setLoading(true);
      const admin = await isSuperAdmin();
      const adminData = await getAdminUser();
      setIsAdmin(admin);
      setAdminUser(adminData);
      setLoading(false);
    }
    checkAdmin();
  }, []);

  return { isAdmin, loading, adminUser };
}

