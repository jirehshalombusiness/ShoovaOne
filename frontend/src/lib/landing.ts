import type { User } from '@/types/user.types';

/**
 * Where a user lands after authentication.
 *
 * Every authenticated user lands on /dashboard. The dashboard is
 * portfolio-aware: personal work for everyone, plus organisation,
 * HR and CRM panels only for the permissions a user actually has.
 *
 * Forced password change still takes priority.
 *
 * Used by:
 *   - PublicRoute (post-login redirect)
 *   - The index route
 *   - The catch-all route
 *   - LoginPage submit handler
 *   - Logout redirect
 */
export function landingPath(user: User | null): string {
  if (!user) return '/login';

  if (user.must_change_password) {
    return '/change-password';
  }

  return '/dashboard';
}
