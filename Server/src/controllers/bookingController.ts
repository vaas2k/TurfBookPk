import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'crypto';
import { Response } from 'express';
import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql as expression } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { attendanceEvents, bookingOrders, bookings, financialDisputes, groundManagers, grounds, ledgerEntries, notifications, paymentAttempts, pitches, refundBankProfiles, refundCases, slots, users, vendors } from '../database/schema.js';
import { canCancelBooking, paymentStatusForCancellation } from '../services/bookingLifecycle.js';
import { bookingStart, cancellationPolicy, cancellationQuote } from '../services/cancellationPolicy.js';
import { MockPaymentProvider } from '../services/paymentProvider.js';
import { BookingMaintenanceService } from '../services/bookingMaintenance.js';
import { calculateBookingPrice } from '../services/bookingPricing.js';
import { effectiveSlotPrice } from '../services/peakPricing.js';
import { env } from '../configs/env.js';
import { sendExpoPush } from '../services/expoPushService.js';
import { nextPaginationCursor, parsePaginationCursor } from '../services/paginationCursor.js';
import { isInsideBookingCutoff } from '../services/bookingCutoff.js';
import { encryptPayoutValue, identifierFingerprint, identifierLastFour, normalizedIdentifier } from '../services/sensitiveData.js';
import { immediateRecurringSlotIds } from '../services/recurringPaymentPolicy.js';
import { canOperateGround, managedGroundIds } from '../services/groundManagerAccess.js';

function param(value: string | string[] | undefined, name: string): string {
  if (typeof value !== 'string' || !value) throw new AppError('invalid_request', `${name} is required`, 422);
  return value;
}
function pagination(request: AuthenticatedRequest): { page: number; limit: number; offset: number } {
  const parse = (value: unknown, name: string, fallback: number, max: number): number => {
    if (value === undefined || value === '') return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError('invalid_pagination', `${name} must be a whole number`, 422);
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new AppError('invalid_pagination', `${name} must be between 1 and ${max}`, 422);
    return number;
  };
  const page = parse(request.query.page, 'Page', 1, 10_000);
  const limit = parse(request.query.limit, 'Limit', 50, 100);
  return { page, limit, offset: (page - 1) * limit };
}
function bookingNumber(): string { return `BK-${Date.now()}-${randomUUID().slice(0, 8)}`; }
function orderNumber(): string { return `ORD-${Date.now()}-${randomUUID().slice(0, 8)}`; }
function assertMockPaymentsEnabled(): void {
  if (env.paymentProvider !== 'mock' || env.nodeEnv === 'production') throw new AppError('mock_payment_disabled', 'Mock payment endpoints are disabled', 404);
}
function hasStarted(date: string, time: string): boolean {
  return isInsideBookingCutoff(date, time);
}
function recurringPaymentWindow(date: string, startTime: string): { opensAt: Date; expiresAt: Date } {
  const start = bookingStart(date, startTime);
  const opensAt = new Date(start.getTime() - env.recurringPaymentOpensBeforeMinutes * 60_000);
  const expiresAt = new Date(start.getTime() - env.recurringPaymentDeadlineBeforeMinutes * 60_000);
  if (expiresAt <= opensAt) throw new AppError('invalid_recurring_payment_window', 'Recurring payment deadline must be after its opening time', 500);
  return { opensAt, expiresAt };
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
    ground_id: booking.groundId, pitch_id: booking.pitchId, pitch_name: booking.pitchName, pitch_side: booking.pitchSide, slot_id: booking.slotId, ground_title: row.ground.title, ground_address: row.ground.address,
    player_name: row.player?.fullName || 'Player', player_phone: row.player?.phone || null,
    date: booking.date, end_date: booking.endDate || booking.date, start_time: booking.startTime, end_time: booking.endTime, turnaround_minutes: booking.turnaroundMinutes, actual_start_at: booking.actualStartAt?.toISOString() ?? null, start_delay_reason: booking.startDelayReason, total_amount: booking.totalAmount,
    platform_fee: booking.platformFee, vendor_amount: booking.vendorAmount, status: booking.status,
    checked_in_at: booking.checkedInAt?.toISOString() ?? null,
    checked_in_by: booking.checkedInBy ?? null,
    payment_status: booking.paymentStatus, payment_method: booking.paymentMethod, payment_reference: booking.paymentReference,
    hold_expires_at: booking.holdExpiresAt?.toISOString() ?? null, cancelled_at: booking.cancelledAt?.toISOString() ?? null,
    cancellation_reason: booking.cancellationReason, notes: booking.notes,
    cancellation_fee: booking.cancellationFee, refund_amount: booking.refundAmount,
    cancellation_policy: booking.cancellationPolicy,
    is_recurring_reservation: booking.isRecurringReservation,
    payment_window_opens_at: booking.paymentWindowOpensAt?.toISOString() ?? null,
    reservation_expires_at: booking.reservationExpiresAt?.toISOString() ?? null,
    created_at: booking.createdAt.toISOString(), updated_at: booking.updatedAt.toISOString(),
  };
}
function mapManagerBooking(row: any) {
  return { id: row.booking.id, booking_number: row.booking.bookingNumber, ground_id: row.booking.groundId, ground_title: row.ground.title, player_name: row.player?.fullName || 'Player', player_phone: row.player?.phone ?? null, date: row.booking.date, end_date: row.booking.endDate || row.booking.date, start_time: row.booking.startTime, end_time: row.booking.endTime, status: row.booking.status, payment_status: row.booking.paymentStatus, checked_in_at: row.booking.checkedInAt?.toISOString() ?? null, actual_start_at: row.booking.actualStartAt?.toISOString() ?? null };
}
function checkInCodeHash(bookingId: string, code: string): string {
  return createHmac('sha256', env.jwtAccessSecret).update(`${bookingId}:${code}`).digest('hex');
}
async function operationalBookingResponse(userId: string, row: any) {
  const owner = (await db.select({ id: vendors.id }).from(vendors).where(and(eq(vendors.id, row.booking.vendorId), eq(vendors.userId, userId))).limit(1))[0];
  return owner ? mapBooking(row) : mapManagerBooking(row);
}
async function fetchBooking(id: string) {
  const rows = await db.select({ booking: bookings, ground: grounds, player: users }).from(bookings)
    .innerJoin(grounds, eq(bookings.groundId, grounds.id)).leftJoin(users, eq(bookings.playerId, users.id))
    .where(eq(bookings.id, id)).limit(1);
  return rows[0];
}

