import { Outlet, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectService } from '@/services/project.service';
import { ProjectSubSidebar } from '../components/ProjectSubSidebar';
import { FolderKanban } from 'lucide-react';

export function ProjectLayout() {
  const { id } = useParams<{ id: string }>();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectService.getById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="text-center py-16">
        <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-gray-700 font-medium">Project not found</p>
        <p className="text-sm text-gray-500 mt-1">
          The project may have been deleted or you may not have access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-0 -m-4 lg:-m-6 min-h-[calc(100vh-3.5rem)]">
      {/* Sub-sidebar */}
      <ProjectSubSidebar project={project} />

      {/* Content */}
      <div className="flex-1 min-w-0 p-6 overflow-x-hidden">
        <Outlet context={{ project }} />
      </div>
    </div>
  );
}