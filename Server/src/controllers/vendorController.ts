import { Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { bookings, grounds, ledgerEntries, users, vendors } from '../database/schema.js';

function toProfile(row: typeof vendors.$inferSelect) {
  return {
    id: row.id,
    user_id: row.userId,
    business_name: row.businessName,
    business_phone: row.businessPhone,
    business_city: row.businessCity,
    business_description: row.businessDescription,
    business_logo: row.businessLogo,
    business_cover_image: row.businessCoverImage,
    is_verified: row.isVerified,
    is_active: row.isActive,
    total_earnings: row.totalEarnings,
    pending_earnings: row.pendingEarnings,
    rating: row.rating,
    total_withdrawn: row.totalWithdrawn,
    total_reviews: row.totalReviews,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export class VendorController {
  me = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const rows = await db.select().from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1);
    response.json({ profile: rows[0] ? toProfile(rows[0]) : null });
  };

  activateMode = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendor = await db.select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, request.auth.userId))
      .limit(1);
    if (!vendor[0]) throw new AppError('vendor_required', 'A vendor profile is required', 403);

    await db.update(users)
      .set({ role: 'vendor', updatedAt: new Date() })
      .where(eq(users.id, request.auth.userId));
    response.json({ message: 'Vendor mode activated' });
  };

  earnings = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendor = (await db.select().from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    if (!vendor) throw new AppError('vendor_required', 'A vendor profile is required', 403);
    const entries = await db.select({
      id: ledgerEntries.id, bookingId: ledgerEntries.bookingId, type: ledgerEntries.type, status: ledgerEntries.status,
      amount: ledgerEntries.amount, description: ledgerEntries.description, postedAt: ledgerEntries.postedAt, createdAt: ledgerEntries.createdAt,
      bookingNumber: bookings.bookingNumber, groundTitle: grounds.title,
    }).from(ledgerEntries)
      .innerJoin(bookings, eq(ledgerEntries.bookingId, bookings.id))
      .innerJoin(grounds, eq(bookings.groundId, grounds.id))
      .where(eq(ledgerEntries.vendorId, vendor.id))
      .orderBy(desc(ledgerEntries.createdAt));
    const pendingRefunds = entries
      .filter((entry) => entry.type === 'refund' && entry.status === 'pending')
      .reduce((total, entry) => total + Math.abs(entry.amount), 0);
    response.json({
      summary: {
        available_to_withdraw: Math.max(0, vendor.totalEarnings - vendor.totalWithdrawn),
        pending_earnings: vendor.pendingEarnings,
        total_paid_out: vendor.totalWithdrawn,
        pending_refunds: pendingRefunds,
      },
      entries: entries.map((entry) => ({
        id: entry.id,
        booking_id: entry.bookingId,
        type: entry.type,
        status: entry.status,
        amount: entry.amount,
        description: entry.description,
        booking_number: entry.bookingNumber,
        ground_title: entry.groundTitle,
        posted_at: entry.postedAt?.toISOString() || null,
        created_at: entry.createdAt.toISOString(),
      })),
    });
  };

  create = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const { business_name, business_phone, business_city, business_description } = request.body || {};
    if (![business_name, business_phone, business_city].every((value) => typeof value === 'string' && value.trim())) {
      throw new AppError('invalid_vendor', 'Business name, phone, and city are required', 422);
    }
    const existing = await db.select().from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1);
    const row = existing[0] || (await db.insert(vendors).values({
      userId: request.auth.userId,
      businessName: business_name.trim(),
      businessPhone: business_phone.trim(),
      businessCity: business_city.trim(),
      businessDescription: business_description?.trim() || null,
    }).returning())[0];
    if (!row) throw new AppError('vendor_creation_failed', 'Vendor profile could not be created', 500);
    await db.update(users).set({ role: 'vendor', updatedAt: new Date() }).where(eq(users.id, request.auth.userId));
    response.status(existing[0] ? 200 : 201).json({ profile: toProfile(row) });
  };

  update = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const current = (await db.select().from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    if (!current) throw new AppError('vendor_required', 'A vendor profile is required', 403);
    const body = request.body || {};
    const values: Partial<typeof vendors.$inferInsert> = { updatedAt: new Date() };
    if (body.business_name !== undefined) {
      if (typeof body.business_name !== 'string' || !body.business_name.trim()) throw new AppError('invalid_vendor', 'Business name is required', 422);
      values.businessName = body.business_name.trim();
    }
    if (body.business_phone !== undefined) {
      if (typeof body.business_phone !== 'string' || !body.business_phone.trim()) throw new AppError('invalid_vendor', 'Business phone is required', 422);
      values.businessPhone = body.business_phone.trim();
    }
    if (body.business_city !== undefined) {
      if (typeof body.business_city !== 'string' || !body.business_city.trim()) throw new AppError('invalid_vendor', 'Business city is required', 422);
      values.businessCity = body.business_city.trim();
    }
    if (body.business_description !== undefined) values.businessDescription = typeof body.business_description === 'string' ? body.business_description.trim() || null : null;
    if (body.is_active !== undefined) values.isActive = Boolean(body.is_active);
    const [updated] = await db.update(vendors).set(values).where(eq(vendors.id, current.id)).returning();
    if (!updated) throw new AppError('vendor_update_failed', 'Unable to update vendor profile', 500);
    response.json({ profile: toProfile(updated) });
  };
}
