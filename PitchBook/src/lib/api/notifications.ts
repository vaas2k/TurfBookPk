import { apiRequest } from './client';

export interface AppNotification { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string; }

export interface NotificationList { notifications: AppNotification[]; unread_count: number; }

export async function getNotifications(): Promise<NotificationList> {
  return apiRequest<NotificationList>('/notifications');
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
