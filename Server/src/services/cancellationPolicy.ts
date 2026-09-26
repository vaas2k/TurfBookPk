export interface CancellationQuote {
  cancellationFee: number;
  refundAmount: number;
  refundRequired: boolean;
  refundPercentage: number;
  policy: CancellationPolicy;
  withinGraceWindow: boolean;
  graceWindowMinutes: number;
}

export const CANCELLATION_POLICIES = ['lenient', 'standard', 'strict'] as const;
export type CancellationPolicy = typeof CANCELLATION_POLICIES[number];

const graceMinutes: Record<CancellationPolicy, number> = { lenient: 30, standard: 15, strict: 5 };
const tiers: Record<CancellationPolicy, Array<[number, number]>> = {
  lenient: [[24, 100], [12, 75], [6, 50], [0, 25]],
  standard: [[24, 100], [12, 75], [6, 50], [0, 0]],
  strict: [[48, 100], [24, 70], [12, 50], [6, 30], [0, 0]],
};

export function cancellationPolicy(value: unknown): CancellationPolicy {
  return typeof value === 'string' && (CANCELLATION_POLICIES as readonly string[]).includes(value.toLowerCase())
    ? value.toLowerCase() as CancellationPolicy
    : 'standard';
}

export function bookingStart(date: string, time: string): Date {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+05:00`);
}

export function cancellationQuote(input: {
  amountPaid: number;
  paymentStatus: string;
  cancelledByVendor: boolean;
  startsAt: Date;
  policy: CancellationPolicy;
  bookedAt: Date;
  now?: Date;
}): CancellationQuote {
  const now = input.now || new Date();
  const policy = input.policy;
  const graceWindowMinutes = graceMinutes[policy];
  const empty = (refundPercentage: number, withinGraceWindow = false): CancellationQuote => {
    const refundAmount = Math.round(input.amountPaid * refundPercentage / 100);
    return { cancellationFee: Math.max(0, input.amountPaid - refundAmount), refundAmount, refundRequired: refundAmount > 0, refundPercentage, policy, withinGraceWindow, graceWindowMinutes };
  };
  if (input.paymentStatus !== 'paid' || input.amountPaid <= 0) return empty(0);
  if (input.cancelledByVendor) return empty(100);
  if (now >= input.startsAt) return empty(0);
  if (now.getTime() - input.bookedAt.getTime() <= graceWindowMinutes * 60_000) return empty(100, true);
  const hoursUntilStart = (input.startsAt.getTime() - now.getTime()) / 3_600_000;
  const [, refundPercentage] = tiers[policy].find(([threshold]) => hoursUntilStart >= threshold) ?? [0, 0];
  return empty(refundPercentage);
}
