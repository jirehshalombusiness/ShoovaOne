import { CalendarDays } from 'lucide-react';

export function HRLeavePage() {
  return (
    <div className="text-center py-16">
      <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-gray-700">Leave Management</p>
      <p className="text-xs text-gray-400 mt-1">
        Coming in the next session
      </p>
    </div>
  );
}