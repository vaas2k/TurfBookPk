import { Response } from 'express';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '../database/client.js';
import { groundManagers, grounds, managerSlotActions, pitches, slots, users, vendors } from '../database/schema.js';
import { AppError } from '../helpers/errors.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { normalizePhone } from '../services/otpService.js';
import { canOperateGround } from '../services/groundManagerAccess.js';
import { bookingStart } from '../services/cancellationPolicy.js';

async function owner(userId: string) {
  const vendor = (await db.select().from(vendors).where(and(eq(vendors.userId, userId), eq(vendors.verificationStatus, 'approved'), eq(vendors.isActive, true))).limit(1))[0];
  if (!vendor) throw new AppError('vendor_required', 'An approved vendor account is required', 403);
  return vendor;
}
function managerRow(row: typeof groundManagers.$inferSelect, groundTitle: string) {
  return { id: row.id, name: row.name, phone: row.phone, ground_id: row.groundId, ground_title: groundTitle, accepted_at: row.acceptedAt?.toISOString() ?? null, revoked_at: row.revokedAt?.toISOString() ?? null };
}

export class ManagerController {
  slotsForDay = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const groundId = String(request.params.groundId || '');
    const date = request.query.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('invalid_date', 'Select a valid calendar date', 422);
    const ground = (await db.select({ id: grounds.id, vendorId: grounds.vendorId }).from(grounds).where(eq(grounds.id, groundId)).limit(1))[0];
    if (!ground || !await canOperateGround(request.auth!.userId, ground.vendorId, ground.id)) throw new AppError('not_found', 'Assigned ground was not found', 404);
    const [pitchRows, rows] = await Promise.all([
      db.select({ id: pitches.id, name: pitches.name, side: pitches.side, kind: pitches.kind, isActive: pitches.isActive }).from(pitches).where(eq(pitches.groundId, groundId)).orderBy(pitches.createdAt),
      db.select({ slot: slots, pitchName: pitches.name, pitchSide: pitches.side }).from(slots).leftJoin(pitches, eq(slots.pitchId, pitches.id)).where(and(eq(slots.groundId, groundId), or(eq(slots.date, date), eq(slots.endDate, date)))).orderBy(slots.date, slots.startTime).limit(1000),
    ]);
    response.json({ pitches: pitchRows.map((pitch) => ({ id: pitch.id, name: pitch.name, side: pitch.side, kind: pitch.kind, is_active: pitch.isActive })), slots: rows.map(({ slot, pitchName, pitchSide }) => ({ id: slot.id, ground_id: slot.groundId, pitch_id: slot.pitchId, pitch_name: pitchName, pitch_side: pitchSide, date: slot.date, end_date: slot.endDate || slot.date, start_time: slot.startTime, end_time: slot.endTime, is_booked: slot.isBooked, is_blocked: slot.isBlocked, is_club_reserved: slot.isClubReserved, is_held: Boolean(slot.holdExpiresAt && slot.holdExpiresAt > new Date()) })) });
  };
  changeSlot = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const groundId = String(request.params.groundId || '');
    const slotId = String(request.params.slotId || '');
    const action = request.body?.action;
    if (!['block', 'unblock', 'reserve', 'remove'].includes(action)) throw new AppError('invalid_slot_action', 'Choose block, unblock, reserve, or remove', 422);
    const ground = (await db.select({ id: grounds.id, vendorId: grounds.vendorId }).from(grounds).where(eq(grounds.id, groundId)).limit(1))[0];
    if (!ground || !await canOperateGround(request.auth!.userId, ground.vendorId, ground.id)) throw new AppError('not_found', 'Assigned ground was not found', 404);
    await db.transaction(async (tx) => {
      const slot = (await tx.select().from(slots).where(and(eq(slots.id, slotId), eq(slots.groundId, groundId))).limit(1).for('update'))[0];
      if (!slot) throw new AppError('not_found', 'Slot was not found', 404);
      if (bookingStart(slot.date, slot.startTime) <= new Date()) throw new AppError('slot_started', 'Past or started slots cannot be changed', 409);
      if (slot.isBooked || (slot.holdExpiresAt && slot.holdExpiresAt > new Date())) throw new AppError('slot_unavailable', 'Booked or payment-held slots cannot be changed', 409);
      if (action === 'remove') await tx.delete(slots).where(eq(slots.id, slot.id));
      else await tx.update(slots).set({ isBlocked: action !== 'unblock', isClubReserved: action === 'reserve', reservationNote: action === 'reserve' ? 'Reserved by ground manager' : null, updatedAt: new Date() }).where(eq(slots.id, slot.id));
      await tx.insert(managerSlotActions).values({ groundId, slotId, actorId: request.auth!.userId, action });
    });
    response.json({ slot_id: slotId, action });
  };
  accept = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const user = (await db.select({ phone: users.phone }).from(users).where(eq(users.id, request.auth!.userId)).limit(1))[0];
    const id = String(request.params.id || '');
    if (!user?.phone) throw new AppError('not_found', 'Assignment was not found', 404);
    const assignment = (await db.update(groundManagers).set({ acceptedAt: new Date() }).where(and(eq(groundManagers.id, id), eq(groundManagers.phone, user.phone), isNull(groundManagers.revokedAt), isNull(groundManagers.acceptedAt))).returning())[0];
    if (!assignment) throw new AppError('not_found', 'Pending assignment was not found', 404);
    response.json({ id: assignment.id, accepted: true });
  };
  mine = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const userId = request.auth!.userId;
    const user = (await db.select({ phone: users.phone, suspended: users.isSuspended }).from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!user?.phone || user.suspended) { response.json({ assignments: [] }); return; }
    const rows = await db.select({ assignment: groundManagers, groundTitle: grounds.title, vendorName: vendors.businessName }).from(groundManagers)
      .innerJoin(grounds, eq(groundManagers.groundId, grounds.id)).innerJoin(vendors, eq(groundManagers.vendorId, vendors.id))
      .where(and(eq(groundManagers.phone, user.phone), isNull(groundManagers.revokedAt), eq(vendors.verificationStatus, 'approved'), eq(vendors.isActive, true)));
    response.json({ assignments: rows.map(({ assignment, groundTitle, vendorName }) => ({ ...managerRow(assignment, groundTitle), vendor_name: vendorName })) });
  };
  list = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const vendor = await owner(request.auth!.userId);
    const rows = await db.select({ assignment: groundManagers, groundTitle: grounds.title }).from(groundManagers).innerJoin(grounds, eq(groundManagers.groundId, grounds.id)).where(eq(groundManagers.vendorId, vendor.id));
    response.json({ managers: rows.map(({ assignment, groundTitle }) => managerRow(assignment, groundTitle)) });
  };
  add = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const vendor = await owner(request.auth!.userId);
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    const groundId = typeof request.body?.ground_id === 'string' ? request.body.ground_id : '';
    if (name.length < 2 || name.length > 100) throw new AppError('invalid_manager', 'Enter a manager name between 2 and 100 characters', 422);
    const phone = normalizePhone(request.body?.phone ?? '');
    const ground = (await db.select({ id: grounds.id, title: grounds.title }).from(grounds).where(and(eq(grounds.id, groundId), eq(grounds.vendorId, vendor.id))).limit(1))[0];
    if (!ground) throw new AppError('not_found', 'Ground was not found', 404);
    const existing = (await db.select().from(groundManagers).where(and(eq(groundManagers.vendorId, vendor.id), eq(groundManagers.groundId, ground.id), eq(groundManagers.phone, phone))).limit(1))[0];
    const assignment = existing
      ? (await db.update(groundManagers).set({ name, revokedAt: null, acceptedAt: null }).where(eq(groundManagers.id, existing.id)).returning())[0]!
      : (await db.insert(groundManagers).values({ vendorId: vendor.id, groundId: ground.id, phone, name }).returning())[0]!;
    response.status(existing ? 200 : 201).json({ manager: managerRow(assignment, ground.title) });
  };
  revoke = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const vendor = await owner(request.auth!.userId);
    const id = String(request.params.id || '');
    const row = (await db.update(groundManagers).set({ revokedAt: new Date() }).where(and(eq(groundManagers.id, id), eq(groundManagers.vendorId, vendor.id), isNull(groundManagers.revokedAt))).returning())[0];
    if (!row) throw new AppError('not_found', 'Active manager assignment was not found', 404);
    response.json({ id: row.id, revoked: true });
  };
}
