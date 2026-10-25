import { and, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import { env } from '../configs/env.js';
import { db } from '../database/client.js';
import { groundBlackoutDates, grounds, slots, slotScheduleTemplates } from '../database/schema.js';

function todayInPakistan(): string { return new Date(Date.now() + 5 * 60 * 60_000).toISOString().slice(0, 10); }
function hasStarted(date: string, time: string): boolean { return new Date(`${date}T${time.slice(0, 5)}:00+05:00`).getTime() <= Date.now(); }

export async function materializeSchedules(groundRows: (typeof grounds.$inferSelect)[]): Promise<number> {
  if (!groundRows.length) return 0;
  const ids = groundRows.map((ground) => ground.id);
  const templates = await db.select().from(slotScheduleTemplates).where(and(inArray(slotScheduleTemplates.groundId, ids), eq(slotScheduleTemplates.isActive, true)));
  if (!templates.length) return 0;
  const today = todayInPakistan();
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + env.maxAdvanceBookingDays);
  const lastDate = end.toISOString().slice(0, 10);
  const latest = await db.select({ templateId: slots.scheduleTemplateId, date: sql<string>`max(${slots.date})` }).from(slots)
    .where(and(inArray(slots.scheduleTemplateId, templates.map((template) => template.id)), lte(slots.date, lastDate)))
    .groupBy(slots.scheduleTemplateId);
  const latestByTemplate = new Map(latest.map((row) => [row.templateId, row.date]));
  const complete = templates.every((template) => {
    const expected = new Date(end);
    for (let daysBack = 0; daysBack < 7 && !template.days.includes(expected.getUTCDay()); daysBack++) expected.setUTCDate(expected.getUTCDate() - 1);
    return (latestByTemplate.get(template.id) || '') >= expected.toISOString().slice(0, 10);
  });
  if (complete) return 0;
  const [blackouts, existing] = await Promise.all([
    db.select({ groundId: groundBlackoutDates.groundId, date: groundBlackoutDates.date }).from(groundBlackoutDates).where(and(inArray(groundBlackoutDates.groundId, ids), gte(groundBlackoutDates.date, today), lte(groundBlackoutDates.date, lastDate))),
    db.select({ groundId: slots.groundId, date: slots.date, startTime: slots.startTime, endTime: slots.endTime }).from(slots).where(and(inArray(slots.groundId, ids), gte(slots.date, today), lte(slots.date, lastDate))),
  ]);
  const key = (groundId: string, date: string, startTime: string, endTime: string) => `${groundId}|${date}|${startTime.slice(0, 5)}|${endTime.slice(0, 5)}`;
  const known = new Set(existing.map((row) => key(row.groundId, row.date, row.startTime, row.endTime)));
  const closed = new Set(blackouts.map((row) => `${row.groundId}|${row.date}`));
  const byGround = new Map<string, typeof templates>();
  for (const template of templates) byGround.set(template.groundId, [...(byGround.get(template.groundId) || []), template]);
  const missing: (typeof slots.$inferInsert)[] = [];
  for (const ground of groundRows) {
    for (let cursor = new Date(`${today}T00:00:00Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      if (closed.has(`${ground.id}|${date}`)) continue;
      for (const template of byGround.get(ground.id) || []) {
        if (!template.days.includes(cursor.getUTCDay()) || hasStarted(date, template.startTime)) continue;
        const identity = key(ground.id, date, template.startTime, template.endTime);
        if (known.has(identity)) continue;
        known.add(identity);
        missing.push({ groundId: ground.id, date, startTime: template.startTime, endTime: template.endTime, price: template.price, scheduleTemplateId: template.id });
      }
    }
  }
  for (let index = 0; index < missing.length; index += 250) await db.insert(slots).values(missing.slice(index, index + 250)).onConflictDoNothing();
  return missing.length;
}

export async function extendAllScheduleHorizons(): Promise<{ grounds: number; generated: number }> {
  let cursor: string | null = null;
  let processed = 0;
  let generated = 0;
  while (true) {
    const ids = await db.selectDistinct({ groundId: slotScheduleTemplates.groundId }).from(slotScheduleTemplates)
      .where(and(eq(slotScheduleTemplates.isActive, true), cursor ? gt(slotScheduleTemplates.groundId, cursor) : undefined))
      .orderBy(slotScheduleTemplates.groundId).limit(50);
    if (!ids.length) break;
    const batch = await db.select().from(grounds).where(inArray(grounds.id, ids.map((row) => row.groundId)));
    generated += await materializeSchedules(batch);
    processed += batch.length;
    cursor = ids.at(-1)!.groundId;
  }
  return { grounds: processed, generated };
}

/** Only unused, unblocked, unreserved slots older than three full Pakistan calendar days. */
export async function cleanupExpiredUnbookedSlots(groundId: string | null = null): Promise<number> {
  const removed = await db.execute(sql`
    WITH eligible AS (
      SELECT slot.id FROM slots AS slot
      WHERE slot.date < ((now() AT TIME ZONE 'Asia/Karachi')::date - 3)
        AND slot.is_booked = false AND slot.is_blocked = false AND slot.is_club_reserved = false
        AND slot.booking_id IS NULL AND slot.booked_by IS NULL
        AND slot.hold_booking_id IS NULL AND slot.held_by IS NULL AND slot.hold_expires_at IS NULL
        AND (${groundId}::uuid IS NULL OR slot.ground_id = ${groundId}::uuid)
        AND NOT EXISTS (SELECT 1 FROM bookings AS booking WHERE booking.slot_id = slot.id)
      ORDER BY slot.date, slot.id
      FOR UPDATE OF slot SKIP LOCKED LIMIT 500
    )
    DELETE FROM slots WHERE id IN (SELECT id FROM eligible) RETURNING id`);
  return removed.length;
}
