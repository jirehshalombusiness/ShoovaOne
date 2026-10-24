import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/lib/notifications';
import { notificationMeta } from '@/lib/notificationMeta';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@/services/notification.service';

const MAX_PREVIEW = 8;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } =
    useNotifications();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id);
      } catch {
        // Non-blocking — navigation still matters.
      }
    }
    setOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'relative p-2 rounded-md transition-colors',
          open ? 'bg-gray-100' : 'hover:bg-gray-100',
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
      >
        <Bell className="w-[18px] h-[18px] text-gray-700" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-[380px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-fade-in z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Notifications
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary-dark transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex gap-3 animate-pulse">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Inbox className="w-5 h-5 text-gray-400" strokeWidth={1.75} />
                </div>
                <div className="text-sm font-medium text-gray-900">
                  No notifications
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  You'll see meetings, approvals and updates here
                </div>
              </div>
            ) : (
              notifications.slice(0, MAX_PREVIEW).map((notification) => {
                const meta = notificationMeta(
                  notification.type,
                  notification.link,
                );
                const Icon = meta.icon;

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0',
                      notification.is_read
                        ? 'hover:bg-gray-50'
                        : 'bg-blue-50/30 hover:bg-blue-50/60',
                    )}
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                        meta.iconClass,
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            'flex-1 text-[13px] leading-snug',
                            notification.is_read
                              ? 'text-gray-700'
                              : 'text-gray-900 font-medium',
                          )}
                        >
                          {notification.title}
                        </div>
                        {!notification.is_read && (
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5',
                              meta.dotClass,
                            )}
                          />
                        )}
                      </div>

                      {notification.body && (
                        <div className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">
                          {notification.body}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-100 px-4 py-2 text-center">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
              className="text-[12px] font-medium text-primary hover:text-primary-dark transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
