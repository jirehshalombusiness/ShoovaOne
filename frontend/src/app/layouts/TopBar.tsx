import { useEffect, useState } from 'react';
import { Menu, Search } from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { UserMenu } from '@/components/ui/UserMenu';
import { CreateMenu } from '@/components/ui/CreateMenu';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;

    const handleScroll = () => setScrolled(main.scrollTop > 0);

    main.addEventListener('scroll', handleScroll);
    return () => main.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'h-14 bg-white flex items-center px-3 lg:px-5 gap-2 lg:gap-3 flex-shrink-0 sticky top-0 z-20',
        'border-b transition-shadow duration-200',
        scrolled ? 'shadow-sm border-gray-200' : 'border-gray-100'
      )}
    >
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-gray-700" strokeWidth={1.75} />
      </button>

      {/* Mobile brand */}
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

      {/* Desktop right actions */}
      <div className="hidden lg:flex items-center gap-1 ml-auto">
        <CreateMenu />
        <NotificationBell />
        <div className="ml-1">
          <UserMenu />
        </div>
      </div>

      {/* Mobile: notification + user */}
      <div className="lg:hidden flex items-center gap-1 ml-auto">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}