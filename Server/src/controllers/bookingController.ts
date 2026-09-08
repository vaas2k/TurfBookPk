import { randomUUID } from 'crypto';
import { Response } from 'express';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { bookings, grounds, notifications, slots, users, vendors } from '../database/schema.js';
import { canCancelBooking, HOLD_DURATION_MS, paymentStatusForCancellation } from '../services/bookingLifecycle.js';

function param(value: string | string[] | undefined, name: string): string {
  if (typeof value !== 'string' || !value) throw new AppError('invalid_request', `${name} is required`, 422);
  return value;
}
function bookingNumber(): string { return `BK-${Date.now()}-${randomUUID().slice(0, 8)}`; }
function hasStarted(date: string, time: string): boolean {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+05:00`).getTime() <= Date.now();
}
function idempotencyKey(request: AuthenticatedRequest): string {
  const value = request.header('idempotency-key') ?? request.body?.idempotency_key;
  if (typeof value !== 'string' || value.trim().length < 8 || value.trim().length > 128) {
    throw new AppError('idempotency_key_required', 'A valid idempotency key is required to create a booking', 422);
  }
  return value.trim();
}
function mapBooking(row: any) {
  const booking = row.booking;
  return {
    id: booking.id, booking_number: booking.bookingNumber, player_id: booking.playerId, vendor_id: booking.vendorId,
    ground_id: booking.groundId, slot_id: booking.slotId, ground_title: row.ground.title, ground_address: row.ground.address,
    player_name: row.player?.fullName || 'Player', player_phone: row.player?.phone || null,
    date: booking.date, start_time: booking.startTime, end_time: booking.endTime, total_amount: booking.totalAmount,
    platform_fee: booking.platformFee, vendor_amount: booking.vendorAmount, status: booking.status,
    payment_status: booking.paymentStatus, payment_method: booking.paymentMethod, payment_reference: booking.paymentReference,
    hold_expires_at: booking.holdExpiresAt?.toISOString() ?? null, cancelled_at: booking.cancelledAt?.toISOString() ?? null,
    cancellation_reason: booking.cancellationReason, notes: booking.notes,
    created_at: booking.createdAt.toISOString(), updated_at: booking.updatedAt.toISOString(),
  };
}
async function fetchBooking(id: string) {
  const rows = await db.select({ booking: bookings, ground: grounds, player: users }).from(bookings)
    .innerJoin(grounds, eq(bookings.groundId, grounds.id)).leftJoin(users, eq(bookings.playerId, users.id))
    .where(eq(bookings.id, id)).limit(1);
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
    if (!slotId) throw new AppError('invalid_booking', 'A slot is required', 422);
    const key = idempotencyKey(request);
    const now = new Date();
    const holdExpiresAt = new Date(now.getTime() + HOLD_DURATION_MS);
    const bookingId = await db.transaction(async (tx) => {
      const duplicate = (await tx.select({ booking: bookings, ground: grounds, player: users }).from(bookings)
        .innerJoin(grounds, eq(bookings.groundId, grounds.id)).leftJoin(users, eq(bookings.playerId, users.id))
        .where(eq(bookings.idempotencyKey, key)).limit(1))[0];
      if (duplicate) {
        if (duplicate.booking.playerId !== request.auth!.userId) throw new AppError('idempotency_key_conflict', 'This idempotency key belongs to another booking', 409);
        return duplicate.booking.id;
      }
      const player = (await tx.select({ fullName: users.fullName, role: users.role }).from(users).where(eq(users.id, request.auth!.userId)).limit(1))[0];
      if (!player) throw new AppError('unauthorized', 'User account was not found', 401);
      if (player.role !== 'player') throw new AppError('player_mode_required', 'Switch to player mode before booking a ground', 403);
      const selected = (await tx.select({ slot: slots, ground: grounds, vendor: vendors }).from(slots)
        .innerJoin(grounds, eq(slots.groundId, grounds.id)).innerJoin(vendors, eq(grounds.vendorId, vendors.id))
        .where(eq(slots.id, slotId)).limit(1))[0];
      if (!selected) throw new AppError('slot_not_found', 'Slot was not found', 404);
      if (!selected.ground.isActive || !selected.vendor.isActive) throw new AppError('ground_unavailable', 'This ground is not accepting bookings', 409);
      if (hasStarted(selected.slot.date, selected.slot.startTime)) throw new AppError('slot_expired', 'This slot has already started', 409);
      if (selected.slot.isBooked || selected.slot.isBlocked) throw new AppError('slot_unavailable', 'This slot is no longer available', 409);
      if (selected.vendor.userId === request.auth!.userId) throw new AppError('self_booking_not_allowed', 'You cannot book your own ground', 403);
      if (selected.slot.holdExpiresAt && selected.slot.holdExpiresAt > now) throw new AppError('slot_held', 'This slot is temporarily reserved while another payment is pending', 409);
      if (selected.slot.holdBookingId) {
        await tx.update(bookings).set({ status: 'expired', updatedAt: now }).where(and(eq(bookings.id, selected.slot.holdBookingId), eq(bookings.status, 'pending_payment')));
      }
      const booking = (await tx.insert(bookings).values({ bookingNumber: bookingNumber(), playerId: request.auth!.userId,
        vendorId: selected.ground.vendorId, groundId: selected.slot.groundId, slotId: selected.slot.id, date: selected.slot.date,
        startTime: selected.slot.startTime, endTime: selected.slot.endTime, totalAmount: selected.slot.price, platformFee: 0,
        vendorAmount: selected.slot.price, status: 'pending_payment', paymentStatus: 'pending', paymentMethod: 'mock',
        idempotencyKey: key, holdExpiresAt }).returning())[0];
      if (!booking) throw new AppError('booking_failed', 'Booking could not be created', 500);
      const held = await tx.update(slots).set({ heldBy: request.auth!.userId, holdBookingId: booking.id, holdExpiresAt, updatedAt: now })
        .where(and(eq(slots.id, selected.slot.id), eq(slots.isBooked, false), eq(slots.isBlocked, false),
          or(isNull(slots.holdExpiresAt), lte(slots.holdExpiresAt, now)))).returning({ id: slots.id });
      if (!held[0]) throw new AppError('slot_unavailable', 'This slot is no longer available', 409);
      return booking.id;
    });
    const result = await fetchBooking(bookingId);
    response.status(201).json({ booking: result ? mapBooking(result) : null });
  };

  confirmMock = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    if (process.env.NODE_ENV === 'production') throw new AppError('payment_provider_required', 'Mock payment confirmation is disabled in production', 403);
    const id = param(request.params.id, 'Booking id');
    const reference = typeof request.body?.payment_reference === 'string' ? request.body.payment_reference.trim().slice(0, 128) : `mock-${randomUUID()}`;
    const now = new Date();
    const outcome = await db.transaction(async (tx) => {
      const current = (await tx.select({ booking: bookings, ground: grounds, vendor: vendors, player: users }).from(bookings)
        .innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(vendors, eq(bookings.vendorId, vendors.id))
        .leftJoin(users, eq(bookings.playerId, users.id)).where(eq(bookings.id, id)).limit(1))[0];
      if (!current || current.booking.playerId !== request.auth!.userId) throw new AppError('not_found', 'Booking was not found', 404);
      if (current.booking.status === 'confirmed' && current.booking.paymentStatus === 'paid') return { idempotent: true, bookingId: id };
      if (current.booking.status !== 'pending_payment' || !current.booking.holdExpiresAt || current.booking.holdExpiresAt <= now) {
        if (current.booking.status === 'pending_payment') {
          await tx.update(bookings).set({ status: 'expired', updatedAt: now }).where(eq(bookings.id, id));
          await tx.update(slots).set({ heldBy: null, holdBookingId: null, holdExpiresAt: null, updatedAt: now }).where(eq(slots.holdBookingId, id));
        }
        throw new AppError('payment_hold_expired', 'The payment hold has expired. Please start a new booking.', 409);
      }
      const booked = await tx.update(slots).set({ isBooked: true, bookedBy: request.auth!.userId, bookingId: id, heldBy: null, holdBookingId: null, holdExpiresAt: null, updatedAt: now })
        .where(and(eq(slots.id, current.booking.slotId), eq(slots.holdBookingId, id), eq(slots.heldBy, request.auth!.userId), gte(slots.holdExpiresAt, now))).returning({ id: slots.id });
      if (!booked[0]) throw new AppError('slot_unavailable', 'This payment hold is no longer valid', 409);
      await tx.update(bookings).set({ status: 'confirmed', paymentStatus: 'paid', paymentReference: reference, holdExpiresAt: null, updatedAt: now }).where(eq(bookings.id, id));
      await tx.insert(notifications).values([
        { userId: request.auth!.userId, type: 'booking', title: 'Booking confirmed', message: `Your slot at ${current.ground.title} is confirmed.`, data: { bookingId: id } },
        { userId: current.vendor.userId, type: 'booking', title: 'New booking', message: `${current.player?.fullName || 'A player'} booked a slot at ${current.ground.title}.`, data: { bookingId: id } },
      ]);
      return { idempotent: false, bookingId: id };
    });
    const result = await fetchBooking(outcome.bookingId);
    response.json({ booking: result ? mapBooking(result) : null, idempotent: outcome.idempotent });
  };

  playerList = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const rows = await db.select({ booking: bookings, ground: grounds, player: users }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).leftJoin(users, eq(bookings.playerId, users.id)).where(eq(bookings.playerId, request.auth.userId)).orderBy(desc(bookings.createdAt));
    response.json({ bookings: rows.map(mapBooking) });
  };
  vendorList = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendor = (await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    if (!vendor) throw new AppError('vendor_required', 'A vendor profile is required', 403);
    const rows = await db.select({ booking: bookings, ground: grounds, player: users }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).leftJoin(users, eq(bookings.playerId, users.id)).where(eq(bookings.vendorId, vendor.id)).orderBy(desc(bookings.createdAt));
    response.json({ bookings: rows.map(mapBooking) });
  };
  cancel = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const id = param(request.params.id, 'Booking id');
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim().slice(0, 500) : null;
    const result = await db.transaction(async (tx) => {
      const current = (await tx.select({ booking: bookings, ground: grounds }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).where(eq(bookings.id, id)).limit(1))[0];
      if (!current) throw new AppError('not_found', 'Booking was not found', 404);
      const vendor = (await tx.select({ id: vendors.id, userId: vendors.userId }).from(vendors).where(eq(vendors.userId, request.auth!.userId)).limit(1))[0];
      const isPlayer = current.booking.playerId === request.auth!.userId;
      const isVendor = vendor?.id === current.booking.vendorId;
      if (!isPlayer && !isVendor) throw new AppError('not_found', 'Booking was not found', 404);
      if (current.booking.status === 'cancelled') return { idempotent: true, bookingId: id };
      if (!canCancelBooking(current.booking.status)) throw new AppError('booking_not_cancellable', 'This booking can no longer be cancelled', 409);
      const now = new Date();
      const cancelled = await tx.update(bookings).set({ status: 'cancelled', paymentStatus: paymentStatusForCancellation(current.booking.paymentStatus), cancelledAt: now, cancelledBy: request.auth!.userId, cancellationReason: reason, holdExpiresAt: null, updatedAt: now })
        .where(and(eq(bookings.id, id), eq(bookings.status, current.booking.status))).returning({ id: bookings.id });
      if (!cancelled[0]) return { idempotent: true, bookingId: id };
      const slotCondition = current.booking.status === 'pending_payment' ? eq(slots.holdBookingId, id) : eq(slots.bookingId, id);
      await tx.update(slots).set({ isBooked: false, bookedBy: null, bookingId: null, heldBy: null, holdBookingId: null, holdExpiresAt: null, updatedAt: now }).where(and(eq(slots.id, current.booking.slotId), slotCondition));
      const recipient = isPlayer ? vendor?.userId : current.booking.playerId;
      if (recipient) await tx.insert(notifications).values({ userId: recipient, type: 'booking', title: 'Booking cancelled', message: `A booking at ${current.ground.title} was cancelled.`, data: { bookingId: id } });
      return { idempotent: false, bookingId: id };
    });
    const booking = await fetchBooking(result.bookingId);
    response.json({ booking: booking ? mapBooking(booking) : null, idempotent: result.idempotent });
  };
}
