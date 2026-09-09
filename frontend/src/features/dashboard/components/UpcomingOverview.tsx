import { Calendar, Clock, ChevronRight } from 'lucide-react';

export function UpcomingOverview() {
  // This will be populated from real data later
  const upcoming: any[] = [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Upcoming</h3>
        <button className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1">
          Calendar
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {upcoming.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">No upcoming events</p>
          <p className="text-xs text-gray-400 mt-0.5">Check back later</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors cursor-pointer"
            >
              <div className="min-w-[44px] text-center">
                <p className="text-xs font-medium text-gray-500">{item.month}</p>
                <p className="text-lg font-bold text-gray-900 -mt-0.5">{item.day}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}