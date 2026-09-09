import { Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { notificationService } from '@/services/notification.service';
import { formatDistanceToNow } from 'date-fns';

export function RecentActivity() {
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getNotifications,
  });
  const activities = notifications.slice(0, 5).map((notification) => ({
    ...notification,
    user: notification.title,
    action: ` — ${notification.body}`,
    userInitials: notification.title.slice(0, 2).toUpperCase(),
    timestamp: formatDistanceToNow(new Date(notification.created_at), { addSuffix: true }),
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
        <button className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
          View all
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3 py-5">
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="h-3 w-56 bg-gray-200 rounded" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Clock className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">No recent activity</p>
          <p className="text-xs text-gray-400 mt-0.5">Activity will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600 flex-shrink-0">
                {activity.userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{activity.user}</span>
                  {activity.action}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activity.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}