import { api } from './api';

export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'approval'
  | 'meeting';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotificationType | string;
  is_read: boolean;
  link?: string | null;
  extra_data?: string | null;
  created_at: string;
  read_at?: string | null;
}

export const notificationService = {
  async getNotifications(limit = 100): Promise<Notification[]> {
    const response = await api.get<Notification[]>('/notifications/', {
      params: { limit },
    });
    return response.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get<{ count: number }>('/notifications/unread');
    return response.data.count;
  },

  async markAsRead(id: string): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },
};
