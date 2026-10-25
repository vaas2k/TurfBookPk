import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { db, sql } from '../database/client.js';
import { bookings, grounds, ledgerEntries, notificationOutbox, notifications, paymentAttempts, paymentEvents, slots, users, vendors } from '../database/schema.js';
import { PaymentController } from './paymentController.js';

after(async () => { await sql.end(); });

test('concurrent Clink acknowledgments confirm one booking and emit effects once', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const player = (await db.insert(users).values({ phone: `+92300${suffix}`, fullName: 'Payment Race Player' }).returning())[0]!;
  const owner = (await db.insert(users).values({ phone: `+92301${suffix}`, fullName: 'Payment Race Vendor', role: 'vendor' }).returning())[0]!;
  const vendor = (await db.insert(vendors).values({ userId: owner.id, businessName: 'Payment Race Vendor', businessPhone: `+92302${suffix}`, businessCity: 'Karachi' }).returning())[0]!;
  const ground = (await db.insert(grounds).values({ vendorId: vendor.id, title: 'Payment Race Ground', location: 'Karachi', city: 'Karachi', address: 'Test address', pricePerHour: 1000 }).returning())[0]!;
  const slot = (await db.insert(slots).values({ groundId: ground.id, date: '2030-01-01', startTime: '10:00', endTime: '11:00', price: 1000 }).returning())[0]!;
  const holdExpiresAt = new Date(Date.now() + 15 * 60_000);
  const booking = (await db.insert(bookings).values({ bookingNumber: `ack-${suffix}`, playerId: player.id, vendorId: vendor.id, groundId: ground.id, slotId: slot.id, date: slot.date, startTime: slot.startTime, endTime: slot.endTime, totalAmount: 1000, vendorAmount: 900, holdExpiresAt }).returning())[0]!;
  await db.update(slots).set({ heldBy: player.id, holdBookingId: booking.id, holdExpiresAt }).where(eq(slots.id, slot.id));
  const clinkId = `${Date.now()}${Math.floor(Math.random() * 100_000).toString().padStart(5, '0')}`;
  const attempt = (await db.insert(paymentAttempts).values({ bookingId: booking.id, playerId: player.id, vendorId: vendor.id, provider: 'clink', providerStatus: 'pending', providerReference: clinkId, amount: 1000, expiresAt: holdExpiresAt, idempotencyKey: `ack-${suffix}` }).returning())[0]!;
  try {
    const controller = new PaymentController() as unknown as { confirmAttempt: (id: string, paidAt: Date, eventKey: string, payloadHash: string) => Promise<'confirmed' | 'manual_review' | 'duplicate'> };
    const paidAt = new Date();
    const results = await Promise.all([
      controller.confirmAttempt(attempt.id, paidAt, `test:${suffix}`, suffix),
      controller.confirmAttempt(attempt.id, paidAt, `test:${suffix}`, suffix),
    ]);
    assert.deepEqual(results.sort(), ['confirmed', 'duplicate']);
    const [currentBooking] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    const [currentSlot] = await db.select().from(slots).where(eq(slots.id, slot.id));
    const [currentVendor] = await db.select().from(vendors).where(eq(vendors.id, vendor.id));
    const earnings = await db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, booking.id));
    const events = await db.select().from(paymentEvents).where(eq(paymentEvents.paymentAttemptId, attempt.id));
    const messages = await db.select().from(notifications).where(eq(notifications.userId, player.id));
    const queued = await db.select().from(notificationOutbox).where(eq(notificationOutbox.notificationId, messages[0]!.id));
    assert.equal(currentBooking?.status, 'confirmed');
    assert.equal(currentSlot?.bookingId, booking.id);
    assert.equal(currentVendor?.pendingEarnings, 900);
    assert.equal(earnings.length, 1);
    assert.equal(events.length, 1);
    assert.equal(messages.length, 1);
    assert.equal(queued.length, 1);
  } finally {
    await db.delete(notifications).where(eq(notifications.userId, player.id));
    await db.delete(notifications).where(eq(notifications.userId, owner.id));
    await db.delete(paymentEvents).where(eq(paymentEvents.paymentAttemptId, attempt.id));
    await db.delete(ledgerEntries).where(eq(ledgerEntries.bookingId, booking.id));
    await db.delete(paymentAttempts).where(eq(paymentAttempts.id, attempt.id));
    await db.update(slots).set({ isBooked: false, bookedBy: null, bookingId: null, heldBy: null, holdBookingId: null, holdExpiresAt: null }).where(eq(slots.id, slot.id));
    await db.delete(bookings).where(eq(bookings.id, booking.id));
    await db.delete(slots).where(eq(slots.id, slot.id));
    await db.delete(grounds).where(eq(grounds.id, ground.id));
    await db.delete(vendors).where(eq(vendors.id, vendor.id));
    await db.delete(users).where(eq(users.id, player.id));
    await db.delete(users).where(eq(users.id, owner.id));
  }
});
