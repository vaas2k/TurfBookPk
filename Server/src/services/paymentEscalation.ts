import { and, eq, lt } from 'drizzle-orm';
import { db } from '../database/client.js';
import { notifications, paymentAttempts, users } from '../database/schema.js';

/** A crashed/ambiguous generation must never be automatically retried or released. */
export async function escalateStaleClinkGeneration(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 2 * 60_000);
  const candidates = await db.select({ id: paymentAttempts.id }).from(paymentAttempts)
    .where(and(eq(paymentAttempts.provider, 'clink'), eq(paymentAttempts.providerStatus, 'initializing'), lt(paymentAttempts.updatedAt, cutoff)))
    .orderBy(paymentAttempts.updatedAt).limit(100);
  if (!candidates.length) return 0;
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
  let escalated = 0;
  for (const candidate of candidates) {
    const changed = await db.transaction(async (tx) => {
      const [updated] = await tx.update(paymentAttempts).set({ providerStatus: 'unknown', reviewStatus: 'manual_review', providerError: 'Generation interrupted; confirm with provider before retrying or releasing the hold', updatedAt: now })
        .where(and(eq(paymentAttempts.id, candidate.id), eq(paymentAttempts.providerStatus, 'initializing'))).returning({ id: paymentAttempts.id });
      if (!updated) return false;
      if (admins.length) await tx.insert(notifications).values(admins.map((admin) => ({ userId: admin.id, type: 'payment_review', title: 'Payment generation needs review', message: 'A 1-Bill reference request was interrupted. Check the payment attempt before retrying.', data: { paymentId: candidate.id } })));
      return true;
    });
    if (changed) escalated += 1;
  }
  return escalated;
}
