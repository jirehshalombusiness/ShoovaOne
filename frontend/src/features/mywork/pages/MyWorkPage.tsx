import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  myWorkService,
  MyTask,
  MyProject,
  MyTimesheet,
} from '@/services/mywork.service';
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
  Circle,
  ArrowRight,
  Plus,
  Users,
  Activity,
  Target,
  PlayCircle,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  format,
  isToday,
  isPast,
  isTomorrow,
  formatDistanceToNow,
} from 'date-fns';

type Tab = 'overview' | 'tasks' | 'projects' | 'timesheet' | 'meetings' | 'activity';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'projects', label: 'My Projects', icon: Briefcase },
  { id: 'timesheet', label: 'Timesheet', icon: Clock },
  { id: 'meetings', label: 'Meetings', icon: Calendar },
  { id: 'activity', label: 'Activity', icon: Activity },
];

export function MyWorkPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Work</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {greeting}, {user?.first_name}. Here's your personal workspace.
          </p>
        </div>
        <button
          onClick={() => navigate_to_timesheets()}
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
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

      {/* Content */}
      {tab === 'overview' && <OverviewTab />}
      {tab === 'tasks' && <TasksTab />}
      {tab === 'projects' && <ProjectsTab />}
      {tab === 'timesheet' && <TimesheetTab />}
      {tab === 'meetings' && <MeetingsTab />}
      {tab === 'activity' && <ActivityTab />}
    </div>
  );
}

function navigate_to_timesheets() {
  window.location.href = '/timesheets';
}

/* ==================== OVERVIEW ==================== */

