import { and, inArray, sql as expression } from 'drizzle-orm';
import { db } from '../database/client.js';
import { slots } from '../database/schema.js';

export const resourceConflictSql = expression`EXISTS (
  SELECT 1 FROM pitch_occupancies po
  WHERE po.slot_id <> ${slots.id}
    AND (po.expires_at IS NULL OR po.expires_at > now())
    AND po.during && tsrange(${slots.date} + ${slots.startTime},
      ${slots.endDate} + ${slots.endTime} + ${slots.turnaroundMinutes} * interval '1 minute', '[)')
    AND po.resource_pitch_id IN (
      SELECT pc.component_pitch_id FROM pitch_components pc WHERE pc.pitch_id = ${slots.pitchId}
      UNION ALL
      SELECT ${slots.pitchId} WHERE NOT EXISTS (SELECT 1 FROM pitch_components pc WHERE pc.pitch_id = ${slots.pitchId})
    )
)`;

/** Conflicts with claims on a physical pitch, including claims from combined pitches. */
export async function occupiedByAnotherSlot(slotIds: string[]): Promise<Set<string>> {
  if (!slotIds.length) return new Set();
  const rows = await db.select({ id: slots.id }).from(slots).where(and(
    inArray(slots.id, slotIds),
    resourceConflictSql,
  ));
  return new Set(rows.map((row) => row.id));
}
