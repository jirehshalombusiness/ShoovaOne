import type { User } from '@/types/user.types';

/**
 * Where a user should land after authentication.
 *
 * Order of preference:
 *   1. Forced password change takes priority over everything
 *   2. CEO / exec -> /dashboard (org-wide executive overview)
 *   3. HR staff  -> /hr (approval inbox is their morning routine)
 *   4. Finance   -> /finance
 *   5. Everyone else -> /me (their personal HR home)
 *
 * This function is the single source of truth for landing decisions.
 * Used by:
 *   - PublicRoute (post-login redirect)
 *   - The catch-all route
 *   - LoginPage submit handler
 *   - Logout redirect
 */
export function landingPath(user: User | null): string {
  if (!user) return '/login';

  if (user.must_change_password) {
    return '/change-password';
  }

  const roles = user.roles ?? [];
  const permissions = user.permissions ?? [];

  const isCEO = roles.includes('ceo');
  const hasExecutiveDashboard = permissions.includes('dashboard.executive');

  if (isCEO || hasExecutiveDashboard) {
    return '/dashboard';
  }

  if (permissions.includes('hr.view_sensitive')) {
    return '/hr';
  }

  if (permissions.includes('finance.view')) {
    return '/finance';
  }

  return '/me';
}