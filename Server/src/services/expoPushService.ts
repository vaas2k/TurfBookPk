import { and, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '../database/client.js';
import { pushReceipts, pushTokens } from '../database/schema.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const MAX_BATCH_SIZE = 100;
type ExpoTicket = { status?: 'ok' | 'error'; id?: string; details?: { error?: string } };
type ExpoReceipt = { status?: 'ok' | 'error'; details?: { error?: string } };

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

async function removeInvalidTokens(tokens: string[]): Promise<void> {
  const uniqueTokens = [...new Set(tokens)];
  if (uniqueTokens.length) await db.delete(pushTokens).where(inArray(pushTokens.token, uniqueTokens));
}

export async function sendExpoPush(input: { userIds: string[]; title: string; body: string; data?: Record<string, string> }): Promise<void> {
  const userIds = [...new Set(input.userIds.filter(Boolean))];
  if (!userIds.length) return;
  const tokens = await db.select().from(pushTokens).where(inArray(pushTokens.userId, userIds));
  for (const batch of chunks(tokens, MAX_BATCH_SIZE)) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map((row) => ({ to: row.token, sound: 'default', channelId: 'bookings', priority: 'high', title: input.title, body: input.body, data: input.data }))),
      });
      if (!response.ok) throw new Error(`Expo push request failed with ${response.status}`);
      const payload = await response.json() as { data?: ExpoTicket[] };
      const tickets = payload.data ?? [];
      await removeInvalidTokens(batch.filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered').map((row) => row.token));
      const receiptRows = batch.flatMap((row, index) => {
        const ticket = tickets[index];
        return ticket?.status === 'ok' && ticket.id ? [{ token: row.token, ticketId: ticket.id }] : [];
      });
      if (receiptRows.length) await db.insert(pushReceipts).values(receiptRows).onConflictDoNothing();
    } catch (error) { console.error('Expo push delivery failed', error); }
  }
}

export async function processExpoPushReceipts(now = new Date()): Promise<number> {
  const pending = await db.select().from(pushReceipts)
    .where(and(isNull(pushReceipts.checkedAt), lte(pushReceipts.createdAt, new Date(now.getTime() - 30_000))))
    .limit(MAX_BATCH_SIZE);
  if (!pending.length) return 0;
  try {
    const response = await fetch(EXPO_RECEIPTS_URL, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: pending.map((item) => item.ticketId) }) });
    if (!response.ok) throw new Error(`Expo receipt request failed with ${response.status}`);
    const payload = await response.json() as { data?: Record<string, ExpoReceipt> };
    const receipts = payload.data ?? {};
    const resolved = pending.filter((item) => receipts[item.ticketId]);
    await removeInvalidTokens(resolved.filter((item) => receipts[item.ticketId]?.details?.error === 'DeviceNotRegistered').map((item) => item.token));
    if (resolved.length) await db.update(pushReceipts).set({ checkedAt: now }).where(inArray(pushReceipts.id, resolved.map((item) => item.id)));
    return resolved.length;
  } catch (error) { console.error('Expo push receipt processing failed', error); return 0; }
}
