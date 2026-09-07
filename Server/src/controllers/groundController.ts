import { Response } from 'express';
import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { grounds, slots, vendors } from '../database/schema.js';

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
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function toGround(row: typeof grounds.$inferSelect) {
  return { id: row.id, vendor_id: row.vendorId, title: row.title, description: row.description, location: row.location, city: row.city, address: row.address, latitude: row.latitude, longitude: row.longitude, amenities: row.amenities, images: row.images, cover_image: row.coverImage, pitch_type: row.pitchType, price_per_hour: row.pricePerHour, peak_price: row.peakPrice, is_active: row.isActive, is_verified: row.isVerified, rating: row.rating, total_reviews: row.totalReviews, operating_hours: row.operatingHours, rules: row.rules, cancellation_policy: row.cancellationPolicy, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() };
}

function toSlot(row: typeof slots.$inferSelect) {
  return { id: row.id, ground_id: row.groundId, date: row.date, start_time: row.startTime, end_time: row.endTime, price: row.price, is_booked: row.isBooked, is_blocked: row.isBlocked, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() };
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
    const rows = await db.select().from(grounds).where(eq(grounds.isActive, true));
    response.json({ grounds: rows.map(toGround) });
  };

  getPublic = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const rows = await db.select().from(grounds).where(and(eq(grounds.id, routeParam(request.params.id, 'Ground id')), eq(grounds.isActive, true))).limit(1);
    if (!rows[0]) throw new AppError('not_found', 'Ground was not found', 404);
    const groundSlots = await db.select().from(slots).where(eq(slots.groundId, rows[0].id));
    response.json({ ground: toGround(rows[0]), slots: groundSlots.map(toSlot) });
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
    if (body.peak_price !== undefined && body.peak_price !== null && (!Number.isInteger(body.peak_price) || body.peak_price <= 0)) throw new AppError('invalid_ground', 'Peak price must be a positive whole number', 422);
    const latitude = coordinate(body.latitude, 'Latitude', -90, 90);
    const longitude = coordinate(body.longitude, 'Longitude', -180, 180);
    const row = (await db.insert(grounds).values({
      vendorId: await vendorIdForUser(request.auth.userId), title, description: body.description?.trim() || null,
      location, city, address, latitude, longitude,
      amenities: textArray(body.amenities), images: textArray(body.images), coverImage: typeof body.cover_image === 'string' ? body.cover_image.trim() || null : null,
      pitchType: body.pitch_type?.trim() || null, pricePerHour: body.price_per_hour, peakPrice: Number.isInteger(body.peak_price) ? body.peak_price : null,
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
    if (body.peak_price !== undefined) {
      if (body.peak_price !== null && (!Number.isInteger(body.peak_price) || body.peak_price <= 0)) throw new AppError('invalid_ground', 'Peak price must be a positive whole number', 422);
      values.peakPrice = body.peak_price;
    }
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
    const booked = await db.select({ id: slots.id }).from(slots).where(and(eq(slots.groundId, current.id), eq(slots.isBooked, true))).limit(1);
    if (booked[0]) throw new AppError('ground_has_bookings', 'Grounds with booked slots cannot be deleted', 409);
    await db.delete(grounds).where(eq(grounds.id, current.id));
    response.status(204).send();
  };

  listSlots = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const rows = await db.select().from(slots).where(eq(slots.groundId, routeParam(request.params.id, 'Ground id')));
    response.json({ slots: rows.map(toSlot) });
  };

  createSlot = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.id, 'Ground id');
    await ownedGround(groundId, request.auth.userId);
    const { date, start_time, end_time, price } = request.body || {};
    if (!validDate(date) || !validTime(start_time) || !validTime(end_time) || !Number.isInteger(price) || price <= 0) throw new AppError('invalid_slot', 'Use a valid date, 24-hour times, and a positive whole-number price', 422);
    if (start_time >= end_time) throw new AppError('invalid_slot', 'End time must be later than start time', 422);
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

  updateSlot = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = routeParam(request.params.groundId, 'Ground id');
    const slotId = routeParam(request.params.slotId, 'Slot id');
    await ownedGround(groundId, request.auth.userId);
    const current = (await db.select().from(slots).where(and(eq(slots.id, slotId), eq(slots.groundId, groundId))).limit(1))[0];
    if (!current) throw new AppError('not_found', 'Slot was not found', 404);
    if (current.isBooked) throw new AppError('slot_booked', 'Booked slots cannot be changed', 409);
    const body = request.body || {};
    const values: Partial<typeof slots.$inferInsert> = { updatedAt: new Date() };
    if (body.date !== undefined && !validDate(body.date)) throw new AppError('invalid_slot', 'Date must use YYYY-MM-DD format', 422);
    if (body.start_time !== undefined && !validTime(body.start_time)) throw new AppError('invalid_slot', 'Start time must use HH:MM format', 422);
    if (body.end_time !== undefined && !validTime(body.end_time)) throw new AppError('invalid_slot', 'End time must use HH:MM format', 422);
    const nextDate = body.date ?? current.date;
    const nextStart = body.start_time ?? current.startTime;
    const nextEnd = body.end_time ?? current.endTime;
    if (nextStart >= nextEnd) throw new AppError('invalid_slot', 'End time must be later than start time', 422);
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
    if (current.isBooked) throw new AppError('slot_booked', 'Booked slots cannot be removed', 409);
    await db.delete(slots).where(eq(slots.id, current.id));
    response.status(204).send();
  };
}
