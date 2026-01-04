import { useState, useEffect } from 'react';
import { isSuperAdmin, getAdminUser, AdminUser } from './admin';

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

