import { useQuery } from '@tanstack/react-query';
import { timesheetService } from '@/services/timesheet.service';
import { CheckSquare, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek } from 'date-fns';

export function MyWork() {
  const navigate = useNavigate();
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const { data: timesheet, isLoading } = useQuery({
    queryKey: ['timesheet', 'dashboard', weekStart],
    queryFn: () => timesheetService.getMyTimesheet(weekStart),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">My Work</h3>
        <button onClick={() => navigate('/timesheets')} className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1">
            Open timesheet
            <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3 py-5">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-56 bg-gray-200 rounded" />
        </div>
      ) : !timesheet ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <CheckSquare className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">No work recorded this week</p>
          <p className="text-xs text-gray-400 mt-0.5">Add your hours from the timesheet</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-gray-900">{timesheet.total_hours} hours recorded</p>
              <p className="text-xs text-gray-500">of {timesheet.expected_hours} expected · {timesheet.status}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Week of {format(new Date(timesheet.week_start_date), 'd MMM yyyy')}</p>
        </div>
      )}
    </div>
  );
}