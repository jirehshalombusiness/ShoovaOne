import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectService, Project } from '@/services/project.service';
import { usePermissions } from '@/hooks/usePermissions';
import { Avatar } from '@/components/ui/Avatar';
import {
  Plus,
  Search,
  FolderKanban,
  Calendar,
  Users,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', search, statusFilter],
    queryFn: () =>
      projectService.getAll({
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  const canCreate = hasPermission('projects.create');

  const statuses = [
    { value: '', label: 'All' },
    { value: 'planning', label: 'Planning' },
    { value: 'active', label: 'Active' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage and track all organisational projects
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name, code..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                statusFilter === s.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No projects found</p>
          <p className="text-xs text-gray-400 mt-1">
            {search ? 'Try adjusting your search' : 'Create your first project to get started'}
          </p>
          {canCreate && !search && (
            <button
              onClick={() => navigate('/projects/new')}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
}: {
  project: Project;
  onClick: () => void;
}) {

  const autoProgress =
    project.task_count > 0
      ? Math.round((project.completed_task_count / project.task_count) * 100)
      : 0;

  const progress =
    typeof project.progress === 'number' && project.progress > 0
      ? project.progress
      : autoProgress;

  const daysLeft = project.end_date
    ? Math.ceil((new Date(project.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary hover:shadow-md transition-all text-left group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {project.code && (
              <span className="text-[10px] font-mono text-gray-400">
                {project.code}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mt-0.5">
            {project.name}
          </h3>
        </div>
        <StatusPill status={project.status} />
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
          {project.description}
        </p>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            Progress
          </span>
          <span className="text-[11px] font-semibold text-gray-700">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <CheckSquare className="w-3 h-3" strokeWidth={1.75} />
          {project.completed_task_count}/{project.task_count}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" strokeWidth={1.75} />
          {project.member_count}
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

      {/* Footer: manager */}
      {project.manager_id && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <Avatar
            firstName={project.manager_first_name}
            lastName={project.manager_last_name}
            imageUrl={project.manager_image_url}
            size="xs"
          />
          <div className="text-[11px] text-gray-500">
            {project.manager_first_name} {project.manager_last_name}
          </div>
          <PriorityDot priority={project.priority} />
        </div>
      )}
    </button>
  );
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

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: 'bg-gray-400',
    medium: 'bg-blue-500',
    high: 'bg-amber-500',
    critical: 'bg-red-500',
  };
  return (
    <span
      className={cn('w-1.5 h-1.5 rounded-full ml-auto', colors[priority] ?? colors.medium)}
      title={priority}
    />
  );
}