import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  HelpCircle,
  Command,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Avatar } from './Avatar';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 p-1 pr-1.5 rounded-md transition-colors',
          open ? 'bg-gray-100' : 'hover:bg-gray-100'
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar
          firstName={user?.first_name}
          lastName={user?.last_name}
          imageUrl={user?.profile_image_url}
          size="sm"
        />
        <ChevronDown
          className={cn(
            'w-3 h-3 text-gray-500 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-fade-in z-50"
        >
          {/* User info header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Avatar
                firstName={user?.first_name}
                lastName={user?.last_name}
                imageUrl={user?.profile_image_url}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {user?.email}
                </div>
              </div>
            </div>

            {/* Roles badges */}
            {user?.roles && user.roles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {user.roles.slice(0, 3).map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 capitalize"
                  >
                    {role.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={() => go('/profile')}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              role="menuitem"
            >
              <UserIcon className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              My Profile
            </button>

            <button
              onClick={() => go('/settings')}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              role="menuitem"
            >
              <Settings className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              Settings
            </button>

            {user?.permissions?.includes('users.manage') && (
              <button
                onClick={() => go('/users')}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                role="menuitem"
              >
                <Shield className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
                Admin Panel
              </button>
            )}

            <button
              onClick={() => go('/help')}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              role="menuitem"
            >
              <HelpCircle className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              Help & Support
            </button>
          </div>

          <div className="px-4 py-2 border-t border-gray-100 hidden lg:block">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span className="flex items-center gap-1.5">
                <Command className="w-3 h-3" />
                Quick menu
              </span>
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="border-t border-gray-100 py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              role="menuitem"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}