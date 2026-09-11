import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, CheckSquare, Users, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onMoreClick: () => void;
}

const TABS = [
  { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
  { icon: Briefcase, label: 'Work', path: '/my-work' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
  { icon: Users, label: 'People', path: '/people' },
];

export function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-200 z-30 flex items-stretch safe-area-inset-bottom">
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) =>
            cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
              isActive ? 'text-primary' : 'text-gray-500'
            )
          }
        >
          {({ isActive }) => (
            <>
              <tab.icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}

      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-gray-500 transition-colors"
      >
        <MoreHorizontal className="w-5 h-5" strokeWidth={1.75} />
        <span className="text-[10px] font-medium">More</span>
      </button>
    </nav>
  );
}