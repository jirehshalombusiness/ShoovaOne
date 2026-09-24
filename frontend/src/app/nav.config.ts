import type { ElementType } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  FolderKanban,
  CheckSquare,
  Clock,
  FileText,
  Users,
  Network,
  UserCircle2,
  Shield,
  Inbox,
  CalendarDays,
  Laptop,
  FileSignature,
  Award,
  BarChart3,
  Settings,
  UserCog,
  ShieldCheck,
  ClipboardList,
  Building2,
  BookOpen,
  CalendarPlus,
  DollarSign,
} from 'lucide-react';

export interface NavItem {
  icon: ElementType;
  label: string;
  path: string;
  /**
   * Permission required to see this item.
   * - undefined       -> always visible (auth required)
   * - string          -> user must have this exact permission
   * - string[]        -> user must have at least one
   */
  permission?: string | string[];
  /** Match this path exactly (no prefix matching). Used for index routes. */
  exact?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      {
        icon: LayoutDashboard,
        label: 'Dashboard',
        path: '/dashboard',
      },
      {
        icon: Briefcase,
        label: 'My Work',
        path: '/my-work',
      },
    ],
  },

  {
    label: 'Work',
    items: [
      {
        icon: FolderKanban,
        label: 'Projects',
        path: '/projects',
        permission: 'projects.view',
      },
      {
        icon: CheckSquare,
        label: 'Tasks',
        path: '/tasks',
        permission: 'tasks.view',
      },
      {
        icon: Clock,
        label: 'Timesheets',
        path: '/timesheets',
        permission: 'timesheets.view',
      },
      {
        icon: FileText,
        label: 'Attendance',
        path: '/attendance',
        permission: 'attendance.view',
      },
    ],
  },

  {
    label: 'People & HR',
    items: [
      {
        icon: UserCircle2,
        label: 'My HR',
        path: '/me',
      },
      {
        icon: Users,
        label: 'Directory',
        path: '/people',
        permission: 'people.view',
      },
      {
        icon: Network,
        label: 'Org Chart',
        path: '/people/org-chart',
        // permission: 'people.view',
      },
      {
        icon: Shield,
        label: 'HR Admin',
        path: '/hr',
        permission: 'hr.view_sensitive',
      },
    ],
  },

  {
    label: 'Business',
    items: [
      {
        icon: Building2,
        label: 'CRM',
        path: '/organisations',
        permission: 'crm.view',
      },
      {
        icon: BookOpen,
        label: 'Programmes',
        path: '/programmes',
        permission: 'programmes.view',
      },
      {
        icon: CalendarPlus,
        label: 'Events',
        path: '/events',
        permission: 'events.view',
      },
      {
        icon: DollarSign,
        label: 'Finance',
        path: '/finance',
        permission: 'finance.view',
      },
    ],
  },

  {
    label: 'System',
    items: [
      {
        icon: BarChart3,
        label: 'Reports',
        path: '/reports',
      },
      {
        icon: Settings,
        label: 'Settings',
        path: '/settings',
      },
      {
        icon: UserCog,
        label: 'Users',
        path: '/users',
        permission: 'users.manage',
      },
      {
        icon: ShieldCheck,
        label: 'Roles & Permissions',
        path: '/roles',
        permission: 'roles.manage',
      },
      {
        icon: ClipboardList,
        label: 'Audit Logs',
        path: '/audit',
        permission: 'audit.view',
      },
    ],
  },
];

// ============================================================
// SUB-NAV — used inside /me and /hr layouts
// ============================================================

export const ME_TABS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Home', path: '/me', exact: true },
  { icon: CalendarDays, label: 'Time Off', path: '/me/time-off' },
  { icon: Laptop, label: 'Devices', path: '/me/devices' },
  { icon: FileSignature, label: 'Contract', path: '/me/contract' },
  { icon: FileText, label: 'Documents', path: '/me/documents' },
];

export const HR_TABS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Overview', path: '/hr', exact: true },
  { icon: Inbox, label: 'Approvals', path: '/hr/approvals' },
  { icon: Users, label: 'Employees', path: '/hr/employees' },
  { icon: CalendarDays, label: 'Time Off', path: '/hr/time-off' },
  { icon: Award, label: 'Celebrations', path: '/hr/celebrations' },
  { icon: FileText, label: 'Documents', path: '/hr/documents' },
  { icon: DollarSign, label: 'Compensation', path: '/hr/compensation' },
  { icon: BarChart3, label: 'Reports', path: '/hr/reports' },
  { icon: Settings, label: 'Settings', path: '/hr/settings' },
];