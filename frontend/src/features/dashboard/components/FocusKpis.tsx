import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { myWorkService } from '@/services/mywork.service';
import { useNotifications } from '@/lib/notifications';
import { useHRAccess } from '@/hooks/useHRAccess';
import {
  CheckSquare,
  CalendarClock,
  AlertTriangle,
  Inbox,
  CalendarDays,
  Bell,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const toneStyles = {
  default: {
    icon: 'bg-gray-100 text-gray-600',
    value: 'text-gray-900',
  },
  primary: {
    icon: 'bg-primary/10 text-primary',
    value: 'text-gray-900',
  },
  success: {
    icon: 'bg-emerald-50 text-emerald-600',
    value: 'text-gray-900',
  },
  warning: {
    icon: 'bg-amber-50 text-amber-600',
    value: 'text-amber-700',
  },
  danger: {
    icon: 'bg-red-50 text-red-600',
    value: 'text-red-700',
  },
  info: {
    icon: 'bg-blue-50 text-blue-600',
    value: 'text-gray-900',
  },
} as const;

type Tone = keyof typeof toneStyles;

interface Kpi {
  key: string;
  label: string;
  value: number | string;
  hint: string;
  icon: React.ElementType;
  tone: Tone;
  path: string;
}

export function FocusKpis() {
  const navigate = useNavigate();
  const access = useHRAccess();
  const { unreadCount } = useNotifications();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['my-work', 'summary'],
    queryFn: () => myWorkService.getSummary(),
    refetchInterval: 60_000,
  });

  const tasksPath = access.has('tasks.view') ? '/tasks' : '/my-work';

  const kpis: Kpi[] = [
    {
      key: 'open',
      label: 'Open tasks',
      value: summary?.open_tasks ?? '—',
      hint: 'Assigned to you',
      icon: CheckSquare,
      tone: 'primary',
      path: tasksPath,
    },
    {
      key: 'due-today',
      label: 'Due today',
      value: summary?.tasks_due_today ?? '—',
      hint: (summary?.tasks_due_today ?? 0) > 0 ? 'Needs attention' : 'Nothing due',
      icon: CalendarClock,
      tone: (summary?.tasks_due_today ?? 0) > 0 ? 'info' : 'default',
      path: '/my-work',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: summary?.overdue_tasks ?? '—',
      hint: (summary?.overdue_tasks ?? 0) > 0 ? 'Past due date' : 'All on track',
      icon: AlertTriangle,
      tone: (summary?.overdue_tasks ?? 0) > 0 ? 'danger' : 'success',
      path: '/my-work',
    },
    {
      key: 'approvals',
      label: 'Approvals',
      value: summary?.pending_approvals ?? '—',
      hint: (summary?.pending_approvals ?? 0) > 0 ? 'Waiting on you' : 'Inbox clear',
      icon: Inbox,
      tone: (summary?.pending_approvals ?? 0) > 0 ? 'warning' : 'default',
      path: '/me/approvals',
    },
    {
      key: 'meetings',
      label: 'Meetings today',
      value: summary?.meetings_today ?? '—',
      hint: (summary?.meetings_today ?? 0) > 0 ? 'On your calendar' : 'Calendar clear',
      icon: CalendarDays,
      tone: 'info',
      path: '/meetings/today',
    },
    {
      key: 'notifications',
      label: 'Unread',
      value: unreadCount,
      hint: unreadCount > 0 ? 'Notifications to review' : 'You are up to date',
      icon: Bell,
      tone: unreadCount > 0 ? 'warning' : 'success',
      path: '/notifications',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const tone = toneStyles[kpi.tone];

        return (
          <button
            key={kpi.key}
            onClick={() => navigate(kpi.path)}
            className="group relative text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                  tone.icon,
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div
              className={cn(
                'text-2xl font-bold tabular-nums mt-3',
                tone.value,
                isLoading && 'text-gray-200 animate-pulse',
              )}
            >
              {isLoading ? '—' : kpi.value}
            </div>

            <div className="text-[12px] font-medium text-gray-700 mt-0.5">
              {kpi.label}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5 truncate">
              {kpi.hint}
            </div>
          </button>
        );
      })}
    </div>
  );
}
