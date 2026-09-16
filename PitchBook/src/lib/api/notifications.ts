import { apiRequest } from './client';

export interface AppNotification { id: string; type: string; title: string; message: string; data?: { bookingId?: string; orderId?: string } | null; isRead: boolean; createdAt: string; }

export interface NotificationList {
  notifications: AppNotification[];
  unread_count: number;
  pagination: { page: number; limit: number; total: number; has_more: boolean };
}

export async function getNotifications(page = 1, limit = 50): Promise<NotificationList> {
  return apiRequest<NotificationList>(`/notifications?page=${page}&limit=${limit}`);
}

export async function listNotifications(): Promise<AppNotification[]> {
  return (await getNotifications()).notifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest(`/notifications/${id}/read`, { method: 'PATCH', data: {} });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest('/notifications/read-all', { method: 'PATCH', data: {} });
}

export async function registerPushToken(token: string, platform: string): Promise<void> {
  await apiRequest('/notifications/push-token', { method: 'POST', data: { token, platform } });
}
