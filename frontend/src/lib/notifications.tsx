import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  notificationService,
  type Notification,
} from '@/services/notification.service';
import { useAuth } from './auth';

export const DESKTOP_NOTIFICATIONS_KEY = 'shoova.desktopNotifications';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialisedRef = useRef(false);

  const showDesktopNotifications = useCallback((items: Notification[]) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY) !== 'true') return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;

    const unread = items.filter((item) => !item.is_read);
    const fresh = unread.filter((item) => !seenIdsRef.current.has(item.id));
    items.forEach((item) => seenIdsRef.current.add(item.id));

    // Don't fire a burst of desktop alerts on first load.
    if (initialisedRef.current && fresh.length > 0) {
      const newest = fresh[0];
      const desktopNotification = new Notification(newest.title, {
        body: newest.body,
        tag: newest.id,
      });
      desktopNotification.onclick = () => {
        window.focus();
        if (newest.link) {
          window.location.assign(newest.link);
        }
      };
    }

    initialisedRef.current = true;
  }, []);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user) return;

      if (!options?.silent) {
        setLoading(true);
      }

      try {
        const [items, count] = await Promise.all([
          notificationService.getNotifications(),
          notificationService.getUnreadCount(),
        ]);
        setNotifications(items);
        setUnreadCount(count);
        showDesktopNotifications(items);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [user, showDesktopNotifications],
  );

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      seenIdsRef.current = new Set();
      initialisedRef.current = false;
      return;
    }

    refresh();

    // Keep polling while the tab is hidden so desktop alerts can fire.
    const interval = window.setInterval(() => {
      refresh({ silent: true });
    }, 60_000);

    const handleFocus = () => refresh({ silent: true });
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh({ silent: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, refresh]);

  const markAsRead = async (id: string) => {
    const target = notifications.find((item) => item.id === id);

    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, is_read: true } : item,
      ),
    );
    if (target && !target.is_read) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }

    try {
      await notificationService.markAsRead(id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      await refresh({ silent: true });
    }
  };

  const markAllAsRead = async () => {
    setNotifications((current) =>
      current.map((item) => ({ ...item, is_read: true })),
    );
    setUnreadCount(0);

    try {
      await notificationService.markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      await refresh({ silent: true });
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider',
    );
  }
  return context;
}
