import { and, eq } from 'drizzle-orm';
import { db } from '../database/client.js';
import { bookings, ledgerEntries, paymentAttempts, paymentEvents, slots } from '../database/schema.js';

export async function auditPaymentAttempt(attemptId: string): Promise<string[]> {
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId)).limit(1);
  if (!attempt) return ['payment_attempt_missing'];
  const linked = attempt.bookingId
    ? await db.select({ booking: bookings, slot: slots }).from(bookings).innerJoin(slots, eq(slots.id, bookings.slotId)).where(eq(bookings.id, attempt.bookingId))
    : await db.select({ booking: bookings, slot: slots }).from(bookings).innerJoin(slots, eq(slots.id, bookings.slotId)).where(eq(bookings.orderId, attempt.orderId!));
  const payable = attempt.orderId ? linked.filter((row) => !row.booking.isRecurringReservation) : linked;
  const earnings = await db.select().from(ledgerEntries).where(and(eq(ledgerEntries.paymentAttemptId, attempt.id), eq(ledgerEntries.type, 'booking_earning')));
  const events = await db.select().from(paymentEvents).where(and(eq(paymentEvents.paymentAttemptId, attempt.id), eq(paymentEvents.eventType, 'payment_acknowledged')));
  const issues: string[] = [];
  if (attempt.providerStatus === 'paid') {
    if (!payable.length || payable.some(({ booking }) => booking.status !== 'confirmed' || booking.paymentStatus !== 'paid')) issues.push('paid_attempt_without_confirmed_bookings');
    if (payable.some(({ booking, slot }) => !slot.isBooked || slot.bookingId !== booking.id || slot.bookedBy !== booking.playerId)) issues.push('confirmed_booking_slot_mismatch');
    if (payable.some(({ booking }) => earnings.filter((row) => row.bookingId === booking.id && row.amount === booking.vendorAmount).length !== 1) || earnings.length !== payable.length) issues.push('booking_earning_mismatch');
    if (events.filter((row) => row.processingResult === 'confirmed').length !== 1 || events.length !== 1) issues.push('payment_event_mismatch');
  }
  if (attempt.providerStatus === 'paid_unallocated') {
    if (attempt.reviewStatus !== 'manual_review') issues.push('unallocated_payment_without_review');
    if (earnings.length) issues.push('unallocated_payment_has_earnings');
    if (events.filter((row) => row.processingResult === 'manual_review').length !== 1 || events.length !== 1) issues.push('payment_event_mismatch');
  }
  return issues;
}
