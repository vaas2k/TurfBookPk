export interface PeakWindow {
  days: number[];
  startTime: string;
  endTime: string;
  endNextDay?: boolean;
}

export interface PeakPriceInput {
  basePrice: number;
  peakPercentage: number | null;
  peakWindows: PeakWindow[];
}

function pakistanDayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00+05:00`).getUTCDay();
}

export function isPeakSlot(date: string, startTime: string, endTime: string, windows: PeakWindow[]): boolean {
  const slotStart = new Date(`${date}T${startTime.slice(0, 5)}:00Z`);
  const slotEnd = new Date(`${date}T${endTime.slice(0, 5)}:00Z`);
  if (slotEnd <= slotStart) slotEnd.setUTCDate(slotEnd.getUTCDate() + 1);
  return windows.some((window) => [0, -1].some((dayOffset) => {
    const anchor = new Date(`${date}T00:00:00Z`);
    anchor.setUTCDate(anchor.getUTCDate() + dayOffset);
    if (!window.days.includes(anchor.getUTCDay())) return false;
    const windowStart = new Date(anchor);
    const [startHour, startMinute] = window.startTime.split(':').map(Number);
    windowStart.setUTCHours(startHour!, startMinute!, 0, 0);
    const windowEnd = new Date(anchor);
    const [endHour, endMinute] = window.endTime.split(':').map(Number);
    windowEnd.setUTCHours(endHour!, endMinute!, 0, 0);
    if (window.endNextDay) windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
    return slotStart >= windowStart && slotEnd <= windowEnd;
  }));
}

export function effectiveSlotPrice(date: string, startTime: string, endTime: string, input: PeakPriceInput): { amount: number; isPeak: boolean } {
  const isPeak = input.peakPercentage !== null && isPeakSlot(date, startTime, endTime, input.peakWindows);
  return { amount: isPeak ? Math.round(input.basePrice * (100 + input.peakPercentage!) / 100) : input.basePrice, isPeak };
}
