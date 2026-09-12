import { Response } from 'express';
import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { grounds, slots, vendors } from '../database/schema.js';
import { env } from '../configs/env.js';
import { PeakWindow, effectiveSlotPrice } from '../services/peakPricing.js';

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()) : [];
}

function routeParam(value: string | string[] | undefined, name: string): string {
  if (typeof value !== 'string' || !value) throw new AppError('invalid_request', `${name} is required`, 422);
  return value;
}

function requiredText(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError('invalid_ground', `${name} is required`, 422);
  return value.trim();
}

function coordinate(value: unknown, name: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new AppError('invalid_ground', `${name} must be between ${min} and ${max}`, 422);
  }
  return value;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function normalizedTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  if (!match || Number(match[1]) > 23) return null;
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

function normalizedDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return validDate(clean) ? clean : null;
}

function peakWindows(value: unknown): PeakWindow[] {
  if (!Array.isArray(value)) throw new AppError('invalid_peak_windows', 'Peak windows must be a list', 422);
  if (value.length > 12) throw new AppError('invalid_peak_windows', 'You can configure at most 12 peak windows', 422);
  return value.map((window) => {
    if (!window || typeof window !== 'object') throw new AppError('invalid_peak_windows', 'Each peak window must include days and times', 422);
    const record = window as Record<string, unknown>;
    const days = Array.isArray(record.days) ? [...new Set(record.days)] : [];
    const startTime = normalizedTime(record.start_time ?? record.startTime);
    const endTime = normalizedTime(record.end_time ?? record.endTime);
    if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || !startTime || !endTime || startTime >= endTime) {
      throw new AppError('invalid_peak_windows', 'Each peak window needs days (0-6) and valid start/end times', 422);
    }
    return { days: days as number[], startTime, endTime };
  });
}

function validatePeakConfig(peakPercentage: number | null, windows: PeakWindow[]): void {
  if ((peakPercentage === null) !== (windows.length === 0)) {
    throw new AppError('invalid_peak_pricing', 'Set both a peak percentage and at least one peak window, or clear both', 422);
  }
}

