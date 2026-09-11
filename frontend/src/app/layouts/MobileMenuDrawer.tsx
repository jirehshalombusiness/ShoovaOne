import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  X,
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
  Briefcase,
  BarChart3,
  FolderKanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';

interface MobileMenuDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NAV_SECTIONS = [
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

export function MobileMenuDrawer({ open, onClose }: MobileMenuDrawerProps) {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const filtered = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item: any) => {
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
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-white z-50 flex flex-col transition-transform duration-250 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-[15px] text-gray-900 tracking-tight">
              Shoova ONE
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-gray-700" strokeWidth={1.75} />
          </button>
        </div>

        {/* User card */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {user?.first_name} {user?.last_name}
              </div>
              <div className="text-xs text-gray-500 truncate">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {filtered.map((section) => (
            <div key={section.label} className="mb-4">
              <div className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item: any) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )
                    }
                  >
                    <item.icon className="w-4.5 h-4.5 flex-shrink-0" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-100 p-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}