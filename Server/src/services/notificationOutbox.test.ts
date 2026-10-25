import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { db, sql } from '../database/client.js';
import { notificationOutbox, notifications, users } from '../database/schema.js';
import { MAX_PUSH_ATTEMPTS, claimDuePushJobs, processNotificationOutbox, pushBody, retryDelayMs } from './notificationOutbox.js';

after(async () => { await sql.end(); });

test('notification insert creates an outbox row in the same transaction', async () => {
  const rollback = new Error('expected rollback');
  let notificationId = '';
  await assert.rejects(db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ phone: `+92319${String(Date.now()).slice(-7)}`, fullName: 'Outbox Test' }).returning();
    const [notification] = await tx.insert(notifications).values({ userId: user!.id, type: 'booking', title: 'Test', message: 'Test message' }).returning();
    notificationId = notification!.id;
    const rows = await tx.select().from(notificationOutbox).where(eq(notificationOutbox.notificationId, notificationId));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, 'pending');
    throw rollback;
  }), rollback);
  const rows = await db.select().from(notificationOutbox).where(eq(notificationOutbox.notificationId, notificationId));
  assert.equal(rows.length, 0);
});

test('push retry policy is bounded and sensitive notification bodies stay private', () => {
  assert.equal(MAX_PUSH_ATTEMPTS, 6);
  assert.equal(retryDelayMs(1), 60_000);
  assert.equal(retryDelayMs(10), 30 * 60_000);
  assert.equal(pushBody('vendor_verification', 'CNIC rejected: private reason'), 'Open TurfBookPK to review your verification update.');
  assert.equal(pushBody('booking', 'Booking confirmed'), 'Booking confirmed');
});

test('parallel workers claim a notification only once', async () => {
  const [user] = await db.insert(users).values({ phone: `+92318${String(Date.now()).slice(-7)}`, fullName: 'Outbox Claim Test' }).returning();
  try {
    const [notification] = await db.insert(notifications).values({ userId: user!.id, type: 'booking', title: 'Test', message: 'Test message' }).returning();
    const [left, right] = await Promise.all([claimDuePushJobs(notification!.id), claimDuePushJobs(notification!.id)]);
    assert.equal(left.length + right.length, 1);
    assert.equal(left.concat(right)[0]?.attempts, 1);
  } finally {
    await db.delete(users).where(eq(users.id, user!.id));
  }
});

test('worker marks a notification sent when the user has no push tokens', async () => {
  const [user] = await db.insert(users).values({ phone: `+92317${String(Date.now()).slice(-7)}`, fullName: 'Outbox Delivery Test' }).returning();
  try {
    const [notification] = await db.insert(notifications).values({ userId: user!.id, type: 'booking', title: 'Test', message: 'Test message' }).returning();
    const result = await processNotificationOutbox(notification!.id);
    assert.deepEqual(result, { sent: 1, retried: 0, dead: 0 });
    const [job] = await db.select().from(notificationOutbox).where(eq(notificationOutbox.notificationId, notification!.id));
    assert.equal(job?.status, 'sent');
  } finally {
    await db.delete(users).where(eq(users.id, user!.id));
  }
});

test('worker reclaims an expired lease after a crash', async () => {
  const [user] = await db.insert(users).values({ phone: `+92316${String(Date.now()).slice(-7)}`, fullName: 'Outbox Lease Test' }).returning();
  try {
    const [notification] = await db.insert(notifications).values({ userId: user!.id, type: 'booking', title: 'Test', message: 'Test message' }).returning();
    assert.equal((await claimDuePushJobs(notification!.id))[0]?.attempts, 1);
    await db.update(notificationOutbox).set({ lockedUntil: new Date(Date.now() - 1000) }).where(eq(notificationOutbox.notificationId, notification!.id));
    assert.equal((await claimDuePushJobs(notification!.id))[0]?.attempts, 2);
  } finally { await db.delete(users).where(eq(users.id, user!.id)); }
});

test('repeated push failures reach dead-letter without affecting other jobs', async () => {
  const [user] = await db.insert(users).values({ phone: `+92315${String(Date.now()).slice(-7)}`, fullName: 'Outbox Retry Test' }).returning();
  try {
    const [notification] = await db.insert(notifications).values({ userId: user!.id, type: 'booking', title: 'Test', message: 'Test message' }).returning();
    const fail = async () => { throw new Error('simulated transport failure'); };
    for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
      const result = await processNotificationOutbox(notification!.id, fail);
      assert.equal(result.retried + result.dead, 1);
      const [job] = await db.select().from(notificationOutbox).where(eq(notificationOutbox.notificationId, notification!.id));
      assert.equal(job?.status, attempt === MAX_PUSH_ATTEMPTS ? 'dead' : 'pending');
      if (attempt < MAX_PUSH_ATTEMPTS) await db.update(notificationOutbox).set({ availableAt: new Date(Date.now() - 1000) }).where(eq(notificationOutbox.notificationId, notification!.id));
    }
    assert.deepEqual(await processNotificationOutbox(notification!.id, fail), { sent: 0, retried: 0, dead: 0 });
  } finally { await db.delete(users).where(eq(users.id, user!.id)); }
});
