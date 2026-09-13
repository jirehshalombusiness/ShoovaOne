import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectService, Project } from '@/services/project.service';
import { Avatar } from '@/components/ui/Avatar';
import {
  Calendar,
  Users,
  CheckSquare,
  Target,
  Clock,
  Edit,
  Plus,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type ContextType = { project: Project };

export function ProjectOverview() {
  const { project } = useOutletContext<ContextType>();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['project-stats', project.id],
    queryFn: () => projectService.getStats(project.id),
  });

// After: explicit progress wins if set, otherwise auto-compute
const autoProgress =
  project.task_count > 0
    ? Math.round((project.completed_task_count / project.task_count) * 100)
    : 0;

const progress =
  typeof project.progress === 'number' && project.progress > 0
    ? project.progress
    : autoProgress;

  const daysLeft = project.end_date
    ? Math.ceil(
        (new Date(project.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {daysLeft !== null && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                  daysLeft < 0
                    ? 'bg-red-50 text-red-700'
                    : daysLeft < 7
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                )}
              >
                {daysLeft < 0
                  ? `${Math.abs(daysLeft)}d overdue`
                  : daysLeft === 0
                  ? 'Due today'
                  : `${daysLeft} days left`}
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 mt-2 leading-relaxed max-w-3xl">
              {project.description}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(`/projects/${project.id}/settings`)}
          className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <Edit className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Progress"
          value={`${progress}%`}
          icon={TrendingUp}
          progress={progress}
        />
        <StatCard
          label="Tasks"
          value={isLoading ? '—' : `${stats?.completed_tasks ?? 0}/${stats?.total_tasks ?? 0}`}
          icon={CheckSquare}
          hint={
            stats && stats.overdue_tasks > 0
              ? `${stats.overdue_tasks} overdue`
              : 'On track'
          }
          hintTone={stats && stats.overdue_tasks > 0 ? 'danger' : 'neutral'}
          onClick={() => navigate(`/projects/${project.id}/tasks`)}
        />
        <StatCard
          label="Milestones"
          value={isLoading ? '—' : `${stats?.completed_milestones ?? 0}/${stats?.total_milestones ?? 0}`}
          icon={Target}
          onClick={() => navigate(`/projects/${project.id}/milestones`)}
        />
        <StatCard
          label="Hours Logged"
          value={isLoading ? '—' : `${stats?.total_hours ?? 0}h`}
          icon={Clock}
          onClick={() => navigate(`/projects/${project.id}/timesheets`)}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Details + Team */}
        <div className="lg:col-span-2 space-y-5">
          {/* Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Project Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailRow
                icon={Users}
                label="Manager"
                value={
                  project.manager_first_name ? (
                    <div className="flex items-center gap-2">
                      <Avatar
                        firstName={project.manager_first_name}
                        lastName={project.manager_last_name}
                        imageUrl={project.manager_image_url}
                        size="xs"
                      />
                      <span className="text-sm text-gray-900">
                        {project.manager_first_name} {project.manager_last_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Not assigned</span>
                  )
                }
              />
              <DetailRow
                icon={Target}
                label="Priority"
                value={
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider inline-block',
                      project.priority === 'high' || project.priority === 'critical'
                        ? 'bg-red-50 text-red-700'
                        : project.priority === 'low'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-blue-50 text-blue-700'
                    )}
                  >
                    {project.priority}
                  </span>
                }
              />
              <DetailRow
                icon={Calendar}
                label="Start Date"
                value={
                  project.start_date
                    ? format(new Date(project.start_date), 'MMM d, yyyy')
                    : 'Not set'
                }
              />
              <DetailRow
                icon={Calendar}
                label="End Date"
                value={
                  project.end_date
                    ? format(new Date(project.end_date), 'MMM d, yyyy')
                    : 'Not set'
                }
              />
              {project.budget && (
                <DetailRow
                  icon={TrendingUp}
                  label="Budget"
                  value={`GHS ${Number(project.budget).toLocaleString()}`}
                />
              )}
              {project.actual_cost && (
                <DetailRow
                  icon={TrendingUp}
                  label="Spent"
                  value={`GHS ${Number(project.actual_cost).toLocaleString()}`}
                />
              )}
            </div>
          </div>

          {/* Team */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Team</h3>
                <span className="text-[11px] text-gray-500">
                  {project.member_count} {project.member_count === 1 ? 'member' : 'members'}
                </span>
              </div>
              <button
                onClick={() => navigate(`/projects/${project.id}/team`)}
                className="text-xs text-primary hover:text-primary-dark font-medium transition-colors flex items-center gap-0.5"
              >
                Manage team
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {!project.members || project.members.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-xs text-gray-500">No members yet</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {project.members.slice(0, 8).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-md border border-gray-100"
                  >
                    <Avatar
                      firstName={m.first_name}
                      lastName={m.last_name}
                      imageUrl={m.profile_image_url}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-gray-900 truncate">
                        {m.first_name} {m.last_name}
                      </div>
                      <div className="text-[9px] text-gray-500 capitalize">
                        {m.role}
                      </div>
                    </div>
                  </div>
                ))}
                {project.members.length > 8 && (
                  <button
                    onClick={() => navigate(`/projects/${project.id}/team`)}
                    className="px-2.5 py-1.5 bg-gray-50 rounded-md border border-gray-100 text-[11px] font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    +{project.members.length - 8} more
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Milestones + Activity */}
        <div className="space-y-5">
          {/* Upcoming milestones */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Milestones
              </h3>
              <button
                onClick={() => navigate(`/projects/${project.id}/milestones`)}
                className="text-xs text-primary hover:text-primary-dark font-medium transition-colors flex items-center gap-0.5"
              >
                All
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {!project.milestones || project.milestones.length === 0 ? (
              <div className="text-center py-6">
                <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-xs text-gray-500">No milestones yet</p>
                <button
                  onClick={() => navigate(`/projects/${project.id}/milestones`)}
                  className="mt-3 text-[11px] text-primary hover:text-primary-dark font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add milestone
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {project.milestones.slice(0, 4).map((ms) => {
                  const isOverdue =
                    ms.due_date &&
                    new Date(ms.due_date) < new Date() &&
                    ms.status !== 'completed';
                  return (
                    <div key={ms.id} className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                          ms.status === 'completed'
                            ? 'bg-emerald-100'
                            : isOverdue
                            ? 'bg-red-100'
                            : 'bg-gray-100'
                        )}
                      >
                        <Target
                          className={cn(
                            'w-3 h-3',
                            ms.status === 'completed'
                              ? 'text-emerald-600'
                              : isOverdue
                              ? 'text-red-600'
                              : 'text-gray-500'
                          )}
                          strokeWidth={2}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-gray-900 truncate">
                          {ms.title}
                        </div>
                        {ms.due_date && (
                          <div
                            className={cn(
                              'text-[10px] mt-0.5',
                              isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
                            )}
                          >
                            {isOverdue ? 'Overdue ' : 'Due '}
                            {format(new Date(ms.due_date), 'MMM d')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Recent Activity
            </h3>
            <div className="text-center py-6">
              <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-xs text-gray-500">
                Activity will appear here
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========== HELPERS ========== */

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  hintTone = 'neutral',
  progress,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  hint?: string;
  hintTone?: 'neutral' | 'danger';
  progress?: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {hint && (
        <div
          className={cn(
            'text-[10px] mt-0.5',
            hintTone === 'danger' ? 'text-red-600 font-medium' : 'text-gray-500'
          )}
        >
          {hint}
        </div>
      )}
      {progress !== undefined && (
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-2">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              progress >= 100
                ? 'bg-emerald-500'
                : progress >= 50
                ? 'bg-primary'
                : 'bg-amber-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </>
  );

  const baseClass =
    'bg-white border border-gray-200 rounded-lg p-4 text-left';

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn(baseClass, 'hover:border-primary hover:shadow-sm transition-all')}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-gray-500" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div className="text-[13px] text-gray-900">{value}</div>
      </div>
    </div>
  );
}