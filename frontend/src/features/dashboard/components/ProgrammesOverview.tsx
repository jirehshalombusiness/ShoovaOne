import { BookOpen, Plus } from 'lucide-react';

export function ProgrammesOverview() {
  // This will be populated from real data later
  const programmes: any[] = [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Programmes</h3>
        <button className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
          View all
        </button>
      </div>

      {programmes.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">No active programmes</p>
          <p className="text-xs text-gray-400 mt-0.5">Programmes will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {programmes.map((programme) => (
            <div
              key={programme.id}
              className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors cursor-pointer"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{programme.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{programme.participants} participants</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                programme.status === 'active' ? 'bg-green-100 text-green-700' :
                programme.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {programme.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}