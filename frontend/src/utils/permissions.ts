import type { User } from '@/types/api';

/**
 * Get all permissions from user's roles
 */
export function getUserPermissions(user: User | null): string[] {
  if (!user || !user.roles) return [];

  const permissions = new Set<string>();
  for (const role of user.roles) {
    if (role.permissions) {
      role.permissions.forEach(perm => permissions.add(perm));
    }
  }

  return Array.from(permissions);
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: User | null, permission: string): boolean {
  const permissions = getUserPermissions(user);
  return permissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(user: User | null, requiredPermissions: string[]): boolean {
  const permissions = getUserPermissions(user);
  return requiredPermissions.some(perm => permissions.includes(perm));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(user: User | null, requiredPermissions: string[]): boolean {
  const permissions = getUserPermissions(user);
  return requiredPermissions.every(perm => permissions.includes(perm));
}
