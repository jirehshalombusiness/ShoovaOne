import type { ElementType } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Inbox,
  XCircle,
} from 'lucide-react';
import type { Notification } from '@/services/notification.service';

export type NotificationCategory = 'approval' | 'meeting' | 'system';

interface NotificationMeta {
  icon: ElementType;
  iconClass: string;
  dotClass: string;
  category: NotificationCategory;
}

export function notificationMeta(
  type: string,
  link?: string | null,
): NotificationMeta {
  const isApproval =
    type === 'approval' ||
    link?.startsWith('/me/approvals') ||
    link?.startsWith('/hr/approvals');

  if (isApproval) {
    return {
      icon: Inbox,
      iconClass: 'bg-violet-50 text-violet-600',
      dotClass: 'bg-violet-500',
      category: 'approval',
    };
  }

  if (type === 'meeting' || link?.startsWith('/meetings')) {
    return {
      icon: CalendarDays,
      iconClass: 'bg-blue-50 text-blue-600',
      dotClass: 'bg-blue-500',
      category: 'meeting',
    };
  }

  switch (type) {
    case 'success':
      return {
        icon: CheckCircle2,
        iconClass: 'bg-emerald-50 text-emerald-600',
        dotClass: 'bg-emerald-500',
        category: 'system',
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        iconClass: 'bg-amber-50 text-amber-600',
        dotClass: 'bg-amber-500',
        category: 'system',
      };
    case 'error':
      return {
        icon: XCircle,
        iconClass: 'bg-red-50 text-red-600',
        dotClass: 'bg-red-500',
        category: 'system',
      };
    default:
      return {
        icon: Bell,
        iconClass: 'bg-gray-100 text-gray-500',
        dotClass: 'bg-blue-500',
        category: 'system',
      };
  }
}

export function notificationCategory(
  notification: Notification,
): NotificationCategory {
  return notificationMeta(notification.type, notification.link).category;
}
