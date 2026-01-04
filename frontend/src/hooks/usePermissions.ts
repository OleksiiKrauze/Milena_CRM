import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';

/**
 * Hook to check user permissions based on their roles
 *
 * Usage:
 * ```tsx
 * const { hasPermission, hasAnyPermission, hasAllPermissions, permissions } = usePermissions();
 *
 * if (hasPermission('cases:create')) {
 *   // Show create button
 * }
 * ```
 */
export function usePermissions() {
  const user = useAuthStore((state) => state.user);

  // Get all unique permissions from user's roles
  const permissions = useMemo(() => {
    if (!user || !user.roles) {
      return [];
    }

    const allPermissions = new Set<string>();
    user.roles.forEach((role) => {
      role.permissions.forEach((permission) => {
        allPermissions.add(permission);
      });
    });

    return Array.from(allPermissions);
  }, [user]);

  /**
   * Check if user has a specific permission
   * @param permission - Permission code (e.g., "cases:read", "users:create")
   * @returns true if user has the permission, false otherwise
   */
  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  /**
   * Check if user has at least one of the specified permissions
   * @param requiredPermissions - Array of permission codes
   * @returns true if user has at least one permission, false otherwise
   */
  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.some((perm) => permissions.includes(perm));
  };

  /**
   * Check if user has all of the specified permissions
   * @param requiredPermissions - Array of permission codes
   * @returns true if user has all permissions, false otherwise
   */
  const hasAllPermissions = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.every((perm) => permissions.includes(perm));
  };

  /**
   * Check if user is an admin (has all permissions or has admin role)
   * @returns true if user is admin, false otherwise
   */
  const isAdmin = useMemo(() => {
    if (!user || !user.roles) {
      return false;
    }
    return user.roles.some((role) => role.name === 'admin');
  }, [user]);

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
  };
}
