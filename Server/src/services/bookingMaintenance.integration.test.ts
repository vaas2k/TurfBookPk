import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import { db, sql } from '../database/client.js';
import { bookings, grounds, notifications, slots, users, vendors } from '../database/schema.js';
import { BookingMaintenanceService } from './bookingMaintenance.js';

after(async () => { await sql.end(); });

async function fixture() {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`.slice(-10);
  const player = (await db.insert(users).values({ phone: `+92320${suffix.slice(-7)}`, fullName: 'Reservation Player' }).returning())[0]!;
  const owner = (await db.insert(users).values({ phone: `+92321${suffix.slice(-7)}`, fullName: 'Reservation Owner', role: 'vendor' }).returning())[0]!;
  const vendor = (await db.insert(vendors).values({ userId: owner.id, businessName: `Reservation Vendor ${suffix}`, businessPhone: `+92322${suffix.slice(-7)}`, businessCity: 'Karachi' }).returning())[0]!;
  const ground = (await db.insert(grounds).values({ vendorId: vendor.id, title: `Reservation Ground ${suffix}`, location: 'Test location', city: 'Karachi', address: 'Test address', pricePerHour: 1000 }).returning())[0]!;
  return { player, owner, vendor, ground };
}

async function cleanup(ids: { playerId: string; ownerId: string; vendorId: string; groundId: string }) {
  await db.delete(notifications).where(eq(notifications.userId, ids.playerId));
  await db.update(slots).set({ heldBy: null, holdBookingId: null, holdExpiresAt: null, bookingId: null, bookedBy: null, isBooked: false }).where(eq(slots.groundId, ids.groundId));
  await db.delete(bookings).where(eq(bookings.playerId, ids.playerId));
  await db.delete(slots).where(eq(slots.groundId, ids.groundId));
  await db.delete(grounds).where(eq(grounds.id, ids.groundId));
  await db.delete(vendors).where(eq(vendors.id, ids.vendorId));
  await db.delete(users).where(and(eq(users.id, ids.playerId)));
  await db.delete(users).where(eq(users.id, ids.ownerId));
}

test('recurring expiry clears only the reservation hold it owns', async () => {
  const data = await fixture();
  try {
    const slot = (await db.insert(slots).values({ groundId: data.ground.id, date: '2030-01-01', startTime: '10:00', endTime: '11:00', price: 1000 }).returning())[0]!;
    const booking = (await db.insert(bookings).values({ bookingNumber: `reservation-${slot.id}`, playerId: data.player.id, vendorId: data.vendor.id, groundId: data.ground.id, slotId: slot.id, date: slot.date, startTime: slot.startTime, endTime: slot.endTime, totalAmount: 1000, vendorAmount: 1000, isRecurringReservation: true, paymentWindowOpensAt: new Date('2026-01-01T00:00:00Z'), reservationExpiresAt: new Date('2026-01-01T00:30:00Z') }).returning())[0]!;
    await db.update(slots).set({ heldBy: data.player.id, holdBookingId: booking.id, holdExpiresAt: new Date('2026-01-01T00:30:00Z') }).where(eq(slots.id, slot.id));
    const result = await new BookingMaintenanceService().processRecurringReservations(new Date('2026-01-01T01:00:00Z'));
    assert.equal(result.released, 1);
    const [expired] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    const [releasedSlot] = await db.select().from(slots).where(eq(slots.id, slot.id));
    assert.equal(expired?.status, 'expired');
    assert.equal(releasedSlot?.holdBookingId, null);
  } finally { await cleanup({ playerId: data.player.id, ownerId: data.owner.id, vendorId: data.vendor.id, groundId: data.ground.id }); }
});

test('recurring payment window creates one in-app notification', async () => {
  const data = await fixture();
  try {
    const slot = (await db.insert(slots).values({ groundId: data.ground.id, date: '2030-01-02', startTime: '10:00', endTime: '11:00', price: 1000 }).returning())[0]!;
    const booking = (await db.insert(bookings).values({ bookingNumber: `window-${slot.id}`, playerId: data.player.id, vendorId: data.vendor.id, groundId: data.ground.id, slotId: slot.id, date: slot.date, startTime: slot.startTime, endTime: slot.endTime, totalAmount: 1000, vendorAmount: 1000, isRecurringReservation: true, paymentWindowOpensAt: new Date('2026-01-01T00:00:00Z'), reservationExpiresAt: new Date('2026-01-01T02:00:00Z') }).returning())[0]!;
    await db.update(slots).set({ heldBy: data.player.id, holdBookingId: booking.id, holdExpiresAt: new Date('2026-01-01T02:00:00Z') }).where(eq(slots.id, slot.id));
    const service = new BookingMaintenanceService();
    assert.equal((await service.processRecurringReservations(new Date('2026-01-01T01:00:00Z'))).opened, 1);
    assert.equal((await service.processRecurringReservations(new Date('2026-01-01T01:01:00Z'))).opened, 0);
    const rows = await db.select().from(notifications).where(eq(notifications.userId, data.player.id));
    assert.equal(rows.filter((row) => row.data && (row.data as { bookingId?: string }).bookingId === booking.id).length, 1);
  } finally { await cleanup({ playerId: data.player.id, ownerId: data.owner.id, vendorId: data.vendor.id, groundId: data.ground.id }); }
});
