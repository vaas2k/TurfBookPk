import { apiRequest } from './client';

export interface AppNotification { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string; }

export async function listNotifications(): Promise<AppNotification[]> {
  const result = await apiRequest<{ notifications: AppNotification[] }>('/bookings/notifications');
  return result.notifications;
}