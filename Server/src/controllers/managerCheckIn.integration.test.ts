import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import { db, sql } from '../database/client.js';
import { attendanceEvents, bookings, groundManagers, grounds, notifications, pitches, slots, users, vendors } from '../database/schema.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { BookingController } from './bookingController.js';
import { ManagerController } from './managerController.js';

after(async () => { await sql.end(); });

function local(date: Date) {
  const localDate = new Date(date.getTime() + 5 * 60 * 60_000).toISOString();
  return { date: localDate.slice(0, 10), time: localDate.slice(11, 16) };
}

test('assigned manager accepts invitation, checks in once, and loses access after revocation', async () => {
  const suffix = String(randomInt(1_000_000, 10_000_000));
  const owner = (await db.insert(users).values({ phone: `92301${suffix}`, fullName: 'Owner' }).returning())[0]!;
  const manager = (await db.insert(users).values({ phone: `92302${suffix}`, fullName: 'Manager' }).returning())[0]!;
  const player = (await db.insert(users).values({ phone: `92303${suffix}`, fullName: 'Player' }).returning())[0]!;
  const vendor = (await db.insert(vendors).values({ userId: owner.id, businessName: 'Manager test', businessPhone: owner.phone!, businessCity: 'Karachi', verificationStatus: 'approved' }).returning())[0]!;
  const ground = (await db.insert(grounds).values({ vendorId: vendor.id, title: 'Manager test', location: 'Karachi', city: 'Karachi', address: 'Test', pricePerHour: 1000 }).returning())[0]!;
  const pitch = (await db.insert(pitches).values({ groundId: ground.id, name: 'Pitch A', side: 7 }).returning())[0]!;
  const start = local(new Date(Date.now() + 10 * 60_000));
  const end = local(new Date(Date.now() + 70 * 60_000));
  const slot = (await db.insert(slots).values({ groundId: ground.id, pitchId: pitch.id, date: start.date, endDate: end.date, startTime: start.time, endTime: end.time, price: 1000 }).returning())[0]!;
  const booking = (await db.insert(bookings).values({ bookingNumber: `manager-${suffix}`, playerId: player.id, vendorId: vendor.id, groundId: ground.id, slotId: slot.id, date: start.date, endDate: end.date, startTime: start.time, endTime: end.time, totalAmount: 1000, vendorAmount: 900, status: 'confirmed', paymentStatus: 'paid' }).returning())[0]!;
  const managerController = new ManagerController();
  const bookingController = new BookingController();
  let body: any;
  const response = { json(value: unknown) { body = value; return this; }, status() { return this; } } as unknown as Response;
  const request = (userId: string, params: Record<string, string> = {}, data: Record<string, unknown> = {}) => ({ auth: { userId }, params, body: data }) as unknown as AuthenticatedRequest;
  try {
    await managerController.add(request(owner.id, {}, { name: 'Ground Manager', phone: manager.phone, ground_id: ground.id }), response);
    const assignmentId = body.manager.id as string;
    const [pending] = await db.select().from(groundManagers).where(eq(groundManagers.id, assignmentId));
    assert.equal(pending?.acceptedAt, null);
    await assert.rejects(bookingController.scanCheckIn(request(manager.id, {}, { token: 'a'.repeat(43) }), response), (error: { code?: string }) => error.code === 'invalid_check_in');
    await managerController.accept(request(manager.id, { id: assignmentId }), response);
    await managerController.slotsForDay({ auth: { userId: manager.id }, params: { groundId: ground.id }, query: { date: start.date } } as unknown as AuthenticatedRequest, response);
    assert.ok(body.pitches.some((item: { id: string; name: string }) => item.id === pitch.id && item.name === 'Pitch A'));
    assert.equal(body.slots.find((item: { id: string }) => item.id === slot.id)?.pitch_id, pitch.id);
    assert.equal(body.slots.find((item: { id: string }) => item.id === slot.id)?.pitch_side, 7);
    await bookingController.issueCheckInToken(request(player.id, { id: booking.id }), response);
    const token = body.token as string;
    const code = body.code as string;
    assert.match(code, /^\d{8}$/);
    const results = await Promise.allSettled([bookingController.scanCheckIn(request(manager.id, {}, { token }), response), bookingController.scanCheckIn(request(manager.id, {}, { token }), response)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const [checked] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    assert.equal(checked?.checkedInBy, manager.id);
    assert.ok(checked?.checkedInAt);
    assert.equal((await db.select().from(attendanceEvents).where(eq(attendanceEvents.bookingId, booking.id))).length, 1);
    await assert.rejects(bookingController.manualCheckIn(request(manager.id, { id: booking.id }, { code }), response));
    await managerController.revoke(request(owner.id, { id: assignmentId }), response);
    await assert.rejects(bookingController.managerDetail(request(manager.id, { id: booking.id }), response), (error: { code?: string }) => error.code === 'not_found');
  } finally {
    await db.delete(attendanceEvents).where(eq(attendanceEvents.bookingId, booking.id));
    await db.delete(notifications).where(eq(notifications.userId, player.id));
    await db.delete(bookings).where(eq(bookings.id, booking.id));
    await db.delete(slots).where(eq(slots.id, slot.id));
    await db.delete(groundManagers).where(eq(groundManagers.groundId, ground.id));
    await db.delete(pitches).where(eq(pitches.id, pitch.id));
    await db.delete(grounds).where(eq(grounds.id, ground.id));
    await db.delete(vendors).where(eq(vendors.id, vendor.id));
    for (const user of [owner, manager, player]) await db.delete(users).where(eq(users.id, user.id));
  }
});