export class BookingController {
  issueCheckInToken = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Booking id');
    const booking = (await db.select().from(bookings).where(and(eq(bookings.id, id), eq(bookings.playerId, request.auth!.userId))).limit(1))[0];
    if (!booking) throw new AppError('not_found', 'Booking was not found', 404);
    const now = new Date();
    const start = bookingStart(booking.date, booking.startTime);
    const end = bookingStart(booking.endDate || booking.date, booking.endTime);
    if (booking.status !== 'confirmed' || booking.paymentStatus !== 'paid' || booking.checkedInAt || now.getTime() < start.getTime() - 30 * 60_000 || now > end) throw new AppError('check_in_unavailable', 'Check-in opens 30 minutes before your paid match and closes when it ends', 409);
    const token = randomBytes(32).toString('base64url');
    const code = String(randomInt(10_000_000, 100_000_000));
    const expiresAt = new Date(Math.min(now.getTime() + 2 * 60_000, end.getTime()));
    const updated = (await db.update(bookings).set({ checkInTokenHash: createHash('sha256').update(token).digest('hex'), checkInTokenExpiresAt: expiresAt, checkInCodeHash: checkInCodeHash(booking.id, code), checkInCodeAttempts: 0 }).where(and(eq(bookings.id, booking.id), eq(bookings.status, 'confirmed'), isNull(bookings.checkedInAt))).returning({ id: bookings.id }))[0];
    if (!updated) throw new AppError('check_in_unavailable', 'This booking is no longer available for check-in', 409);
    response.json({ token, code, expires_at: expiresAt.toISOString(), booking_number: booking.bookingNumber });
  };
  manualCheckIn = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Booking id');
    const code = typeof request.body?.code === 'string' ? request.body.code.trim() : '';
    if (!/^\d{8}$/.test(code)) throw new AppError('invalid_check_in_code', 'Enter the eight-digit code shown on the player phone', 422);
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const row = (await tx.select().from(bookings).where(eq(bookings.id, id)).limit(1).for('update'))[0];
      if (!row || !await canOperateGround(request.auth!.userId, row.vendorId, row.groundId)) throw new AppError('not_found', 'Booking was not found', 404);
      if (row.status !== 'confirmed' || row.paymentStatus !== 'paid' || row.checkedInAt || !row.checkInTokenExpiresAt || row.checkInTokenExpiresAt <= now) return { error: 'Ask the player to refresh their check-in code.' };
      if (now.getTime() < bookingStart(row.date, row.startTime).getTime() - 30 * 60_000 || now > bookingStart(row.endDate || row.date, row.endTime)) return { error: 'Check-in is outside the match arrival window.' };
      if (row.checkInCodeAttempts >= 5) return { error: 'Too many attempts. Ask the player to refresh their code.' };
      if (row.checkInCodeHash !== checkInCodeHash(row.id, code)) {
        await tx.update(bookings).set({ checkInCodeAttempts: row.checkInCodeAttempts + 1 }).where(eq(bookings.id, row.id));
        return { error: 'Code did not match. Check the player phone and try again.' };
      }
      await tx.update(bookings).set({ checkedInAt: now, checkedInBy: request.auth!.userId, checkInTokenHash: null, checkInTokenExpiresAt: null, checkInCodeHash: null, updatedAt: now }).where(eq(bookings.id, id));
      await tx.insert(attendanceEvents).values({ bookingId: id, groundId: row.groundId, actorId: request.auth!.userId, action: 'checked_in' });
      await tx.insert(notifications).values({ userId: row.playerId, type: 'booking', title: 'Arrival confirmed', message: 'Your ground manager checked you in for this match.', data: { bookingId: id } });
      return { booking_number: row.bookingNumber, checked_in_at: now.toISOString() };
    });
    if ('error' in result) throw new AppError('invalid_check_in_code', result.error!, 409);
    response.json(result);
  };
  scanCheckIn = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const token = typeof request.body?.token === 'string' ? request.body.token.trim() : '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError('invalid_check_in', 'Scan a valid TurfBookPK check-in QR', 422);
    const hash = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const row = (await tx.select().from(bookings).where(eq(bookings.checkInTokenHash, hash)).limit(1).for('update'))[0];
      if (!row || row.status !== 'confirmed' || row.paymentStatus !== 'paid' || row.checkedInAt || !row.checkInTokenExpiresAt || row.checkInTokenExpiresAt <= now) throw new AppError('invalid_check_in', 'This check-in QR expired or has already been used. Ask the player to refresh it.', 409);
      const start = bookingStart(row.date, row.startTime);
      const end = bookingStart(row.endDate || row.date, row.endTime);
      if (now.getTime() < start.getTime() - 30 * 60_000 || now > end) throw new AppError('check_in_unavailable', 'Check-in is outside the match arrival window', 409);
      if (!await canOperateGround(request.auth!.userId, row.vendorId, row.groundId)) throw new AppError('forbidden', 'You are not assigned to this ground', 403);
      const updated = (await tx.update(bookings).set({ checkedInAt: now, checkedInBy: request.auth!.userId, checkInTokenHash: null, checkInTokenExpiresAt: null, checkInCodeHash: null, updatedAt: now }).where(and(eq(bookings.id, row.id), isNull(bookings.checkedInAt))).returning())[0];
      if (!updated) throw new AppError('already_checked_in', 'This booking is already checked in', 409);
      await tx.insert(attendanceEvents).values({ bookingId: row.id, groundId: row.groundId, actorId: request.auth!.userId, action: 'checked_in' });
      await tx.insert(notifications).values({ userId: row.playerId, type: 'booking', title: 'Arrival confirmed', message: 'Your ground manager checked you in for this match.', data: { bookingId: row.id } });
      return updated;
    });
    response.json({ booking_id: result.id, booking_number: result.bookingNumber, checked_in_at: result.checkedInAt?.toISOString() });
  };
  recordDelayedStart = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const id = param(request.params.id, 'Booking id');
    const reason = request.body?.reason;
    if (reason !== 'previous_team' && reason !== 'venue_delay' && reason !== 'other') throw new AppError('invalid_delay_reason', 'Choose why the pitch started late', 422);
    const current = await fetchBooking(id);
    if (!current || !await canOperateGround(request.auth.userId, current.booking.vendorId, current.booking.groundId)) throw new AppError('not_found', 'Booking was not found', 404);
    const now = new Date();
    if (current.booking.status !== 'confirmed' || now < bookingStart(current.booking.date, current.booking.startTime) || now >= bookingStart(current.booking.endDate || current.booking.date, current.booking.endTime)) throw new AppError('delay_not_recordable', 'Record the actual start during a confirmed playing slot', 409);
    const saved = await db.transaction(async (tx) => {
      const [updated] = await tx.update(bookings).set({ actualStartAt: now, startDelayReason: reason, updatedAt: now }).where(and(eq(bookings.id, id), eq(bookings.status, 'confirmed'), isNull(bookings.actualStartAt))).returning();
      if (updated) await tx.insert(notifications).values({ userId: updated.playerId, type: 'booking', title: 'Delayed start recorded', message: `The venue recorded that your match at ${current.ground.title} started late. Your booked end time has not changed.`, data: { bookingId: id } });
      return updated;
    });
    if (!saved) throw new AppError('delay_already_recorded', 'The actual start has already been recorded', 409);
    void sendExpoPush({ userIds: [saved.playerId], title: 'Delayed start recorded', body: `The venue recorded a delayed start for your match at ${current.ground.title}.`, data: { bookingId: id } });
    const result = await fetchBooking(id);
    response.json({ booking: result ? await operationalBookingResponse(request.auth.userId, result) : null });
  };
  confirmOrderMock = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    assertMockPaymentsEnabled();
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const id = param(request.params.id, 'Order id'); const now = new Date();
    const result = await db.transaction(async (tx) => {
      const order = (await tx.select().from(bookingOrders).where(eq(bookingOrders.id, id)).limit(1))[0];
      if (!order || order.playerId !== request.auth!.userId) throw new AppError('not_found', 'Booking order was not found', 404);
      if (order.status === 'confirmed' && order.paymentStatus === 'paid') return { idempotent: true, order };
      if (order.status !== 'pending_payment') throw new AppError('order_not_payable', 'This order can no longer be paid', 409);
      const items = await tx.select({ booking: bookings, slot: slots, ground: grounds, vendor: vendors, player: users }).from(bookings).innerJoin(slots, eq(bookings.slotId, slots.id)).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(vendors, eq(bookings.vendorId, vendors.id)).leftJoin(users, eq(bookings.playerId, users.id)).where(eq(bookings.orderId, id));
      if (items.length < 2) throw new AppError('payment_hold_expired', 'Your selected slots are no longer available. Please start again.', 409);
      const ordered = [...items].sort((a, b) => `${a.booking.date}${a.booking.startTime}`.localeCompare(`${b.booking.date}${b.booking.startTime}`));
      const first = ordered[0]!;
      const recurringReservation = ordered.some((item) => item.booking.isRecurringReservation);
      const payableItems = recurringReservation ? ordered.filter((item) => !item.booking.isRecurringReservation) : ordered;
      if (payableItems.some((item) => item.booking.status !== 'pending_payment' || item.booking.holdExpiresAt === null || item.booking.holdExpiresAt <= now || item.slot.holdBookingId !== item.booking.id)) {
        throw new AppError('payment_hold_expired', 'One or more selected slots are no longer available. Please start again.', 409);
      }
      if (recurringReservation && ordered.filter((item) => item.booking.isRecurringReservation).some((item) => item.booking.status !== 'pending_payment' || item.booking.reservationExpiresAt === null || item.booking.reservationExpiresAt <= now || item.slot.holdBookingId !== item.booking.id)) throw new AppError('reservation_expired', 'One or more future reservations have expired. Please select them again.', 409);
      const dueNow = payableItems.reduce((sum, item) => sum + item.booking.totalAmount, 0);
      const confirmation = await new MockPaymentProvider().confirm({ bookingId: id, amount: dueNow, requestedReference: typeof request.body?.payment_reference === 'string' ? request.body.payment_reference : null });
      const [payment] = await tx.update(paymentAttempts).set({ status: confirmation.status, providerReference: confirmation.providerReference, paidAt: confirmation.paidAt, updatedAt: now }).where(and(eq(paymentAttempts.orderId, id), eq(paymentAttempts.status, 'pending'))).returning();
      if (!payment) throw new AppError('payment_attempt_missing', 'Order payment attempt was not found', 409);
      for (const item of payableItems) {
        const [claimed] = await tx.update(slots).set({ isBooked: true, bookedBy: request.auth!.userId, bookingId: item.booking.id, heldBy: null, holdBookingId: null, holdExpiresAt: null, updatedAt: now }).where(and(eq(slots.id, item.slot.id), eq(slots.holdBookingId, item.booking.id))).returning();
        if (!claimed) throw new AppError('slot_unavailable', 'One or more selected slots are no longer available', 409);
        await tx.update(bookings).set({ status: 'confirmed', paymentStatus: 'paid', paymentReference: confirmation.providerReference, holdExpiresAt: null, updatedAt: now }).where(eq(bookings.id, item.booking.id));
        await tx.insert(ledgerEntries).values({ vendorId: item.booking.vendorId, bookingId: item.booking.id, paymentAttemptId: payment.id, type: 'booking_earning', status: 'pending', amount: item.booking.vendorAmount, description: `Pending earning for booking ${item.booking.bookingNumber}`, idempotencyKey: `earning:${item.booking.id}` });
        await tx.update(vendors).set({ pendingEarnings: expression`${vendors.pendingEarnings} + ${item.booking.vendorAmount}`, updatedAt: now }).where(eq(vendors.id, item.booking.vendorId));
        await tx.insert(notifications).values({ userId: item.vendor.userId, type: 'booking', title: 'New booking', message: `${item.player?.fullName || 'A player'} booked a slot at ${item.ground.title}.`, data: { bookingId: item.booking.id, orderId: id } });
      }
      await tx.update(bookingOrders).set({ status: 'confirmed', paymentStatus: 'paid', updatedAt: now }).where(eq(bookingOrders.id, id));
      const futureCount = ordered.filter((item) => item.booking.isRecurringReservation).length;
      await tx.insert(notifications).values({ userId: request.auth!.userId, type: 'booking', title: recurringReservation ? 'Recurring booking started' : 'Bookings confirmed', message: recurringReservation ? `${payableItems.length} slot${payableItems.length === 1 ? '' : 's'} confirmed and ${futureCount} reserved. Each future payment opens 24 hours before kickoff and closes 12 hours before.` : `${items.length} slots were confirmed.`, data: { bookingId: first.booking.id, orderId: id } });
      return { idempotent: false, order: { ...order, status: 'confirmed', paymentStatus: 'paid' } };
    });
    if (!result.idempotent) {
      const confirmed = await db.select({ booking: bookings, ground: grounds, vendor: vendors, player: users })
        .from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(vendors, eq(bookings.vendorId, vendors.id))
        .leftJoin(users, eq(bookings.playerId, users.id)).where(eq(bookings.orderId, result.order.id));
      const first = confirmed[0];
      if (first) {
        void sendExpoPush({ userIds: [request.auth.userId], title: 'Bookings confirmed', body: `${confirmed.length} slot${confirmed.length === 1 ? '' : 's'} at ${first.ground.title} confirmed.`, data: { bookingId: first.booking.id } });
        for (const vendorUserId of [...new Set(confirmed.map((item) => item.vendor.userId))]) {
          void sendExpoPush({ userIds: [vendorUserId], title: 'New booking', body: `${first.player?.fullName || 'A player'} booked ${confirmed.length} slot${confirmed.length === 1 ? '' : 's'} at ${first.ground.title}.`, data: { bookingId: first.booking.id } });
        }
      }
    }
    response.json({ order: { id: result.order.id, order_number: result.order.orderNumber, status: result.order.status, payment_status: result.order.paymentStatus }, idempotent: result.idempotent });
  };
  createOrder = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const slotIds = Array.isArray(request.body?.slot_ids) ? [...new Set(request.body.slot_ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))] : [];
    const recurringReservation = request.body?.reserve_future_slots === true;
    if (slotIds.length < 2 || slotIds.length > 20) throw new AppError('invalid_order', 'Select between 2 and 20 different slots', 422);
    const key = idempotencyKey(request); const now = new Date(); const holdExpiresAt = new Date(now.getTime() + env.paymentHoldMinutes * 60_000);
    const order = await db.transaction(async (tx) => {
      const existing = (await tx.select().from(bookingOrders).where(eq(bookingOrders.idempotencyKey, key)).limit(1))[0];
      if (existing) { if (existing.playerId !== request.auth!.userId) throw new AppError('idempotency_key_conflict', 'This idempotency key belongs to another order', 409); return existing; }
      const player = (await tx.select({ role: users.role }).from(users).where(eq(users.id, request.auth!.userId)).limit(1))[0];
      if (!player || player.role !== 'player') throw new AppError('player_mode_required', 'Switch to player mode before booking grounds', 403);
      const slotIdList = expression.join(slotIds.map((slotId) => expression`${slotId}::uuid`), expression`, `);
      const selected = await tx.select({ slot: slots, ground: grounds, vendor: vendors, pitch: pitches }).from(slots).innerJoin(grounds, eq(slots.groundId, grounds.id)).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).innerJoin(pitches, eq(slots.pitchId, pitches.id)).where(expression`${slots.id} IN (${slotIdList})`);
      if (selected.length !== slotIds.length) throw new AppError('slot_not_found', 'One or more slots were not found', 404);
      if (selected.some((item) => item.ground.vendorId !== selected[0]!.ground.vendorId)) {
        throw new AppError('multiple_vendors_not_supported', 'Select slots from one venue per payment', 422);
      }
      let totalAmount = 0; let platformFee = 0;
      for (const item of selected) {
        if (!item.ground.isActive || !item.ground.isVerified || item.ground.verificationStatus !== 'approved' || !item.vendor.isActive || item.vendor.verificationStatus !== 'approved' || !item.pitch.isActive || item.slot.isBooked || item.slot.isBlocked || (item.slot.holdExpiresAt && item.slot.holdExpiresAt > now) || hasStarted(item.slot.date, item.slot.startTime)) throw new AppError('slot_unavailable', 'One or more selected slots are unavailable', 409);
        if (item.vendor.userId === request.auth!.userId) throw new AppError('self_booking_not_allowed', 'You cannot book your own ground', 403);
        const effective = effectiveSlotPrice(item.slot.date, item.slot.startTime, item.slot.endTime, { basePrice: item.slot.price, peakPercentage: item.ground.peakPercentage, peakWindows: item.ground.peakWindows });
        const price = calculateBookingPrice(effective.amount, env.platformCommissionBps); totalAmount += price.totalAmount; platformFee += price.platformFee;
      }
      const ordered = [...selected].sort((a, b) => `${a.slot.date}${a.slot.startTime}`.localeCompare(`${b.slot.date}${b.slot.startTime}`));
      const immediateSlotIds = recurringReservation
        ? immediateRecurringSlotIds(ordered.map((item) => ({ id: item.slot.id, date: item.slot.date, startTime: item.slot.startTime })), now, env.recurringPayNowHours)
        : new Set(ordered.map((item) => item.slot.id));
      const [created] = await tx.insert(bookingOrders).values({ orderNumber: orderNumber(), playerId: request.auth!.userId, totalAmount, platformFee, idempotencyKey: key }).returning();
      if (!created) throw new AppError('order_creation_failed', 'Unable to create booking order', 500);
      let dueNow = 0;
      for (const item of selected) {
        const effective = effectiveSlotPrice(item.slot.date, item.slot.startTime, item.slot.endTime, { basePrice: item.slot.price, peakPercentage: item.ground.peakPercentage, peakWindows: item.ground.peakWindows });
        const price = calculateBookingPrice(effective.amount, env.platformCommissionBps);
        const isFutureReservation = recurringReservation && !immediateSlotIds.has(item.slot.id);
        const window = isFutureReservation ? recurringPaymentWindow(item.slot.date, item.slot.startTime) : null;
        const reservationHoldExpiresAt = window?.expiresAt ?? holdExpiresAt;
        const [booking] = await tx.insert(bookings).values({ bookingNumber: bookingNumber(), orderId: created.id, playerId: request.auth!.userId, vendorId: item.ground.vendorId, groundId: item.slot.groundId, pitchId: item.pitch.id, pitchName: item.pitch.name, pitchSide: item.pitch.side, slotId: item.slot.id, date: item.slot.date, endDate: item.slot.endDate, startTime: item.slot.startTime, endTime: item.slot.endTime, turnaroundMinutes: item.slot.turnaroundMinutes, totalAmount: price.totalAmount, platformFee: price.platformFee, vendorAmount: price.vendorAmount, status: 'pending_payment', paymentStatus: 'pending', paymentMethod: env.paymentProvider === 'clink' ? 'clink_1bill' : 'mock', idempotencyKey: `${key}:${item.slot.id}`, holdExpiresAt: reservationHoldExpiresAt, isRecurringReservation: isFutureReservation, paymentWindowOpensAt: window?.opensAt ?? null, reservationExpiresAt: window?.expiresAt ?? null, cancellationPolicy: cancellationPolicy(item.ground.cancellationPolicy) }).returning();
        if (!booking) throw new AppError('booking_failed', 'Unable to create order bookings', 500);
        const held = await tx.update(slots).set({ heldBy: request.auth!.userId, holdBookingId: booking.id, holdExpiresAt: reservationHoldExpiresAt, updatedAt: now }).where(and(eq(slots.id, item.slot.id), eq(slots.isBooked, false), eq(slots.isBlocked, false), or(isNull(slots.holdExpiresAt), lte(slots.holdExpiresAt, now)))).returning({ id: slots.id });
        if (!held[0]) throw new AppError('slot_unavailable', 'One or more selected slots are unavailable', 409);
        if (!isFutureReservation) dueNow += price.totalAmount;
      }
      await tx.insert(paymentAttempts).values({ orderId: created.id, playerId: request.auth!.userId, vendorId: selected[0]!.ground.vendorId, provider: env.paymentProvider, amount: dueNow, status: 'pending', idempotencyKey: `payment:${created.id}:${env.paymentProvider}` });
      return { ...created, dueNow };
    });
    response.status(201).json({ order: { id: order.id, order_number: order.orderNumber, total_amount: order.totalAmount, due_now_amount: 'dueNow' in order ? order.dueNow : order.totalAmount, platform_fee: order.platformFee, status: order.status, payment_status: order.paymentStatus } });
  };
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
    const holdExpiresAt = new Date(now.getTime() + env.paymentHoldMinutes * 60_000);
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
      const selected = (await tx.select({ slot: slots, ground: grounds, vendor: vendors, pitch: pitches }).from(slots)
        .innerJoin(grounds, eq(slots.groundId, grounds.id)).innerJoin(vendors, eq(grounds.vendorId, vendors.id))
        .innerJoin(pitches, eq(slots.pitchId, pitches.id))
        .where(eq(slots.id, slotId)).limit(1))[0];
      if (!selected) throw new AppError('slot_not_found', 'Slot was not found', 404);
      if (!selected.ground.isActive || !selected.ground.isVerified || selected.ground.verificationStatus !== 'approved' || !selected.vendor.isActive || selected.vendor.verificationStatus !== 'approved' || !selected.pitch.isActive) throw new AppError('ground_unavailable', 'This pitch is not accepting bookings', 409);
      if (hasStarted(selected.slot.date, selected.slot.startTime)) throw new AppError('slot_expired', `This slot can no longer be booked within ${env.minimumBookingLeadMinutes} minutes of its start time`, 409);
      if (selected.slot.isBooked || selected.slot.isBlocked) throw new AppError('slot_unavailable', 'This slot is no longer available', 409);
      if (selected.vendor.userId === request.auth!.userId) throw new AppError('self_booking_not_allowed', 'You cannot book your own ground', 403);
      if (selected.slot.holdExpiresAt && selected.slot.holdExpiresAt > now) throw new AppError('slot_held', 'This slot is temporarily reserved while another payment is pending', 409);
      if (selected.slot.holdBookingId) {
        await tx.update(bookings).set({ status: 'expired', updatedAt: now }).where(and(eq(bookings.id, selected.slot.holdBookingId), eq(bookings.status, 'pending_payment')));
      }
      const effective = effectiveSlotPrice(selected.slot.date, selected.slot.startTime, selected.slot.endTime, { basePrice: selected.slot.price, peakPercentage: selected.ground.peakPercentage, peakWindows: selected.ground.peakWindows });
      const price = calculateBookingPrice(effective.amount, env.platformCommissionBps);
      const booking = (await tx.insert(bookings).values({
        bookingNumber: bookingNumber(), playerId: request.auth!.userId,
        vendorId: selected.ground.vendorId, groundId: selected.slot.groundId, pitchId: selected.pitch.id, pitchName: selected.pitch.name, pitchSide: selected.pitch.side, slotId: selected.slot.id, date: selected.slot.date, endDate: selected.slot.endDate,
        startTime: selected.slot.startTime, endTime: selected.slot.endTime, turnaroundMinutes: selected.slot.turnaroundMinutes, totalAmount: price.totalAmount, platformFee: price.platformFee,
        vendorAmount: price.vendorAmount, status: 'pending_payment', paymentStatus: 'pending', paymentMethod: env.paymentProvider === 'clink' ? 'clink_1bill' : 'mock',
        idempotencyKey: key, holdExpiresAt, cancellationPolicy: cancellationPolicy(selected.ground.cancellationPolicy)
      }).returning())[0];
      if (!booking) throw new AppError('booking_failed', 'Booking could not be created', 500);
      await tx.insert(paymentAttempts).values({
        bookingId: booking.id, playerId: booking.playerId, vendorId: booking.vendorId,
        provider: env.paymentProvider, amount: booking.totalAmount, status: 'pending', idempotencyKey: `payment:${booking.id}:${env.paymentProvider}`,
      });
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
    assertMockPaymentsEnabled();
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const id = param(request.params.id, 'Booking id');
    const requestedReference = typeof request.body?.payment_reference === 'string' ? request.body.payment_reference : null;
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
      if (!booked[0]) {
        // A concurrent confirmation may have claimed this slot while this
        // transaction waited on the row lock. PostgreSQL READ COMMITTED lets
        // this statement observe the committed booking before deciding.
        const [latest] = await tx.select({ status: bookings.status, paymentStatus: bookings.paymentStatus })
          .from(bookings).where(eq(bookings.id, id)).limit(1);
        if (latest?.status === 'confirmed' && latest.paymentStatus === 'paid') return { idempotent: true, bookingId: id };
        throw new AppError('slot_unavailable', 'This payment hold is no longer valid', 409);
      }
      const confirmation = await new MockPaymentProvider().confirm({ bookingId: id, amount: current.booking.totalAmount, requestedReference });
      const payment = (await tx.update(paymentAttempts).set({ status: confirmation.status, providerReference: confirmation.providerReference, paidAt: confirmation.paidAt, updatedAt: now })
        .where(and(eq(paymentAttempts.bookingId, id), eq(paymentAttempts.status, 'pending'))).returning())[0];
      if (!payment) throw new AppError('payment_attempt_missing', 'Payment attempt was not found', 409);
      await tx.update(bookings).set({ status: 'confirmed', paymentStatus: 'paid', paymentReference: confirmation.providerReference, holdExpiresAt: null, updatedAt: now }).where(eq(bookings.id, id));
      await tx.insert(ledgerEntries).values({
        vendorId: current.booking.vendorId, bookingId: id, paymentAttemptId: payment.id,
        type: 'booking_earning', status: 'pending', amount: current.booking.vendorAmount,
        description: `Pending earning for booking ${current.booking.bookingNumber}`, idempotencyKey: `earning:${id}`
      });
      await tx.update(vendors).set({ pendingEarnings: expression`${vendors.pendingEarnings} + ${current.booking.vendorAmount}`, updatedAt: now }).where(eq(vendors.id, current.booking.vendorId));
      await tx.insert(notifications).values([
        { userId: request.auth!.userId, type: 'booking', title: 'Booking confirmed', message: `Your slot at ${current.ground.title} is confirmed.`, data: { bookingId: id } },
        { userId: current.vendor.userId, type: 'booking', title: 'New booking', message: `${current.player?.fullName || 'A player'} booked a slot at ${current.ground.title}.`, data: { bookingId: id } },
      ]);
      void sendExpoPush({ userIds: [request.auth!.userId], title: 'Booking confirmed', body: `Your slot at ${current.ground.title} is confirmed.`, data: { bookingId: id } });
      void sendExpoPush({ userIds: [current.vendor.userId], title: 'New booking', body: `A slot was booked at ${current.ground.title}.`, data: { bookingId: id } });
      return { idempotent: false, bookingId: id };
    });
    const result = await fetchBooking(outcome.bookingId);
    response.json({ booking: result ? mapBooking(result) : null, idempotent: outcome.idempotent });
  };

  playerList = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const { page, limit, offset } = pagination(request);
    const cursor = parsePaginationCursor(request.query.cursor);
    const condition = eq(bookings.playerId, request.auth.userId);
    const totalForPlayer = expression<number>`(select count(*)::int from bookings total_bookings where total_bookings.player_id = ${request.auth.userId})`;
    const rows = await db.select({ booking: bookings, ground: grounds, player: users, total: totalForPlayer }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).leftJoin(users, eq(bookings.playerId, users.id)).where(and(condition, cursor ? or(lt(bookings.createdAt, cursor.createdAt), and(eq(bookings.createdAt, cursor.createdAt), lt(bookings.id, cursor.id))) : undefined)).orderBy(desc(bookings.createdAt), desc(bookings.id)).limit(limit + 1).offset(cursor ? 0 : offset);
    const total = Number(rows[0]?.total ?? 0);
    const pageRows = rows.slice(0, limit);
    response.json({ bookings: pageRows.map(mapBooking), pagination: { page, limit, total, has_more: rows.length > limit, next_cursor: rows.length > limit ? nextPaginationCursor(pageRows.at(-1)?.booking) : null } });
  };
  confirmRecurringReservationMock = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    assertMockPaymentsEnabled();
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const id = param(request.params.id, 'Booking id'); const now = new Date();
    await db.transaction(async (tx) => {
      const item = (await tx.select({ booking: bookings, slot: slots, ground: grounds, vendor: vendors, player: users }).from(bookings).innerJoin(slots, eq(bookings.slotId, slots.id)).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(vendors, eq(bookings.vendorId, vendors.id)).leftJoin(users, eq(bookings.playerId, users.id)).where(eq(bookings.id, id)).limit(1))[0];
      if (!item || item.booking.playerId !== request.auth!.userId || !item.booking.isRecurringReservation) throw new AppError('not_found', 'Recurring reservation was not found', 404);
      if (item.booking.status === 'confirmed' && item.booking.paymentStatus === 'paid') return;
      if (item.booking.status !== 'pending_payment' || !item.booking.paymentWindowOpensAt || !item.booking.reservationExpiresAt || now < item.booking.paymentWindowOpensAt) throw new AppError('payment_window_not_open', 'Payment opens 24 hours before this reserved slot', 409);
      if (now >= item.booking.reservationExpiresAt || item.slot.holdBookingId !== id || !item.slot.holdExpiresAt || item.slot.holdExpiresAt <= now) throw new AppError('reservation_expired', 'This reservation window has expired and the slot is available to others', 409);
      const confirmation = await new MockPaymentProvider().confirm({ bookingId: id, amount: item.booking.totalAmount, requestedReference: typeof request.body?.payment_reference === 'string' ? request.body.payment_reference : null });
      const [payment] = await tx.insert(paymentAttempts).values({ bookingId: id, playerId: request.auth!.userId, vendorId: item.booking.vendorId, provider: 'mock', amount: item.booking.totalAmount, status: confirmation.status, providerReference: confirmation.providerReference, paidAt: confirmation.paidAt, idempotencyKey: `recurring-payment:${id}` }).onConflictDoNothing().returning();
      if (!payment) return;
      const [claimed] = await tx.update(slots).set({ isBooked: true, bookedBy: request.auth!.userId, bookingId: id, heldBy: null, holdBookingId: null, holdExpiresAt: null, updatedAt: now }).where(and(eq(slots.id, item.slot.id), eq(slots.holdBookingId, id))).returning();
      if (!claimed) throw new AppError('slot_unavailable', 'This slot is no longer available', 409);
      await tx.update(bookings).set({ status: 'confirmed', paymentStatus: 'paid', paymentReference: confirmation.providerReference, holdExpiresAt: null, updatedAt: now }).where(eq(bookings.id, id));
      await tx.insert(ledgerEntries).values({ vendorId: item.booking.vendorId, bookingId: id, paymentAttemptId: payment.id, type: 'booking_earning', status: 'pending', amount: item.booking.vendorAmount, description: `Pending earning for recurring booking ${item.booking.bookingNumber}`, idempotencyKey: `earning:${id}` }).onConflictDoNothing();
      await tx.update(vendors).set({ pendingEarnings: expression`${vendors.pendingEarnings} + ${item.booking.vendorAmount}`, updatedAt: now }).where(eq(vendors.id, item.booking.vendorId));
      await tx.insert(notifications).values([{ userId: item.vendor.userId, type: 'booking', title: 'Recurring slot paid', message: `${item.player?.fullName || 'A player'} paid for a reserved slot at ${item.ground.title}.`, data: { bookingId: id } }, { userId: request.auth!.userId, type: 'booking', title: 'Reserved slot confirmed', message: `Your reserved slot at ${item.ground.title} is confirmed.`, data: { bookingId: id } }]);
    });
    const booking = await fetchBooking(id);
    if (booking) {
      void sendExpoPush({ userIds: [request.auth.userId], title: 'Reserved slot confirmed', body: `Your reserved slot at ${booking.ground.title} is confirmed.`, data: { bookingId: id } });
      const vendor = (await db.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, booking.booking.vendorId)).limit(1))[0];
      if (vendor) void sendExpoPush({ userIds: [vendor.userId], title: 'Recurring slot paid', body: `A player paid for a reserved slot at ${booking.ground.title}.`, data: { bookingId: id } });
    }
    response.json({ booking: booking ? mapBooking(booking) : null });
  };
  vendorList = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendor = (await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    if (!vendor) throw new AppError('vendor_required', 'A vendor profile is required', 403);
    const { page, limit, offset } = pagination(request);
    const cursor = parsePaginationCursor(request.query.cursor);
    const condition = eq(bookings.vendorId, vendor.id);
    const totalForVendor = expression<number>`(select count(*)::int from bookings total_bookings where total_bookings.vendor_id = ${vendor.id})`;
    const rows = await db.select({ booking: bookings, ground: grounds, player: users, total: totalForVendor }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).leftJoin(users, eq(bookings.playerId, users.id)).where(and(condition, cursor ? or(lt(bookings.createdAt, cursor.createdAt), and(eq(bookings.createdAt, cursor.createdAt), lt(bookings.id, cursor.id))) : undefined)).orderBy(desc(bookings.createdAt), desc(bookings.id)).limit(limit + 1).offset(cursor ? 0 : offset);
    const total = Number(rows[0]?.total ?? 0);
    const pageRows = rows.slice(0, limit);
    response.json({ bookings: pageRows.map(mapBooking), pagination: { page, limit, total, has_more: rows.length > limit, next_cursor: rows.length > limit ? nextPaginationCursor(pageRows.at(-1)?.booking) : null } });
  };
  managerList = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const groundIds = await managedGroundIds(request.auth!.userId);
    if (!groundIds.length) { response.json({ bookings: [] }); return; }
    const date = request.query.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('invalid_date', 'Select a valid calendar date', 422);
    const rows = await db.select({ booking: bookings, ground: grounds, player: users }).from(bookings)
      .innerJoin(grounds, eq(bookings.groundId, grounds.id)).leftJoin(users, eq(bookings.playerId, users.id))
      .where(and(inArray(bookings.groundId, groundIds), or(eq(bookings.date, date), eq(bookings.endDate, date)))).orderBy(bookings.startTime).limit(200);
    response.json({ bookings: rows.map(mapManagerBooking) });
  };
  managerDetail = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const current = await fetchBooking(param(request.params.id, 'Booking id'));
    if (!current || !await canOperateGround(request.auth!.userId, current.booking.vendorId, current.booking.groundId)) throw new AppError('not_found', 'Booking was not found', 404);
    response.json({ booking: mapManagerBooking(current) });
  };
  managerDispute = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Booking id');
    const current = await fetchBooking(id);
    if (!current || !await canOperateGround(request.auth!.userId, current.booking.vendorId, current.booking.groundId)) throw new AppError('not_found', 'Booking was not found', 404);
    const row = (await db.select().from(financialDisputes).where(eq(financialDisputes.bookingId, id)).limit(1))[0];
    response.json({ dispute: row ? { id: row.id, status: row.status, category: row.category, description: row.description, vendor_response: row.vendorResponse } : null });
  };
  detail = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const current = await fetchBooking(param(request.params.id, 'Booking id'));
    if (!current) throw new AppError('not_found', 'Booking was not found', 404);
    const vendor = (await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    if (current.booking.playerId !== request.auth.userId && vendor?.id !== current.booking.vendorId) throw new AppError('not_found', 'Booking was not found', 404);
    response.json({ booking: mapBooking(current) });
  };
  dispute = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const bookingId = param(request.params.id, 'Booking id');
    const current = await fetchBooking(bookingId);
    if (!current) throw new AppError('not_found', 'Booking was not found', 404);
    const vendor = (await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    if (current.booking.playerId !== request.auth.userId && vendor?.id !== current.booking.vendorId) throw new AppError('not_found', 'Booking was not found', 404);
    const row = (await db.select().from(financialDisputes).where(eq(financialDisputes.bookingId, bookingId)).limit(1))[0];
    response.json({ dispute: row ? { id: row.id, status: row.status, category: row.category, description: row.description, vendor_response: row.vendorResponse, vendor_appeal: row.vendorAppeal, resolution: row.resolution, refund_amount: row.refundAmount, created_at: row.createdAt.toISOString(), vendor_responded_at: row.vendorRespondedAt?.toISOString() ?? null, appealed_at: row.appealedAt?.toISOString() ?? null, resolved_at: row.resolvedAt?.toISOString() ?? null } : null });
  };
  openDispute = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const bookingId = param(request.params.id, 'Booking id');
    const current = await fetchBooking(bookingId);
    if (!current || current.booking.playerId !== request.auth.userId) throw new AppError('not_found', 'Booking was not found', 404);
    if (!['confirmed', 'completed'].includes(current.booking.status)) throw new AppError('dispute_not_available', 'Only a paid match can be disputed', 409);
    const now = new Date();
    const startsAt = bookingStart(current.booking.date, current.booking.startTime);
    const endsAt = bookingStart(current.booking.endDate || current.booking.date, current.booking.endTime);
    if (now < startsAt) throw new AppError('dispute_not_open', 'You can report a match issue once the booked time starts', 409);
    if (now > new Date(endsAt.getTime() + 2 * 60 * 60_000)) throw new AppError('dispute_window_closed', 'The two-hour match issue window has closed', 409);
    const category = typeof request.body?.category === 'string' ? request.body.category.trim() : '';
    const description = typeof request.body?.description === 'string' ? request.body.description.trim().slice(0, 1000) : '';
    const categories = ['delayed_start', 'ground_closed', 'pitch_quality', 'booking_not_honored', 'other'];
    if (!categories.includes(category) || description.length < 10) throw new AppError('invalid_dispute', 'Choose an issue and describe what happened in at least 10 characters', 422);
    const created = await db.transaction(async (tx) => {
      await tx.execute(expression`SELECT pg_advisory_xact_lock(hashtext(${bookingId}))`);
      const existing = (await tx.select({ id: financialDisputes.id }).from(financialDisputes).where(eq(financialDisputes.bookingId, bookingId)).limit(1))[0];
      if (existing) throw new AppError('dispute_exists', 'An issue is already open for this booking', 409);
      return (await tx.insert(financialDisputes).values({ bookingId, playerId: current.booking.playerId, vendorId: current.booking.vendorId, status: 'waiting', category, description, vendorHoldAmount: current.booking.vendorAmount }).returning())[0]!;
    });
    const vendor = (await db.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, current.booking.vendorId)).limit(1))[0];
    if (vendor) await db.insert(notifications).values({ userId: vendor.userId, type: 'dispute', title: 'Player reported a match issue', message: `Review the issue for ${current.ground.title} and send your response.`, data: { bookingId, disputeId: created.id, destination: 'booking_details' } });
    response.status(201).json({ dispute: { id: created.id, status: created.status, category: created.category, description: created.description, created_at: created.createdAt.toISOString() } });
  };
  respondToDispute = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const bookingId = param(request.params.id, 'Booking id');
    const disputeId = param(request.params.disputeId, 'Dispute id');
    const current = await fetchBooking(bookingId);
    const message = typeof request.body?.response === 'string' ? request.body.response.trim().slice(0, 1000) : '';
    if (!current || !await canOperateGround(request.auth.userId, current.booking.vendorId, current.booking.groundId)) throw new AppError('not_found', 'Booking was not found', 404);
    if (message.length < 10) throw new AppError('invalid_dispute_response', 'Provide a response of at least 10 characters', 422);
    const [updated] = await db.update(financialDisputes).set({ status: 'under_review', vendorResponse: message, vendorRespondedAt: new Date(), updatedAt: new Date() }).where(and(eq(financialDisputes.id, disputeId), eq(financialDisputes.bookingId, bookingId), eq(financialDisputes.vendorId, current.booking.vendorId), inArray(financialDisputes.status, ['open', 'waiting']))).returning();
    if (!updated) throw new AppError('dispute_not_respondable', 'This issue is not waiting for a vendor response', 409);
    await db.insert(notifications).values({ userId: updated.playerId, type: 'dispute', title: 'Venue responded to your issue', message: 'The TurfBookPK team can now review both sides.', data: { bookingId, disputeId, destination: 'booking_details' } });
    response.json({ dispute: { id: updated.id, status: updated.status, vendor_response: updated.vendorResponse } });
  };
  appealDispute = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const bookingId = param(request.params.id, 'Booking id');
    const disputeId = param(request.params.disputeId, 'Dispute id');
    const vendor = (await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    const message = typeof request.body?.appeal === 'string' ? request.body.appeal.trim().slice(0, 1000) : '';
    if (!vendor || message.length < 10) throw new AppError('invalid_dispute_appeal', 'Explain the appeal in at least 10 characters', 422);
    const [updated] = await db.update(financialDisputes).set({ status: 'under_review', vendorAppeal: message, appealedAt: new Date(), updatedAt: new Date() }).where(and(eq(financialDisputes.id, disputeId), eq(financialDisputes.bookingId, bookingId), eq(financialDisputes.vendorId, vendor.id), inArray(financialDisputes.status, ['resolved', 'rejected']), isNull(financialDisputes.appealedAt))).returning();
    if (!updated) throw new AppError('dispute_not_appealable', 'This decision cannot be appealed again', 409);
    response.json({ dispute: { id: updated.id, status: updated.status, vendor_appeal: updated.vendorAppeal } });
  };
  cancellationPreview = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const current = await fetchBooking(param(request.params.id, 'Booking id'));
    if (!current) throw new AppError('not_found', 'Booking was not found', 404);
    const vendor = (await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    const isVendor = vendor?.id === current.booking.vendorId;
    if (!isVendor && current.booking.playerId !== request.auth.userId) throw new AppError('not_found', 'Booking was not found', 404);
    if (!canCancelBooking(current.booking.status) || bookingStart(current.booking.date, current.booking.startTime) <= new Date()) throw new AppError('booking_not_cancellable', 'This booking can no longer be cancelled', 409);
    const quote = cancellationQuote({ amountPaid: current.booking.totalAmount, paymentStatus: current.booking.paymentStatus, cancelledByVendor: isVendor, startsAt: bookingStart(current.booking.date, current.booking.startTime), policy: cancellationPolicy(current.booking.cancellationPolicy), bookedAt: current.booking.createdAt });
    response.json({ cancellation_fee: quote.cancellationFee, refund_amount: quote.refundAmount, refund_required: quote.refundRequired, refund_percentage: quote.refundPercentage, cancellation_policy: quote.policy, within_grace_window: quote.withinGraceWindow, grace_window_minutes: quote.graceWindowMinutes, payment_status: current.booking.paymentStatus, is_mock_payment: current.booking.paymentMethod === 'mock' });
  };
  markNoShow = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const id = param(request.params.id, 'Booking id');
    const current = await fetchBooking(id);
    if (!current || !await canOperateGround(request.auth.userId, current.booking.vendorId, current.booking.groundId)) throw new AppError('not_found', 'Booking was not found', 404);
    if (bookingStart(current.booking.endDate || current.booking.date, current.booking.endTime) > new Date()) throw new AppError('booking_not_ended', 'A no-show can only be recorded after the slot ends', 409);
    if (current.booking.checkedInAt) throw new AppError('already_checked_in', 'This player was checked in and cannot be marked as a no-show', 409);
    if (!await new BookingMaintenanceService().finalizeBooking(id, 'no_show', new Date(), request.auth.userId)) throw new AppError('booking_not_updatable', 'Only confirmed bookings can be marked as no-show', 409);
    const player = (await db.select({ noShowStrikes: users.noShowStrikes }).from(users).where(eq(users.id, current.booking.playerId)).limit(1))[0];
    const strikeMessage = `Your booking at ${current.ground.title} was marked as a no-show.${player && player.noShowStrikes >= 3 ? ' Your account has been flagged for review after three no-shows.' : ''}`;
    await db.insert(notifications).values({ userId: current.booking.playerId, type: 'booking', title: 'Booking marked as no-show', message: strikeMessage, data: { bookingId: id } });
    void sendExpoPush({ userIds: [current.booking.playerId], title: 'Booking marked as no-show', body: `Your booking at ${current.ground.title} was marked as a no-show.`, data: { bookingId: id } });
    const result = await fetchBooking(id);
    response.json({ booking: result ? await operationalBookingResponse(request.auth.userId, result) : null });
  };
  markCompleted = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const id = param(request.params.id, 'Booking id'); const current = await fetchBooking(id);
    if (!current || !await canOperateGround(request.auth.userId, current.booking.vendorId, current.booking.groundId)) throw new AppError('not_found', 'Booking was not found', 404);
    if (bookingStart(current.booking.endDate || current.booking.date, current.booking.endTime) > new Date()) throw new AppError('booking_not_ended', 'Attendance can only be recorded after the slot ends', 409);
    if (!await new BookingMaintenanceService().finalizeBooking(id, 'completed', new Date(), request.auth.userId)) throw new AppError('booking_not_updatable', 'Only confirmed bookings can be marked as attended', 409);
    await db.insert(notifications).values({ userId: current.booking.playerId, type: 'booking', title: 'Booking completed', message: `Your booking at ${current.ground.title} was marked as completed.`, data: { bookingId: id } });
    const result = await fetchBooking(id); response.json({ booking: result ? await operationalBookingResponse(request.auth.userId, result) : null });
  };
  cancel = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const id = param(request.params.id, 'Booking id');
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim().slice(0, 500) : null;
    const result = await db.transaction(async (tx) => {
      const current = (await tx.select({ booking: bookings, ground: grounds }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).where(eq(bookings.id, id)).limit(1))[0];
      if (!current) throw new AppError('not_found', 'Booking was not found', 404);
      const vendor = (await tx.select({ id: vendors.id, userId: vendors.userId }).from(vendors).where(eq(vendors.userId, request.auth!.userId)).limit(1))[0];
      const bookingVendor = (await tx.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, current.booking.vendorId)).limit(1))[0];
      const isPlayer = current.booking.playerId === request.auth!.userId;
      const isVendor = vendor?.id === current.booking.vendorId;
      if (!isPlayer && !isVendor) throw new AppError('not_found', 'Booking was not found', 404);
      if (current.booking.status === 'cancelled') return { idempotent: true, bookingId: id };
      if (!canCancelBooking(current.booking.status)) throw new AppError('booking_not_cancellable', 'This booking can no longer be cancelled', 409);
      const now = new Date();
      if (bookingStart(current.booking.date, current.booking.startTime) <= now) throw new AppError('booking_started', 'Bookings cannot be cancelled after the slot starts', 409);
      const quote = cancellationQuote({
        amountPaid: current.booking.totalAmount, paymentStatus: current.booking.paymentStatus,
        cancelledByVendor: Boolean(isVendor), startsAt: bookingStart(current.booking.date, current.booking.startTime),
        policy: cancellationPolicy(current.booking.cancellationPolicy), bookedAt: current.booking.createdAt, now
      });
      const nextPaymentStatus = paymentStatusForCancellation(current.booking.paymentStatus, quote.refundRequired);
      const cancelled = await tx.update(bookings).set({ status: 'cancelled', paymentStatus: nextPaymentStatus, cancelledAt: now, cancelledBy: request.auth!.userId, cancellationReason: reason, cancellationFee: quote.cancellationFee, refundAmount: quote.refundAmount, holdExpiresAt: null, updatedAt: now })
        .where(and(eq(bookings.id, id), eq(bookings.status, current.booking.status))).returning({ id: bookings.id });
      if (!cancelled[0]) return { idempotent: true, bookingId: id };
      const slotCondition = current.booking.status === 'pending_payment' ? eq(slots.holdBookingId, id) : eq(slots.bookingId, id);
      await tx.update(slots).set({ isBooked: false, bookedBy: null, bookingId: null, heldBy: null, holdBookingId: null, holdExpiresAt: null, updatedAt: now }).where(and(eq(slots.id, current.booking.slotId), slotCondition));
      if (current.booking.paymentStatus === 'paid') {
        await tx.update(paymentAttempts).set({ status: nextPaymentStatus, updatedAt: now }).where(and(eq(paymentAttempts.bookingId, id), eq(paymentAttempts.status, 'paid')));
        const reversed = await tx.update(ledgerEntries).set({ status: 'reversed', updatedAt: now })
          .where(and(eq(ledgerEntries.bookingId, id), eq(ledgerEntries.status, 'pending'), eq(ledgerEntries.type, 'booking_earning'))).returning({ amount: ledgerEntries.amount });
        const reversedAmount = reversed.reduce((sum, entry) => sum + entry.amount, 0);
        if (reversedAmount > 0) await tx.update(vendors).set({ pendingEarnings: expression`GREATEST(0, ${vendors.pendingEarnings} - ${reversedAmount})`, updatedAt: now }).where(eq(vendors.id, current.booking.vendorId));
        const vendorRetainedAmount = current.booking.totalAmount > 0
          ? Math.round(quote.cancellationFee * current.booking.vendorAmount / current.booking.totalAmount)
          : 0;
        if (vendorRetainedAmount > 0) {
          await tx.insert(ledgerEntries).values({
            vendorId: current.booking.vendorId, bookingId: id,
            type: 'booking_earning', status: 'posted', amount: vendorRetainedAmount,
            description: `Cancellation fee for booking ${current.booking.bookingNumber}`, idempotencyKey: `cancellation-fee:${id}`, postedAt: now
          }).onConflictDoNothing();
          await tx.update(vendors).set({ totalEarnings: expression`${vendors.totalEarnings} + ${vendorRetainedAmount}`, updatedAt: now }).where(eq(vendors.id, current.booking.vendorId));
        }
        if (quote.refundRequired) {
          const vendorFunded = current.booking.totalAmount > 0
            ? Math.round(quote.refundAmount * current.booking.vendorAmount / current.booking.totalAmount)
            : 0;
          await tx.insert(ledgerEntries).values({
            vendorId: current.booking.vendorId, bookingId: id,
            type: 'refund', status: 'pending', amount: -vendorFunded, description: `Vendor-funded refund pending for booking ${current.booking.bookingNumber}`,
            idempotencyKey: `refund:${id}`
          }).onConflictDoNothing();
          const profile = (await tx.select().from(refundBankProfiles).where(eq(refundBankProfiles.playerId, current.booking.playerId)).limit(1))[0];
          await tx.insert(refundCases).values({
            bookingId: id, playerId: current.booking.playerId, vendorId: current.booking.vendorId,
            status: profile ? 'pending_review' : 'awaiting_bank_details', responsibility: isVendor ? 'vendor' : 'policy',
            calculatedAmount: quote.refundAmount, vendorFundedAmount: vendorFunded, platformFundedAmount: quote.refundAmount - vendorFunded,
            bankName: profile?.bankName ?? null, accountTitle: profile?.accountTitle ?? null, accountCiphertext: profile?.accountCiphertext ?? null, accountLastFour: profile?.accountLastFour ?? null,
          }).onConflictDoNothing();
        }
      }
      const recipient = isPlayer ? bookingVendor?.userId : current.booking.playerId;
      if (recipient) await tx.insert(notifications).values({ userId: recipient, type: 'booking', title: 'Booking cancelled', message: `A booking at ${current.ground.title} was cancelled.`, data: { bookingId: id } });
      return { idempotent: false, bookingId: id };
    });
    const booking = await fetchBooking(result.bookingId);
    if (!result.idempotent && booking) {
      const vendor = (await db.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, booking.booking.vendorId)).limit(1))[0];
      const recipient = booking.booking.playerId === request.auth.userId ? vendor?.userId : booking.booking.playerId;
      if (recipient) void sendExpoPush({ userIds: [recipient], title: 'Booking cancelled', body: `A booking at ${booking.ground.title} was cancelled.`, data: { bookingId: booking.booking.id } });
    }
    response.json({ booking: booking ? mapBooking(booking) : null, idempotent: result.idempotent });
  };

  refundBankProfile = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const profile = (await db.select().from(refundBankProfiles).where(eq(refundBankProfiles.playerId, request.auth.userId)).limit(1))[0];
    response.setHeader('Cache-Control', 'private, no-store');
    response.json({ profile: profile ? { bank_name: profile.bankName, account_title: profile.accountTitle, account_last_four: profile.accountLastFour, belongs_to_player: profile.belongsToPlayer, alternate_owner_reason: profile.alternateOwnerReason } : null });
  };

  saveRefundBankProfile = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const bankName = typeof request.body?.bank_name === 'string' ? request.body.bank_name.trim().slice(0, 100) : '';
    const accountTitle = typeof request.body?.account_title === 'string' ? request.body.account_title.trim().slice(0, 120) : '';
    const rawAccount = typeof request.body?.account_number === 'string' ? request.body.account_number : '';
    const account = normalizedIdentifier(rawAccount);
    const belongsToPlayer = request.body?.belongs_to_player !== false;
    const alternateOwnerReason = typeof request.body?.alternate_owner_reason === 'string' ? request.body.alternate_owner_reason.trim().slice(0, 300) || null : null;
    if (!bankName || !accountTitle || !/^(PK\d{2}[A-Z0-9]{15,30}|\d{8,34})$/.test(account)) throw new AppError('invalid_refund_bank', 'Enter the bank name, account title, and a valid IBAN or account number', 422);
    if (!belongsToPlayer && !alternateOwnerReason) throw new AppError('refund_account_reason_required', 'Explain why this refund account belongs to another person', 422);
    const values = { bankName, accountTitle, accountCiphertext: encryptPayoutValue(account), accountFingerprint: identifierFingerprint(account), accountLastFour: identifierLastFour(account), belongsToPlayer, alternateOwnerReason, updatedAt: new Date() };
    const existing = (await db.select({ id: refundBankProfiles.id }).from(refundBankProfiles).where(eq(refundBankProfiles.playerId, request.auth.userId)).limit(1))[0];
    if (existing) await db.update(refundBankProfiles).set(values).where(eq(refundBankProfiles.id, existing.id)); else await db.insert(refundBankProfiles).values({ playerId: request.auth.userId, ...values });
    await db.update(refundCases).set({ bankName, accountTitle, accountCiphertext: values.accountCiphertext, accountLastFour: values.accountLastFour, status: 'pending_review', updatedAt: new Date() }).where(and(eq(refundCases.playerId, request.auth.userId), eq(refundCases.status, 'awaiting_bank_details')));
    response.json({ profile: { bank_name: bankName, account_title: accountTitle, account_last_four: values.accountLastFour, belongs_to_player: belongsToPlayer, alternate_owner_reason: alternateOwnerReason } });
  };
}
