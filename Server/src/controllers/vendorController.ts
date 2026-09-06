import { Response } from 'express';
import { eq } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { users, vendors } from '../database/schema.js';

function toProfile(row: typeof vendors.$inferSelect) {
  return {
    id: row.id, user_id: row.userId, business_name: row.businessName,
    business_phone: row.businessPhone, business_city: row.businessCity,
    business_description: row.businessDescription, business_logo: row.businessLogo,
    business_cover_image: row.businessCoverImage, is_verified: row.isVerified,
    is_active: row.isActive, total_earnings: row.totalEarnings,
    pending_earnings: row.pendingEarnings, rating: row.rating,
    total_withdrawn: row.totalWithdrawn,
    total_reviews: row.totalReviews, created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export class VendorController {
  me = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const rows = await db.select().from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1);
    response.json({ profile: rows[0] ? toProfile(rows[0]) : null });
  };

  create = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const { business_name, business_phone, business_city, business_description } = request.body || {};
    if (![business_name, business_phone, business_city].every((value) => typeof value === 'string' && value.trim())) {
      throw new AppError('invalid_vendor', 'Business name, phone, and city are required', 422);
    }
    const existing = await db.select().from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1);
    const row = existing[0] || (await db.insert(vendors).values({
      userId: request.auth.userId, businessName: business_name.trim(),
      businessPhone: business_phone.trim(), businessCity: business_city.trim(),
      businessDescription: business_description?.trim() || null,
    }).returning())[0];
    if (!row) throw new AppError('vendor_creation_failed', 'Vendor profile could not be created', 500);
    await db.update(users).set({ role: 'vendor', updatedAt: new Date() }).where(eq(users.id, request.auth.userId));
    response.status(existing[0] ? 200 : 201).json({ profile: toProfile(row) });
  };
}