import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { myWorkService } from '@/services/mywork.service';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui/Avatar';
import {
  CheckSquare,
  Clock,
  Calendar,
  AlertCircle,
  TrendingUp,
  Briefcase,
  CheckCircle,
  FileText,
  ArrowRight,
  Plus,
  Circle,
  PlayCircle,
  PauseCircle,
  XCircle,
  Timer,
  Bell,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isPast, isTomorrow } from 'date-fns';

type Tab = 'overview' | 'tasks' | 'projects' | 'timesheet' | 'meetings' | 'activity';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'projects', label: 'My Projects', icon: Briefcase },
  { id: 'timesheet', label: 'Timesheet', icon: Clock },
  { id: 'meetings', label: 'Meetings', icon: Calendar },
  { id: 'activity', label: 'Activity', icon: FileText },
];

export function MyWorkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['my-work', 'summary'],
    queryFn: () => myWorkService.getSummary(),
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Work</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {greeting}, {user?.first_name}. Here's your personal workspace.
          </p>
        </div>
        <button
          onClick={() => navigate('/timesheets')}
          className="hidden sm:flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Time
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <OverviewTab summary={summary} loading={summaryLoading} />
      )}
      {tab === 'tasks' && <TasksTab />}
      {tab === 'projects' && <ProjectsTab />}
      {tab === 'timesheet' && <TimesheetTab summary={summary} />}
      {tab === 'meetings' && <MeetingsTab />}
      {tab === 'activity' && <ActivityTab />}
    </div>
  );
}

/* ========== OVERVIEW TAB ========== */

function OverviewTab({ summary, loading }: { summary: any; loading: boolean }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="h-7 w-12 bg-gray-200 rounded" />
              <div className="h-2.5 w-24 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Open Tasks',
      value: summary?.open_tasks ?? 0,
      description: `${summary?.tasks_due_today ?? 0} due today`,
      icon: CheckSquare,
      tone: 'primary',
      onClick: () => navigate('/tasks'),
    },
    {
      label: 'Overdue',
      value: summary?.overdue_tasks ?? 0,
      description: summary?.overdue_tasks > 0 ? 'Needs attention' : 'All caught up',
      icon: AlertCircle,
      tone: summary?.overdue_tasks > 0 ? 'danger' : 'neutral',
      onClick: () => navigate('/tasks'),
    },
    {
      label: 'Timesheet',
      value: `${summary?.timesheet_hours ?? 0}h`,
      description: `of ${summary?.timesheet_expected ?? 40}h this week`,
      icon: Clock,
      tone: 'primary',
      onClick: () => navigate('/timesheets'),
    },
    {
      label: 'Meetings',
      value: summary?.meetings_today ?? 0,
      description: 'today',
      icon: Calendar,
      tone: 'neutral',
      onClick: () => {},
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={c.onClick}
              className="text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  {c.label}
                </span>
                <Icon
                  className={cn(
                    'w-4 h-4',
                    c.tone === 'danger' ? 'text-red-500' : 'text-gray-400'
                  )}
                  strokeWidth={1.75}
                />
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{c.value}</div>
              <div
                className={cn(
                  'text-[11px] mt-0.5',
                  c.tone === 'danger' ? 'text-red-600 font-medium' : 'text-gray-500'
                )}
              >
                {c.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* Today's Focus + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TodayFocus />
        <UpcomingList />
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">My Recent Activity</h3>
          <button className="text-xs text-primary hover:text-primary-dark font-medium transition-colors">
            View all
          </button>
        </div>
        <div className="text-center py-8 text-sm text-gray-400">
          Activity will appear here as you work
        </div>
      </div>
    </div>
  );
}

/* ========== TODAY'S FOCUS ========== */

