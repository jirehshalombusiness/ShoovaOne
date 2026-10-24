import { useEffect, useState } from 'react';
import { Menu, Search } from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { UserMenu } from '@/components/ui/UserMenu';
import { CreateMenu } from '@/components/ui/CreateMenu';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import { SessionIndicator } from '@/components/ui/SessionIndicator';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const shortcutLabel =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl K';

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;

    const handleScroll = () => setScrolled(main.scrollTop > 0);

    main.addEventListener('scroll', handleScroll);
    return () => main.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
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

      {/* Desktop search — opens the command palette */}
      <div className="hidden lg:flex flex-1 max-w-md">
        <button
          onClick={() => setPaletteOpen(true)}
          className="relative w-full pl-9 pr-16 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-left text-sm text-gray-400 hover:bg-white hover:border-gray-300 transition-colors"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          Search people, projects, tasks...
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono text-gray-400">
            {shortcutLabel}
          </kbd>
        </button>
      </div>

      {/* Desktop right actions */}
      <div className="hidden lg:flex items-center gap-1 ml-auto">
        <ThemeToggle />
        <CreateMenu />
        <NotificationBell />
        <SessionIndicator />
        <div className="ml-1">
          <UserMenu />
        </div>
      </div>

      {/* Mobile: search + notification + user */}
      <div className="lg:hidden flex items-center gap-1 ml-auto">
        <button
          onClick={() => setPaletteOpen(true)}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Search"
        >
          <Search className="w-5 h-5 text-gray-700" strokeWidth={1.75} />
        </button>
        <ThemeToggle />
        <NotificationBell />
        <UserMenu />
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </header>
  );
}