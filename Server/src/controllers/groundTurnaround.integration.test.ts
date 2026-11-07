import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import { db, sql } from '../database/client.js';
import { bookings, grounds, pitches, slots, slotScheduleTemplates, users, vendors } from '../database/schema.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { GroundController } from './groundController.js';

after(async () => { await sql.end(); });

test('two independent pitches can use the same daily times with separate prices', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const [user] = await db.insert(users).values({ phone: `+92317${suffix}`, fullName: 'Two Pitch Vendor' }).returning();
  const [vendor] = await db.insert(vendors).values({ userId: user!.id, businessName: 'Two Pitch Ground', businessPhone: `+92318${suffix}`, businessCity: 'Islamabad' }).returning();
  const [ground] = await db.insert(grounds).values({ vendorId: vendor!.id, title: 'Two Pitch Ground', location: 'Islamabad', city: 'Islamabad', address: 'Test', pricePerHour: 1000 }).returning();
  const [first] = await db.select().from(pitches).where(eq(pitches.groundId, ground!.id));
  const [second] = await db.insert(pitches).values({ groundId: ground!.id, name: 'Pitch 2', side: 7 }).returning();
  const controller = new GroundController();
  const response = { json(value: unknown) { return value; }, status() { return this; } } as unknown as Response;
  const request = (pitchId: string, price: number) => ({ auth: { userId: user!.id }, params: { id: ground!.id }, body: { pitch_id: pitchId, open_time: '14:00', close_time: '16:00', slot_duration_minutes: 60, turnaround_minutes: 10, slot_starts: ['14:00'], days: [0,1,2,3,4,5,6], price } }) as unknown as AuthenticatedRequest;
  try {
    await controller.saveSchedule(request(first!.id, 1000), response);
    await controller.saveSchedule(request(second!.id, 1500), response);
    const templates = await db.select().from(slotScheduleTemplates).where(eq(slotScheduleTemplates.groundId, ground!.id));
    assert.equal(templates.length, 2);
    assert.equal(templates.find((item) => item.pitchId === first!.id)?.price, 1000);
    assert.equal(templates.find((item) => item.pitchId === second!.id)?.price, 1500);
    assert.ok((await db.select().from(slots).where(eq(slots.pitchId, second!.id))).length > 0);
  } finally {
    await db.delete(slots).where(eq(slots.groundId, ground!.id));
    await db.delete(slotScheduleTemplates).where(eq(slotScheduleTemplates.groundId, ground!.id));
    await db.delete(grounds).where(eq(grounds.id, ground!.id));
    await db.delete(vendors).where(eq(vendors.id, vendor!.id));
    await db.delete(users).where(eq(users.id, user!.id));
  }
});

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

