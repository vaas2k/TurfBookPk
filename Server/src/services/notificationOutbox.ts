import { db, sql } from '../database/client.js';
import { notificationOutbox, notifications } from '../database/schema.js';
import { deliverExpoPush } from './expoPushService.js';
import { errorMetadata, logEvent } from './operationalLogger.js';
import { eq } from 'drizzle-orm';

export const MAX_PUSH_ATTEMPTS = 6;
export function retryDelayMs(attempt: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000);
}

export function pushBody(type: string, message: string): string {
  if (type === 'vendor_verification' || type === 'ground_verification') return 'Open TurfBookPK to review your verification update.';
  if (type === 'payment_review') return 'A payment needs review in the admin panel.';
  if (type === 'payment') return 'Open TurfBookPK to review your payment status.';
  return message;
}

type Claimed = { id: string; notification_id: string; attempts: number };

export async function claimDuePushJobs(onlyNotificationId: string | null = null): Promise<Claimed[]> {
  const claimed = await sql<Claimed[]>`
    UPDATE notification_outbox AS queue SET status = 'processing', attempts = queue.attempts + 1,
      locked_until = now() + interval '45 seconds', updated_at = now()
    WHERE queue.id IN (
      SELECT id FROM notification_outbox
      WHERE ((status = 'pending' AND available_at <= now())
         OR (status = 'processing' AND locked_until <= now()))
        AND (${onlyNotificationId}::uuid IS NULL OR notification_id = ${onlyNotificationId}::uuid)
      ORDER BY available_at, id FOR UPDATE SKIP LOCKED LIMIT 50
    ) RETURNING queue.id, queue.notification_id, queue.attempts`;
  return [...claimed];
}

export async function processNotificationOutbox(onlyNotificationId: string | null = null): Promise<{ sent: number; retried: number; dead: number }> {
  const claimed = await claimDuePushJobs(onlyNotificationId);
  const result = { sent: 0, retried: 0, dead: 0 };
  for (const job of claimed) {
    try {
      const [notification] = await db.select().from(notifications).where(eq(notifications.id, job.notification_id)).limit(1);
      if (notification) {
        const data = notification.data && typeof notification.data === 'object' && !Array.isArray(notification.data)
          ? Object.fromEntries(Object.entries(notification.data).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : undefined;
        await deliverExpoPush({ userIds: [notification.userId], title: notification.title, body: pushBody(notification.type, notification.message), ...(data ? { data } : {}) });
      }
      await db.update(notificationOutbox).set({ status: 'sent', lockedUntil: null, sentAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(notificationOutbox.id, job.id));
      result.sent += 1;
    } catch (error) {
      const dead = job.attempts >= MAX_PUSH_ATTEMPTS;
      await db.update(notificationOutbox).set({ status: dead ? 'dead' : 'pending', lockedUntil: null, availableAt: new Date(Date.now() + retryDelayMs(job.attempts)), lastError: error instanceof Error ? error.name.slice(0, 80) : 'unknown', updatedAt: new Date() }).where(eq(notificationOutbox.id, job.id));
      logEvent('error', 'notification_outbox_delivery_failed', { outbox_id: job.id, attempt: job.attempts, dead, ...errorMetadata(error) });
      if (dead) result.dead += 1; else result.retried += 1;
    }
  }
  return result;
}
