import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/lib/notifications';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } =
    useNotifications();

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      try {
        await markAsRead(notif.id);
      } catch {
        // ignore
      }
    }
    setOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const getTypeDot = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative p-2 rounded-md transition-colors',
          open ? 'bg-gray-100' : 'hover:bg-gray-100'
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

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-[380px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-fade-in z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Notifications
              </div>
              {unreadCount > 0 && (
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {unreadCount} unread
                </div>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary-dark transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-gray-200 mt-2" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-200 rounded w-1/2" />
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
                  You're all caught up
                </div>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0',
                    notif.is_read
                      ? 'hover:bg-gray-50'
                      : 'bg-blue-50/30 hover:bg-blue-50/60'
                  )}
                >
                  <div className="pt-1.5 flex-shrink-0">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        notif.is_read ? 'bg-gray-300' : getTypeDot(notif.type)
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-[13px] leading-snug',
                        notif.is_read
                          ? 'text-gray-700'
                          : 'text-gray-900 font-medium'
                      )}
                    >
                      {notif.title}
                    </div>
                    {notif.body && (
                      <div className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">
                        {notif.body}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notif.created_at), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
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
          )}
        </div>
      )}
    </div>
  );
}