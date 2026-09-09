import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  FileText, 
  Calendar, 
  CheckSquare,
  LogOut,
  ShieldCheck,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { icon: ShieldCheck, label: 'User access', path: '/users', permission: 'users.manage' },
    ],
  },
  {
    label: 'People & Work',
    items: [
      { icon: Users, label: 'People', path: '/people' },
      { icon: Briefcase, label: 'HR', path: '/hr', permission: 'hr.view_sensitive' },
      { icon: Clock, label: 'Attendance', path: '/attendance' },
      { icon: FileText, label: 'Timesheets', path: '/timesheets' },
      { icon: Calendar, label: 'Projects', path: '/projects' },
      { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
    ],
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getUserInitials = () => {
    if (!user) return '?';
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return `${first}${last}`.toUpperCase() || '?';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="w-[258px] bg-white border-r border-border flex flex-col flex-shrink-0 fixed inset-0 right-auto z-20 overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-6 border-b border-border">
        <div className="w-10 h-10 rounded-[11px] bg-primary flex items-center justify-center text-white font-extrabold text-lg">
          S
        </div>
        <div>
          <div className="text-[17px] font-extrabold tracking-tight text-text">SHOOVA ONE</div>
          <div className="text-[10px] text-muted mt-0.5">Management Platform</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="nav-section">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                (!item.permission || user?.permissions?.includes(item.permission)) && (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  className={({ isActive }) => cn('nav-item', isActive && 'active')}
                >
                  <item.icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  <span>{item.label}</span>
                </NavLink>
                )
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-[#f6f8f7]">
          <div className="avatar">
            {getUserInitials()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text truncate">
              {user?.first_name || 'User'} {user?.last_name || ''}
            </p>
            <p className="text-[11px] text-muted truncate">
              {user?.roles?.[0] || 'Member'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-md hover:bg-white transition-colors text-muted hover:text-red-600"
            title="Logout"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}