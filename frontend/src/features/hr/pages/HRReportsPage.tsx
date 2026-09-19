import { BarChart3 } from 'lucide-react';

export function HRReportsPage() {
  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">HR Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Headcount, turnover, leave analytics
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-gray-700">Coming soon</p>
        <p className="text-xs text-gray-400 mt-1">
          HR analytics and reporting will appear here
        </p>
      </div>
    </div>
  );
}