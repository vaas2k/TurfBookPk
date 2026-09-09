export interface CancellationQuote {
  cancellationFee: number;
  refundAmount: number;
  refundRequired: boolean;
}

export function bookingStart(date: string, time: string): Date {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+05:00`);
}

export function cancellationQuote(input: {
  totalAmount: number;
  paymentStatus: string;
  cancelledByVendor: boolean;
  startsAt: Date;
  now?: Date;
}): CancellationQuote {
  if (input.paymentStatus !== 'paid') return { cancellationFee: 0, refundAmount: 0, refundRequired: false };
  if (input.cancelledByVendor) return { cancellationFee: 0, refundAmount: input.totalAmount, refundRequired: true };
  const hoursUntilStart = (input.startsAt.getTime() - (input.now || new Date()).getTime()) / 3_600_000;
  if (hoursUntilStart < 2) return { cancellationFee: input.totalAmount, refundAmount: 0, refundRequired: false };
  if (hoursUntilStart < 24) {
    const cancellationFee = Math.ceil(input.totalAmount / 2);
    return { cancellationFee, refundAmount: input.totalAmount - cancellationFee, refundRequired: true };
  }
  return { cancellationFee: 0, refundAmount: input.totalAmount, refundRequired: true };
}
