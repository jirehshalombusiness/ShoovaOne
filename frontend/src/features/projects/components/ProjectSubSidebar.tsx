import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  CheckSquare,
  Target,
  Users,
  Clock,
  FileText,
  Activity,
  Settings,
  MoreHorizontal,
  FolderKanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project } from '@/services/project.service';

interface ProjectSubSidebarProps {
  project: Project;
}

export function ProjectSubSidebar({ project }: ProjectSubSidebarProps) {
  const navigate = useNavigate();

const autoProgress =
  project.task_count > 0
    ? Math.round((project.completed_task_count / project.task_count) * 100)
    : 0;

const progress =
  typeof project.progress === 'number' && project.progress > 0
    ? project.progress
    : autoProgress;
  const navItems = [
    {
      icon: LayoutDashboard,
      label: 'Overview',
      to: `/projects/${project.id}`,
      end: true,
    },
    {
      icon: CheckSquare,
      label: 'Tasks',
      to: `/projects/${project.id}/tasks`,
      badge: project.task_count > 0 ? String(project.task_count) : undefined,
    },
    {
      icon: Target,
      label: 'Milestones',
      to: `/projects/${project.id}/milestones`,
      badge: project.milestones?.length
        ? String(project.milestones.length)
        : undefined,
    },
    {
      icon: Users,
      label: 'Team',
      to: `/projects/${project.id}/team`,
      badge: project.member_count > 0 ? String(project.member_count) : undefined,
    },
    {
      icon: Clock,
      label: 'Timesheets',
      to: `/projects/${project.id}/timesheets`,
    },
    {
      icon: FileText,
      label: 'Documents',
      to: `/projects/${project.id}/documents`,
    },
    {
      icon: Activity,
      label: 'Activity',
      to: `/projects/${project.id}/activity`,
    },
    {
      icon: Settings,
      label: 'Settings',
      to: `/projects/${project.id}/settings`,
    },
  ];

  return (
    <aside className="hidden lg:flex w-[240px] flex-shrink-0 bg-white border-r border-gray-200 flex-col">
      {/* Back link */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 px-4 py-3 text-[11px] font-medium text-gray-500 hover:text-gray-900 transition-colors border-b border-gray-100"
      >
        <ArrowLeft className="w-3 h-3" strokeWidth={2} />
        All Projects
      </button>

      {/* Project header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FolderKanban className="w-4.5 h-4.5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-semibold text-gray-900 leading-tight line-clamp-2">
              {project.name}
            </h2>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {project.code && (
                <span className="text-[10px] font-mono text-gray-400">
                  {project.code}
                </span>
              )}
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
                  project.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : project.status === 'planning'
                    ? 'bg-gray-100 text-gray-600'
                    : project.status === 'on_hold'
                    ? 'bg-amber-50 text-amber-700'
                    : project.status === 'completed'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-red-50 text-red-700'
                )}
              >
                {project.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <button
            className="p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
            title="More actions"
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
            >
              <item.icon
                className="w-4 h-4 flex-shrink-0"
                strokeWidth={1.75}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded min-w-[20px] text-center">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Progress footer */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Progress
          </span>
          <span className="text-[11px] font-bold text-gray-700">
            {progress}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
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
    </aside>
  );
}