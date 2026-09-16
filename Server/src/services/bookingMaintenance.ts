import { and, eq, isNull, lte, sql as expression } from 'drizzle-orm';
import { db } from '../database/client.js';
import { bookings, ledgerEntries, notifications, slots, vendors } from '../database/schema.js';
import { bookingStart } from './cancellationPolicy.js';

export class BookingMaintenanceService {
  async processRecurringReservations(now = new Date()): Promise<{ opened: number; released: number }> {
    const waiting = await db.select().from(bookings).where(and(eq(bookings.isRecurringReservation, true), eq(bookings.status, 'pending_payment')));
    let opened = 0; let released = 0;
    for (const booking of waiting) {
      if (booking.reservationExpiresAt && booking.reservationExpiresAt <= now) {
        const changed = await db.transaction(async (tx) => {
          const expired = await tx.update(bookings).set({ status: 'expired', paymentStatus: 'cancelled', updatedAt: now }).where(and(eq(bookings.id, booking.id), eq(bookings.status, 'pending_payment'), lte(bookings.reservationExpiresAt, now))).returning();
          if (!expired[0]) return false;
          await tx.update(slots).set({ heldBy: null, holdBookingId: null, holdExpiresAt: null, updatedAt: now }).where(and(eq(slots.id, booking.slotId), eq(slots.holdBookingId, booking.id)));
          await tx.insert(notifications).values({ userId: booking.playerId, type: 'booking', title: 'Reserved slot released', message: `Your payment window closed, so the ${booking.date} slot is now available to other players.`, data: { bookingId: booking.id } });
          return true;
        });
        if (changed) released += 1;
      } else if (booking.paymentWindowOpensAt && booking.paymentWindowOpensAt <= now && !booking.paymentWindowNotifiedAt) {
        const changed = await db.transaction(async (tx) => {
          const marked = await tx.update(bookings).set({ paymentWindowNotifiedAt: now, updatedAt: now }).where(and(eq(bookings.id, booking.id), isNull(bookings.paymentWindowNotifiedAt), eq(bookings.status, 'pending_payment'))).returning();
          if (!marked[0]) return false;
          await tx.insert(notifications).values({ userId: booking.playerId, type: 'booking', title: 'Pay for your reserved slot', message: `Your payment window is open for the ${booking.date} slot. Pay now before it is released.`, data: { bookingId: booking.id } });
          return true;
        });
        if (changed) opened += 1;
      }
    }
    return { opened, released };
  }
  async finalizeBooking(bookingId: string, status: 'completed' | 'no_show', now = new Date()): Promise<boolean> {
    return db.transaction(async (tx) => {
      const changed = await tx.update(bookings).set({ status, updatedAt: now })
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'confirmed'))).returning();
      const booking = changed[0];
      if (!booking) return false;
      const posted = await tx.update(ledgerEntries).set({ status: 'posted', postedAt: now, updatedAt: now })
        .where(and(eq(ledgerEntries.bookingId, booking.id), eq(ledgerEntries.status, 'pending'), eq(ledgerEntries.type, 'booking_earning')))
        .returning({ amount: ledgerEntries.amount });
      const amount = posted.reduce((sum, entry) => sum + entry.amount, 0);
      if (amount > 0) {
        await tx.update(vendors).set({
          pendingEarnings: expression`GREATEST(0, ${vendors.pendingEarnings} - ${amount})`,
          totalEarnings: expression`${vendors.totalEarnings} + ${amount}`,
          updatedAt: now,
        }).where(eq(vendors.id, booking.vendorId));
      }
      return true;
    });
  }

  async completeEndedBookings(now = new Date()): Promise<number> {
    await this.processRecurringReservations(now);
    const candidates = await db.select().from(bookings).where(eq(bookings.status, 'confirmed'));
    let completed = 0;
    for (const booking of candidates) {
      if (bookingStart(booking.date, booking.endTime) > now) continue;
      if (await this.finalizeBooking(booking.id, 'completed', now)) completed += 1;
    }
    return completed;
  }
}
