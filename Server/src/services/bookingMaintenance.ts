import { and, eq, isNull, lte, or, sql as expression } from 'drizzle-orm';
import { db } from '../database/client.js';
import { bookings, ledgerEntries, notifications, slots, vendors } from '../database/schema.js';
import { bookingStart } from './cancellationPolicy.js';
import { sendExpoPush } from './expoPushService.js';

export class BookingMaintenanceService {
  async notifyStartingMatches(now = new Date()): Promise<number> {
    const candidates = await db.select().from(bookings).where(and(
      eq(bookings.status, 'confirmed'),
      isNull(bookings.matchStartNotifiedAt),
      expression`((${bookings.date}::date + ${bookings.startTime}::time) AT TIME ZONE 'Asia/Karachi') <= ${now.toISOString()}::timestamptz`,
      expression`((${bookings.date}::date + ${bookings.startTime}::time) AT TIME ZONE 'Asia/Karachi') > ${new Date(now.getTime() - 15 * 60_000).toISOString()}::timestamptz`,
    )).orderBy(bookings.date, bookings.startTime).limit(200);
    let notified = 0;
    for (const booking of candidates) {
      const changed = await db.transaction(async (tx) => {
        const [marked] = await tx.update(bookings).set({ matchStartNotifiedAt: now, updatedAt: now }).where(and(eq(bookings.id, booking.id), isNull(bookings.matchStartNotifiedAt), eq(bookings.status, 'confirmed'))).returning({ id: bookings.id });
        if (!marked) return false;
        await tx.insert(notifications).values({ userId: booking.playerId, type: 'booking', title: 'Your match is starting now', message: 'Open Match Hub for check-in details, directions, and help during your booking.', data: { bookingId: booking.id, destination: 'match_hub' } });
        return true;
      });
      if (changed) notified += 1;
    }
    return notified;
  }
  async processRecurringReservations(now = new Date()): Promise<{ opened: number; reminded: number; released: number }> {
    const reminderCutoff = new Date(now.getTime() + 2 * 60 * 60_000);
    const waiting = await db.select().from(bookings).where(and(eq(bookings.isRecurringReservation, true), eq(bookings.status, 'pending_payment'), or(
      lte(bookings.reservationExpiresAt, now),
      and(lte(bookings.reservationExpiresAt, reminderCutoff), isNull(bookings.paymentDeadlineReminderNotifiedAt)),
      and(lte(bookings.paymentWindowOpensAt, now), isNull(bookings.paymentWindowNotifiedAt)),
    ))).orderBy(bookings.reservationExpiresAt).limit(200);
    let opened = 0; let reminded = 0; let released = 0;
    for (const booking of waiting) {
      if (booking.reservationExpiresAt && booking.reservationExpiresAt <= now) {
        const changed = await db.transaction(async (tx) => {
          const expired = await tx.update(bookings).set({ status: 'expired', paymentStatus: 'cancelled', updatedAt: now }).where(and(eq(bookings.id, booking.id), eq(bookings.status, 'pending_payment'), lte(bookings.reservationExpiresAt, now))).returning();
          if (!expired[0]) return false;
          await tx.update(slots).set({ heldBy: null, holdBookingId: null, holdExpiresAt: null, updatedAt: now }).where(and(eq(slots.id, booking.slotId), eq(slots.holdBookingId, booking.id)));
          await tx.insert(notifications).values({ userId: booking.playerId, type: 'booking', title: 'Reserved slot released', message: `Your payment window closed, so the ${booking.date} slot is now available to other players.`, data: { bookingId: booking.id } });
          return true;
        });
        if (changed) {
          released += 1;
          void sendExpoPush({ userIds: [booking.playerId], title: 'Reserved slot released', body: `Your ${booking.date} reserved slot was released because its payment window closed.`, data: { bookingId: booking.id } });
        }
      } else if (booking.paymentWindowOpensAt && booking.paymentWindowOpensAt <= now && !booking.paymentWindowNotifiedAt) {
        const changed = await db.transaction(async (tx) => {
          const marked = await tx.update(bookings).set({ paymentWindowNotifiedAt: now, updatedAt: now }).where(and(eq(bookings.id, booking.id), isNull(bookings.paymentWindowNotifiedAt), eq(bookings.status, 'pending_payment'))).returning();
          if (!marked[0]) return false;
          await tx.insert(notifications).values({ userId: booking.playerId, type: 'booking', title: 'Pay for your reserved slot', message: `Your payment window is open for the ${booking.date} slot. Pay now before it is released.`, data: { bookingId: booking.id } });
          return true;
        });
        if (changed) {
          opened += 1;
          void sendExpoPush({ userIds: [booking.playerId], title: 'Pay for your reserved slot', body: `Your payment window is now open for the ${booking.date} slot. Pay before it is released.`, data: { bookingId: booking.id } });
        }
      } else if (booking.reservationExpiresAt && booking.reservationExpiresAt <= reminderCutoff && !booking.paymentDeadlineReminderNotifiedAt) {
        const changed = await db.transaction(async (tx) => {
          const marked = await tx.update(bookings).set({ paymentDeadlineReminderNotifiedAt: now, updatedAt: now }).where(and(eq(bookings.id, booking.id), isNull(bookings.paymentDeadlineReminderNotifiedAt), eq(bookings.status, 'pending_payment'))).returning();
          if (!marked[0]) return false;
          await tx.insert(notifications).values({ userId: booking.playerId, type: 'booking', title: 'Payment deadline in 2 hours', message: `Pay for your ${booking.date} reserved slot within 2 hours or it will be released.`, data: { bookingId: booking.id } });
          return true;
        });
        if (changed) {
          reminded += 1;
          void sendExpoPush({ userIds: [booking.playerId], title: 'Payment deadline in 2 hours', body: `Pay for your ${booking.date} reserved slot now or it will be released.`, data: { bookingId: booking.id } });
        }
      }
    }
    return { opened, reminded, released };
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
    await this.notifyStartingMatches(now);
    const candidates = await db.select().from(bookings).where(and(eq(bookings.status, 'confirmed'), expression`((${bookings.endDate}::date + ${bookings.endTime}::time) AT TIME ZONE 'Asia/Karachi') <= ${now.toISOString()}::timestamptz`)).orderBy(bookings.date).limit(200);
    let completed = 0;
    for (const booking of candidates) {
      if (bookingStart(booking.endDate || booking.date, booking.endTime) > now) continue;
      if (await this.finalizeBooking(booking.id, 'completed', now)) completed += 1;
    }
    return completed;
  }
}
