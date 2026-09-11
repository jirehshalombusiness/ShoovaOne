import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  CheckSquare,
  Building2,
  BookOpen,
  CalendarDays,
  Settings,
  LogOut,
  DollarSign,
  Shield,
  Briefcase,
  BarChart3,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserCog,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { Avatar } from '@/components/ui/Avatar';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  permission?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: Briefcase, label: 'My Work', path: '/my-work' },
    ],
  },
  {
    label: 'Work',
    items: [
      { icon: FolderKanban, label: 'Projects', path: '/projects' },
      { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
      { icon: Clock, label: 'Timesheets', path: '/timesheets' },
      { icon: FileText, label: 'Attendance', path: '/attendance' },
    ],
  },
  {
    label: 'People & HR',
    items: [
      { icon: Users, label: 'People', path: '/people' },
      { icon: Network, label: 'Org Chart', path: '/people/org-chart' },
      { icon: Shield, label: 'HR', path: '/hr', permission: 'hr.view_sensitive' },
    ],
  },
  {
    label: 'Business',
    items: [
      { icon: Building2, label: 'CRM', path: '/organisations' },
      { icon: BookOpen, label: 'Programmes', path: '/programmes' },
      { icon: CalendarDays, label: 'Events', path: '/events' },
      { icon: DollarSign, label: 'Finance', path: '/finance', permission: 'finance.view' },
    ],
  },
  {
    label: 'System',
    items: [
      { icon: BarChart3, label: 'Reports', path: '/reports' },
      { icon: Settings, label: 'Settings', path: '/settings' },
      { icon: UserCog, label: 'User Management', path: '/users', permission: 'users.manage' },
      { icon: ShieldCheck, label: 'Roles & Permissions', path: '/roles', permission: 'roles.manage' },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  const filtered = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.permission || hasPermission(item.permission)
    ),
  })).filter((section) => section.items.length > 0);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 bottom-0 bg-white border-r border-gray-200 flex flex-col z-30',
        'transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* Brand + Toggle */}
      <div
        className={cn(
          'h-14 flex items-center border-b border-gray-100 transition-all duration-300',
          collapsed ? 'justify-center px-2' : 'justify-between px-3'
        )}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span
            className={cn(
              'font-semibold text-[15px] text-gray-900 tracking-tight whitespace-nowrap transition-all duration-200',
              collapsed ? 'opacity-0 w-0 ml-0' : 'opacity-100 w-auto ml-0'
            )}
          >
            Shoova ONE
          </span>
        </div>

        {!collapsed && (
          <button
            onClick={onToggle}
            title="Collapse sidebar"
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}

        {collapsed && (
          <button
            onClick={onToggle}
            title="Expand sidebar"
            className="absolute top-3.5 right-2 p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors opacity-0 hover:opacity-100"
          >
            <PanelLeftOpen className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300',
          collapsed ? 'px-2 py-3' : 'px-2 py-3'
        )}
      >
        {filtered.map((section) => (
          <div key={section.label} className={cn('mb-4', collapsed && 'mb-2')}>
            {!collapsed ? (
              <div className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {section.label}
              </div>
            ) : (
              <div className="h-px bg-gray-100 mx-2 mb-2" />
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center rounded-md text-[13px] font-medium transition-colors',
                      collapsed
                        ? 'justify-center px-0 py-2'
                        : 'gap-2.5 px-3 py-[7px]',
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                >
                  <item.icon
                    className="w-4 h-4 flex-shrink-0"
                    strokeWidth={1.75}
                  />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}

                  {collapsed && (
                    <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[11px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="border-t border-gray-100 p-2">
        <div
          className={cn(
            'group flex items-center rounded-md hover:bg-gray-50 transition-colors',
            collapsed ? 'justify-center p-1.5' : 'gap-2.5 px-3 py-2'
          )}
        >
          <Avatar
            firstName={user?.first_name}
            lastName={user?.last_name}
            imageUrl={user?.profile_image_url}
            size="sm"
          />

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-gray-900 truncate">
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {user?.email}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 rounded-md hover:bg-gray-200 transition-colors text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {collapsed && (
            <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[11px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              {user?.first_name} {user?.last_name}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}