import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors',
        className,
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="w-5 h-5" strokeWidth={1.75} />
      ) : (
        <Moon className="w-5 h-5" strokeWidth={1.75} />
      )}
    </button>
  );
}
