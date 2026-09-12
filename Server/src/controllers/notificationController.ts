import { and, desc, eq } from 'drizzle-orm';
import { Response } from 'express';
import { db } from '../database/client.js';
import { notifications } from '../database/schema.js';
import { AppError } from '../helpers/errors.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

function notificationId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || !value) throw new AppError('invalid_request', 'Notification id is required', 422);
  return value;
}

export class NotificationController {
  list = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const rows = await db.select().from(notifications)
      .where(eq(notifications.userId, request.auth.userId))
      .orderBy(desc(notifications.createdAt));
    response.json({ notifications: rows, unread_count: rows.filter((row) => !row.isRead).length });
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
