import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  Calendar,
  CheckSquare,
  Building2,
  BookOpen,
  CalendarDays,
  Settings,
  LogOut,
  DollarSign,
  Shield,
  ChevronDown,
  Briefcase,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path?: string;
  permission?: string;
  children?: NavItem[];
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
      { icon: FolderKanbanIcon, label: 'Projects', path: '/projects' },
      { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
      { icon: Clock, label: 'Timesheets', path: '/timesheets' },
      { icon: FileText, label: 'Attendance', path: '/attendance' },
    ],
  },
  {
    label: 'People & HR',
    items: [
      { icon: Users, label: 'People', path: '/people' },
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
    ],
  },
];

// Simple icon placeholder to avoid import errors
function FolderKanbanIcon(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="M8 10v4" />
      <path d="M12 10v2" />
      <path d="M16 10v6" />
    </svg>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const filtered = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    }),
  })).filter((section) => section.items.length > 0);

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '?';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[240px] bg-white border-r border-gray-200 flex flex-col z-30">
      {/* Brand */}
      <div className="h-14 flex items-center px-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-semibold text-[15px] text-gray-900 tracking-tight">
            Shoova ONE
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {filtered.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.path || item.label}
                  to={item.path || '#'}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors',
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="border-t border-gray-100 p-2">
        <div className="group flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-gray-50 transition-colors">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 text-[11px] font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-gray-900 truncate">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="text-[10px] text-gray-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded-md hover:bg-gray-200 transition-colors text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}