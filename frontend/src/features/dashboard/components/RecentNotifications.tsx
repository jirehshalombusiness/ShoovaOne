import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Bell, ArrowRight, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';
import { notificationMeta } from '@/lib/notificationMeta';
import { cn } from '@/lib/utils';

export function RecentNotifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();

  const recent = notifications.slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 ? (
          <button
            onClick={() => markAllAsRead()}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            <CheckCheck className="w-3 h-3" />
            Mark all read
          </button>
        ) : (
          <button
            onClick={() => navigate('/notifications')}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex-1">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 h-full">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
              <Bell className="w-5 h-5 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-gray-700">
              No notifications yet
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Meeting invites and approvals will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map((notification) => {
              const meta = notificationMeta(
                notification.type,
                notification.link,
              );
              const Icon = meta.icon;

              return (
                <button
                  key={notification.id}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                    if (notification.link) {
                      navigate(notification.link);
                    }
                  }}
                  className={cn(
                    'w-full flex items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50',
                    !notification.is_read && 'bg-primary/[0.025]',
                  )}
                >
                  <span
                    className={cn(
                      'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5',
                      meta.iconClass,
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[12px] truncate',
                          notification.is_read
                            ? 'text-gray-700'
                            : 'font-semibold text-gray-900',
                        )}
                      >
                        {notification.title}
                      </span>
                      {!notification.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                      {notification.body}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
        <button
          onClick={() => navigate('/notifications')}
          className="w-full flex items-center justify-center gap-2 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
        >
          Open notification center
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
