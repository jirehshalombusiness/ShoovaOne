import { Search, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { NotificationBell } from '@/components/ui/NotificationBell';

export function TopBar() {
  const { user } = useAuth();

  const getUserInitials = () => {
    if (!user) return '?';
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return `${first}${last}`.toUpperCase() || '?';
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      console.log('🔍 Searching for:', e.currentTarget.value.trim());
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search people, projects, tasks..."
            onKeyDown={handleSearch}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <NotificationBell />

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-700">
              {user?.first_name || 'User'} {user?.last_name || ''}
            </p>
            <p className="text-xs text-gray-500">{user?.email || 'Not logged in'}</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
            <span className="text-sm font-semibold text-primary">
              {getUserInitials()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}