function OverviewTab() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useQuery({
    queryKey: ['my-work', 'summary'],
    queryFn: () => myWorkService.getSummary(),
  });

  const { data: todayTasks } = useQuery({
    queryKey: ['my-work', 'tasks', 'today'],
    queryFn: () => myWorkService.getTasks('today'),
  });

  const { data: projects } = useQuery({
    queryKey: ['my-work', 'projects'],
    queryFn: () => myWorkService.getProjects(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
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
      tone: 'primary' as const,
      onClick: () => navigate('/my-work?tab=tasks'),
    },
    {
      label: 'Overdue',
      value: summary?.overdue_tasks ?? 0,
      description:
        summary?.overdue_tasks && summary.overdue_tasks > 0
          ? 'Needs attention'
          : 'All caught up',
      icon: AlertCircle,
      tone:
        summary?.overdue_tasks && summary.overdue_tasks > 0
          ? ('danger' as const)
          : ('neutral' as const),
      onClick: () => navigate('/my-work?tab=tasks'),
    },
    {
      label: 'Timesheet',
      value: `${summary?.timesheet_hours ?? 0}h`,
      description: `of ${summary?.timesheet_expected ?? 40}h this week`,
      icon: Clock,
      tone: 'primary' as const,
      onClick: () => navigate('/my-work?tab=timesheet'),
    },
    {
      label: 'My Projects',
      value: projects?.length ?? 0,
      description: 'active projects',
      icon: Briefcase,
      tone: 'primary' as const,
      onClick: () => navigate('/my-work?tab=projects'),
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
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
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
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {c.value}
              </div>
              <div
                className={cn(
                  'text-[11px] mt-0.5',
                  c.tone === 'danger'
                    ? 'text-red-600 font-medium'
                    : 'text-gray-500'
                )}
              >
                {c.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* Two Column: Today + Coming Up */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TodayFocus tasks={todayTasks ?? []} />
        <ComingUp />
      </div>

      {/* Projects Strip */}
      {projects && projects.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              My Active Projects
            </h3>
            <button
              onClick={() => navigate('/my-work?tab=projects')}
              className="text-xs text-primary hover:text-primary-dark font-medium transition-colors flex items-center gap-0.5"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.slice(0, 3).map((p) => (
              <MiniProjectCard key={p.id} project={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TodayFocus({ tasks }: { tasks: MyTask[] }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Today's Focus
          </h3>
          {tasks.length > 0 && (
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

      {tasks.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle
            className="w-8 h-8 text-emerald-400 mx-auto mb-2"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-gray-700">All caught up</p>
          <p className="text-xs text-gray-400 mt-0.5">
            No tasks due today
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {tasks.slice(0, 5).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComingUp() {
  const { data: tasks } = useQuery({
    queryKey: ['my-work', 'tasks', 'upcoming'],
    queryFn: () => myWorkService.getTasks('upcoming'),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Coming Up</h3>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">
          Next 7 days
        </span>
      </div>

      {!tasks || tasks.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          Nothing scheduled
        </div>
      ) : (
        <div className="space-y-1">
          {tasks.slice(0, 5).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: MyTask }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (task.project_id) {
      // Project task → go to project Kanban, highlight the task
      navigate(`/projects/${task.project_id}/tasks?highlight=${task.id}`);
    } else {
      // Personal task → go to global tasks page
      navigate(`/tasks/${task.id}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors text-left group"
    >
      <div className="pt-0.5">
        <StatusIcon status={task.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900 truncate">
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <PriorityBadge priority={task.priority} />
          {task.due_date && (
            <span
              className={cn(
                'text-[10px] flex items-center gap-1',
                isOverdue(task) ? 'text-red-600 font-medium' : 'text-gray-500'
              )}
            >
              <Calendar className="w-2.5 h-2.5" />
              {formatRelativeShort(task.due_date)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function MiniProjectCard({ project }: { project: MyProject }) {
  const navigate = useNavigate();
  const progressPct =
    project.total_tasks > 0
      ? Math.round((project.completed_tasks / project.total_tasks) * 100)
      : project.progress;

  return (
    <button
      onClick={() => navigate(`/projects/${project.id}`)}
      className="text-left bg-gray-50 border border-gray-200 rounded-md p-3 hover:border-primary hover:bg-white transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-[12px] font-semibold text-gray-900 line-clamp-2">
          {project.name}
        </h4>
        {project.my_role === 'manager' && (
          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded uppercase tracking-wider flex-shrink-0">
            Manager
          </span>
        )}
      </div>
      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            progressPct >= 100
              ? 'bg-emerald-500'
              : progressPct >= 50
              ? 'bg-primary'
              : 'bg-amber-500'
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>
          {project.my_open_tasks} task
          {project.my_open_tasks !== 1 ? 's' : ''} assigned to me
        </span>
        <span className="font-semibold">{progressPct}%</span>
      </div>
    </button>
  );
}

/* ==================== TASKS ==================== */

function TasksTab() {
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue' | 'upcoming'>(
    'all'
  );
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
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <CheckSquare
            className="w-12 h-12 text-gray-300 mx-auto mb-3"
            strokeWidth={1.5}
          />
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
            onClick={() => {
              if (task.project_id) {
                navigate(`/projects/${task.project_id}/tasks?highlight=${task.id}`);
              } else {
                navigate(`/tasks/${task.id}`);
              }
            }}
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
                        isOverdue(task)
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
              <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== PROJECTS ==================== */

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
          <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
        <Briefcase
          className="w-12 h-12 text-gray-300 mx-auto mb-3"
          strokeWidth={1.5}
        />
        <p className="text-sm font-medium text-gray-700">No projects yet</p>
        <p className="text-xs text-gray-400 mt-1">
          You haven't been added to any projects
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}

function ProjectCard({ project }: { project: MyProject }) {
  const navigate = useNavigate();
  const progressPct =
    project.total_tasks > 0
      ? Math.round((project.completed_tasks / project.total_tasks) * 100)
      : project.progress;

  const daysLeft = project.end_date
    ? Math.ceil(
        (new Date(project.end_date).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <button
      onClick={() => navigate(`/projects/${project.id}`)}
      className="text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-primary hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          {project.code && (
            <span className="text-[10px] font-mono text-gray-400">
              {project.code}
            </span>
          )}
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mt-0.5">
            {project.name}
          </h3>
        </div>
        <StatusPill status={project.status} />
      </div>

      {project.my_role === 'manager' && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded uppercase tracking-wider">
            <Target className="w-2.5 h-2.5" strokeWidth={2.5} />
            Manager
          </span>
        </div>
      )}

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            Progress
          </span>
          <span className="text-[11px] font-semibold text-gray-700">
            {progressPct}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              progressPct >= 100
                ? 'bg-emerald-500'
                : progressPct >= 50
                ? 'bg-primary'
                : 'bg-amber-500'
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <CheckSquare className="w-3 h-3" strokeWidth={1.75} />
          {project.my_open_tasks} assigned
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" strokeWidth={1.75} />
          {project.completed_tasks}/{project.total_tasks}
        </span>
        {daysLeft !== null && (
          <span
            className={cn(
              'flex items-center gap-1 ml-auto',
              daysLeft < 0
                ? 'text-red-600 font-medium'
                : daysLeft < 7
                ? 'text-amber-600 font-medium'
                : ''
            )}
          >
            <Calendar className="w-3 h-3" strokeWidth={1.75} />
            {daysLeft < 0
              ? `${Math.abs(daysLeft)}d overdue`
              : daysLeft === 0
              ? 'Due today'
              : `${daysLeft}d left`}
          </span>
        )}
      </div>

      {project.manager_id && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <Avatar
            firstName={project.manager_first_name}
            lastName={project.manager_last_name}
            imageUrl={project.manager_image_url}
            size="xs"
          />
          <span className="text-[11px] text-gray-500 truncate">
            {project.manager_first_name} {project.manager_last_name}
          </span>
        </div>
      )}
    </button>
  );
}

/* ==================== TIMESHEET ==================== */

function TimesheetTab() {
  const navigate = useNavigate();
  const { data: timesheet, isLoading } = useQuery({
    queryKey: ['my-work', 'timesheet'],
    queryFn: () => myWorkService.getTimesheet(),
  });

  if (isLoading) {
    return <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />;
  }

  if (!timesheet) return null;

  const pct = Math.min(
    100,
    (timesheet.total_hours / timesheet.expected_hours) * 100
  );

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Logged
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {timesheet.total_hours.toFixed(1)}h
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Expected
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {timesheet.expected_hours}h
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Remaining
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {Math.max(
              0,
              timesheet.expected_hours - timesheet.total_hours
            ).toFixed(1)}
            h
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Status
          </div>
          <div className="mt-2">
            <StatusBadge status={timesheet.status} />
          </div>
        </div>
      </div>

      {/* Week Header + Progress */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              This Week's Timesheet
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {format(new Date(timesheet.week_start_date), 'MMM d')} —{' '}
              {format(new Date(timesheet.week_end_date), 'MMM d, yyyy')}
            </p>
          </div>
          <button
            onClick={() => navigate('/timesheets')}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
          >
            Open Timesheet
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
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

        {/* Recent entries */}
        {timesheet.entries.length > 0 && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Recent Entries
            </h4>
            <div className="space-y-2">
              {timesheet.entries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-gray-900 truncate">
                      {entry.description || 'No description'}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {format(new Date(entry.date), 'EEE, MMM d')}
                    </div>
                  </div>
                  <div className="text-[12px] font-semibold text-gray-900">
                    {entry.duration}h
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== MEETINGS ==================== */

function MeetingsTab() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
      <Calendar
        className="w-12 h-12 text-gray-300 mx-auto mb-3"
        strokeWidth={1.5}
      />
      <p className="text-sm font-medium text-gray-700">No meetings yet</p>
      <p className="text-xs text-gray-400 mt-1">
        Meetings will appear here once the module is available
      </p>
    </div>
  );
}

/* ==================== ACTIVITY ==================== */

function ActivityTab() {
  const { data: activity, isLoading } = useQuery({
    queryKey: ['my-work', 'activity'],
    queryFn: () => myWorkService.getActivity(),
  });

  if (isLoading) {
    return <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />;
  }

  if (!activity || activity.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
        <Activity
          className="w-12 h-12 text-gray-300 mx-auto mb-3"
          strokeWidth={1.5}
        />
        <p className="text-sm font-medium text-gray-700">No recent activity</p>
        <p className="text-xs text-gray-400 mt-1">
          Your actions across Shoova ONE will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      {activity.map((item) => (
        <div key={item.id} className="px-4 py-3 flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Activity className="w-3.5 h-3.5 text-gray-500" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900">
              <span className="font-medium capitalize">{item.action}</span>{' '}
              <span className="text-gray-600">
                {item.entity_type.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {item.created_at &&
                formatDistanceToNow(new Date(item.created_at), {
                  addSuffix: true,
                })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ==================== SHARED HELPERS ==================== */

function PriorityBadge({ priority }: { priority: string }) {
  if (!priority) return null;
  const styles: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-50 text-blue-700',
    high: 'bg-amber-50 text-amber-700',
    critical: 'bg-red-50 text-red-700',
  };
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
        styles[priority] ?? styles.medium
      )}
    >
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
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider inline-block',
        styles[status] ?? styles.open
      )}
    >
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  const iconProps = {
    className: 'w-4 h-4 flex-shrink-0 mt-0.5',
    strokeWidth: 1.75,
  };
  switch (status) {
    case 'done':
    case 'completed':
      return (
        <CheckCircle
          {...iconProps}
          className={cn(iconProps.className, 'text-emerald-500')}
        />
      );
    case 'in_progress':
      return (
        <PlayCircle
          {...iconProps}
          className={cn(iconProps.className, 'text-blue-500')}
        />
      );
    case 'blocked':
      return (
        <PauseCircle
          {...iconProps}
          className={cn(iconProps.className, 'text-red-500')}
        />
      );
    case 'cancelled':
      return (
        <XCircle
          {...iconProps}
          className={cn(iconProps.className, 'text-gray-400')}
        />
      );
    default:
      return (
        <Circle
          {...iconProps}
          className={cn(iconProps.className, 'text-gray-300')}
        />
      );
  }
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    planning: 'bg-gray-100 text-gray-700',
    active: 'bg-emerald-50 text-emerald-700',
    on_hold: 'bg-amber-50 text-amber-700',
    completed: 'bg-blue-50 text-blue-700',
    cancelled: 'bg-red-50 text-red-700',
  };
  const label = status.replace(/_/g, ' ');
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider flex-shrink-0',
        styles[status] ?? styles.planning
      )}
    >
      {label}
    </span>
  );
}

function isOverdue(task: MyTask): boolean {
  return (
    !!task.due_date &&
    isPast(new Date(task.due_date)) &&
    !isToday(new Date(task.due_date)) &&
    task.status !== 'done' &&
    task.status !== 'completed'
  );
}

function formatRelativeShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isPast(d)) {
    const days = Math.floor(
      (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
    );
    return `${days}d overdue`;
  }
  return format(d, 'MMM d');
}