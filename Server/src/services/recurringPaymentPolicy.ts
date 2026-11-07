import { bookingStart } from './cancellationPolicy.js';

export type RecurringCheckoutSlot = { id: string; date: string; startTime: string };

export function immediateRecurringSlotIds(
  slots: RecurringCheckoutSlot[],
  now: Date,
  payNowHours: number,
): Set<string> {
  if (!slots.length) return new Set();
  const cutoff = now.getTime() + payNowHours * 60 * 60_000;
  const immediate = slots.filter((slot) => bookingStart(slot.date, slot.startTime).getTime() <= cutoff);
  if (immediate.length) return new Set(immediate.map((slot) => slot.id));

  // A recurring order must always have an initial paid occurrence. This avoids
  // creating a long-lived order with no payment or confirmed commitment.
  const first = [...slots].sort((a, b) => bookingStart(a.date, a.startTime).getTime() - bookingStart(b.date, b.startTime).getTime())[0]!;
  return new Set([first.id]);
}