function TodayFocus() {
  const navigate = useNavigate();
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['my-work', 'tasks', 'today'],
    queryFn: () => myWorkService.getTasks('today'),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Today's Focus</h3>
          {tasks && tasks.length > 0 && (
            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
              {tasks.length}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/tasks')}
          className="text-xs text-primary hover:text-primary-dark font-medium transition-colors flex items-center gap-0.5"
        >
          All tasks
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-md" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">All caught up</p>
          <p className="text-xs text-gray-400 mt-0.5">No tasks due today</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tasks.slice(0, 5).map((task) => (
            <button
              key={task.id}
              onClick={() => navigate(`/tasks/${task.id}`)}
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors text-left group"
            >
              <div className="pt-0.5">
                <Circle className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary transition-colors" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-gray-900 truncate">
                  {task.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <PriorityBadge priority={task.priority} />
                  {task.due_date && (
                    <span className="text-[10px] text-gray-500">
                      Due {formatRelativeShort(task.due_date)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========== UPCOMING ========== */

function UpcomingList() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['my-work', 'tasks', 'upcoming'],
    queryFn: () => myWorkService.getTasks('upcoming'),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Coming Up</h3>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Next 7 days</span>
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-md" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          Nothing scheduled
        </div>
      ) : (
        <div className="space-y-1">
          {tasks.slice(0, 5).map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="pt-0.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-gray-900 truncate">
                  {task.title}
                </div>
                {task.due_date && (
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {format(new Date(task.due_date), 'EEE, MMM d')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========== TASKS TAB ========== */

function TasksTab() {
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue' | 'upcoming'>('all');
  const navigate = useNavigate();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['my-work', 'tasks', filter],
    queryFn: () => myWorkService.getTasks(filter === 'all' ? 'all' : filter),
  });

  const filters = [
    { id: 'all' as const, label: 'All' },
    { id: 'today' as const, label: 'Today' },
    { id: 'overdue' as const, label: 'Overdue' },
    { id: 'upcoming' as const, label: 'Upcoming' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center gap-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              filter === f.id
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No tasks</p>
          <p className="text-xs text-gray-400 mt-1">
            You have no tasks in this view
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => navigate(`/tasks/${task.id}`)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left group"
            >
              <StatusIcon status={task.status} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-gray-900 truncate">
                  {task.title}
                </div>
                {task.description && (
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {task.description}
                  </div>
                )}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                  {task.due_date && (
                    <span
                      className={cn(
                        'text-[10px] flex items-center gap-1',
                        isPast(new Date(task.due_date)) &&
                          !isToday(new Date(task.due_date)) &&
                          task.status !== 'done'
                          ? 'text-red-600 font-medium'
                          : 'text-gray-500'
                      )}
                    >
                      <Calendar className="w-2.5 h-2.5" />
                      {formatRelativeShort(task.due_date)}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========== PROJECTS TAB ========== */

function ProjectsTab() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useQuery({
    queryKey: ['my-work', 'projects'],
    queryFn: () => myWorkService.getProjects(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
        <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-gray-700">No projects yet</p>
        <p className="text-xs text-gray-400 mt-1">
          You're not assigned to any projects
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {projects.map((p) => (
        <button
          key={p.id}
          onClick={() => navigate(`/projects/${p.id}`)}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all text-left"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">
              {p.name}
            </h4>
            {p.is_manager && (
              <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded uppercase tracking-wider flex-shrink-0">
                Manager
              </span>
            )}
          </div>
          {p.code && (
            <div className="text-[10px] text-gray-400 font-mono">{p.code}</div>
          )}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <StatusBadge status={p.status} />
            <PriorityBadge priority={p.priority} />
          </div>
        </button>
      ))}
    </div>
  );
}

/* ========== TIMESHEET TAB ========== */

function TimesheetTab({ summary }: { summary: any }) {
  const navigate = useNavigate();

  if (!summary) return null;

  const hours = summary.timesheet_hours ?? 0;
  const expected = summary.timesheet_expected ?? 40;
  const pct = Math.min(100, (hours / expected) * 100);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900">This Week's Timesheet</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {summary.timesheet_week_start} — {summary.timesheet_week_end}
          </p>
        </div>
        <button
          onClick={() => navigate('/timesheets')}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
        >
          View Timesheet
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-3xl font-bold text-gray-900">
              {hours}h
            </span>
            <span className="text-sm text-gray-500">
              of {expected}h expected
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                pct >= 100 ? 'bg-emerald-500' : 'bg-primary'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">Status</div>
          <StatusBadge status={summary.timesheet_status} />
        </div>
      </div>
    </div>
  );
}

/* ========== MEETINGS TAB ========== */

function MeetingsTab() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-gray-700">No meetings today</p>
      <p className="text-xs text-gray-400 mt-1">
        Meetings will appear here once your team schedules them
      </p>
    </div>
  );
}

/* ========== ACTIVITY TAB ========== */

function ActivityTab() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-gray-700">No recent activity</p>
      <p className="text-xs text-gray-400 mt-1">
        Your actions across Shoova ONE will appear here
      </p>
    </div>
  );
}

/* ========== SHARED COMPONENTS ========== */

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const styles: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-50 text-blue-700',
    high: 'bg-amber-50 text-amber-700',
    critical: 'bg-red-50 text-red-700',
  };
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider', styles[priority] ?? styles.medium)}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  const styles: Record<string, string> = {
    open: 'bg-gray-100 text-gray-700',
    draft: 'bg-gray-100 text-gray-700',
    not_started: 'bg-gray-100 text-gray-700',
    todo: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-50 text-blue-700',
    blocked: 'bg-red-50 text-red-700',
    review: 'bg-purple-50 text-purple-700',
    submitted: 'bg-amber-50 text-amber-700',
    under_review: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    completed: 'bg-emerald-50 text-emerald-700',
    done: 'bg-emerald-50 text-emerald-700',
    active: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };
  const label = status.replace(/_/g, ' ');
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider', styles[status] ?? styles.open)}>
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  const iconProps = { className: 'w-4 h-4 flex-shrink-0 mt-0.5', strokeWidth: 1.75 };
  switch (status) {
    case 'done':
    case 'completed':
      return <CheckCircle {...iconProps} className={cn(iconProps.className, 'text-emerald-500')} />;
    case 'in_progress':
      return <PlayCircle {...iconProps} className={cn(iconProps.className, 'text-blue-500')} />;
    case 'blocked':
      return <PauseCircle {...iconProps} className={cn(iconProps.className, 'text-red-500')} />;
    case 'cancelled':
      return <XCircle {...iconProps} className={cn(iconProps.className, 'text-gray-400')} />;
    default:
      return <Circle {...iconProps} className={cn(iconProps.className, 'text-gray-300')} />;
  }
}

function formatRelativeShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isPast(d)) {
    const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    return `${days}d overdue`;
  }
  return format(d, 'MMM d');
}