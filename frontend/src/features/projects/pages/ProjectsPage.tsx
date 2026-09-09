import { Calendar } from 'lucide-react';

export function ProjectsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
      <p className="text-sm text-gray-500 mt-1">Manage all projects</p>
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Project management coming soon</p>
      </div>
    </div>
  );
}