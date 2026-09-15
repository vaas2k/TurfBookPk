import { inArray } from 'drizzle-orm';
import { db } from '../database/client.js';
import { pushTokens } from '../database/schema.js';

export async function sendExpoPush(input: { userIds: string[]; title: string; body: string; data?: Record<string, string> }): Promise<void> {
  const userIds = [...new Set(input.userIds.filter(Boolean))];
  if (!userIds.length) return;
  const tokens = await db.select().from(pushTokens).where(inArray(pushTokens.userId, userIds));
  if (!tokens.length) return;
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(tokens.map((row) => ({ to: row.token, sound: 'default', title: input.title, body: input.body, data: input.data }))) });
    const payload = await response.json() as { data?: { details?: { error?: string } }[] };
    const invalid = tokens.filter((_, index) => payload.data?.[index]?.details?.error === 'DeviceNotRegistered').map((row) => row.token);
    if (invalid.length) await db.delete(pushTokens).where(inArray(pushTokens.token, invalid));
  } catch (error) { console.error('Expo push delivery failed', error); }
}
