import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';

export interface HRAccess {
  // Role shortcuts
  isCEO: boolean;
  isHRApprover: boolean;
  isHRSensitive: boolean;

  // Permission checks
  canViewSensitive: boolean;
  canEditSensitive: boolean;
  canViewEmployment: boolean;
  canEditEmployment: boolean;
  canViewCompensation: boolean;
  canEditCompensation: boolean;
  canViewLeave: boolean;
  canEditLeave: boolean;
  canViewPerformance: boolean;
  canEditPerformance: boolean;

  canManagePeople: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
  canViewAudit: boolean;

  // Meta
  canAccessHRAdmin: boolean;

  // Helpers
  has: (permission: string | string[]) => boolean;
  hasAny: (permissions: string[]) => boolean;
  hasAll: (permissions: string[]) => boolean;
}

const HR_APPROVER_ROLES = new Set([
  'ceo',
  'head_of_hr',
  'director',
  'executive_director',
]);

const HR_SENSITIVE_ROLES = new Set([
  'ceo',
  'head_of_hr',
]);

export function useHRAccess(): HRAccess {
  const { user } = useAuth();

  return useMemo<HRAccess>(() => {
    const roles = user?.roles ?? [];
    const permissions = user?.permissions ?? [];

    const isCEO = roles.includes('ceo');
    const isHRApprover = roles.some((r) => HR_APPROVER_ROLES.has(r));
    const isHRSensitive = roles.some((r) => HR_SENSITIVE_ROLES.has(r));

    const has = (permission: string | string[]): boolean => {
      // CEO bypasses everything, matching the backend.
      if (isCEO) return true;

      if (Array.isArray(permission)) {
        return permission.some((p) => permissions.includes(p));
      }
      return permissions.includes(permission);
    };

    const hasAny = (perms: string[]): boolean => {
      if (isCEO) return true;
      return perms.some((p) => permissions.includes(p));
    };

    const hasAll = (perms: string[]): boolean => {
      if (isCEO) return true;
      return perms.every((p) => permissions.includes(p));
    };

    const canViewSensitive = has('hr.view_sensitive');
    const canEditSensitive = has('hr.edit_sensitive');
    const canViewEmployment = has('hr.view_employment');
    const canEditEmployment = has('hr.edit_employment');
    const canViewCompensation = has('hr.view_compensation');
    const canEditCompensation = has('hr.edit_compensation');
    const canViewLeave = has('hr.view_leave');
    const canEditLeave = has('hr.edit_leave');
    const canViewPerformance = has('hr.view_performance');
    const canEditPerformance = has('hr.edit_performance');

    const canManagePeople = has('people.edit');
    const canManageUsers = has('users.manage');
    const canManageRoles = has('roles.manage');
    const canViewAudit = has('audit.view');

    // Anything that lives under /hr requires at least one HR permission.
    const canAccessHRAdmin =
      canViewSensitive ||
      canEditSensitive ||
      canViewEmployment ||
      canEditEmployment ||
      canViewCompensation ||
      canEditCompensation ||
      canViewLeave ||
      canEditLeave ||
      canViewPerformance ||
      canEditPerformance ||
      isHRApprover;

    return {
      isCEO,
      isHRApprover,
      isHRSensitive,

      canViewSensitive,
      canEditSensitive,
      canViewEmployment,
      canEditEmployment,
      canViewCompensation,
      canEditCompensation,
      canViewLeave,
      canEditLeave,
      canViewPerformance,
      canEditPerformance,

      canManagePeople,
      canManageUsers,
      canManageRoles,
      canViewAudit,

      canAccessHRAdmin,

      has,
      hasAny,
      hasAll,
    };
  }, [user]);
}