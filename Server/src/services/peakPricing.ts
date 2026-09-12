export interface PeakWindow {
  days: number[];
  startTime: string;
  endTime: string;
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
  const day = pakistanDayOfWeek(date);
  const slotStart = startTime.slice(0, 5);
  const slotEnd = endTime.slice(0, 5);
  return windows.some((window) => window.days.includes(day) && slotStart >= window.startTime && slotEnd <= window.endTime);
}

export function effectiveSlotPrice(date: string, startTime: string, endTime: string, input: PeakPriceInput): { amount: number; isPeak: boolean } {
  const isPeak = input.peakPercentage !== null && isPeakSlot(date, startTime, endTime, input.peakWindows);
  return { amount: isPeak ? Math.round(input.basePrice * (100 + input.peakPercentage!) / 100) : input.basePrice, isPeak };
}
