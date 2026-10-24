import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCheck,
  Inbox,
  RefreshCw,
  Search,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/lib/notifications';
import {
  notificationCategory,
  notificationMeta,
} from '@/lib/notificationMeta';
import type { Notification } from '@/services/notification.service';

type Filter = 'all' | 'unread' | 'approvals' | 'meetings' | 'system';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'approvals', label: 'Approvals' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'system', label: 'System' },
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh,
  } = useNotifications();

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    return {
      all: notifications.length,
      unread: unreadCount,
      approvals: notifications.filter(
        (item) => notificationCategory(item) === 'approval',
      ).length,
      meetings: notifications.filter(
        (item) => notificationCategory(item) === 'meeting',
      ).length,
      system: notifications.filter(
        (item) => notificationCategory(item) === 'system',
      ).length,
    };
  }, [notifications, unreadCount]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notifications.filter((notification) => {
      if (filter === 'unread' && notification.is_read) return false;
      if (
        filter === 'approvals' &&
        notificationCategory(notification) !== 'approval'
      ) {
        return false;
      }
      if (
        filter === 'meetings' &&
        notificationCategory(notification) !== 'meeting'
      ) {
        return false;
      }
      if (
        filter === 'system' &&
        notificationCategory(notification) !== 'system'
      ) {
        return false;
      }
      if (!query) return true;

      return (
        notification.title.toLowerCase().includes(query) ||
        notification.body?.toLowerCase().includes(query)
      );
    });
  }, [notifications, filter, search]);

  const groups = useMemo(() => {
    const grouped = new Map<string, Notification[]>();

    filtered.forEach((notification) => {
      const created = new Date(notification.created_at);
      let label: string;

      if (isToday(created)) {
        label = 'Today';
      } else if (isYesterday(created)) {
        label = 'Yesterday';
      } else {
        label = format(created, 'EEEE, MMM d');
      }

      if (!grouped.has(label)) {
        grouped.set(label, []);
      }
      grouped.get(label)!.push(notification);
    });

    return Array.from(grouped.entries());
  }, [filtered]);

  const handleOpen = (notification: Notification) => {
    if (!notification.is_read) {
      void markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    await markAllAsRead();
    toast.success('All notifications marked as read');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            Meetings, approvals, and updates that need your attention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5', loading && 'animate-spin')}
            />
            Refresh
          </button>

          <button
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryTile label="Unread" value={counts.unread} tone="text-primary" />
        <SummaryTile
          label="Approvals"
          value={counts.approvals}
          tone="text-violet-600"
        />
        <SummaryTile
          label="Meetings"
          value={counts.meetings}
          tone="text-blue-600"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-1 overflow-x-auto">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                filter === option.value
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {option.label}
              <span
                className={cn(
                  'tabular-nums text-[10px]',
                  filter === option.value
                    ? 'text-white/70'
                    : 'text-gray-400',
                )}
              >
                {counts[option.value]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notifications..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-20 bg-white border border-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {search
              ? 'No notifications match your search'
              : filter === 'unread'
                ? 'No unread notifications'
                : 'Nothing here yet'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {filter === 'unread'
              ? "You're all caught up."
              : 'New meeting invites, approvals and updates will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <div key={label}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {label}
                </h2>
                <span className="text-[10px] text-gray-400">
                  {items.length}
                </span>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                {items.map((notification) => {
                  const meta = notificationMeta(
                    notification.type,
                    notification.link,
                  );
                  const Icon = meta.icon;

                  return (
                    <div
                      key={notification.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpen(notification)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleOpen(notification);
                        }
                      }}
                      className={cn(
                        'flex items-start gap-3 px-4 py-4 cursor-pointer transition-colors',
                        notification.is_read
                          ? 'hover:bg-gray-50'
                          : 'bg-blue-50/30 hover:bg-blue-50/60',
                      )}
                    >
                      <div
                        className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                          meta.iconClass,
                        )}
                      >
                        <Icon className="w-4 h-4" strokeWidth={1.75} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              'flex-1 text-sm',
                              notification.is_read
                                ? 'text-gray-700'
                                : 'text-gray-900 font-semibold',
                            )}
                          >
                            {notification.title}
                          </div>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                            {format(new Date(notification.created_at), 'h:mm a')}
                          </span>
                        </div>

                        {notification.body && (
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            {notification.body}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                            {meta.category}
                          </span>
                          {notification.link && (
                            <span className="text-[10px] text-primary">
                              Open
                            </span>
                          )}
                        </div>
                      </div>

                      {!notification.is_read && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void markAsRead(notification.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-white rounded-md transition-colors flex-shrink-0"
                          title="Mark as read"
                          aria-label="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={cn('text-xl font-bold tabular-nums mt-0.5', tone)}>
        {value}
      </div>
    </div>
  );
}
