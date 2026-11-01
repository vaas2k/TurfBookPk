import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { db, sql } from '../database/client.js';
import { bookingOrders, bookings, grounds, ledgerEntries, notificationOutbox, notifications, paymentAttempts, paymentEvents, slots, users, vendors } from '../database/schema.js';
import { PaymentController } from './paymentController.js';
import { auditPaymentAttempt } from '../services/paymentReconciliation.js';

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
    let expiryStarted!: () => void;
    let finishExpiry!: () => void;
    const started = new Promise<void>((resolve) => { expiryStarted = resolve; });
    const expiryGate = new Promise<void>((resolve) => { finishExpiry = resolve; });
    const expiringController = new PaymentController(() => ({
      async generateReference() { throw new Error('Not used in this test'); },
      async expireReference() { expiryStarted(); await expiryGate; },
    })) as unknown as { expireAttempt: (row: typeof paymentAttempts.$inferSelect, force: boolean) => Promise<typeof paymentAttempts.$inferSelect> };
    const expiring = expiringController.expireAttempt(attempt, true);
    await started;
    const paidAt = new Date();
    const results = await Promise.all([
      controller.confirmAttempt(attempt.id, paidAt, `test:${suffix}`, suffix),
      controller.confirmAttempt(attempt.id, paidAt, `test:${suffix}`, suffix),
    ]);
    finishExpiry();
    const expiryResult = await expiring;
    assert.deepEqual(results.sort(), ['confirmed', 'duplicate']);
    assert.equal(expiryResult.providerStatus, 'paid');
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

