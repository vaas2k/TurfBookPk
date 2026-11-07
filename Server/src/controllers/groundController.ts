import { Response } from 'express';
import { and, arrayContains, asc, count, desc, eq, gte, gt, ilike, inArray, lt, lte, ne, or, sql } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { bookings, favoriteGrounds, groundBlackoutDates, groundVerificationDocuments, groundVerifications, grounds, pitchComponents, pitches, publicGroundCatalogRevision, recentlyViewedGrounds, slots, slotScheduleTemplates, vendors } from '../database/schema.js';
import { env } from '../configs/env.js';
import { CANCELLATION_POLICIES, cancellationPolicy } from '../services/cancellationPolicy.js';
import { PeakWindow, effectiveSlotPrice } from '../services/peakPricing.js';
import { materializeSchedules } from '../services/scheduleMaterialization.js';
import { cachedPublicDiscovery, cachedPublicGround, publicGroundEtag } from '../services/publicGroundCache.js';
import { periodsConflict, validTurnaround } from '../services/slotTurnaround.js';
import { occupiedByAnotherSlot, resourceConflictSql } from '../services/pitchAvailability.js';
import { isInsideBookingCutoff } from '../services/bookingCutoff.js';
import { resolveMapLink } from '../services/mapLinkResolver.js';

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
    const endNextDay = record.end_next_day === true || record.endNextDay === true;
    const validRange = startTime && endTime && (endNextDay ? endTime <= startTime : startTime < endTime);
    if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || !validRange) {
      throw new AppError('invalid_peak_windows', 'Choose valid peak days and whether the ending time is on the same or next day', 422);
    }
    return { days: days as number[], startTime: startTime!, endTime: endTime!, endNextDay };
  });
}

function validatePeakConfig(peakPercentage: number | null, windows: PeakWindow[]): void {
  if ((peakPercentage === null) !== (windows.length === 0)) {
    throw new AppError('invalid_peak_pricing', 'Set both a peak percentage and at least one peak window, or clear both', 422);
  }
}

function operatingHours(value: unknown): { open: string; close: string; closeNextDay: boolean } {
  if (!value || typeof value !== 'object') throw new AppError('invalid_operating_hours', 'Operating hours must include opening and closing times', 422);
  const record = value as Record<string, unknown>; const open = normalizedTime(record.open); const close = normalizedTime(record.close);
  const closeNextDay = record.close_next_day === true || record.closeNextDay === true;
  if (!open || !close || (!closeNextDay && timeMinutes(close) <= timeMinutes(open))) throw new AppError('invalid_operating_hours', 'Closing time must be after opening time, or select closes next day', 422);
  return { open, close, closeNextDay };
}

