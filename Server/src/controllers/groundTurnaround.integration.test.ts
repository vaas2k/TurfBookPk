import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import { db, sql } from '../database/client.js';
import { bookings, grounds, slots, slotScheduleTemplates, users, vendors } from '../database/schema.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { GroundController } from './groundController.js';

after(async () => { await sql.end(); });

test('schedule preview preserves a booked legacy slot and requires a gap', async () => {
  const suffix = randomUUID().slice(0, 10);
  const tomorrow = new Date(Date.now() + 5 * 60 * 60_000 + 86_400_000).toISOString().slice(0, 10);
  const [user] = await db.insert(users).values({ phone: `+92314${suffix}`, fullName: 'Turnaround Vendor' }).returning();
  const [vendor] = await db.insert(vendors).values({ userId: user!.id, businessName: 'Turnaround Test', businessPhone: `+92313${suffix}`, businessCity: 'Islamabad' }).returning();
  const [ground] = await db.insert(grounds).values({ vendorId: vendor!.id, title: 'Turnaround Test', location: 'Islamabad', city: 'Islamabad', address: 'Test', pricePerHour: 1000 }).returning();
  const [legacy] = await db.insert(slots).values({ groundId: ground!.id, date: tomorrow, startTime: '14:00', endTime: '15:00', turnaroundMinutes: 0, price: 1000 }).returning();
  await db.insert(bookings).values({ bookingNumber: `turnaround-${suffix}`, playerId: user!.id, vendorId: vendor!.id, groundId: ground!.id, slotId: legacy!.id, date: tomorrow, startTime: '14:00', endTime: '15:00', totalAmount: 1000, vendorAmount: 1000, status: 'confirmed', paymentStatus: 'paid' });

  const controller = new GroundController();
  const base = { open_time: '14:00', close_time: '17:00', slot_duration_minutes: 60, turnaround_minutes: 10, days: [0, 1, 2, 3, 4, 5, 6], price: 1000 };
  const response = { json(value: unknown) { return value; }, status() { return this; } } as unknown as Response;
  const request = (slotStarts: string[], previewOnly: boolean) => ({ auth: { userId: user!.id }, params: { id: ground!.id }, body: { ...base, slot_starts: slotStarts, preview_only: previewOnly } }) as unknown as AuthenticatedRequest;
  try {
    await assert.rejects(controller.saveSchedule(request(['15:05'], true), response), (error: { code?: string }) => error.code === 'schedule_conflict');
    await controller.saveSchedule(request(['14:00', '15:10'], true), response);
    assert.equal((await db.select().from(slotScheduleTemplates).where(eq(slotScheduleTemplates.groundId, ground!.id))).length, 0);
    await controller.saveSchedule(request(['14:00', '15:10'], false), response);
    const booked = (await db.select().from(slots).where(eq(slots.id, legacy!.id)))[0];
    assert.equal(booked?.startTime, '14:00:00');
    assert.equal(booked?.endTime, '15:00:00');
    assert.equal(booked?.turnaroundMinutes, 0);
    const next = (await db.select().from(slots).where(eq(slots.groundId, ground!.id))).find((slot) => slot.date === tomorrow && slot.startTime.startsWith('15:10'));
    assert.equal(next?.turnaroundMinutes, 10);
  } finally {
    await db.delete(bookings).where(eq(bookings.groundId, ground!.id));
    await db.delete(slots).where(eq(slots.groundId, ground!.id));
    await db.delete(slotScheduleTemplates).where(eq(slotScheduleTemplates.groundId, ground!.id));
    await db.delete(grounds).where(eq(grounds.id, ground!.id));
    await db.delete(vendors).where(eq(vendors.id, vendor!.id));
    await db.delete(users).where(eq(users.id, user!.id));
  }
});
