import { Response } from 'express';
import { and, arrayContains, asc, desc, eq, gt, ilike, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { bookings, favoriteGrounds, groundBlackoutDates, groundVerificationDocuments, groundVerifications, grounds, recentlyViewedGrounds, slots, slotScheduleTemplates, vendors } from '../database/schema.js';
import { env } from '../configs/env.js';
import { CANCELLATION_POLICIES, cancellationPolicy } from '../services/cancellationPolicy.js';
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

function validatedCancellationPolicy(value: unknown): 'lenient' | 'standard' | 'strict' {
  if (typeof value !== 'string' || !(CANCELLATION_POLICIES as readonly string[]).includes(value.toLowerCase())) {
    throw new AppError('invalid_ground', 'Cancellation policy must be Lenient, Standard, or Strict', 422);
  }
  return cancellationPolicy(value);
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

const groundRelationships = ['owner', 'tenant_lessee', 'manager_operator'] as const;
type GroundRelationship = typeof groundRelationships[number];
function authorityDocument(value: unknown, ownerId: string, relationship: GroundRelationship) {
  const item = value as Record<string, unknown> | null;
  const expectedType = relationship === 'owner' ? 'ownership_control_document' : relationship === 'tenant_lessee' ? 'lease_rental_agreement' : 'authorization_agreement';
  if (!item || item.type !== expectedType || typeof item.storage_key !== 'string' || !item.storage_key.startsWith(`turfbookpk/${ownerId}/ground_authority_document/`) || typeof item.content_type !== 'string' || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(item.content_type)) {
    throw new AppError('invalid_verification_document', 'Upload the required private ownership or operating-authority proof', 422);
  }
  return { type: expectedType, storageKey: item.storage_key, contentType: item.content_type, originalFilename: typeof item.original_filename === 'string' ? item.original_filename.slice(0, 180) : null };
}

function optionalQueryText(value: unknown, name: string, maxLength = 100): string | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new AppError('invalid_search', `${name} must be text`, 422);
  const clean = value.trim();
  if (!clean) return null;
  if (clean.length > maxLength) throw new AppError('invalid_search', `${name} is too long`, 422);
  return clean;
}

function queryInteger(value: unknown, name: string, fallback: number, min: number, max: number): number {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError('invalid_search', `${name} must be a whole number`, 422);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new AppError('invalid_search', `${name} must be between ${min} and ${max}`, 422);
  return parsed;
}

function queryAmenities(value: unknown): string[] {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string') throw new AppError('invalid_search', 'Amenities must be comma-separated text', 422);
  const amenities = [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
  if (amenities.length > 12 || amenities.some((item) => item.length > 60)) throw new AppError('invalid_search', 'Use at most 12 valid amenities', 422);
  return amenities;
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

function operatingHours(value: unknown): { open: string; close: string } {
  if (!value || typeof value !== 'object') throw new AppError('invalid_operating_hours', 'Operating hours must include opening and closing times', 422);
  const record = value as Record<string, unknown>; const open = normalizedTime(record.open); const close = normalizedTime(record.close);
  if (!open || !close || open >= close) throw new AppError('invalid_operating_hours', 'Choose valid opening and closing times', 422);
  return { open, close };
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

function pakistanToday(): string { return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10); }

async function materializeSchedule(ground: typeof grounds.$inferSelect): Promise<void> {
  const templates = await db.select().from(slotScheduleTemplates).where(and(eq(slotScheduleTemplates.groundId, ground.id), eq(slotScheduleTemplates.isActive, true)));
  const blackouts = await db.select({ date: groundBlackoutDates.date }).from(groundBlackoutDates).where(eq(groundBlackoutDates.groundId, ground.id));
  const blackoutDates = new Set(blackouts.map((item) => item.date));
  const end = new Date(`${pakistanToday()}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + env.maxAdvanceBookingDays);
  for (let cursor = new Date(`${pakistanToday()}T00:00:00Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    if (blackoutDates.has(date)) continue;
    for (const template of templates.filter((item) => item.days.includes(cursor.getUTCDay()))) {
      if (hasStarted(date, template.startTime)) continue;
      const existing = await db.select({ id: slots.id }).from(slots).where(and(eq(slots.groundId, ground.id), eq(slots.date, date), eq(slots.startTime, template.startTime), eq(slots.endTime, template.endTime))).limit(1);
      if (!existing[0]) await db.insert(slots).values({ groundId: ground.id, date, startTime: template.startTime, endTime: template.endTime, price: template.price, scheduleTemplateId: template.id });
    }
  }
}

export function toGround(row: typeof grounds.$inferSelect) {
  return { id: row.id, vendor_id: row.vendorId, title: row.title, description: row.description, location: row.location, city: row.city, address: row.address, latitude: row.latitude, longitude: row.longitude, amenities: row.amenities, images: row.images, cover_image: row.coverImage, pitch_type: row.pitchType, price_per_hour: row.pricePerHour, peak_percentage: row.peakPercentage, peak_windows: row.peakWindows.map((window) => ({ days: window.days, start_time: window.startTime, end_time: window.endTime })), is_active: row.isActive, is_verified: row.isVerified, verification_status: row.verificationStatus, verification_reason: row.verificationReason, rating: row.rating, total_reviews: row.totalReviews, operating_hours: row.operatingHours, scheduling_policy: { max_slot_duration_minutes: env.maxSlotDurationMinutes, max_advance_booking_days: env.maxAdvanceBookingDays }, rules: row.rules, cancellation_policy: row.cancellationPolicy, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() };
}

function toSlot(row: typeof slots.$inferSelect, ground?: typeof grounds.$inferSelect) {
  const effective = ground ? effectiveSlotPrice(row.date, row.startTime, row.endTime, { basePrice: row.price, peakPercentage: ground.peakPercentage, peakWindows: ground.peakWindows }) : { amount: row.price, isPeak: false };
  return { id: row.id, ground_id: row.groundId, date: row.date, start_time: row.startTime, end_time: row.endTime, price: effective.amount, base_price: row.price, is_peak: effective.isPeak, is_booked: row.isBooked, is_blocked: row.isBlocked, is_club_reserved: row.isClubReserved, reservation_note: row.reservationNote, is_held: isHeld(row), created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() };
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
  listPublic = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const q = optionalQueryText(request.query.q, 'Search query');
    const city = optionalQueryText(request.query.city, 'City');
    const pitchType = optionalQueryText(request.query.pitch_type, 'Pitch type', 60);
    const amenities = queryAmenities(request.query.amenities);
    const availabilityDate = request.query.availability_date === undefined ? null : normalizedDate(request.query.availability_date);
    if (request.query.availability_date !== undefined && !availabilityDate) throw new AppError('invalid_search', 'Availability date must use YYYY-MM-DD format', 422);
    const maxPrice = queryInteger(request.query.max_price, 'Maximum price', Number.MAX_SAFE_INTEGER, 1, 1_000_000);
    const page = queryInteger(request.query.page, 'Page', 1, 1, 10_000);
    const limit = queryInteger(request.query.limit, 'Limit', 24, 1, 50);
    const sort = request.query.sort === undefined ? 'recommended' : request.query.sort;
    if (!['recommended', 'price_low', 'price_high', 'rating'].includes(String(sort))) throw new AppError('invalid_search', 'Sort must be recommended, price_low, price_high, or rating', 422);

    const filters = [eq(grounds.isActive, true), eq(grounds.isVerified, true), eq(grounds.verificationStatus, 'approved'), eq(vendors.isActive, true), eq(vendors.verificationStatus, 'approved')];
    if (q) {
      const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      filters.push(or(ilike(grounds.title, pattern), ilike(grounds.city, pattern), ilike(grounds.location, pattern), ilike(grounds.address, pattern), ilike(grounds.pitchType, pattern), ilike(sql<string>`array_to_string(${grounds.amenities}, ' ')`, pattern))!);
    }
    if (city) filters.push(ilike(grounds.city, `%${city.replace(/[\\%_]/g, '\\$&')}%`));
    if (pitchType) filters.push(ilike(grounds.pitchType, pitchType));
    if (amenities.length) filters.push(arrayContains(grounds.amenities, amenities));

    const orderBy = sort === 'price_low'
      ? [asc(grounds.pricePerHour), asc(grounds.title), asc(grounds.id)]
      : sort === 'price_high'
        ? [desc(grounds.pricePerHour), asc(grounds.title), asc(grounds.id)]
        : [desc(grounds.rating), asc(grounds.title), asc(grounds.id)];
    const rows = await db.select({ ground: grounds }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(and(...filters)).orderBy(...orderBy);
    await Promise.all(rows.map(({ ground }) => materializeSchedule(ground)));
    if (!availabilityDate) {
      const total = rows.length;
      const start = (page - 1) * limit;
      const pageRows = rows.slice(start, start + limit);
      const allIds = pageRows.map(({ ground }) => ground.id);
      const available = allIds.length ? await db.select().from(slots).where(and(inArray(slots.groundId, allIds), eq(slots.isBooked, false), eq(slots.isBlocked, false))).orderBy(asc(slots.date), asc(slots.startTime)) : [];
      const summaries: Record<string, { available_count: number; next_available_at: string | null }> = {};
      for (const { ground } of pageRows) summaries[ground.id] = { available_count: 0, next_available_at: null };
      for (const slot of available) {
        if (hasStarted(slot.date, slot.startTime) || isHeld(slot)) continue;
        const summary = summaries[slot.groundId];
        if (summary) { summary.available_count++; summary.next_available_at ??= `${slot.date}T${slot.startTime.slice(0, 5)}:00+05:00`; }
      }
      response.json({ grounds: pageRows.map(({ ground }) => toGround(ground)), availability_by_ground: summaries, pagination: { page, limit, total, has_more: start + pageRows.length < total } });
      return;
    }

    const ids = rows.map(({ ground }) => ground.id);
    const matchingSlots = ids.length ? await db.select().from(slots).where(and(inArray(slots.groundId, ids), eq(slots.date, availabilityDate), eq(slots.isBooked, false), eq(slots.isBlocked, false))) : [];
    const slotsByGround = new Map<string, ReturnType<typeof toSlot>[]>();
    for (const slot of matchingSlots) {
      if (isHeld(slot) || hasStarted(slot.date, slot.startTime)) continue;
      const ground = rows.find(({ ground: item }) => item.id === slot.groundId)?.ground;
      if (!ground) continue;
      const value = toSlot(slot, ground);
      if (value.price > maxPrice) continue;
      slotsByGround.set(slot.groundId, [...(slotsByGround.get(slot.groundId) || []), value]);
    }
    let matches = rows.filter(({ ground }) => slotsByGround.has(ground.id));
    if (sort === 'price_low') matches = matches.sort((a, b) => Math.min(...slotsByGround.get(a.ground.id)!.map((slot) => slot.price)) - Math.min(...slotsByGround.get(b.ground.id)!.map((slot) => slot.price)));
    if (sort === 'price_high') matches = matches.sort((a, b) => Math.min(...slotsByGround.get(b.ground.id)!.map((slot) => slot.price)) - Math.min(...slotsByGround.get(a.ground.id)!.map((slot) => slot.price)));
    const total = matches.length;
    const start = (page - 1) * limit;
    const pageRows = matches.slice(start, start + limit);
    response.json({ grounds: pageRows.map(({ ground }) => toGround(ground)), slots_by_ground: Object.fromEntries(pageRows.map(({ ground }) => [ground.id, slotsByGround.get(ground.id) || []])), pagination: { page, limit, total, has_more: start + limit < total } });
  };

  getPublic = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const row = (await db.select({ ground: grounds }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(and(eq(grounds.id, routeParam(request.params.id, 'Ground id')), eq(grounds.isActive, true), eq(grounds.isVerified, true), eq(grounds.verificationStatus, 'approved'), eq(vendors.isActive, true), eq(vendors.verificationStatus, 'approved'))).limit(1))[0];
    if (!row) throw new AppError('not_found', 'Ground was not found', 404);
    await materializeSchedule(row.ground);
    const groundSlots = await db.select().from(slots).where(eq(slots.groundId, row.ground.id));
    response.json({ ground: toGround(row.ground), slots: groundSlots.filter((slot) => !hasStarted(slot.date, slot.startTime)).map((slot) => toSlot(slot, row.ground)) });
  };

  listMine = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendorId = await vendorIdForUser(request.auth.userId);
    const page = queryInteger(request.query.page, 'Page', 1, 1, 10_000);
    const limit = queryInteger(request.query.limit, 'Limit', 50, 1, 100);
    const offset = (page - 1) * limit;
    const all = await db.select().from(grounds).where(eq(grounds.vendorId, vendorId)).orderBy(asc(grounds.title), asc(grounds.id));
    const rows = all.slice(offset, offset + limit);
    response.json({ grounds: rows.map(toGround), pagination: { page, limit, total: all.length, has_more: offset + rows.length < all.length } });
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
    const ownerVendorId = await vendorIdForUser(request.auth.userId);
    const vendor = (await db.select({ verificationStatus: vendors.verificationStatus, isActive: vendors.isActive }).from(vendors).where(eq(vendors.id, ownerVendorId)).limit(1))[0];
    if (!vendor?.isActive || vendor.verificationStatus !== 'approved') throw new AppError('vendor_verification_required', 'Your vendor verification must be approved before adding grounds', 403);
    const row = (await db.insert(grounds).values({
      vendorId: ownerVendorId, title, description: body.description?.trim() || null,
      location, city, address, latitude, longitude,
      amenities: textArray(body.amenities), images: textArray(body.images), coverImage: typeof body.cover_image === 'string' ? body.cover_image.trim() || null : null,
      pitchType: body.pitch_type?.trim() || null, pricePerHour: body.price_per_hour, peakPercentage: configuredPeakPercentage, peakWindows: configuredPeakWindows,
      operatingHours: body.operating_hours === undefined ? { open: '06:00', close: '23:00' } : operatingHours(body.operating_hours),
      rules: textArray(body.rules), cancellationPolicy: body.cancellation_policy === undefined ? 'standard' : validatedCancellationPolicy(body.cancellation_policy),
      isVerified: false, verificationStatus: 'draft', verificationReason: null,
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
    if (body.operating_hours !== undefined) values.operatingHours = operatingHours(body.operating_hours);
    validatePeakConfig(values.peakPercentage === undefined ? current.peakPercentage : values.peakPercentage, values.peakWindows === undefined ? current.peakWindows : values.peakWindows);
    if (body.is_active !== undefined) values.isActive = Boolean(body.is_active);
    if (body.rules !== undefined) values.rules = textArray(body.rules);
    if (body.cancellation_policy !== undefined) values.cancellationPolicy = validatedCancellationPolicy(body.cancellation_policy);
    const row = (await db.update(grounds).set(values).where(eq(grounds.id, current.id)).returning())[0];
    if (!row) throw new AppError('ground_update_failed', 'Ground could not be updated', 500);
    response.json({ ground: toGround(row) });
  };

  remove = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const current = await ownedGround(routeParam(request.params.id, 'Ground id'), request.auth.userId);
    const hasBookingHistory = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.groundId, current.id)).limit(1);
    if (hasBookingHistory[0]) {
      await db.update(grounds).set({ isActive: false, updatedAt: new Date() }).where(eq(grounds.id, current.id));
      response.json({ deleted: false, archived: true, message: 'This ground has booking history, so it was archived to preserve those records.' });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.delete(favoriteGrounds).where(eq(favoriteGrounds.groundId, current.id));
      await tx.delete(recentlyViewedGrounds).where(eq(recentlyViewedGrounds.groundId, current.id));
      await tx.delete(grounds).where(eq(grounds.id, current.id));
    });
    response.json({ deleted: true, archived: false });
  };

  verification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const ground = await ownedGround(routeParam(request.params.id, 'Ground id'), request.auth.userId);
    const verification = (await db.select().from(groundVerifications).where(eq(groundVerifications.groundId, ground.id)).limit(1))[0];
    const documents = verification ? await db.select({ id: groundVerificationDocuments.id, type: groundVerificationDocuments.type, contentType: groundVerificationDocuments.contentType, originalFilename: groundVerificationDocuments.originalFilename }).from(groundVerificationDocuments).where(eq(groundVerificationDocuments.verificationId, verification.id)) : [];
    response.json({ ground: toGround(ground), verification: verification ? { status: verification.status, authority_status: verification.authorityStatus, authority_reason: verification.authorityReason, relationship: verification.relationship, document_expiry_date: verification.documentExpiryDate, documents, submitted_at: verification.submittedAt?.toISOString() || null } : { status: 'draft', authority_status: 'draft', authority_reason: null, relationship: null, document_expiry_date: null, documents: [], submitted_at: null } });
  };

  saveVerification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const ground = await ownedGround(routeParam(request.params.id, 'Ground id'), request.auth.userId);
    const existing = (await db.select().from(groundVerifications).where(eq(groundVerifications.groundId, ground.id)).limit(1))[0] || (await db.insert(groundVerifications).values({ groundId: ground.id }).returning())[0];
    if (!existing) throw new AppError('verification_failed', 'Unable to prepare ground verification', 500);
    if (existing.status === 'approved' || (existing.status === 'under_review' && existing.authorityStatus !== 'changes_requested')) throw new AppError('verification_locked', 'This ground verification is already under review or approved', 409);
    const relationship = request.body?.relationship as GroundRelationship;
    if (!groundRelationships.includes(relationship)) throw new AppError('invalid_verification', 'Choose owner, tenant/lessee, or manager/operator', 422);
    const expiry = request.body?.document_expiry_date === undefined || request.body?.document_expiry_date === '' ? null : normalizedDate(request.body.document_expiry_date);
    if (request.body?.document_expiry_date && !expiry) throw new AppError('invalid_verification', 'Document expiry must use YYYY-MM-DD', 422);
    if (relationship === 'tenant_lessee' && !expiry) throw new AppError('invalid_verification', 'Lease or rental agreement expiry date is required', 422);
    const document = authorityDocument(request.body?.document, request.auth.userId, relationship);
    await db.transaction(async (tx) => {
      await tx.update(groundVerifications).set({ status: 'draft', authorityStatus: 'pending', authorityReason: null, relationship, documentExpiryDate: expiry, updatedAt: new Date() }).where(eq(groundVerifications.id, existing.id));
      await tx.delete(groundVerificationDocuments).where(eq(groundVerificationDocuments.verificationId, existing.id));
      await tx.insert(groundVerificationDocuments).values({ verificationId: existing.id, ...document });
      await tx.update(grounds).set({ verificationStatus: 'draft', verificationReason: null, isVerified: false, updatedAt: new Date() }).where(eq(grounds.id, ground.id));
    });
    response.json({ message: 'Ground authority proof saved', status: 'draft' });
  };

  submitVerification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const ground = await ownedGround(routeParam(request.params.id, 'Ground id'), request.auth.userId);
    if (ground.images.length < 4 || ground.images.length > 8) throw new AppError('verification_incomplete', 'Add between 4 and 8 ground photos before submitting', 422);
    const verification = (await db.select().from(groundVerifications).where(eq(groundVerifications.groundId, ground.id)).limit(1))[0];
    const document = verification ? (await db.select({ id: groundVerificationDocuments.id }).from(groundVerificationDocuments).where(eq(groundVerificationDocuments.verificationId, verification.id)).limit(1))[0] : null;
    if (!verification?.relationship || !document) throw new AppError('verification_incomplete', 'Add your relationship and authority proof before submitting', 422);
    await db.transaction(async (tx) => {
      await tx.update(groundVerifications).set({ status: 'under_review', authorityStatus: 'pending', submittedAt: new Date(), updatedAt: new Date() }).where(eq(groundVerifications.id, verification.id));
      await tx.update(grounds).set({ verificationStatus: 'under_review', verificationReason: null, isVerified: false, updatedAt: new Date() }).where(eq(grounds.id, ground.id));
    });
    response.json({ message: 'Ground submitted for review', status: 'under_review' });
  };

  listSlots = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const ground = (await db.select({ ground: grounds }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(and(eq(grounds.id, routeParam(request.params.id, 'Ground id')), eq(grounds.isActive, true), eq(grounds.isVerified, true), eq(grounds.verificationStatus, 'approved'), eq(vendors.isActive, true), eq(vendors.verificationStatus, 'approved'))).limit(1))[0];
    if (!ground) throw new AppError('not_found', 'Ground was not found', 404);
    await materializeSchedule(ground.ground);
    const page = queryInteger(request.query.page, 'Page', 1, 1, 10_000);
    const limit = queryInteger(request.query.limit, 'Limit', 100, 1, 200);
    const offset = (page - 1) * limit;
    const rows = (await db.select().from(slots).where(eq(slots.groundId, ground.ground.id)).orderBy(asc(slots.date), asc(slots.startTime), asc(slots.id))).filter((slot) => !hasStarted(slot.date, slot.startTime));
    const pageRows = rows.slice(offset, offset + limit);
    response.json({ slots: pageRows.map((slot) => toSlot(slot, ground.ground)), pagination: { page, limit, total: rows.length, has_more: offset + pageRows.length < rows.length } });
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

  saveSchedule = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.id, 'Ground id'); const ground = await ownedGround(groundId, request.auth.userId); const body = request.body || {};
    const open = normalizedTime(body.open_time); const close = normalizedTime(body.close_time);
    const starts: string[] = Array.isArray(body.slot_starts) ? [...new Set((body.slot_starts as unknown[]).map((value) => normalizedTime(value)).filter((value): value is string => Boolean(value)))] : [];
    const days: number[] = Array.isArray(body.days) ? [...new Set((body.days as unknown[]).filter((day): day is number => typeof day === 'number' && Number.isInteger(day)))] : [0, 1, 2, 3, 4, 5, 6]; const duration = typeof body.slot_duration_minutes === 'number' ? body.slot_duration_minutes : 0; const price = typeof body.price === 'number' ? body.price : 0;
    if (!open || !close || open >= close || !starts.length || starts.length > 30 || !Number.isSafeInteger(duration) || duration < 30 || duration > env.maxSlotDurationMinutes || !Number.isSafeInteger(price) || price <= 0 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new AppError('invalid_schedule', 'Choose valid hours, selected slots, days, duration, and price', 422);
    const endFor = (start: string) => `${String(Math.floor((timeMinutes(start) + duration) / 60)).padStart(2, '0')}:${String((timeMinutes(start) + duration) % 60).padStart(2, '0')}`;
    if (starts.some((start) => start < open || endFor(start) > close)) throw new AppError('invalid_schedule', 'Every selected slot must fit inside the working hours', 422);
    const booked = await db.select({ id: slots.id }).from(slots).where(and(eq(slots.groundId, groundId), sql`${slots.scheduleTemplateId} IS NOT NULL`, eq(slots.isBooked, true))).limit(1);
    if (booked[0]) throw new AppError('schedule_has_bookings', 'This schedule already has bookings. Use daily controls for changes until those bookings pass.', 409);
    await db.transaction(async (tx) => {
      await tx.delete(slots).where(and(eq(slots.groundId, groundId), sql`${slots.scheduleTemplateId} IS NOT NULL`, eq(slots.isBooked, false), sql`${slots.holdBookingId} IS NULL`));
      await tx.delete(slotScheduleTemplates).where(eq(slotScheduleTemplates.groundId, groundId));
      await tx.update(grounds).set({ operatingHours: { open, close }, pricePerHour: price, updatedAt: new Date() }).where(eq(grounds.id, groundId));
      await tx.insert(slotScheduleTemplates).values(starts.map((start) => ({ groundId, days, startTime: start, endTime: endFor(start), price })));
    });
    const refreshed = (await db.select().from(grounds).where(eq(grounds.id, groundId)).limit(1))[0]!; await materializeSchedule(refreshed);
    const created = await db.select().from(slots).where(eq(slots.groundId, groundId)); response.status(201).json({ slots: created.filter((slot) => !hasStarted(slot.date, slot.startTime)).map((slot) => toSlot(slot, refreshed)) });
  };

  listBlackouts = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const ground = await ownedGround(routeParam(request.params.id, 'Ground id'), request.auth.userId);
    const rows = await db.select().from(groundBlackoutDates).where(eq(groundBlackoutDates.groundId, ground.id));
    response.json({ blackouts: rows.filter((row) => row.date >= pakistanToday()).sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({ id: row.id, date: row.date, reason: row.reason })) });
  };

  createBlackouts = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.id, 'Ground id'); await ownedGround(groundId, request.auth.userId);
    const dates: string[] = Array.isArray(request.body?.dates) ? [...new Set((request.body.dates as unknown[]).filter((value): value is string => validDate(value) && value >= pakistanToday()))] : [];
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim().slice(0, 160) || null : null;
    if (!dates.length || dates.length > 31) throw new AppError('invalid_blackout_dates', 'Choose between 1 and 31 future dates in YYYY-MM-DD format', 422);
    const protectedSlots = await db.select({ date: slots.date }).from(slots).where(and(eq(slots.groundId, groundId), inArray(slots.date, dates), or(eq(slots.isBooked, true), sql`${slots.holdBookingId} IS NOT NULL`))).limit(1);
    if (protectedSlots[0]) throw new AppError('blackout_has_bookings', `Cannot close ${protectedSlots[0].date} because it has a booking or payment in progress`, 409);
    await db.transaction(async (tx) => {
      for (const date of dates) {
        const existing = await tx.select({ id: groundBlackoutDates.id }).from(groundBlackoutDates).where(and(eq(groundBlackoutDates.groundId, groundId), eq(groundBlackoutDates.date, date))).limit(1);
        if (!existing[0]) await tx.insert(groundBlackoutDates).values({ groundId, date, reason });
      }
      await tx.update(slots).set({ isBlocked: true, updatedAt: new Date() }).where(and(eq(slots.groundId, groundId), inArray(slots.date, dates), eq(slots.isBooked, false)));
    });
    response.status(201).json({ dates });
  };

  removeBlackout = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.id, 'Ground id'); await ownedGround(groundId, request.auth.userId);
    const date = routeParam(request.params.date, 'Blackout date'); if (!validDate(date)) throw new AppError('invalid_blackout_date', 'Date must use YYYY-MM-DD format', 422);
    await db.delete(groundBlackoutDates).where(and(eq(groundBlackoutDates.groundId, groundId), eq(groundBlackoutDates.date, date)));
    await db.update(slots).set({ isBlocked: false, updatedAt: new Date() }).where(and(eq(slots.groundId, groundId), eq(slots.date, date), eq(slots.isBooked, false), eq(slots.isClubReserved, false)));
    response.status(204).send();
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
    if (body.is_club_reserved !== undefined) { values.isClubReserved = Boolean(body.is_club_reserved); values.isBlocked = Boolean(body.is_club_reserved) || values.isBlocked === true; values.reservationNote = values.isClubReserved && typeof body.reservation_note === 'string' ? body.reservation_note.trim().slice(0, 160) || null : null; }
    const row = (await db.update(slots).set(values).where(eq(slots.id, current.id)).returning())[0];
    if (!row) throw new AppError('slot_update_failed', 'Slot could not be updated', 500);
    response.json({ slot: toSlot(row) });
  };

  bulkUpdateSlots = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.id, 'Ground id'); await ownedGround(groundId, request.auth.userId);
    const rawSlotIds: unknown[] = Array.isArray(request.body?.slot_ids) ? request.body.slot_ids : [];
    const slotIds = [...new Set(rawSlotIds.filter((value): value is string => typeof value === 'string'))];
    const action = request.body?.action;
    if (!slotIds.length || slotIds.length > 100 || !['block', 'unblock', 'delete'].includes(action)) throw new AppError('invalid_bulk_slots', 'Select 1 to 100 slots and a valid bulk action', 422);
    const selected = await db.select().from(slots).where(and(eq(slots.groundId, groundId), inArray(slots.id, slotIds)));
    if (selected.length !== slotIds.length) throw new AppError('not_found', 'One or more slots were not found', 404);
    if (selected.some((slot) => slot.isBooked || isHeld(slot))) throw new AppError('slot_unavailable', 'Booked or payment-held slots cannot be changed', 409);
    if (action === 'delete') await db.delete(slots).where(and(eq(slots.groundId, groundId), inArray(slots.id, slotIds)));
    else await db.update(slots).set({ isBlocked: action === 'block', updatedAt: new Date() }).where(and(eq(slots.groundId, groundId), inArray(slots.id, slotIds)));
    response.json({ changed: slotIds.length });
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