test('late Clink acknowledgment records manual review without allocating or earning', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const player = (await db.insert(users).values({ phone: `+92340${suffix}`, fullName: 'Late Payment Player' }).returning())[0]!;
  const owner = (await db.insert(users).values({ phone: `+92341${suffix}`, fullName: 'Late Payment Vendor', role: 'vendor' }).returning())[0]!;
  const vendor = (await db.insert(vendors).values({ userId: owner.id, businessName: 'Late Payment Vendor', businessPhone: `+92342${suffix}`, businessCity: 'Karachi' }).returning())[0]!;
  const ground = (await db.insert(grounds).values({ vendorId: vendor.id, title: 'Late Payment Ground', location: 'Karachi', city: 'Karachi', address: 'Test address', pricePerHour: 1000 }).returning())[0]!;
  const slot = (await db.insert(slots).values({ groundId: ground.id, date: '2030-01-02', startTime: '10:00', endTime: '11:00', price: 1000 }).returning())[0]!;
  const holdExpiresAt = new Date(Date.now() - 60_000);
  const booking = (await db.insert(bookings).values({ bookingNumber: `late-${suffix}`, playerId: player.id, vendorId: vendor.id, groundId: ground.id, slotId: slot.id, date: slot.date, startTime: slot.startTime, endTime: slot.endTime, totalAmount: 1000, vendorAmount: 900, holdExpiresAt }).returning())[0]!;
  await db.update(slots).set({ heldBy: player.id, holdBookingId: booking.id, holdExpiresAt }).where(eq(slots.id, slot.id));
  const attempt = (await db.insert(paymentAttempts).values({ bookingId: booking.id, playerId: player.id, vendorId: vendor.id, provider: 'clink', providerStatus: 'pending', providerReference: `${Date.now()}${Math.floor(Math.random() * 100_000).toString().padStart(5, '0')}`, amount: 1000, expiresAt: holdExpiresAt, idempotencyKey: `late-${suffix}` }).returning())[0]!;
  try {
    const controller = new PaymentController() as unknown as { confirmAttempt: (id: string, paidAt: Date, eventKey: string, payloadHash: string) => Promise<'confirmed' | 'manual_review' | 'duplicate'> };
    assert.equal(await controller.confirmAttempt(attempt.id, new Date(), `late:${suffix}`, suffix), 'manual_review');
    assert.equal(await controller.confirmAttempt(attempt.id, new Date(), `late:${suffix}`, suffix), 'duplicate');
    const [currentBooking] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    const [currentSlot] = await db.select().from(slots).where(eq(slots.id, slot.id));
    const [currentAttempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attempt.id));
    const [currentVendor] = await db.select().from(vendors).where(eq(vendors.id, vendor.id));
    assert.equal(currentBooking?.status, 'pending_payment');
    assert.equal(currentSlot?.isBooked, false);
    assert.equal(currentSlot?.bookingId, null);
    assert.equal(currentAttempt?.providerStatus, 'paid_unallocated');
    assert.equal(currentAttempt?.reviewStatus, 'manual_review');
    assert.equal(currentVendor?.pendingEarnings, 0);
    assert.equal((await db.select().from(ledgerEntries).where(eq(ledgerEntries.bookingId, booking.id))).length, 0);
    assert.equal((await db.select().from(paymentEvents).where(eq(paymentEvents.paymentAttemptId, attempt.id))).length, 1);
    assert.equal((await db.select().from(notifications).where(eq(notifications.userId, player.id))).length, 1);
    assert.deepEqual(await auditPaymentAttempt(attempt.id), []);
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

test('one Clink payment confirms every same-day order slot and credits each earning once', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const player = (await db.insert(users).values({ phone: `+92350${suffix}`, fullName: 'Order Payment Player' }).returning())[0]!;
  const owner = (await db.insert(users).values({ phone: `+92351${suffix}`, fullName: 'Order Payment Vendor', role: 'vendor' }).returning())[0]!;
  const vendor = (await db.insert(vendors).values({ userId: owner.id, businessName: 'Order Payment Vendor', businessPhone: `+92352${suffix}`, businessCity: 'Karachi' }).returning())[0]!;
  const ground = (await db.insert(grounds).values({ vendorId: vendor.id, title: 'Order Payment Ground', location: 'Karachi', city: 'Karachi', address: 'Test address', pricePerHour: 1000 }).returning())[0]!;
  const order = (await db.insert(bookingOrders).values({ orderNumber: `order-${suffix}`, playerId: player.id, totalAmount: 3000, idempotencyKey: `order-${suffix}` }).returning())[0]!;
  const holdExpiresAt = new Date(Date.now() + 15 * 60_000);
  const createdSlots = [];
  const createdBookings = [];
  let attempt: typeof paymentAttempts.$inferSelect | undefined;
  try {
    for (const [index, startTime, endTime, amount, earning] of [[0, '10:00', '11:00', 1000, 900], [1, '11:00', '12:00', 2000, 1800]] as const) {
      const slot = (await db.insert(slots).values({ groundId: ground.id, date: '2030-01-03', startTime, endTime, price: amount }).returning())[0]!;
      createdSlots.push(slot);
      const booking = (await db.insert(bookings).values({ bookingNumber: `order-${suffix}-${index}`, orderId: order.id, playerId: player.id, vendorId: vendor.id, groundId: ground.id, slotId: slot.id, date: slot.date, startTime, endTime, totalAmount: amount, vendorAmount: earning, holdExpiresAt }).returning())[0]!;
      createdBookings.push(booking);
      await db.update(slots).set({ heldBy: player.id, holdBookingId: booking.id, holdExpiresAt }).where(eq(slots.id, slot.id));
    }
    attempt = (await db.insert(paymentAttempts).values({ orderId: order.id, playerId: player.id, vendorId: vendor.id, provider: 'clink', providerStatus: 'pending', providerReference: `${Date.now()}${Math.floor(Math.random() * 100_000).toString().padStart(5, '0')}`, amount: 3000, expiresAt: holdExpiresAt, idempotencyKey: `order-payment-${suffix}` }).returning())[0]!;
    const controller = new PaymentController() as unknown as { confirmAttempt: (id: string, paidAt: Date, eventKey: string, payloadHash: string) => Promise<'confirmed' | 'manual_review' | 'duplicate'> };
    const results = await Promise.all([controller.confirmAttempt(attempt.id, new Date(), `order:${suffix}`, suffix), controller.confirmAttempt(attempt.id, new Date(), `order:${suffix}`, suffix)]);
    assert.deepEqual(results.sort(), ['confirmed', 'duplicate']);
    const currentBookings = await db.select().from(bookings).where(eq(bookings.orderId, order.id));
    assert.equal(currentBookings.length, 2);
    assert.ok(currentBookings.every((row) => row.status === 'confirmed' && row.paymentStatus === 'paid'));
    for (const booking of createdBookings) {
      const [slot] = await db.select().from(slots).where(eq(slots.id, booking.slotId));
      assert.equal(slot?.bookingId, booking.id);
    }
    const [currentOrder] = await db.select().from(bookingOrders).where(eq(bookingOrders.id, order.id));
    const [currentVendor] = await db.select().from(vendors).where(eq(vendors.id, vendor.id));
    const earnings = await db.select().from(ledgerEntries).where(eq(ledgerEntries.paymentAttemptId, attempt.id));
    assert.equal(currentOrder?.status, 'confirmed');
    assert.equal(currentOrder?.paymentStatus, 'paid');
    assert.equal(currentVendor?.pendingEarnings, 2700);
    assert.equal(earnings.length, 2);
    assert.equal(earnings.reduce((sum, row) => sum + row.amount, 0), 2700);
    assert.equal((await db.select().from(paymentEvents).where(eq(paymentEvents.paymentAttemptId, attempt.id))).length, 1);
    assert.equal((await db.select().from(notifications).where(eq(notifications.userId, player.id))).length, 1);
    assert.equal((await db.select().from(notifications).where(eq(notifications.userId, owner.id))).length, 2);
    assert.deepEqual(await auditPaymentAttempt(attempt.id), []);
    await db.update(ledgerEntries).set({ amount: 1 }).where(eq(ledgerEntries.id, earnings[0]!.id));
    assert.deepEqual(await auditPaymentAttempt(attempt.id), ['booking_earning_mismatch']);
  } finally {
    await db.delete(notifications).where(eq(notifications.userId, player.id));
    await db.delete(notifications).where(eq(notifications.userId, owner.id));
    if (attempt) {
      await db.delete(paymentEvents).where(eq(paymentEvents.paymentAttemptId, attempt.id));
      await db.delete(ledgerEntries).where(eq(ledgerEntries.paymentAttemptId, attempt.id));
      await db.delete(paymentAttempts).where(eq(paymentAttempts.id, attempt.id));
    }
    for (const slot of createdSlots) await db.update(slots).set({ isBooked: false, bookedBy: null, bookingId: null, heldBy: null, holdBookingId: null, holdExpiresAt: null }).where(eq(slots.id, slot.id));
    for (const booking of createdBookings) await db.delete(bookings).where(eq(bookings.id, booking.id));
    for (const slot of createdSlots) await db.delete(slots).where(eq(slots.id, slot.id));
    await db.delete(bookingOrders).where(eq(bookingOrders.id, order.id));
    await db.delete(grounds).where(eq(grounds.id, ground.id));
    await db.delete(vendors).where(eq(vendors.id, vendor.id));
    await db.delete(users).where(eq(users.id, player.id));
    await db.delete(users).where(eq(users.id, owner.id));
  }
});
