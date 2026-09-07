import { Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { bookings, grounds, notifications, slots, users, vendors } from '../database/schema.js';

function param(value: string | string[] | undefined, name: string): string {
  if (typeof value !== 'string' || !value) throw new AppError('invalid_request', `${name} is required`, 422);
  return value;
}

function number(): string { return `BK-${Date.now()}-${Math.floor(Math.random() * 1000)}`; }

function mapBooking(row: any) {
  return {
    id: row.booking.id, booking_number: row.booking.bookingNumber, player_id: row.booking.playerId,
    vendor_id: row.booking.vendorId, ground_id: row.booking.groundId, slot_id: row.booking.slotId,
    ground_title: row.ground.title, ground_address: row.ground.address,
    player_name: row.player?.fullName || 'Player', player_phone: row.player?.phone || null,
    date: row.booking.date, start_time: row.booking.startTime, end_time: row.booking.endTime,
    total_amount: row.booking.totalAmount, platform_fee: row.booking.platformFee,
    vendor_amount: row.booking.vendorAmount, status: row.booking.status,
    payment_status: row.booking.paymentStatus, payment_method: row.booking.paymentMethod,
    payment_reference: row.booking.paymentReference, notes: row.booking.notes,
    created_at: row.booking.createdAt.toISOString(), updated_at: row.booking.updatedAt.toISOString(),
  };
}

async function fetchBooking(id: string) {
  const rows = await db.select({ booking: bookings, ground: grounds, player: users })
    .from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id))
    .leftJoin(users, eq(bookings.playerId, users.id)).where(eq(bookings.id, id)).limit(1);
  return rows[0];
}

export class BookingController {
  notifications = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const rows = await db.select().from(notifications).where(eq(notifications.userId, request.auth.userId)).orderBy(desc(notifications.createdAt));
    response.json({ notifications: rows });
  };

  create = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const slotId = typeof request.body?.slot_id === 'string' ? request.body.slot_id : '';
    const paymentReference = typeof request.body?.payment_reference === 'string' ? request.body.payment_reference.trim() : null;
    if (!slotId) throw new AppError('invalid_booking', 'A slot is required', 422);
    const row = await db.transaction(async (tx) => {
      const slotRows = await tx.select({ slot: slots, ground: grounds }).from(slots)
        .innerJoin(grounds, eq(slots.groundId, grounds.id)).where(eq(slots.id, slotId)).limit(1);
      const selected = slotRows[0];
      if (!selected) throw new AppError('slot_not_found', 'Slot was not found', 404);
      if (selected.slot.isBooked || selected.slot.isBlocked) throw new AppError('slot_unavailable', 'This slot is no longer available', 409);
      const vendorRows = await tx.select({ id: vendors.id, userId: vendors.userId }).from(vendors).where(eq(vendors.id, selected.ground.vendorId)).limit(1);
      if (!vendorRows[0]) throw new AppError('vendor_not_found', 'Ground owner was not found', 500);
      const platformFee = 0;
      const bookingRows = await tx.insert(bookings).values({
        bookingNumber: number(), playerId: request.auth!.userId, vendorId: selected.ground.vendorId,
        groundId: selected.slot.groundId, slotId: selected.slot.id, date: selected.slot.date,
        startTime: selected.slot.startTime, endTime: selected.slot.endTime, totalAmount: selected.slot.price,
        platformFee, vendorAmount: selected.slot.price, paymentReference,
      }).returning();
      const booking = bookingRows[0];
      if (!booking) throw new AppError('booking_failed', 'Booking could not be created', 500);
      const updated = await tx.update(slots).set({ isBooked: true, bookedBy: request.auth!.userId, bookingId: booking.id, updatedAt: new Date() })
        .where(and(eq(slots.id, selected.slot.id), eq(slots.isBooked, false), eq(slots.isBlocked, false))).returning();
      if (!updated[0]) throw new AppError('slot_unavailable', 'This slot was booked by another player', 409);
      const player = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, request.auth!.userId)).limit(1);
      await tx.insert(notifications).values([
        { userId: request.auth!.userId, type: 'booking', title: 'Booking confirmed', message: `Your slot at ${selected.ground.title} is confirmed.`, data: { bookingId: booking.id } },
        { userId: vendorRows[0].userId, type: 'booking', title: 'New booking', message: `${player[0]?.fullName || 'A player'} booked a slot at ${selected.ground.title}.`, data: { bookingId: booking.id } },
      ]);
      return booking.id;
    });
    const result = await fetchBooking(row);
    response.status(201).json({ booking: result ? mapBooking(result) : null });
  };

  playerList = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const rows = await db.select({ booking: bookings, ground: grounds, player: users }).from(bookings)
      .innerJoin(grounds, eq(bookings.groundId, grounds.id)).leftJoin(users, eq(bookings.playerId, users.id))
      .where(eq(bookings.playerId, request.auth.userId)).orderBy(desc(bookings.createdAt));
    response.json({ bookings: rows.map(mapBooking) });
  };

  vendorList = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendor = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1);
    if (!vendor[0]) throw new AppError('vendor_required', 'A vendor profile is required', 403);
    const rows = await db.select({ booking: bookings, ground: grounds, player: users }).from(bookings)
      .innerJoin(grounds, eq(bookings.groundId, grounds.id)).leftJoin(users, eq(bookings.playerId, users.id))
      .where(eq(bookings.vendorId, vendor[0].id)).orderBy(desc(bookings.createdAt));
    response.json({ bookings: rows.map(mapBooking) });
  };

  cancel = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const id = param(request.params.id, 'Booking id');
    const current = await fetchBooking(id);
    if (!current || (current.booking.playerId !== request.auth.userId && current.booking.vendorId !== request.auth.userId)) throw new AppError('not_found', 'Booking was not found', 404);
    if (current.booking.status === 'cancelled') throw new AppError('already_cancelled', 'Booking is already cancelled', 409);
    await db.transaction(async (tx) => {
      await tx.update(bookings).set({ status: 'cancelled', paymentStatus: 'refunded', updatedAt: new Date() }).where(eq(bookings.id, id));
      await tx.update(slots).set({ isBooked: false, bookedBy: null, bookingId: null, updatedAt: new Date() }).where(eq(slots.id, current.booking.slotId));
      await tx.insert(notifications).values({ userId: current.booking.playerId, type: 'booking', title: 'Booking cancelled', message: `Your booking at ${current.ground.title} was cancelled.`, data: { bookingId: id } });
    });
    response.json({ message: 'Booking cancelled' });
  };
}
