import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { taskService, Task } from '@/services/task.service';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui/Avatar';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Search,
  Filter,
  CheckSquare,
  Calendar,
  Briefcase,
  User as UserIcon,
  CheckCircle2,
  Circle,
  PlayCircle,
  PauseCircle,
  XCircle,
  LayoutGrid,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';

type Tab = 'assigned' | 'created' | 'all';
type GroupBy = 'none' | 'status' | 'priority';

export function TasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('assigned');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'board'>('list');

  const debouncedSearch = useDebounce(search, 300);

  const queryParams = useMemo(() => {
    const params: any = {
      limit: 500,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter;
    if (projectFilter) params.project_id = projectFilter;

    if (tab === 'assigned') params.assigned_to_me = true;
    if (tab === 'created') params.created_by_me = true;

    return params;
  }, [tab, statusFilter, projectFilter, debouncedSearch]);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', queryParams],
    queryFn: () => taskService.getAll(queryParams),
  });

  // Client-side priority filter (backend doesn't support it yet)
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    let result = tasks;
    if (priorityFilter) {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    return result;
  }, [tasks, priorityFilter]);

  // Stats
  const stats = useMemo(() => {
    const all = tasks || [];
    return {
      total: all.length,
      todo: all.filter((t) => t.status === 'todo').length,
      inProgress: all.filter((t) => t.status === 'in_progress').length,
      overdue: all.filter(
        (t) =>
          t.due_date &&
          isPast(new Date(t.due_date)) &&
          !isToday(new Date(t.due_date)) &&
          t.status !== 'done' &&
          t.status !== 'cancelled'
      ).length,
      done: all.filter((t) => t.status === 'done').length,
    };
  }, [tasks]);

  const handleTaskClick = (task: Task) => {
    if (task.project_id) {
      navigate(`/projects/${task.project_id}/tasks?highlight=${task.id}`);
    } else {
      navigate(`/tasks/${task.id}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All tasks across projects and personal work
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="To Do" value={stats.todo} />
        <StatCard label="In Progress" value={stats.inProgress} tone="info" />
        <StatCard label="Overdue" value={stats.overdue} tone="danger" />
        <StatCard label="Done" value={stats.done} tone="success" />
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
          {[
            { id: 'assigned' as const, label: 'Assigned to me' },
            { id: 'created' as const, label: 'Created by me' },
            { id: 'all' as const, label: 'All tasks' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                tab === t.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
          <button
            onClick={() => setView('list')}
            className={cn(
              'p-1.5 rounded transition-colors',
              view === 'list'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-900'
            )}
            title="List view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setView('board')}
            className={cn(
              'p-1.5 rounded transition-colors',
              view === 'board'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-900'
            )}
            title="Board view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All projects</option>
          <option value="personal">Personal only</option>
          {/* Note: hardcoding projects in filter would require fetching them; leaving for v2 */}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No tasks found</p>
          <p className="text-xs text-gray-400 mt-1">
            {search || statusFilter || priorityFilter
              ? 'Try adjusting your filters'
              : tab === 'assigned'
              ? 'No tasks assigned to you'
              : tab === 'created'
              ? 'You haven\'t created any tasks'
              : 'No tasks yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {filteredTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              currentUserId={user?.id}
              onClick={() => handleTaskClick(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'info' | 'danger' | 'success';
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div
        className={cn(
          'text-xl font-bold mt-1',
          tone === 'danger'
            ? 'text-red-600'
            : tone === 'success'
            ? 'text-emerald-600'
            : tone === 'info'
            ? 'text-blue-600'
            : 'text-gray-900'
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  currentUserId,
  onClick,
}: {
  task: Task;
  currentUserId?: string;
  onClick: () => void;
}) {
  const isOverdue =
    task.due_date &&
    isPast(new Date(task.due_date)) &&
    !isToday(new Date(task.due_date)) &&
    task.status !== 'done' &&
    task.status !== 'cancelled';

  const isAssigneeMe = task.assignee_id === currentUserId;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left group"
    >
      <div className="pt-0.5">
        <StatusIcon status={task.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900 truncate">
          {task.title}
        </div>
        {task.description && (
          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {task.description}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />

          {task.is_personal ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-purple-50 text-purple-700">
              Personal
            </span>
          ) : task.project_name ? (
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Briefcase className="w-2.5 h-2.5" />
              {task.project_name}
            </span>
          ) : null}

          {task.due_date && (
            <span
              className={cn(
                'text-[10px] flex items-center gap-1',
                isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
              )}
            >
              <Calendar className="w-2.5 h-2.5" />
              {isOverdue
                ? `${Math.floor((Date.now() - new Date(task.due_date).getTime()) / 86400000)}d overdue`
                : isToday(new Date(task.due_date))
                ? 'Today'
                : format(new Date(task.due_date), 'MMM d')}
            </span>
          )}
        </div>
      </div>

      {task.assignee_id && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAssigneeMe && (
            <span className="text-[9px] font-bold text-primary uppercase tracking-wider">
              You
            </span>
          )}
          <Avatar
            firstName={task.assignee_first_name}
            lastName={task.assignee_last_name}
            imageUrl={task.assignee_image_url}
            size="xs"
          />
        </div>
      )}
    </button>
  );
}

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
  const styles: Record<string, string> = {
    todo: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-50 text-blue-700',
    blocked: 'bg-red-50 text-red-700',
    review: 'bg-purple-50 text-purple-700',
    done: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };
  const label = status.replace(/_/g, ' ');
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
        styles[status] ?? styles.todo
      )}
    >
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  const props = {
    className: 'w-4 h-4 flex-shrink-0 mt-0.5',
    strokeWidth: 1.75,
  };
  switch (status) {
    case 'done':
      return <CheckCircle2 {...props} className={cn(props.className, 'text-emerald-500')} />;
    case 'in_progress':
      return <PlayCircle {...props} className={cn(props.className, 'text-blue-500')} />;
    case 'blocked':
      return <PauseCircle {...props} className={cn(props.className, 'text-red-500')} />;
    case 'cancelled':
      return <XCircle {...props} className={cn(props.className, 'text-gray-400')} />;
    default:
      return <Circle {...props} className={cn(props.className, 'text-gray-300')} />;
  }
}