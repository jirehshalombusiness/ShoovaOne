import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  MessageSquare,
  Users,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHRAccess } from '@/hooks/useHRAccess';
import { useChatUnread } from '@/hooks/useChatConversations';

interface MobileBottomNavProps {
  onMoreClick: () => void;
}

const TABS = [
  { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
  { icon: Briefcase, label: 'Work', path: '/my-work' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks', permission: 'tasks.view' },
  { icon: Users, label: 'People', path: '/people', permission: 'people.view' },
];

export function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  const access = useHRAccess();
  const chatUnread = useChatUnread();
  const tabs = TABS.filter(
    (tab) => !tab.permission || access.has(tab.permission),
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-200 z-30 flex items-stretch safe-area-inset-bottom">
      {tabs.map((tab) => (
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
              <span className="relative inline-flex">
                <tab.icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2.25 : 1.75}
                />

                {tab.path === '/chat' && chatUnread > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold text-white">
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                )}
              </span>

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