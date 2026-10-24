import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, ArrowRight, CheckSquare } from 'lucide-react';
import { myWorkService } from '@/services/mywork.service';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  planning: 'bg-blue-50 text-blue-700',
  on_hold: 'bg-amber-50 text-amber-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-50 text-red-700',
};

export function MyProjectsWidget() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['my-work', 'projects'],
    queryFn: () => myWorkService.getProjects(),
    refetchInterval: 2 * 60_000,
  });

  const projects = (data ?? []).slice(0, 4);

  return (
    <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">My Projects</h3>
          {data && data.length > 0 && (
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {data.length}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          All projects
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 h-full">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
              <FolderKanban className="w-5 h-5 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-gray-700">No projects yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Projects you join will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {projects.map((project) => {
              const progress = Math.min(100, Math.max(0, project.progress ?? 0));

              return (
                <button
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="w-full px-5 py-3 hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {project.code && (
                          <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded tracking-wider">
                            {project.code}
                          </span>
                        )}
                        <span className="text-[13px] font-semibold text-gray-900 truncate">
                          {project.name}
                        </span>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
                            statusStyles[project.status] ?? statusStyles.active,
                          )}
                        >
                          {project.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <CheckSquare className="w-2.5 h-2.5" />
                          {project.my_open_tasks} of {project.total_tasks} tasks
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="capitalize">
                          {project.my_role.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-gray-500 tabular-nums w-8 text-right">
                          {progress}%
                        </span>
                      </div>
                    </div>

                    {project.manager_first_name && (
                      <Avatar
                        firstName={project.manager_first_name}
                        lastName={project.manager_last_name}
                        imageUrl={project.manager_image_url}
                        size="sm"
                        className="mt-0.5"
                      />
                    )}

                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
