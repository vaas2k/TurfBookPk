import { and, count, desc, eq } from 'drizzle-orm';
import { Response } from 'express';
import { db } from '../database/client.js';
import { notifications, pushTokens } from '../database/schema.js';
import { AppError } from '../helpers/errors.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

function notificationId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || !value) throw new AppError('invalid_request', 'Notification id is required', 422);
  return value;
}

function pagination(request: AuthenticatedRequest): { page: number; limit: number; offset: number } {
  const parse = (value: unknown, name: string, fallback: number, max: number): number => {
    if (value === undefined || value === '') return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError('invalid_pagination', `${name} must be a whole number`, 422);
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new AppError('invalid_pagination', `${name} must be between 1 and ${max}`, 422);
    return number;
  };
  const page = parse(request.query.page, 'Page', 1, 10_000);
  const limit = parse(request.query.limit, 'Limit', 50, 100);
  return { page, limit, offset: (page - 1) * limit };
}

export class NotificationController {
  registerPushToken = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const token = typeof request.body?.token === 'string' ? request.body.token.trim() : '';
    const platform = typeof request.body?.platform === 'string' ? request.body.platform.trim().slice(0, 20) : 'unknown';
    if (!/^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/.test(token)) throw new AppError('invalid_push_token', 'A valid Expo push token is required', 422);
    await db.insert(pushTokens).values({ userId: request.auth.userId, token, platform, updatedAt: new Date() }).onConflictDoUpdate({ target: pushTokens.token, set: { userId: request.auth.userId, platform, updatedAt: new Date() } });
    response.status(204).send();
  };
  list = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const { page, limit, offset } = pagination(request);
    const condition = eq(notifications.userId, request.auth.userId);
    const total = (await db.select({ total: count() }).from(notifications).where(condition))[0]?.total ?? 0;
    const rows = await db.select().from(notifications)
      .where(condition)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit).offset(offset);
    const unreadCount = (await db.select({ unreadCount: count() }).from(notifications).where(and(condition, eq(notifications.isRead, false))))[0]?.unreadCount ?? 0;
    response.json({ notifications: rows, unread_count: unreadCount, pagination: { page, limit, total, has_more: offset + rows.length < total } });
  };

  markRead = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const [row] = await db.update(notifications).set({ isRead: true })
      .where(and(eq(notifications.id, notificationId(request.params.id)), eq(notifications.userId, request.auth.userId)))
      .returning();
    if (!row) throw new AppError('not_found', 'Notification was not found', 404);
    response.json({ notification: row });
  };

  markAllRead = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, request.auth.userId));
    response.status(204).send();
  };
}