function hasStarted(date: string, time: string): boolean {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+05:00`).getTime() <= Date.now();
}

function timeMinutes(value: string): number { return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)); }
function closesNextDay(hours: { open: string; close: string; closeNextDay?: boolean }): boolean { return hours.closeNextDay ?? hours.close <= hours.open; }
function addCalendarDays(value: string, days: number): string { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function conflictingSlot(pitchId: string, date: string, startTime: string, endTime: string, turnaroundMinutes: number, excludeId?: string, endDate = date) {
  return db.select({ id: slots.id }).from(slots).where(and(
    eq(slots.pitchId, pitchId),
    sql`tsrange(${slots.date} + ${slots.startTime}, ${slots.endDate} + ${slots.endTime} + greatest(${slots.turnaroundMinutes}, ${turnaroundMinutes}) * interval '1 minute', '[)') && tsrange(${date}::date + ${startTime}::time, ${endDate}::date + ${endTime}::time + ${turnaroundMinutes} * interval '1 minute', '[)')`,
    excludeId ? ne(slots.id, excludeId) : undefined,
  )).limit(1);
}
function enforceSlotPolicy(ground: typeof grounds.$inferSelect, date: string, startTime: string, endTime: string): void {
  const duration = timeMinutes(endTime) - timeMinutes(startTime) + (endTime <= startTime ? 1440 : 0);
  if (duration <= 0 || duration > env.maxSlotDurationMinutes) throw new AppError('slot_duration_exceeded', `Slots may be at most ${env.maxSlotDurationMinutes} minutes`, 422);
  const opens = timeMinutes(ground.operatingHours.open); const closes = timeMinutes(ground.operatingHours.close) + (closesNextDay(ground.operatingHours) ? 1440 : 0);
  const actualStart = timeMinutes(startTime) + (timeMinutes(startTime) < opens ? 1440 : 0);
  const insideHours = actualStart >= opens && actualStart + duration <= closes;
  if (!insideHours) throw new AppError('outside_operating_hours', `Slots must be within ${ground.operatingHours.open}–${ground.operatingHours.close}${closesNextDay(ground.operatingHours) ? ' next day' : ''}`, 422);
  const maxDate = new Date(Date.now() + env.maxAdvanceBookingDays * 86_400_000).toISOString().slice(0, 10);
  if (date > maxDate) throw new AppError('advance_booking_window_exceeded', `Slots may be created up to ${env.maxAdvanceBookingDays} days in advance`, 422);
}

function isHeld(row: typeof slots.$inferSelect): boolean {
  return Boolean(row.holdBookingId && row.holdExpiresAt && row.holdExpiresAt > new Date());
}

function pakistanToday(): string { return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10); }

export function toGround(row: typeof grounds.$inferSelect) {
  return { id: row.id, vendor_id: row.vendorId, title: row.title, description: row.description, location: row.location, city: row.city, address: row.address, latitude: row.latitude, longitude: row.longitude, amenities: row.amenities, images: row.images, cover_image: row.coverImage, pitch_type: row.pitchType, price_per_hour: row.pricePerHour, peak_percentage: row.peakPercentage, peak_windows: row.peakWindows.map((window) => ({ days: window.days, start_time: window.startTime, end_time: window.endTime, end_next_day: window.endNextDay === true })), is_active: row.isActive, is_verified: row.isVerified, verification_status: row.verificationStatus, verification_reason: row.verificationReason, rating: row.rating, total_reviews: row.totalReviews, operating_hours: { open: row.operatingHours.open, close: row.operatingHours.close, close_next_day: closesNextDay(row.operatingHours) }, turnaround_minutes: row.turnaroundMinutes, scheduling_policy: { max_slot_duration_minutes: env.maxSlotDurationMinutes, max_advance_booking_days: env.maxAdvanceBookingDays }, rules: row.rules, cancellation_policy: row.cancellationPolicy, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() };
}

function toSlot(row: typeof slots.$inferSelect, ground?: typeof grounds.$inferSelect) {
  const effective = ground ? effectiveSlotPrice(row.date, row.startTime, row.endTime, { basePrice: row.price, peakPercentage: ground.peakPercentage, peakWindows: ground.peakWindows }) : { amount: row.price, isPeak: false };
  return { id: row.id, ground_id: row.groundId, pitch_id: row.pitchId, date: row.date, end_date: row.endDate || row.date, start_time: row.startTime, end_time: row.endTime, turnaround_minutes: row.turnaroundMinutes, price: effective.amount, base_price: row.price, is_peak: effective.isPeak, is_booked: row.isBooked, is_blocked: row.isBlocked, is_club_reserved: row.isClubReserved, reservation_note: row.reservationNote, is_held: isHeld(row), created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() };
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

async function selectedPitch(groundId: string, requested: unknown): Promise<string> {
  const rows = await db.select({ id: pitches.id }).from(pitches).where(and(eq(pitches.groundId, groundId), eq(pitches.isActive, true))).orderBy(asc(pitches.createdAt));
  const id = typeof requested === 'string' && requested ? requested : rows.length === 1 ? rows[0]!.id : '';
  if (!rows.some((row) => row.id === id)) throw new AppError('pitch_required', 'Choose a pitch before adding booking times', 422);
  return id;
}

export class GroundController {
  resolveLocation = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const link = typeof request.body?.link === 'string' ? request.body.link.trim() : '';
    if (!link || link.length > 2_048) throw new AppError('invalid_map_link', 'Paste a valid Google Maps or Apple Maps link', 422);
    try {
      const resolved = await resolveMapLink(link);
      if (!resolved) throw new AppError('map_pin_not_found', 'We could not find a pin in this link. In Maps, drop a pin on the ground and copy its Share link.', 422);
      response.json({ latitude: resolved.latitude, longitude: resolved.longitude, maps_url: resolved.mapsUrl });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const code = error instanceof Error ? error.message : '';
      if (code === 'unsupported_map_link') throw new AppError('unsupported_map_link', 'Use a Google Maps or Apple Maps Share link', 422);
      throw new AppError('map_link_unavailable', 'The map link could not be opened right now. Try again or use current location.', 502);
    }
  };
  vendorSlots = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const groundId = routeParam(request.params.id, 'Ground id');
    const ground = await ownedGround(groundId, request.auth!.userId);
    const fromDate = typeof request.query.from_date === 'string' ? request.query.from_date : pakistanToday();
    const toDate = typeof request.query.to_date === 'string' ? request.query.to_date : addCalendarDays(fromDate, 31);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || toDate < fromDate || toDate > addCalendarDays(fromDate, 62)) throw new AppError('invalid_date_range', 'Choose a date range of up to 62 days', 422);
    const rows = await db.select().from(slots).where(and(eq(slots.groundId, groundId), gte(slots.date, fromDate), lte(slots.date, toDate))).orderBy(asc(slots.date), asc(slots.startTime));
    const busy = await occupiedByAnotherSlot(rows.map((slot) => slot.id));
    response.setHeader('Cache-Control', 'no-store');
    response.json({ slots: rows.map((slot) => ({ ...toSlot(slot, ground), resource_unavailable: busy.has(slot.id), is_held: isHeld(slot) || busy.has(slot.id) })) });
  };
  listPitches = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const groundId = routeParam(request.params.id, 'Ground id');
    await ownedGround(groundId, request.auth!.userId);
    const rows = await db.select().from(pitches).where(eq(pitches.groundId, groundId)).orderBy(asc(pitches.createdAt), asc(pitches.id));
    const components = rows.length ? await db.select().from(pitchComponents).where(inArray(pitchComponents.pitchId, rows.map((row) => row.id))) : [];
    response.json({ pitches: rows.map((row) => ({ id: row.id, ground_id: row.groundId, name: row.name, side: row.side, kind: row.kind, is_active: row.isActive, component_pitch_ids: components.filter((item) => item.pitchId === row.id).map((item) => item.componentPitchId) })) });
  };

  createPitch = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const groundId = routeParam(request.params.id, 'Ground id');
    await ownedGround(groundId, request.auth!.userId);
    const name = requiredText(request.body?.name, 'Pitch name');
    const side = request.body?.side;
    const kind = request.body?.kind === 'combined' ? 'combined' : 'independent';
    const componentIds: string[] = Array.isArray(request.body?.component_pitch_ids) ? [...new Set((request.body.component_pitch_ids as unknown[]).filter((id): id is string => typeof id === 'string'))] : [];
    if (name.length > 80 || ![7, 9, 11].includes(side) || (kind === 'combined' && (![9, 11].includes(side) || componentIds.length !== 2)) || (kind === 'independent' && componentIds.length)) {
      throw new AppError('invalid_pitch', 'Choose a 7 a-side, 9 a-side, or 11 a-side pitch and exactly two 7 a-side source pitches when combining', 422);
    }
    const pitch = await db.transaction(async (tx) => {
      const existing = await tx.select().from(pitches).where(eq(pitches.groundId, groundId));
      if (existing.length >= 12) throw new AppError('pitch_limit', 'A ground can have up to 12 pitch options', 422);
      if (kind === 'combined' && componentIds.some((id) => !existing.some((row) => row.id === id && row.side === 7 && row.kind === 'independent' && row.isActive))) {
        throw new AppError('invalid_pitch_components', 'Select two active 7 a-side pitches in this ground', 422);
      }
      const [created] = await tx.insert(pitches).values({ groundId, name, side, kind }).returning();
      if (kind === 'combined') await tx.insert(pitchComponents).values(componentIds.map((id) => ({ pitchId: created!.id, componentPitchId: id })));
      return created!;
    });
    response.status(201).json({ pitch: { id: pitch.id, ground_id: groundId, name, side, kind, is_active: true, component_pitch_ids: componentIds } });
  };

  updatePitch = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const groundId = routeParam(request.params.id, 'Ground id');
    await ownedGround(groundId, request.auth!.userId);
    const id = routeParam(request.params.pitchId, 'Pitch id');
    const current = (await db.select().from(pitches).where(and(eq(pitches.id, id), eq(pitches.groundId, groundId))).limit(1))[0];
    if (!current) throw new AppError('pitch_not_found', 'Pitch was not found', 404);
    const name = request.body?.name === undefined ? current.name : requiredText(request.body.name, 'Pitch name');
    const side = request.body?.side === undefined ? current.side : request.body.side;
    const isActive = request.body?.is_active === undefined ? current.isActive : request.body.is_active;
    if (name.length > 80 || !(side === current.side || [7, 9, 11].includes(side)) || typeof isActive !== 'boolean' || (current.kind === 'combined' && side === 7)) throw new AppError('invalid_pitch', 'Use a valid pitch name, size and availability', 422);
    const hasSlots = (await db.select({ id: slots.id }).from(slots).where(eq(slots.pitchId, id)).limit(1)).length > 0;
    if (hasSlots && side !== current.side) throw new AppError('pitch_has_slots', 'Remove future unused slots before changing pitch size', 409);
    if (!isActive && current.kind === 'independent') {
      const uses = await db.select({ id: pitchComponents.pitchId }).from(pitchComponents).where(eq(pitchComponents.componentPitchId, id)).limit(1);
      if (uses.length) throw new AppError('pitch_in_use', 'Deactivate its combined pitch options first', 409);
    }
    const [updated] = await db.update(pitches).set({ name, side, isActive, updatedAt: new Date() }).where(eq(pitches.id, id)).returning();
    response.json({ pitch: { id, ground_id: groundId, name, side, kind: current.kind, is_active: updated!.isActive } });
  };
  listPublic = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    response.setHeader('Cache-Control', 'no-store');
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
    if (pitchType) {
      const requestedSide = /^(7|9|11)(?:-a-side| side)?$/i.exec(pitchType)?.[1];
      filters.push(requestedSide
        ? sql`EXISTS (SELECT 1 FROM pitches p WHERE p.ground_id = ${grounds.id} AND p.is_active AND p.side = ${Number(requestedSide)})`
        : ilike(grounds.pitchType, pitchType));
    }
    if (amenities.length) filters.push(arrayContains(grounds.amenities, amenities));
    if (!availabilityDate && maxPrice < Number.MAX_SAFE_INTEGER) filters.push(lte(grounds.pricePerHour, maxPrice));

    const orderBy = sort === 'price_low'
      ? [asc(grounds.pricePerHour), asc(grounds.title), asc(grounds.id)]
      : sort === 'price_high'
        ? [desc(grounds.pricePerHour), asc(grounds.title), asc(grounds.id)]
        : [desc(grounds.rating), asc(grounds.title), asc(grounds.id)];
    const condition = and(...filters);
    const offset = (page - 1) * limit;
    if (!availabilityDate) {
      const revision = (await db.select({ revision: publicGroundCatalogRevision.revision }).from(publicGroundCatalogRevision).where(eq(publicGroundCatalogRevision.id, 1)).limit(1))[0]?.revision;
      if (revision === undefined) throw new AppError('database_not_ready', 'Ground catalog migration is required', 503);
      const staticPage = await cachedPublicDiscovery({ q, city, pitchType, amenities, maxPrice, sort, page, limit }, revision, async () => {
        const [totalRow, pageRows] = await Promise.all([
          db.select({ value: count() }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(condition),
          db.select({ ground: grounds }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(condition).orderBy(...orderBy).limit(limit).offset(offset),
        ]);
        return { total: totalRow[0]?.value ?? 0, grounds: pageRows.map(({ ground }) => toGround(ground)) };
      });
      const allIds = staticPage.grounds.map((ground) => ground.id);
      const available = allIds.length ? await db.select({ groundId: slots.groundId, availableCount: sql<number>`count(*)::int`, nextAvailableAt: sql<string>`min(${slots.date}::text || 'T' || to_char(${slots.startTime}, 'HH24:MI') || ':00+05:00')` })
        .from(slots).where(and(inArray(slots.groundId, allIds), eq(slots.isBooked, false), eq(slots.isBlocked, false), gte(slots.date, pakistanToday()), sql`(${slots.holdBookingId} IS NULL OR ${slots.holdExpiresAt} <= now())`, sql`(${slots.date}::timestamp + ${slots.startTime}::time) > ((now() AT TIME ZONE 'Asia/Karachi') + ${env.minimumBookingLeadMinutes} * interval '1 minute')`, sql`NOT ${resourceConflictSql}`, sql`EXISTS (SELECT 1 FROM pitches p WHERE p.id = ${slots.pitchId} AND p.is_active)`))
        .groupBy(slots.groundId) : [];
      const summaries: Record<string, { available_count: number; next_available_at: string | null }> = {};
      for (const ground of staticPage.grounds) summaries[ground.id] = { available_count: 0, next_available_at: null };
      for (const row of available) summaries[row.groundId] = { available_count: row.availableCount, next_available_at: row.nextAvailableAt };
      response.json({ grounds: staticPage.grounds, availability_by_ground: summaries, pagination: { page, limit, total: staticPage.total, has_more: offset + staticPage.grounds.length < staticPage.total } });
      return;
    }

    // Keep the price filter and price ordering at the database boundary. The
    // correlated lookup is restricted to a ground and one date by the slot index.
    const day = new Date(`${availabilityDate}T12:00:00+05:00`).getUTCDay();
    const previousDay = (day + 6) % 7;
    const selectedDate = availabilityDate;
    const displayPrice = sql<number>`coalesce((select min(case when ${grounds.peakPercentage} is not null and exists (
      select 1 from jsonb_array_elements(${grounds.peakWindows}) as peak_window(value)
      where (
        (coalesce((peak_window.value->>'endNextDay')::boolean, false) = false
          and (peak_window.value->'days') @> ${JSON.stringify([day])}::jsonb
          and (peak_window.value->>'startTime') <= to_char(candidate.start_time, 'HH24:MI')
          and (peak_window.value->>'endTime') >= to_char(candidate.end_time, 'HH24:MI'))
        or
        (coalesce((peak_window.value->>'endNextDay')::boolean, false) = true and (
          ((peak_window.value->'days') @> ${JSON.stringify([day])}::jsonb
            and to_char(candidate.start_time, 'HH24:MI') >= (peak_window.value->>'startTime')
            and (candidate.end_date + candidate.end_time) <= (candidate.date + 1 + (peak_window.value->>'endTime')::time))
          or
          ((peak_window.value->'days') @> ${JSON.stringify([previousDay])}::jsonb
            and to_char(candidate.start_time, 'HH24:MI') < (peak_window.value->>'endTime')
            and to_char(candidate.end_time, 'HH24:MI') <= (peak_window.value->>'endTime'))
        ))
      )
    ) then round(candidate.price * (100 + ${grounds.peakPercentage})::numeric / 100)::int else candidate.price end)
      from slots candidate where candidate.ground_id = ${grounds.id}
        and candidate.date = ${selectedDate}::date and candidate.is_booked = false and candidate.is_blocked = false
        and (candidate.hold_booking_id is null or candidate.hold_expires_at <= now())
        and (candidate.date::timestamp + candidate.start_time) > ((now() at time zone 'Asia/Karachi') + ${env.minimumBookingLeadMinutes} * interval '1 minute')
        and exists (select 1 from pitches candidate_pitch where candidate_pitch.id = candidate.pitch_id and candidate_pitch.is_active ${/^(7|9|11)(?:-a-side| side)?$/i.exec(pitchType || '') ? sql`and candidate_pitch.side = ${Number(/^(7|9|11)/i.exec(pitchType!)![1])}` : sql``})
        and not exists (select 1 from pitch_occupancies occupancy where occupancy.slot_id <> candidate.id and occupancy.resource_pitch_id in
          (select coalesce(pc.component_pitch_id, candidate.pitch_id) from pitch_components pc where pc.pitch_id = candidate.pitch_id
           union select candidate.pitch_id where not exists (select 1 from pitch_components pc2 where pc2.pitch_id = candidate.pitch_id))
          and occupancy.during && tsrange(candidate.date + candidate.start_time, candidate.end_date + candidate.end_time + candidate.turnaround_minutes * interval '1 minute', '[)') and (occupancy.expires_at is null or occupancy.expires_at > now()))
    ), ${grounds.pricePerHour})`;
    // Effective-price calculation is expensive because it inspects dated
    // slots and peak windows per ground. Do not run it for the common
    // recommended/rating search when no maximum-price filter was requested.
    const datedCondition = maxPrice < Number.MAX_SAFE_INTEGER
      ? and(condition, lte(sql<number>`(${displayPrice})::bigint`, maxPrice))
      : condition;
    const datedOrder = sort === 'price_low' ? [asc(displayPrice), asc(grounds.title), asc(grounds.id)]
      : sort === 'price_high' ? [desc(displayPrice), asc(grounds.title), asc(grounds.id)] : orderBy;
    const [totalRow, pageRows] = await Promise.all([
      db.select({ value: count() }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(datedCondition),
      db.select({ ground: grounds }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(datedCondition).orderBy(...datedOrder).limit(limit).offset(offset),
    ]);
    const ids = pageRows.map(({ ground }) => ground.id);
    const matchingSlots = ids.length ? await db.select().from(slots).where(and(inArray(slots.groundId, ids), eq(slots.date, selectedDate), eq(slots.isBooked, false), eq(slots.isBlocked, false), sql`NOT ${resourceConflictSql}`, sql`EXISTS (SELECT 1 FROM pitches p WHERE p.id = ${slots.pitchId} AND p.is_active)`)).orderBy(asc(slots.startTime)) : [];
    const groundById = new Map(pageRows.map(({ ground }) => [ground.id, ground]));
    const slotsByGround = new Map<string, ReturnType<typeof toSlot>[]>();
    for (const slot of matchingSlots) {
      if (isHeld(slot) || isInsideBookingCutoff(slot.date, slot.startTime)) continue;
      const ground = groundById.get(slot.groundId);
      if (!ground) continue;
      const value = toSlot(slot, ground);
      if (value.price > maxPrice) continue;
      const list = slotsByGround.get(slot.groundId) || [];
      list.push(value);
      slotsByGround.set(slot.groundId, list);
    }
    // A selected date controls the availability shown on each card. It must
    // not hide an otherwise discoverable ground once that day's slots end.
    const total = totalRow[0]?.value ?? 0;
    response.json({ grounds: pageRows.map(({ ground }) => toGround(ground)), slots_by_ground: Object.fromEntries(pageRows.map(({ ground }) => [ground.id, slotsByGround.get(ground.id) || []])), pagination: { page, limit, total, has_more: offset + pageRows.length < total } });
  };

  getPublic = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const row = (await db.select({ ground: grounds, version: sql<string>`grounds.xmin::text` }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(and(eq(grounds.id, routeParam(request.params.id, 'Ground id')), eq(grounds.isActive, true), eq(grounds.isVerified, true), eq(grounds.verificationStatus, 'approved'), eq(vendors.isActive, true), eq(vendors.verificationStatus, 'approved'))).limit(1))[0];
    if (!row) throw new AppError('not_found', 'Ground was not found', 404);
    const ground = await cachedPublicGround(row.ground.id, row.version, async () => toGround(row.ground));
    const lastDate = new Date(`${pakistanToday()}T00:00:00Z`);
    lastDate.setUTCDate(lastDate.getUTCDate() + env.maxAdvanceBookingDays);
    const groundSlots = await db.select().from(slots).where(and(eq(slots.groundId, row.ground.id), gte(slots.date, pakistanToday()), sql`${slots.date} <= ${lastDate.toISOString().slice(0, 10)}`)).orderBy(asc(slots.date), asc(slots.startTime));
    response.setHeader('Cache-Control', 'no-store');
    const pitchRows = await db.select().from(pitches).where(and(eq(pitches.groundId, row.ground.id), eq(pitches.isActive, true))).orderBy(asc(pitches.createdAt));
    const components = pitchRows.length ? await db.select().from(pitchComponents).where(inArray(pitchComponents.pitchId, pitchRows.map((pitch) => pitch.id))) : [];
    const busy = await occupiedByAnotherSlot(groundSlots.map((slot) => slot.id));
    response.json({ ground, pitches: pitchRows.map((pitch) => ({ id: pitch.id, name: pitch.name, side: pitch.side, kind: pitch.kind, component_pitch_ids: components.filter((item) => item.pitchId === pitch.id).map((item) => item.componentPitchId) })), slots: groundSlots.filter((slot) => !isInsideBookingCutoff(slot.date, slot.startTime) && pitchRows.some((pitch) => pitch.id === slot.pitchId)).map((slot) => ({ ...toSlot(slot, row.ground), is_held: isHeld(slot) || busy.has(slot.id), resource_unavailable: busy.has(slot.id) })) });
  };

  getPublicMetadata = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const groundId = routeParam(request.params.id, 'Ground id');
    const row = (await db.select({ id: grounds.id, version: sql<string>`grounds.xmin::text` }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(and(eq(grounds.id, groundId), eq(grounds.isActive, true), eq(grounds.isVerified, true), eq(grounds.verificationStatus, 'approved'), eq(vendors.isActive, true), eq(vendors.verificationStatus, 'approved'))).limit(1))[0];
    if (!row) throw new AppError('not_found', 'Ground was not found', 404);
    const ground = await cachedPublicGround(row.id, row.version, async () => {
      const current = (await db.select().from(grounds).where(and(eq(grounds.id, groundId), eq(grounds.isActive, true), eq(grounds.isVerified, true), eq(grounds.verificationStatus, 'approved'))).limit(1))[0];
      if (!current) throw new AppError('not_found', 'Ground was not found', 404);
      return toGround(current);
    });
    const etag = publicGroundEtag(ground);
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    if (request.headers['if-none-match'] === etag) {
      response.status(304).end();
      return;
    }
    response.json({ ground });
  };

  listMine = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendorId = await vendorIdForUser(request.auth.userId);
    const page = queryInteger(request.query.page, 'Page', 1, 1, 10_000);
    const limit = queryInteger(request.query.limit, 'Limit', 50, 1, 100);
    const offset = (page - 1) * limit;
    const [totalRow, rows] = await Promise.all([
      db.select({ value: count() }).from(grounds).where(eq(grounds.vendorId, vendorId)),
      db.select().from(grounds).where(eq(grounds.vendorId, vendorId)).orderBy(asc(grounds.title), asc(grounds.id)).limit(limit).offset(offset),
    ]);
    const total = totalRow[0]?.value ?? 0;
    response.json({ grounds: rows.map(toGround), pagination: { page, limit, total, has_more: offset + rows.length < total } });
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
    if (latitude === null || longitude === null) throw new AppError('exact_location_required', 'Add the exact ground location using a Maps Share link, current location, or advanced coordinates', 422);
    const ownerVendorId = await vendorIdForUser(request.auth.userId);
    const vendor = (await db.select({ verificationStatus: vendors.verificationStatus, isActive: vendors.isActive }).from(vendors).where(eq(vendors.id, ownerVendorId)).limit(1))[0];
    if (!vendor?.isActive || vendor.verificationStatus !== 'approved') throw new AppError('vendor_verification_required', 'Your vendor verification must be approved before adding grounds', 403);
    const row = (await db.insert(grounds).values({
      vendorId: ownerVendorId, title, description: body.description?.trim() || null,
      location, city, address, latitude, longitude,
      amenities: textArray(body.amenities), images: textArray(body.images), coverImage: typeof body.cover_image === 'string' ? body.cover_image.trim() || null : null,
      pitchType: body.pitch_type?.trim() || null, pricePerHour: body.price_per_hour, peakPercentage: configuredPeakPercentage, peakWindows: configuredPeakWindows,
      operatingHours: body.operating_hours === undefined ? { open: '06:00', close: '23:00', closeNextDay: false } : operatingHours(body.operating_hours),
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
    response.setHeader('Cache-Control', 'no-store');
    const ground = (await db.select({ ground: grounds }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(and(eq(grounds.id, routeParam(request.params.id, 'Ground id')), eq(grounds.isActive, true), eq(grounds.isVerified, true), eq(grounds.verificationStatus, 'approved'), eq(vendors.isActive, true), eq(vendors.verificationStatus, 'approved'))).limit(1))[0];
    if (!ground) throw new AppError('not_found', 'Ground was not found', 404);
    const page = queryInteger(request.query.page, 'Page', 1, 1, 10_000);
    const limit = queryInteger(request.query.limit, 'Limit', 100, 1, 200);
    const offset = (page - 1) * limit;
    const rows = (await db.select().from(slots).where(eq(slots.groundId, ground.ground.id)).orderBy(asc(slots.date), asc(slots.startTime), asc(slots.id))).filter((slot) => !isInsideBookingCutoff(slot.date, slot.startTime));
    const pageRows = rows.slice(offset, offset + limit);
    const busy = await occupiedByAnotherSlot(pageRows.map((slot) => slot.id));
    response.json({ slots: pageRows.map((slot) => ({ ...toSlot(slot, ground.ground), resource_unavailable: busy.has(slot.id), is_held: isHeld(slot) || busy.has(slot.id) })), pagination: { page, limit, total: rows.length, has_more: offset + pageRows.length < rows.length } });
  };

  createSlot = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.id, 'Ground id');
    const ground = await ownedGround(groundId, request.auth.userId);
    const body = request.body || {};
    const pitchId = await selectedPitch(groundId, body.pitch_id);
    const date = normalizedDate(body.date);
    const start_time = normalizedTime(body.start_time);
    const end_time = normalizedTime(body.end_time);
    const price = body.price;
    if (!date || !start_time || !end_time || !Number.isSafeInteger(price) || price <= 0) throw new AppError('invalid_slot', 'Use a valid date, 24-hour times, and a positive whole-number price', 422);
    if (start_time === end_time) throw new AppError('invalid_slot', 'Start and end times must be different', 422);
    if (hasStarted(date, start_time)) throw new AppError('slot_expired', 'Slots must start in the future', 422);
    enforceSlotPolicy(ground, date, start_time, end_time);
    const endDate = end_time < start_time ? addCalendarDays(date, 1) : date;
    const conflict = await conflictingSlot(pitchId, date, start_time, end_time, ground.turnaroundMinutes, undefined, endDate);
    if (conflict[0]) throw new AppError('slot_conflict', 'Allow the required changeover time between slots', 409);
    const row = (await db.insert(slots).values({ groundId, pitchId, date, endDate, startTime: start_time, endTime: end_time, turnaroundMinutes: ground.turnaroundMinutes, price }).returning())[0];
    if (!row) throw new AppError('slot_creation_failed', 'Slot could not be created', 500);
    response.status(201).json({ slot: toSlot(row) });
  };

  createRecurringSlots = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.id, 'Ground id');
    const ground = await ownedGround(groundId, request.auth.userId);
    const body = request.body || {};
    const pitchId = await selectedPitch(groundId, body.pitch_id);
    const date = normalizedDate(body.start_date);
    const startTime = normalizedTime(body.start_time);
    const endTime = normalizedTime(body.end_time);
    const price = body.price;
    const intervalDays = body.interval_days;
    const occurrences = body.occurrences;
    if (!date || !startTime || !endTime || !Number.isSafeInteger(price) || price <= 0 || !Number.isSafeInteger(intervalDays) || intervalDays < 1 || !Number.isSafeInteger(occurrences) || occurrences < 1 || occurrences > 60) {
      throw new AppError('invalid_recurring_slots', 'Provide valid slot details, an interval of at least one day, and 1 to 60 occurrences', 422);
    }
    if (startTime === endTime) throw new AppError('invalid_slot', 'Start and end times must be different', 422);
    const recurringDates = Array.from({ length: occurrences }, (_, index) => {
      const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + index * intervalDays); return next.toISOString().slice(0, 10);
    });
    if (recurringDates.some((slotDate) => hasStarted(slotDate, startTime))) throw new AppError('slot_expired', 'All recurring slots must start in the future', 422);
    recurringDates.forEach((slotDate) => enforceSlotPolicy(ground, slotDate, startTime, endTime));
    const created = await db.transaction(async (tx) => {
      const result = [];
      for (const slotDate of recurringDates) {
        const endDate = endTime < startTime ? addCalendarDays(slotDate, 1) : slotDate;
        const conflict = await conflictingSlot(pitchId, slotDate, startTime, endTime, ground.turnaroundMinutes, undefined, endDate);
        if (conflict[0]) throw new AppError('slot_conflict', `Allow the required changeover time on ${slotDate}`, 409);
        const [row] = await tx.insert(slots).values({ groundId, pitchId, date: slotDate, endDate, startTime, endTime, turnaroundMinutes: ground.turnaroundMinutes, price }).returning();
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
    const requestedPitchId = typeof body.pitch_id === 'string' ? body.pitch_id : '';
    const pitchRows = await db.select().from(pitches).where(and(eq(pitches.groundId, groundId), eq(pitches.isActive, true))).orderBy(asc(pitches.createdAt));
    const pitchId = requestedPitchId || (pitchRows.length === 1 ? pitchRows[0]!.id : '');
    if (!pitchRows.some((pitch) => pitch.id === pitchId)) throw new AppError('pitch_required', 'Choose the pitch whose booking times you are setting', 422);
    const rawStarts: unknown[] = Array.isArray(body.slot_starts) ? body.slot_starts : [];
    const days: number[] = Array.isArray(body.days) ? [...new Set((body.days as unknown[]).filter((day): day is number => typeof day === 'number' && Number.isInteger(day)))] : [0, 1, 2, 3, 4, 5, 6]; const duration = typeof body.slot_duration_minutes === 'number' ? body.slot_duration_minutes : 0; const price = typeof body.price === 'number' ? body.price : 0;
    const turnaround = body.turnaround_minutes === undefined ? 10 : body.turnaround_minutes;
    if (!open || !close || !rawStarts.length || rawStarts.length > 48 || !days.length || !validTurnaround(turnaround) || !Number.isSafeInteger(duration) || duration < 30 || duration > env.maxSlotDurationMinutes || !Number.isSafeInteger(price) || price <= 0 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new AppError('invalid_schedule', 'Choose valid hours, selected slots, days, playing duration, changeover, and price', 422);
    const groundOpens = timeMinutes(ground.operatingHours.open);
    const savedGroundCloses = timeMinutes(ground.operatingHours.close) + (closesNextDay(ground.operatingHours) ? 1440 : 0);
    const onGroundDay = (time: string) => timeMinutes(time) + (timeMinutes(time) < groundOpens ? 1440 : 0);
    const opening = onGroundDay(open);
    const requestedCloseNextDay = body.close_next_day === true || timeMinutes(close) <= timeMinutes(open);
    const closing = timeMinutes(close) + (requestedCloseNextDay ? 1440 : 0);
    const extendsGroundClosing = body.extend_ground_hours === true && closing > savedGroundCloses;
    const allowedGroundClose = extendsGroundClosing ? closing : savedGroundCloses;
    if (opening < groundOpens || closing <= opening || closing > allowedGroundClose) throw new AppError('outside_operating_hours', `Pitch booking times must fit within the venue hours (${ground.operatingHours.open}–${ground.operatingHours.close}${closesNextDay(ground.operatingHours) ? ' next day' : ''}). Edit or extend the venue hours first.`, 422);
    const parsedStarts = rawStarts.map((value) => {
      const record = value && typeof value === 'object' ? value as Record<string, unknown> : null;
      const time = normalizedTime(record ? record.time : value);
      const inferredOffset = time && timeMinutes(time) < groundOpens ? 1 : 0;
      const dayOffset = record?.day_offset === 0 || record?.day_offset === 1 ? record.day_offset : inferredOffset;
      return time ? { time, dayOffset } : null;
    }).filter((value): value is { time: string; dayOffset: number } => Boolean(value));
    const starts = [...new Map(parsedStarts.map((value) => [`${value.dayOffset}:${value.time}`, value])).values()];
    if (!starts.length || starts.length !== rawStarts.length) throw new AppError('invalid_schedule', 'One or more selected slot times are invalid', 422);
    const absoluteStart = (start: { time: string; dayOffset: number }) => timeMinutes(start.time) + start.dayOffset * 1440;
    const endFor = (start: { time: string; dayOffset: number }) => { const value = (absoluteStart(start) + duration) % 1440; return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; };
    if (starts.some((start) => absoluteStart(start) < opening || absoluteStart(start) + duration > closing)) throw new AppError('invalid_schedule', 'Every selected slot must fit inside the working hours', 422);
    const proposed = starts.map((start) => ({ date: addCalendarDays(pakistanToday(), start.dayOffset), endDate: addCalendarDays(pakistanToday(), Math.floor((absoluteStart(start) + duration) / 1440)), startTime: start.time, endTime: endFor(start), turnaroundMinutes: turnaround, dayOffset: start.dayOffset }));
    if (proposed.some((item, index) => proposed.slice(index + 1).some((other) => periodsConflict(item, other)))) throw new AppError('invalid_schedule', 'Selected slots need the chosen changeover time between them', 422);
    const previewOnly = body.preview_only === true;
    const preview = await db.transaction(async (tx) => {
      // Keep every slot that has booking history or an active claim; replacing a
      // repeating program must never move or erase a customer's promised time.
      const existing = await tx.select().from(slots).where(and(eq(slots.pitchId, pitchId), gte(slots.date, pakistanToday())));
      const bookingRows = existing.length ? await tx.select({ slotId: bookings.slotId }).from(bookings).where(inArray(bookings.slotId, existing.map((slot) => slot.id))) : [];
      const withHistory = new Set(bookingRows.map((row) => row.slotId));
      const removable = existing.filter((slot) => slot.scheduleTemplateId && !slot.isBooked && !slot.isBlocked && !slot.isClubReserved && !slot.holdBookingId && !withHistory.has(slot.id));
      const removableIds = new Set(removable.map((slot) => slot.id));
      const protectedSlots = existing.filter((slot) => !removableIds.has(slot.id));
      const horizon = new Date(`${pakistanToday()}T00:00:00Z`);
      horizon.setUTCDate(horizon.getUTCDate() + env.maxAdvanceBookingDays);
      for (let cursor = new Date(`${pakistanToday()}T00:00:00Z`); cursor <= horizon; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        if (!days.includes(cursor.getUTCDay())) continue;
        const date = cursor.toISOString().slice(0, 10);
        for (const item of proposed) {
          const itemAbsoluteStart = timeMinutes(item.startTime) + item.dayOffset * 1440;
          const startDate = addCalendarDays(date, item.dayOffset);
          const endDate = addCalendarDays(date, Math.floor((itemAbsoluteStart + duration) / 1440));
          if (hasStarted(startDate, item.startTime)) continue;
          const conflict = protectedSlots.find((slot) => {
            if (slot.date === startDate && slot.startTime.slice(0, 5) === item.startTime && slot.endTime.slice(0, 5) === item.endTime) return false;
            return periodsConflict({ ...item, date: startDate, endDate }, { ...slot, turnaroundMinutes: Math.max(slot.turnaroundMinutes, turnaround) });
          });
          if (conflict) throw new AppError('schedule_conflict', `Keep a changeover gap on ${date} around ${conflict.startTime.slice(0, 5)}. An existing slot or booking is protected.`, 409);
        }
      }
      if (previewOnly) return { replaceableSlots: removable.length, protectedSlots: protectedSlots.length };
      if (removable.length) await tx.delete(slots).where(inArray(slots.id, removable.map((slot) => slot.id)));
      await tx.delete(slotScheduleTemplates).where(eq(slotScheduleTemplates.pitchId, pitchId));
      await tx.insert(slotScheduleTemplates).values(starts.map((start) => ({ groundId, pitchId, days, startTime: start.time, endTime: endFor(start), startDayOffset: start.dayOffset, endDayOffset: Math.floor((absoluteStart(start) + duration) / 1440), turnaroundMinutes: turnaround, price })));
      if (extendsGroundClosing) await tx.update(grounds).set({ operatingHours: { ...ground.operatingHours, close, closeNextDay: requestedCloseNextDay }, updatedAt: new Date() }).where(eq(grounds.id, groundId));
      const [startingPrice] = await tx.select({ value: sql<number>`min(${slotScheduleTemplates.price})::int` }).from(slotScheduleTemplates).innerJoin(pitches, eq(slotScheduleTemplates.pitchId, pitches.id)).where(and(eq(slotScheduleTemplates.groundId, groundId), eq(pitches.isActive, true)));
      await tx.update(grounds).set({ pricePerHour: startingPrice?.value ?? price, updatedAt: new Date() }).where(eq(grounds.id, groundId));
      return { replaceableSlots: removable.length, protectedSlots: protectedSlots.length };
    });
    if (previewOnly) { response.json({ preview: { replaceable_slots: preview.replaceableSlots, protected_slots: preview.protectedSlots, selected_times: starts.length, repeat_days: days.length, turnaround_minutes: turnaround } }); return; }
    const refreshed = (await db.select().from(grounds).where(eq(grounds.id, groundId)).limit(1))[0]!; await materializeSchedules([refreshed]);
    const created = await db.select().from(slots).where(eq(slots.pitchId, pitchId)); response.status(201).json({ slots: created.filter((slot) => !hasStarted(slot.date, slot.startTime)).map((slot) => toSlot(slot, refreshed)) });
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
      // Block the physical pitch slots only. Combined pitch slots share those
      // resources and are made unavailable by the pitch-occupancy rules. Updating
      // both representations can make their synchronized occupancy rows overlap.
      const physicalPitches = await tx.select({ id: pitches.id }).from(pitches)
        .where(and(eq(pitches.groundId, groundId), eq(pitches.kind, 'independent')));
      if (physicalPitches.length) {
        await tx.update(slots).set({ isBlocked: true, updatedAt: new Date() }).where(and(
          eq(slots.groundId, groundId),
          inArray(slots.pitchId, physicalPitches.map((pitch) => pitch.id)),
          inArray(slots.date, dates),
          eq(slots.isBooked, false),
        ));
      }
    });
    response.status(201).json({ dates });
  };

  removeBlackout = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.id, 'Ground id'); await ownedGround(groundId, request.auth.userId);
    const date = routeParam(request.params.date, 'Blackout date'); if (!validDate(date)) throw new AppError('invalid_blackout_date', 'Date must use YYYY-MM-DD format', 422);
    await db.delete(groundBlackoutDates).where(and(eq(groundBlackoutDates.groundId, groundId), eq(groundBlackoutDates.date, date)));
    const physicalPitches = await db.select({ id: pitches.id }).from(pitches)
      .where(and(eq(pitches.groundId, groundId), eq(pitches.kind, 'independent')));
    if (physicalPitches.length) {
      await db.update(slots).set({ isBlocked: false, updatedAt: new Date() }).where(and(
        eq(slots.groundId, groundId),
        inArray(slots.pitchId, physicalPitches.map((pitch) => pitch.id)),
        eq(slots.date, date),
        eq(slots.isBooked, false),
        eq(slots.isClubReserved, false),
      ));
    }
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
    if (nextStart === nextEnd) throw new AppError('invalid_slot', 'Start and end times must be different', 422);
    if (hasStarted(nextDate, nextStart)) throw new AppError('slot_expired', 'Slots must start in the future', 422);
    enforceSlotPolicy(ground, nextDate, nextStart, nextEnd);
    const nextEndDate = nextEnd < nextStart ? addCalendarDays(nextDate, 1) : nextDate;
    const conflict = await conflictingSlot(current.pitchId!, nextDate, nextStart, nextEnd, current.turnaroundMinutes, current.id, nextEndDate);
    if (conflict[0]) throw new AppError('slot_conflict', 'Allow the required changeover time between slots', 409);
    if (body.date !== undefined) values.date = body.date;
    if (body.date !== undefined || body.start_time !== undefined || body.end_time !== undefined) values.endDate = nextEndDate;
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
