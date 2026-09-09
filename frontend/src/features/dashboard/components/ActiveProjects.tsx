import { FolderKanban, Plus } from 'lucide-react';

export function ActiveProjects() {
  // This will be populated from real data later
  const projects: any[] = [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Active Projects</h3>
        <button className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
          View all
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <FolderKanban className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">No active projects</p>
          <p className="text-xs text-gray-400 mt-0.5">Create your first project</p>
          <button className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:bg-primary-dark transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{project.name}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  project.status === 'active' ? 'bg-green-100 text-green-700' :
                  project.status === 'at_risk' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {project.status}
                </span>
              </div>
              <div className="mt-2">
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${project.progress || 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-500">{project.progress || 0}%</span>
                  <span className="text-xs text-gray-400">Due {project.deadline}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}