test('an overnight program publishes after-midnight slots on the next calendar date', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const [user] = await db.insert(users).values({ phone: `+92315${suffix}`, fullName: 'Overnight Vendor' }).returning();
  const [vendor] = await db.insert(vendors).values({ userId: user!.id, businessName: 'Night Ground', businessPhone: `+92316${suffix}`, businessCity: 'Islamabad' }).returning();
  const [ground] = await db.insert(grounds).values({ vendorId: vendor!.id, title: 'Night Ground', location: 'Islamabad', city: 'Islamabad', address: 'Test', pricePerHour: 1000, operatingHours: { open: '18:00', close: '02:00' } }).returning();
  const controller = new GroundController();
  const response = { json(value: unknown) { return value; }, status() { return this; } } as unknown as Response;
  const request = { auth: { userId: user!.id }, params: { id: ground!.id }, body: { open_time: '18:00', close_time: '02:00', slot_duration_minutes: 60, turnaround_minutes: 10, slot_starts: ['23:30', '00:40'], days: [0,1,2,3,4,5,6], price: 1000 } } as unknown as AuthenticatedRequest;
  try {
    await controller.saveSchedule(request, response);
    const published = await db.select().from(slots).where(eq(slots.groundId, ground!.id));
    const late = published.find((slot) => slot.startTime.startsWith('23:30'));
    const afterMidnight = published.find((slot) => slot.startTime.startsWith('00:40'));
    assert.ok(late && afterMidnight);
    assert.equal(late!.endDate, new Date(Date.parse(`${late!.date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10));
    assert.equal(afterMidnight!.date, afterMidnight!.endDate);
  } finally {
    await db.delete(slots).where(eq(slots.groundId, ground!.id));
    await db.delete(slotScheduleTemplates).where(eq(slotScheduleTemplates.groundId, ground!.id));
    await db.delete(grounds).where(eq(grounds.id, ground!.id));
    await db.delete(vendors).where(eq(vendors.id, vendor!.id));
    await db.delete(users).where(eq(users.id, user!.id));
  }
});

test('a next-day afternoon close publishes slots after the following sunrise', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const baseDay = new Date(Date.now() + 5 * 60 * 60_000); baseDay.setUTCDate(baseDay.getUTCDate() + 1);
  const baseDate = baseDay.toISOString().slice(0, 10);
  const nextDate = new Date(baseDay); nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const [user] = await db.insert(users).values({ phone: `+92319${suffix}`, fullName: 'Long Hours Vendor' }).returning();
  const [vendor] = await db.insert(vendors).values({ userId: user!.id, businessName: 'Long Hours Ground', businessPhone: `+92320${suffix}`, businessCity: 'Islamabad' }).returning();
  const [ground] = await db.insert(grounds).values({ vendorId: vendor!.id, title: 'Long Hours Ground', location: 'Islamabad', city: 'Islamabad', address: 'Test', pricePerHour: 1000, operatingHours: { open: '06:00', close: '13:00', closeNextDay: true } }).returning();
  const controller = new GroundController();
  const response = { json(value: unknown) { return value; }, status() { return this; } } as unknown as Response;
  const request = { auth: { userId: user!.id }, params: { id: ground!.id }, body: { open_time: '06:00', close_time: '13:00', close_next_day: true, slot_duration_minutes: 60, turnaround_minutes: 10, slot_starts: [{ time: '06:00', day_offset: 0 }, { time: '12:00', day_offset: 1 }], days: [baseDay.getUTCDay()], price: 1000 } } as unknown as AuthenticatedRequest;
  try {
    await controller.saveSchedule(request, response);
    const templates = await db.select().from(slotScheduleTemplates).where(eq(slotScheduleTemplates.groundId, ground!.id));
    assert.equal(templates.find((template) => template.startTime.startsWith('12:00'))?.startDayOffset, 1);
    const published = await db.select().from(slots).where(eq(slots.groundId, ground!.id));
    const firstDay = published.find((slot) => slot.date === baseDate && slot.startTime.startsWith('06:00'));
    const nextDayNoon = published.find((slot) => slot.date === nextDate.toISOString().slice(0, 10) && slot.startTime.startsWith('12:00'));
    assert.ok(firstDay && nextDayNoon);
  } finally {
    await db.delete(slots).where(eq(slots.groundId, ground!.id));
    await db.delete(slotScheduleTemplates).where(eq(slotScheduleTemplates.groundId, ground!.id));
    await db.delete(grounds).where(eq(grounds.id, ground!.id));
    await db.delete(vendors).where(eq(vendors.id, vendor!.id));
    await db.delete(users).where(eq(users.id, user!.id));
  }
});

test('saving a reviewed overnight pitch schedule extends an earlier venue close', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const [user] = await db.insert(users).values({ phone: `+92321${suffix}`, fullName: 'Extended Hours Vendor' }).returning();
  const [vendor] = await db.insert(vendors).values({ userId: user!.id, businessName: 'Extended Hours Ground', businessPhone: `+92322${suffix}`, businessCity: 'Islamabad' }).returning();
  const [ground] = await db.insert(grounds).values({ vendorId: vendor!.id, title: 'Extended Hours Ground', location: 'Islamabad', city: 'Islamabad', address: 'Test', pricePerHour: 1000, operatingHours: { open: '06:00', close: '23:00', closeNextDay: false } }).returning();
  const controller = new GroundController();
  const response = { json(value: unknown) { return value; }, status() { return this; } } as unknown as Response;
  const body = { open_time: '06:00', close_time: '01:00', close_next_day: true, extend_ground_hours: true, slot_duration_minutes: 60, turnaround_minutes: 10, slot_starts: [{ time: '00:00', day_offset: 1 }], days: [0,1,2,3,4,5,6], price: 1000 };
  try {
    await controller.saveSchedule({ auth: { userId: user!.id }, params: { id: ground!.id }, body: { ...body, preview_only: true } } as unknown as AuthenticatedRequest, response);
    const afterPreview = (await db.select().from(grounds).where(eq(grounds.id, ground!.id)))[0]!;
    assert.equal(afterPreview.operatingHours.close, '23:00');
    await controller.saveSchedule({ auth: { userId: user!.id }, params: { id: ground!.id }, body } as unknown as AuthenticatedRequest, response);
    const afterSave = (await db.select().from(grounds).where(eq(grounds.id, ground!.id)))[0]!;
    assert.equal(afterSave.operatingHours.close, '01:00');
    assert.equal(afterSave.operatingHours.closeNextDay, true);
    assert.ok((await db.select().from(slots).where(eq(slots.groundId, ground!.id))).some((slot) => slot.startTime.startsWith('00:00')));
  } finally {
    await db.delete(slots).where(eq(slots.groundId, ground!.id));
    await db.delete(slotScheduleTemplates).where(eq(slotScheduleTemplates.groundId, ground!.id));
    await db.delete(grounds).where(eq(grounds.id, ground!.id));
    await db.delete(vendors).where(eq(vendors.id, vendor!.id));
    await db.delete(users).where(eq(users.id, user!.id));
  }
});