function hasStarted(date: string, time: string): boolean {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+05:00`).getTime() <= Date.now();
}

function timeMinutes(value: string): number { return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)); }
function enforceSlotPolicy(ground: typeof grounds.$inferSelect, date: string, startTime: string, endTime: string): void {
  if (timeMinutes(endTime) - timeMinutes(startTime) > env.maxSlotDurationMinutes) throw new AppError('slot_duration_exceeded', `Slots may be at most ${env.maxSlotDurationMinutes} minutes`, 422);
  if (timeMinutes(startTime) < timeMinutes(ground.operatingHours.open) || timeMinutes(endTime) > timeMinutes(ground.operatingHours.close)) throw new AppError('outside_operating_hours', `Slots must be within ${ground.operatingHours.open}–${ground.operatingHours.close}`, 422);
  const maxDate = new Date(Date.now() + env.maxAdvanceBookingDays * 86_400_000).toISOString().slice(0, 10);
  if (date > maxDate) throw new AppError('advance_booking_window_exceeded', `Slots may be created up to ${env.maxAdvanceBookingDays} days in advance`, 422);
}

function isHeld(row: typeof slots.$inferSelect): boolean {
  return Boolean(row.holdBookingId && row.holdExpiresAt && row.holdExpiresAt > new Date());
}

function toGround(row: typeof grounds.$inferSelect) {
  return { id: row.id, vendor_id: row.vendorId, title: row.title, description: row.description, location: row.location, city: row.city, address: row.address, latitude: row.latitude, longitude: row.longitude, amenities: row.amenities, images: row.images, cover_image: row.coverImage, pitch_type: row.pitchType, price_per_hour: row.pricePerHour, peak_percentage: row.peakPercentage, peak_windows: row.peakWindows.map((window) => ({ days: window.days, start_time: window.startTime, end_time: window.endTime })), is_active: row.isActive, is_verified: row.isVerified, rating: row.rating, total_reviews: row.totalReviews, operating_hours: row.operatingHours, scheduling_policy: { max_slot_duration_minutes: env.maxSlotDurationMinutes, max_advance_booking_days: env.maxAdvanceBookingDays }, rules: row.rules, cancellation_policy: row.cancellationPolicy, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() };
}

function toSlot(row: typeof slots.$inferSelect, ground?: typeof grounds.$inferSelect) {
  const effective = ground ? effectiveSlotPrice(row.date, row.startTime, row.endTime, { basePrice: row.price, peakPercentage: ground.peakPercentage, peakWindows: ground.peakWindows }) : { amount: row.price, isPeak: false };
  return { id: row.id, ground_id: row.groundId, date: row.date, start_time: row.startTime, end_time: row.endTime, price: effective.amount, base_price: row.price, is_peak: effective.isPeak, is_booked: row.isBooked, is_blocked: row.isBlocked, is_held: isHeld(row), created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() };
}

async function vendorIdForUser(userId: string): Promise<string> {
  const rows = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.userId, userId)).limit(1);
  if (!rows[0]) throw new AppError('vendor_required', 'A vendor profile is required', 403);
  return rows[0].id;
}

async function ownedGround(groundId: string, userId: string) {
  const vendorId = await vendorIdForUser(userId);
  const rows = await db.select().from(grounds).where(and(eq(grounds.id, groundId), eq(grounds.vendorId, vendorId))).limit(1);
  if (!rows[0]) throw new AppError('not_found', 'Ground was not found', 404);
  return rows[0];
}

export class GroundController {
  listPublic = async (_request: AuthenticatedRequest, response: Response): Promise<void> => {
    const rows = await db.select({ ground: grounds }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(and(eq(grounds.isActive, true), eq(vendors.isActive, true)));
    response.json({ grounds: rows.map(({ ground }) => toGround(ground)) });
  };

  getPublic = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const row = (await db.select({ ground: grounds }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(and(eq(grounds.id, routeParam(request.params.id, 'Ground id')), eq(grounds.isActive, true), eq(vendors.isActive, true))).limit(1))[0];
    if (!row) throw new AppError('not_found', 'Ground was not found', 404);
    const groundSlots = await db.select().from(slots).where(eq(slots.groundId, row.ground.id));
    response.json({ ground: toGround(row.ground), slots: groundSlots.filter((slot) => !hasStarted(slot.date, slot.startTime)).map((slot) => toSlot(slot, row.ground)) });
  };

  listMine = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendorId = await vendorIdForUser(request.auth.userId);
    const rows = await db.select().from(grounds).where(eq(grounds.vendorId, vendorId));
    response.json({ grounds: rows.map(toGround) });
  };

  create = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const body = request.body || {};
    const title = requiredText(body.title, 'Title');
    const location = requiredText(body.location, 'Location');
    const city = requiredText(body.city, 'City');
    const address = requiredText(body.address, 'Address');
    if (!Number.isInteger(body.price_per_hour) || body.price_per_hour <= 0) throw new AppError('invalid_ground', 'Price per hour must be a positive whole number', 422);
    if (body.peak_percentage !== undefined && body.peak_percentage !== null && (!Number.isInteger(body.peak_percentage) || body.peak_percentage < 1 || body.peak_percentage > 500)) throw new AppError('invalid_ground', 'Peak percentage must be a whole number between 1 and 500', 422);
    const configuredPeakWindows = body.peak_windows === undefined ? [] : peakWindows(body.peak_windows);
    const configuredPeakPercentage = Number.isInteger(body.peak_percentage) ? body.peak_percentage : null;
    validatePeakConfig(configuredPeakPercentage, configuredPeakWindows);
    const latitude = coordinate(body.latitude, 'Latitude', -90, 90);
    const longitude = coordinate(body.longitude, 'Longitude', -180, 180);
    const row = (await db.insert(grounds).values({
      vendorId: await vendorIdForUser(request.auth.userId), title, description: body.description?.trim() || null,
      location, city, address, latitude, longitude,
      amenities: textArray(body.amenities), images: textArray(body.images), coverImage: typeof body.cover_image === 'string' ? body.cover_image.trim() || null : null,
      pitchType: body.pitch_type?.trim() || null, pricePerHour: body.price_per_hour, peakPercentage: configuredPeakPercentage, peakWindows: configuredPeakWindows,
      rules: textArray(body.rules), cancellationPolicy: body.cancellation_policy?.trim() || null,
    }).returning())[0];
    if (!row) throw new AppError('ground_creation_failed', 'Ground could not be created', 500);
    response.status(201).json({ ground: toGround(row) });
  };

  update = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const current = await ownedGround(routeParam(request.params.id, 'Ground id'), request.auth.userId);
    const body = request.body || {};
    const values: Partial<typeof grounds.$inferInsert> = { updatedAt: new Date() };
    if (body.title !== undefined) values.title = requiredText(body.title, 'Title');
    if (body.description !== undefined) values.description = body.description?.trim() || null;
    if (body.location !== undefined) values.location = requiredText(body.location, 'Location');
    if (body.city !== undefined) values.city = requiredText(body.city, 'City');
    if (body.address !== undefined) values.address = requiredText(body.address, 'Address');
    if (body.latitude !== undefined) values.latitude = coordinate(body.latitude, 'Latitude', -90, 90);
    if (body.longitude !== undefined) values.longitude = coordinate(body.longitude, 'Longitude', -180, 180);
    if (body.amenities !== undefined) values.amenities = textArray(body.amenities);
    if (body.images !== undefined) values.images = textArray(body.images);
    if (body.cover_image !== undefined) values.coverImage = body.cover_image?.trim() || null;
    if (body.pitch_type !== undefined) values.pitchType = body.pitch_type?.trim() || null;
    if (body.price_per_hour !== undefined) {
      if (!Number.isInteger(body.price_per_hour) || body.price_per_hour <= 0) throw new AppError('invalid_ground', 'Price per hour must be a positive whole number', 422);
      values.pricePerHour = body.price_per_hour;
    }
    if (body.peak_percentage !== undefined) {
      if (body.peak_percentage !== null && (!Number.isInteger(body.peak_percentage) || body.peak_percentage < 1 || body.peak_percentage > 500)) throw new AppError('invalid_ground', 'Peak percentage must be a whole number between 1 and 500', 422);
      values.peakPercentage = body.peak_percentage;
    }
    if (body.peak_windows !== undefined) values.peakWindows = peakWindows(body.peak_windows);
    validatePeakConfig(values.peakPercentage === undefined ? current.peakPercentage : values.peakPercentage, values.peakWindows === undefined ? current.peakWindows : values.peakWindows);
    if (body.is_active !== undefined) values.isActive = Boolean(body.is_active);
    if (body.rules !== undefined) values.rules = textArray(body.rules);
    if (body.cancellation_policy !== undefined) values.cancellationPolicy = body.cancellation_policy?.trim() || null;
    const row = (await db.update(grounds).set(values).where(eq(grounds.id, current.id)).returning())[0];
    if (!row) throw new AppError('ground_update_failed', 'Ground could not be updated', 500);
    response.json({ ground: toGround(row) });
  };

  remove = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const current = await ownedGround(routeParam(request.params.id, 'Ground id'), request.auth.userId);
    await db.update(grounds).set({ isActive: false, updatedAt: new Date() }).where(eq(grounds.id, current.id));
    response.status(204).send();
  };

  listSlots = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const ground = (await db.select({ ground: grounds }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(and(eq(grounds.id, routeParam(request.params.id, 'Ground id')), eq(grounds.isActive, true), eq(vendors.isActive, true))).limit(1))[0];
    if (!ground) throw new AppError('not_found', 'Ground was not found', 404);
    const rows = await db.select().from(slots).where(eq(slots.groundId, ground.ground.id));
    response.json({ slots: rows.filter((slot) => !hasStarted(slot.date, slot.startTime)).map((slot) => toSlot(slot, ground.ground)) });
  };

  createSlot = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.id, 'Ground id');
    const ground = await ownedGround(groundId, request.auth.userId);
    const body = request.body || {};
    const date = normalizedDate(body.date);
    const start_time = normalizedTime(body.start_time);
    const end_time = normalizedTime(body.end_time);
    const price = body.price;
    if (!date || !start_time || !end_time || !Number.isSafeInteger(price) || price <= 0) throw new AppError('invalid_slot', 'Use a valid date, 24-hour times, and a positive whole-number price', 422);
    if (start_time >= end_time) throw new AppError('invalid_slot', 'End time must be later than start time', 422);
    if (hasStarted(date, start_time)) throw new AppError('slot_expired', 'Slots must start in the future', 422);
    enforceSlotPolicy(ground, date, start_time, end_time);
    const conflict = await db.select({ id: slots.id }).from(slots).where(and(
      eq(slots.groundId, groundId),
      eq(slots.date, date),
      lt(slots.startTime, end_time),
      gt(slots.endTime, start_time),
    )).limit(1);
    if (conflict[0]) throw new AppError('slot_conflict', 'This slot overlaps an existing slot', 409);
    const row = (await db.insert(slots).values({ groundId, date, startTime: start_time, endTime: end_time, price }).returning())[0];
    if (!row) throw new AppError('slot_creation_failed', 'Slot could not be created', 500);
    response.status(201).json({ slot: toSlot(row) });
  };

  createRecurringSlots = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.id, 'Ground id');
    const ground = await ownedGround(groundId, request.auth.userId);
    const body = request.body || {};
    const date = normalizedDate(body.start_date);
    const startTime = normalizedTime(body.start_time);
    const endTime = normalizedTime(body.end_time);
    const price = body.price;
    const intervalDays = body.interval_days;
    const occurrences = body.occurrences;
    if (!date || !startTime || !endTime || !Number.isSafeInteger(price) || price <= 0 || !Number.isSafeInteger(intervalDays) || intervalDays < 1 || !Number.isSafeInteger(occurrences) || occurrences < 1 || occurrences > 60) {
      throw new AppError('invalid_recurring_slots', 'Provide valid slot details, an interval of at least one day, and 1 to 60 occurrences', 422);
    }
    if (startTime >= endTime) throw new AppError('invalid_slot', 'End time must be later than start time', 422);
    const recurringDates = Array.from({ length: occurrences }, (_, index) => {
      const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + index * intervalDays); return next.toISOString().slice(0, 10);
    });
    if (recurringDates.some((slotDate) => hasStarted(slotDate, startTime))) throw new AppError('slot_expired', 'All recurring slots must start in the future', 422);
    recurringDates.forEach((slotDate) => enforceSlotPolicy(ground, slotDate, startTime, endTime));
    const created = await db.transaction(async (tx) => {
      const result = [];
      for (const slotDate of recurringDates) {
        const conflict = await tx.select({ id: slots.id }).from(slots).where(and(eq(slots.groundId, groundId), eq(slots.date, slotDate), lt(slots.startTime, endTime), gt(slots.endTime, startTime))).limit(1);
        if (conflict[0]) throw new AppError('slot_conflict', `A slot already overlaps ${slotDate}`, 409);
        const [row] = await tx.insert(slots).values({ groundId, date: slotDate, startTime, endTime, price }).returning();
        if (!row) throw new AppError('slot_creation_failed', 'Unable to create recurring slots', 500);
        result.push(toSlot(row));
      }
      return result;
    });
    response.status(201).json({ slots: created });
  };

  updateSlot = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.groundId, 'Ground id');
    const slotId = routeParam(request.params.slotId, 'Slot id');
    const ground = await ownedGround(groundId, request.auth.userId);
    const current = (await db.select().from(slots).where(and(eq(slots.id, slotId), eq(slots.groundId, groundId))).limit(1))[0];
    if (!current) throw new AppError('not_found', 'Slot was not found', 404);
    if (current.isBooked || isHeld(current)) throw new AppError('slot_unavailable', 'Booked or payment-held slots cannot be changed', 409);
    const body = request.body || {};
    const values: Partial<typeof slots.$inferInsert> = { updatedAt: new Date() };
    if (body.date !== undefined && !validDate(body.date)) throw new AppError('invalid_slot', 'Date must use YYYY-MM-DD format', 422);
    if (body.start_time !== undefined && !validTime(body.start_time)) throw new AppError('invalid_slot', 'Start time must use HH:MM format', 422);
    if (body.end_time !== undefined && !validTime(body.end_time)) throw new AppError('invalid_slot', 'End time must use HH:MM format', 422);
    const nextDate = body.date ?? current.date;
    const nextStart = body.start_time ?? current.startTime;
    const nextEnd = body.end_time ?? current.endTime;
    if (nextStart >= nextEnd) throw new AppError('invalid_slot', 'End time must be later than start time', 422);
    if (hasStarted(nextDate, nextStart)) throw new AppError('slot_expired', 'Slots must start in the future', 422);
    enforceSlotPolicy(ground, nextDate, nextStart, nextEnd);
    const conflict = await db.select({ id: slots.id }).from(slots).where(and(
      eq(slots.groundId, groundId),
      eq(slots.date, nextDate),
      lt(slots.startTime, nextEnd),
      gt(slots.endTime, nextStart),
      ne(slots.id, current.id),
    )).limit(1);
    if (conflict[0]) throw new AppError('slot_conflict', 'This slot overlaps an existing slot', 409);
    if (body.date !== undefined) values.date = body.date;
    if (body.start_time !== undefined) values.startTime = body.start_time;
    if (body.end_time !== undefined) values.endTime = body.end_time;
    if (body.price !== undefined) {
      if (!Number.isInteger(body.price) || body.price <= 0) throw new AppError('invalid_slot', 'Price must be a positive whole number', 422);
      values.price = body.price;
    }
    if (body.is_blocked !== undefined) values.isBlocked = Boolean(body.is_blocked);
    const row = (await db.update(slots).set(values).where(eq(slots.id, current.id)).returning())[0];
    if (!row) throw new AppError('slot_update_failed', 'Slot could not be updated', 500);
    response.json({ slot: toSlot(row) });
  };

  removeSlot = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.groundId, 'Ground id');
    const slotId = routeParam(request.params.slotId, 'Slot id');
    await ownedGround(groundId, request.auth.userId);
    const current = (await db.select().from(slots).where(and(eq(slots.id, slotId), eq(slots.groundId, groundId))).limit(1))[0];
    if (!current) throw new AppError('not_found', 'Slot was not found', 404);
    if (current.isBooked || isHeld(current)) throw new AppError('slot_unavailable', 'Booked or payment-held slots cannot be removed', 409);
    await db.delete(slots).where(eq(slots.id, current.id));
    response.status(204).send();
  };
}
