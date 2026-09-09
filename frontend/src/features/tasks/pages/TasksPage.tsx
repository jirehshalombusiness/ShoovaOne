import { CheckSquare } from 'lucide-react';

export function TasksPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
      <p className="text-sm text-gray-500 mt-1">Manage all tasks</p>
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-8 text-center">
        <CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Task management coming soon</p>
      </div>
    </div>
  );
}