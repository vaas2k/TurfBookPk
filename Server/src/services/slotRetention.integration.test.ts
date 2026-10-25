import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { db, sql } from '../database/client.js';
import { bookings, grounds, slots, users, vendors } from '../database/schema.js';
import { cleanupExpiredUnbookedSlots } from './scheduleMaterialization.js';

after(async () => { await sql.end(); });

test('three-day cleanup removes only old slots with no booking, block, club reservation, or hold', async () => {
  const suffix = randomUUID().slice(0, 10);
  const user = (await db.insert(users).values({ phone: `+92314${suffix}`, fullName: 'Retention Vendor' }).returning())[0]!;
  const vendor = (await db.insert(vendors).values({ userId: user.id, businessName: 'Retention Test', businessPhone: `+92313${suffix}`, businessCity: 'Karachi' }).returning())[0]!;
  const ground = (await db.insert(grounds).values({ vendorId: vendor.id, title: 'Retention Test', location: 'Karachi', city: 'Karachi', address: 'Test', pricePerHour: 1000 }).returning())[0]!;
  const recent = new Date(Date.now() + 5 * 60 * 60_000);
  recent.setUTCDate(recent.getUTCDate() - 3);
  const recentDate = recent.toISOString().slice(0, 10);
  const oldDate = '2020-01-01';
  try {
    const created = await db.insert(slots).values([
      { groundId: ground.id, date: oldDate, startTime: '08:00', endTime: '09:00', price: 1000 },
      { groundId: ground.id, date: oldDate, startTime: '09:00', endTime: '10:00', price: 1000, isBlocked: true },
      { groundId: ground.id, date: oldDate, startTime: '10:00', endTime: '11:00', price: 1000, isClubReserved: true },
      { groundId: ground.id, date: oldDate, startTime: '11:00', endTime: '12:00', price: 1000 },
      { groundId: ground.id, date: recentDate, startTime: '12:00', endTime: '13:00', price: 1000 },
    ]).returning();
    await db.insert(bookings).values({ bookingNumber: `retention-${suffix}`, playerId: user.id, vendorId: vendor.id, groundId: ground.id, slotId: created[3]!.id, date: oldDate, startTime: '11:00', endTime: '12:00', totalAmount: 1000, vendorAmount: 1000, status: 'cancelled', paymentStatus: 'cancelled' });
    assert.equal(await cleanupExpiredUnbookedSlots(ground.id), 1);
    const remaining = await db.select({ id: slots.id }).from(slots).where(eq(slots.groundId, ground.id));
    assert.equal(remaining.length, 4);
    assert.equal(await cleanupExpiredUnbookedSlots(ground.id), 0);
  } finally {
    const existing = await db.select({ id: slots.id }).from(slots).where(eq(slots.groundId, ground.id));
    await db.delete(bookings).where(eq(bookings.groundId, ground.id));
    if (existing.length) await db.delete(slots).where(inArray(slots.id, existing.map((row) => row.id)));
    await db.delete(grounds).where(eq(grounds.id, ground.id));
    await db.delete(vendors).where(eq(vendors.id, vendor.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
});
