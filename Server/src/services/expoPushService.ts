import { and, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '../database/client.js';
import { pushReceipts, pushTokens } from '../database/schema.js';
import { errorMetadata, logEvent } from './operationalLogger.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const MAX_BATCH_SIZE = 100;
const MAX_RESPONSE_BYTES = 512 * 1024;
type ExpoTicket = { status?: 'ok' | 'error'; id?: string; details?: { error?: string } };
type ExpoReceipt = { status?: 'ok' | 'error'; details?: { error?: string } };

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export async function parseExpoResponse<T>(response: Response): Promise<T> {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_RESPONSE_BYTES) throw new Error('Expo response exceeded the size limit');
  if (!response.body) throw new Error('Expo returned an empty response');
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Expo response exceeded the size limit');
    }
    chunks.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

async function removeInvalidTokens(tokens: string[]): Promise<void> {
  const uniqueTokens = [...new Set(tokens)];
  if (uniqueTokens.length) await db.delete(pushTokens).where(inArray(pushTokens.token, uniqueTokens));
}

// Legacy call sites may invoke this after inserting an in-app notification.
// The database trigger queues that notification transactionally; sending here
// would duplicate it and could lose delivery if the API process exits.
export async function sendExpoPush(_input: { userIds: string[]; title: string; body: string; data?: Record<string, string> }): Promise<void> {}

export async function deliverExpoPush(input: { userIds: string[]; title: string; body: string; data?: Record<string, string> }): Promise<void> {
  const userIds = [...new Set(input.userIds.filter(Boolean))];
  if (!userIds.length) return;
  const tokens = await db.select().from(pushTokens).where(inArray(pushTokens.userId, userIds));
  for (const batch of chunks(tokens, MAX_BATCH_SIZE)) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map((row) => ({ to: row.token, sound: 'default', channelId: 'bookings', priority: 'high', title: input.title, body: input.body, data: input.data }))),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Expo push request failed with ${response.status}`);
      const payload = await parseExpoResponse<{ data?: ExpoTicket[] }>(response);
      const tickets = payload.data ?? [];
      if (tickets.length !== batch.length) throw new Error('Expo push ticket count mismatch');
      await removeInvalidTokens(batch.filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered').map((row) => row.token));
      const receiptRows = batch.flatMap((row, index) => {
        const ticket = tickets[index];
        return ticket?.status === 'ok' && ticket.id ? [{ token: row.token, ticketId: ticket.id }] : [];
      });
      if (receiptRows.length) await db.insert(pushReceipts).values(receiptRows).onConflictDoNothing();
      if (tickets.some((ticket) => ticket.status === 'error' && ticket.details?.error !== 'DeviceNotRegistered')) throw new Error('Expo rejected one or more push messages');
  }
}

export async function processExpoPushReceipts(now = new Date()): Promise<number> {
  const pending = await db.select().from(pushReceipts)
    .where(and(isNull(pushReceipts.checkedAt), lte(pushReceipts.createdAt, new Date(now.getTime() - 30_000))))
    .limit(MAX_BATCH_SIZE);
  if (!pending.length) return 0;
  try {
    const response = await fetch(EXPO_RECEIPTS_URL, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: pending.map((item) => item.ticketId) }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Expo receipt request failed with ${response.status}`);
    const payload = await parseExpoResponse<{ data?: Record<string, ExpoReceipt> }>(response);
    const receipts = payload.data ?? {};
    const resolved = pending.filter((item) => receipts[item.ticketId]);
    await removeInvalidTokens(resolved.filter((item) => receipts[item.ticketId]?.details?.error === 'DeviceNotRegistered').map((item) => item.token));
    if (resolved.length) await db.update(pushReceipts).set({ checkedAt: now }).where(inArray(pushReceipts.id, resolved.map((item) => item.id)));
    return resolved.length;
  } catch (error) {
    logEvent('error', 'expo_push_receipt_processing_failed', errorMetadata(error));
    return 0;
  }
}
