import { useAuth } from '@/lib/auth';

export function usePermissions() {
  const { user } = useAuth();

  const userPermissions: string[] = Array.isArray(user?.permissions)
    ? user!.permissions
    : [];

  const userRoles: string[] = Array.isArray(user?.roles)
    ? user!.roles
    : [];

  return {
    hasPermission: (permission: string) => userPermissions.includes(permission),
    hasAnyPermission: (permissions: string[]) =>
      permissions.some((p) => userPermissions.includes(p)),
    hasAllPermissions: (permissions: string[]) =>
      permissions.every((p) => userPermissions.includes(p)),
    hasRole: (role: string) => userRoles.includes(role),
    hasAnyRole: (roles: string[]) => roles.some((r) => userRoles.includes(r)),
    hasAllRoles: (roles: string[]) => roles.every((r) => userRoles.includes(r)),
  };
}