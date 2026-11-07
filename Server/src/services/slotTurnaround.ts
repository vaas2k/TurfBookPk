export type SlotPeriod = { date: string; endDate?: string | null; startTime: string; endTime: string; turnaroundMinutes: number };

export function timeMinutes(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

export function occupiedPeriod(slot: SlotPeriod): { start: number; end: number } {
  const day = Date.parse(`${slot.date}T00:00:00Z`);
  return {
    start: day + timeMinutes(slot.startTime) * 60_000,
    end: Date.parse(`${slot.endDate || slot.date}T00:00:00Z`) + (timeMinutes(slot.endTime) + slot.turnaroundMinutes) * 60_000,
  };
}

export function periodsConflict(left: SlotPeriod, right: SlotPeriod): boolean {
  const a = occupiedPeriod(left);
  const b = occupiedPeriod(right);
  return a.start < b.end && b.start < a.end;
}

export function validTurnaround(value: unknown): value is 5 | 10 | 15 {
  return value === 5 || value === 10 || value === 15;
}
