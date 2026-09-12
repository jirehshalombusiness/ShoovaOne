import { useOutletContext } from 'react-router-dom';
import type { Project } from '@/services/project.service';

export function ProjectActivity() {
  const { project } = useOutletContext<{ project: Project }>();
  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-gray-900">Activity</h1>
      <p className="text-sm text-gray-500 mt-1">
        Activity for {project.name} — coming next
      </p>
    </div>
  );
}
