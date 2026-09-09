import { Building2, Plus } from 'lucide-react';

export function PartnershipsOverview() {
  // This will be populated from real data later
  const partnerships: any[] = [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Partnerships</h3>
        <button className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
          View all
        </button>
      </div>

      {partnerships.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Building2 className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">No active partnerships</p>
          <p className="text-xs text-gray-400 mt-0.5">Partnerships will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partnerships.map((partnership) => (
            <div
              key={partnership.id}
              className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors cursor-pointer"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{partnership.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{partnership.stage}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-700">Next action</p>
                <p className="text-xs text-gray-500">{partnership.nextAction}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}