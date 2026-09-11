import { Menu, Search, Bell, Plus, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useAuth } from '@/lib/auth';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '?';

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-3 lg:px-5 gap-2 lg:gap-4 flex-shrink-0 sticky top-0 z-20">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-gray-700" strokeWidth={1.75} />
      </button>

      {/* Brand (mobile only) */}
      <div className="lg:hidden flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
          <span className="text-white font-bold text-sm">S</span>
        </div>
        <span className="font-semibold text-[15px] text-gray-900 tracking-tight">
          Shoova ONE
        </span>
      </div>

      {/* Desktop search */}
      <div className="hidden lg:flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search people, projects, tasks..."
            className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-300 transition-colors"
          />
        </div>
      </div>

      {/* Mobile search icon */}
      <button
        onClick={() => setSearchOpen(!searchOpen)}
        className="lg:hidden ml-auto p-2 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Search"
      >
        <Search className="w-5 h-5 text-gray-700" strokeWidth={1.75} />
      </button>

      {/* Right actions */}
      <div className="hidden lg:flex items-center gap-1 ml-auto">
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
          <Plus className="w-4 h-4" />
          Create
          <ChevronDown className="w-3 h-3 ml-0.5" />
        </button>

        <NotificationBell />

        <div className="relative ml-1">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-white text-[11px] font-semibold">
              {initials}
            </div>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Mobile: notifications only */}
      <div className="lg:hidden flex items-center gap-1 ml-1">
        <NotificationBell />
      </div>
    </header>
  );
}