import { env } from '../configs/env.js';

export function slotStartAt(date: string, time: string): number {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalized}+05:00`).getTime();
}

export function isInsideBookingCutoff(date: string, time: string, now = Date.now(), leadMinutes = env.minimumBookingLeadMinutes): boolean {
  return slotStartAt(date, time) <= now + leadMinutes * 60_000;
}
