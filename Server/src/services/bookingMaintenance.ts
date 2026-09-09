import { and, eq, sql as expression } from 'drizzle-orm';
import { db } from '../database/client.js';
import { bookings, ledgerEntries, vendors } from '../database/schema.js';
import { bookingStart } from './cancellationPolicy.js';

export class BookingMaintenanceService {
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
    const candidates = await db.select().from(bookings).where(eq(bookings.status, 'confirmed'));
    let completed = 0;
    for (const booking of candidates) {
      if (bookingStart(booking.date, booking.endTime) > now) continue;
      if (await this.finalizeBooking(booking.id, 'completed', now)) completed += 1;
    }
    return completed;
  }
}
