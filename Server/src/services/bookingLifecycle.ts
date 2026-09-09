export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'cancelled',
  'expired',
  'completed',
  'no_show',
] as const;

export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refund_pending',
  'refunded',
] as const;

export type BookingStatus = typeof BOOKING_STATUSES[number];
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
export type SlotState = 'available' | 'held' | 'booked' | 'blocked' | 'expired';

export const HOLD_DURATION_MS = 10 * 60_000;

export function canCancelBooking(status: BookingStatus): boolean {
  return status === 'pending_payment' || status === 'confirmed';
}

export function paymentStatusForCancellation(paymentStatus: PaymentStatus, refundRequired = false): PaymentStatus {
  if (paymentStatus === 'paid') return refundRequired ? 'refund_pending' : 'paid';
  if (paymentStatus === 'pending') return 'cancelled';
  return paymentStatus;
}

export function slotState(input: {
  isBooked: boolean;
  isBlocked: boolean;
  holdExpiresAt: Date | null;
  now?: Date;
}): SlotState {
  const now = input.now || new Date();
  if (input.isBooked) return 'booked';
  if (input.isBlocked) return 'blocked';
  if (input.holdExpiresAt && input.holdExpiresAt > now) return 'held';
  return 'available';
}
