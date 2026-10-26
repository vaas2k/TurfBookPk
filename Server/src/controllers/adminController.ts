import { and, count, desc, eq, lt, or, sql } from 'drizzle-orm';
import { Response } from 'express';
import { createHash } from 'node:crypto';
import { db } from '../database/client.js';
import { adminAuditLogs, bookingOrders, bookings, groundVerificationDocuments, groundVerifications, grounds, ledgerEntries, notificationOutbox, notifications, paymentAttempts, reviewReports, reviews, users, vendorVerificationDocuments, vendorVerifications, vendors } from '../database/schema.js';
import { env } from '../configs/env.js';
import { AppError } from '../helpers/errors.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendExpoPush } from '../services/expoPushService.js';
import { nextPaginationCursor, parsePaginationCursor } from '../services/paginationCursor.js';

type VerificationStatus = 'pending' | 'approved' | 'rejected';

function param(value: string | string[] | undefined, name: string): string {
  if (typeof value !== 'string' || !value) throw new AppError('invalid_request', `${name} is required`, 422);
  return value;
}

function pagination(request: AuthenticatedRequest): { page: number; limit: number; offset: number } {
  const page = Number(request.query.page || 1); const limit = Number(request.query.limit || 50);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new AppError('invalid_pagination', 'Use a valid page and limit', 422);
  return { page, limit, offset: (page - 1) * limit };
}

function verificationBody(body: unknown): { status: VerificationStatus; reason: string | null } {
  const value = body as Record<string, unknown> | null;
  const status = value?.status;
  const reason = typeof value?.reason === 'string' ? value.reason.trim().slice(0, 500) || null : null;
  if (status !== 'pending' && status !== 'approved' && status !== 'rejected') throw new AppError('invalid_verification', 'Status must be pending, approved, or rejected', 422);
  if (status === 'rejected' && !reason) throw new AppError('invalid_verification', 'A rejection reason is required', 422);
  return { status, reason };
}

async function audit(actorId: string, action: string, targetType: string, targetId: string, reason: string | null, metadata?: Record<string, unknown>): Promise<void> {
  await db.insert(adminAuditLogs).values({ actorId, action, targetType, targetId, reason, metadata: metadata ?? null });
}

function privateDocumentUrl(key: string, contentType: string): string {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) throw new AppError('storage_not_configured', 'Private document storage is not configured', 503);
  const timestamp = String(Math.floor(Date.now() / 1000)); const expiresAt = String(Math.floor(Date.now() / 1000) + 300);
  const format = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1] || 'jpg';
  const params = { expires_at: expiresAt, format, public_id: key, timestamp, type: 'authenticated' };
  const serialized = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${name}=${value}`).join('&');
  const signature = createHash('sha256').update(`${serialized}${env.cloudinaryApiSecret}`).digest('hex');
  // `private_download_url` uses a concrete resource type. CNIC/business files
  // in this application are images or PDFs, both of which Cloudinary stores as
  // image assets; `auto/download` is not a valid private-download endpoint.
  return `https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/download?${new URLSearchParams({ ...params, api_key: env.cloudinaryApiKey, signature }).toString()}`;
}

export class AdminController {
  dashboard = async (_request: AuthenticatedRequest, response: Response): Promise<void> => {
    const [pendingVendors, pendingGrounds, openReports, suspendedUsers, totalUsers, activeGrounds, paidTotals, revenueRows, cityRows, topGroundRows] = await Promise.all([
      db.select({ total: count() }).from(vendors).leftJoin(vendorVerifications, eq(vendorVerifications.vendorId, vendors.id)).where(or(eq(vendors.verificationStatus, 'under_review'), and(eq(vendors.verificationStatus, 'draft'), or(eq(vendorVerifications.identityStatus, 'changes_requested'), eq(vendorVerifications.businessStatus, 'changes_requested'), eq(vendorVerifications.payoutStatus, 'changes_requested'))))),
      db.select({ total: count() }).from(grounds).leftJoin(groundVerifications, eq(groundVerifications.groundId, grounds.id)).where(or(eq(grounds.verificationStatus, 'under_review'), and(eq(grounds.verificationStatus, 'draft'), eq(groundVerifications.authorityStatus, 'changes_requested')))),
      db.select({ total: count() }).from(reviewReports).where(eq(reviewReports.status, 'open')),
      db.select({ total: count() }).from(users).where(eq(users.isSuspended, true)),
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(grounds).where(and(eq(grounds.isActive, true), eq(grounds.verificationStatus, 'approved'))),
      db.select({ amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int`, bookings: count() }).from(bookings).where(eq(bookings.paymentStatus, 'paid')),
      db.select({ date: sql<string>`(${bookings.createdAt} AT TIME ZONE 'Asia/Karachi')::date::text`, amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int` }).from(bookings).where(and(eq(bookings.paymentStatus, 'paid'), sql`${bookings.createdAt} >= now() - interval '31 days'`)).groupBy(sql`(${bookings.createdAt} AT TIME ZONE 'Asia/Karachi')::date`),
      db.select({ city: grounds.city, bookings: count() }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).where(eq(bookings.paymentStatus, 'paid')).groupBy(grounds.city).orderBy(desc(count())).limit(4),
      db.select({ id: grounds.id, title: grounds.title, image: grounds.coverImage, images: grounds.images, amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int`, bookings: count() }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).where(eq(bookings.paymentStatus, 'paid')).groupBy(grounds.id).orderBy(desc(sql`sum(${bookings.totalAmount})`)).limit(5),
    ]);
    const now = new Date(Date.now() + 5 * 60 * 60 * 1000); const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const days = Array.from({ length: 30 }, (_, index) => { const day = new Date(today); day.setUTCDate(day.getUTCDate() - (29 - index)); return day; });
    const key = (date: Date) => date.toISOString().slice(0, 10);
    const daily = new Map(revenueRows.map((row) => [row.date, row.amount]));
    response.json({ counts: { pending_vendors: pendingVendors[0]?.total ?? 0, pending_grounds: pendingGrounds[0]?.total ?? 0, open_review_reports: openReports[0]?.total ?? 0, suspended_users: suspendedUsers[0]?.total ?? 0, total_users: totalUsers[0]?.total ?? 0, active_verified_grounds: activeGrounds[0]?.total ?? 0 }, analytics: { paid_gmv: paidTotals[0]?.amount ?? 0, total_bookings: paidTotals[0]?.bookings ?? 0, revenue_trend: days.map((day) => ({ date: key(day), amount: daily.get(key(day)) || 0 })), bookings_by_city: cityRows.map(({ city, bookings }) => ({ city, count: bookings })), top_grounds: topGroundRows.map(({ id, title, image, images, amount, bookings }) => ({ id, title, image: image || images[0] || null, amount, bookings })) } });
  };

  listVendors = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const status = typeof request.query.status === 'string' ? request.query.status : 'pending';
    const { page, limit, offset } = pagination(request);
    const includeChangesRequested = request.query.include_changes_requested === 'true';
    if (!['draft', 'pending', 'under_review', 'approved', 'rejected', 'suspended', 'all'].includes(status)) throw new AppError('invalid_status', 'Use a valid vendor status', 422);
    const changesRequested = or(eq(vendorVerifications.identityStatus, 'changes_requested'), eq(vendorVerifications.businessStatus, 'changes_requested'), eq(vendorVerifications.payoutStatus, 'changes_requested'));
    const where = status === 'all' ? undefined : status === 'under_review' && includeChangesRequested ? or(eq(vendors.verificationStatus, 'under_review'), and(eq(vendors.verificationStatus, 'draft'), changesRequested)) : eq(vendors.verificationStatus, status);
    const rows = await db.select({ vendor: vendors, user: users, verification: vendorVerifications }).from(vendors).innerJoin(users, eq(vendors.userId, users.id)).leftJoin(vendorVerifications, eq(vendorVerifications.vendorId, vendors.id))
      .where(where).orderBy(desc(vendors.createdAt)).limit(limit + 1).offset(offset);
    response.json({ vendors: rows.slice(0, limit).map(({ vendor, user, verification }) => ({ id: vendor.id, business_name: vendor.businessName, business_city: vendor.businessCity, business_phone: vendor.businessPhone, verification_status: verification && [verification.identityStatus, verification.businessStatus, verification.payoutStatus].includes('changes_requested') ? 'changes_requested' : vendor.verificationStatus, verification_reason: vendor.verificationReason, is_active: vendor.isActive, owner: { id: user.id, full_name: user.fullName, phone: user.phone, is_suspended: user.isSuspended }, created_at: vendor.createdAt.toISOString() })), pagination: { page, limit, has_more: rows.length > limit } });
  };

  vendorVerification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Vendor id'); const vendor = (await db.select().from(vendors).where(eq(vendors.id, id)).limit(1))[0];
    if (!vendor) throw new AppError('not_found', 'Vendor was not found', 404);
    const verification = (await db.select().from(vendorVerifications).where(eq(vendorVerifications.vendorId, id)).limit(1))[0];
    if (!verification) { response.json({ vendor: { id: vendor.id, business_name: vendor.businessName }, verification: null }); return; }
    const documents = await db.select({ id: vendorVerificationDocuments.id, type: vendorVerificationDocuments.type, contentType: vendorVerificationDocuments.contentType, originalFilename: vendorVerificationDocuments.originalFilename }).from(vendorVerificationDocuments).where(eq(vendorVerificationDocuments.verificationId, verification.id));
    response.json({ vendor: { id: vendor.id, business_name: vendor.businessName, business_city: vendor.businessCity }, verification: { id: verification.id, status: verification.status, identity_status: verification.identityStatus, identity_reason: verification.identityReason, business_status: verification.businessStatus, business_reason: verification.businessReason, payout_status: verification.payoutStatus, payout_reason: verification.payoutReason, cnic_last_four: verification.cnicLastFour, business_type: verification.businessType, business_number_last_four: verification.businessNumberLastFour, registrant_relationship: verification.registrantRelationship, payout_bank_name: verification.payoutBankName, payout_account_title: verification.payoutAccountTitle, documents } });
  };

  vendorDetail = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Vendor id');
    const row = (await db.select({ vendor: vendors, owner: users }).from(vendors).innerJoin(users, eq(vendors.userId, users.id)).where(eq(vendors.id, id)).limit(1))[0];
    if (!row) throw new AppError('not_found', 'Vendor was not found', 404);
    const managedGrounds = await db.select({ id: grounds.id, title: grounds.title, city: grounds.city, address: grounds.address, pitchType: grounds.pitchType, isActive: grounds.isActive, verificationStatus: grounds.verificationStatus, rating: grounds.rating, createdAt: grounds.createdAt }).from(grounds).where(eq(grounds.vendorId, id)).orderBy(desc(grounds.createdAt));
    response.json({ vendor: { id: row.vendor.id, business_name: row.vendor.businessName, business_phone: row.vendor.businessPhone, business_city: row.vendor.businessCity, business_description: row.vendor.businessDescription, verification_status: row.vendor.verificationStatus, verification_reason: row.vendor.verificationReason, is_active: row.vendor.isActive, is_verified: row.vendor.isVerified, rating: row.vendor.rating, total_reviews: row.vendor.totalReviews, total_earnings: row.vendor.totalEarnings, pending_earnings: row.vendor.pendingEarnings, created_at: row.vendor.createdAt.toISOString(), owner: { id: row.owner.id, full_name: row.owner.fullName, phone: row.owner.phone, email: row.owner.email, city: row.owner.city, is_suspended: row.owner.isSuspended } }, grounds: managedGrounds.map((ground) => ({ id: ground.id, title: ground.title, city: ground.city, address: ground.address, pitch_type: ground.pitchType, is_active: ground.isActive, verification_status: ground.verificationStatus, rating: ground.rating, created_at: ground.createdAt.toISOString() })) });
  };

  reviewVendorVerification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const actorId = request.auth!.userId; const vendorId = param(request.params.id, 'Vendor id'); const area = String(request.params.area || ''); const body = request.body as Record<string, unknown>; const action = body?.action; const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;
    if (!['identity', 'business', 'payout'].includes(area) || !['approved', 'rejected', 'changes_requested'].includes(String(action))) throw new AppError('invalid_verification', 'Use a valid verification area and action', 422);
    if (action !== 'approved' && !reason) throw new AppError('invalid_verification', 'A reason is required when rejecting or requesting changes', 422);
    const verification = (await db.select().from(vendorVerifications).where(eq(vendorVerifications.vendorId, vendorId)).limit(1))[0]; if (!verification) throw new AppError('not_found', 'Vendor verification was not found', 404);
    const vendor = (await db.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, vendorId)).limit(1))[0]; if (!vendor) throw new AppError('not_found', 'Vendor was not found', 404);
    const values: Partial<typeof vendorVerifications.$inferInsert> = { reviewedBy: actorId, reviewedAt: new Date(), updatedAt: new Date() };
    if (area === 'identity') { values.identityStatus = String(action); values.identityReason = reason; }
    if (area === 'business') { values.businessStatus = String(action); values.businessReason = reason; }
    if (area === 'payout') { values.payoutStatus = String(action); values.payoutReason = reason; }
    const statuses = [values.identityStatus ?? verification.identityStatus, values.businessStatus ?? verification.businessStatus, values.payoutStatus ?? verification.payoutStatus]; const vendorStatus = statuses.some((status) => status === 'rejected') ? 'rejected' : statuses.some((status) => status === 'changes_requested') ? 'draft' : 'under_review';
    values.status = vendorStatus;
    const [updated] = await db.update(vendorVerifications).set(values).where(eq(vendorVerifications.id, verification.id)).returning();
    await db.update(vendors).set({ verificationStatus: vendorStatus, verificationReason: reason, isVerified: false, updatedAt: new Date() }).where(eq(vendors.id, vendorId));
    await audit(actorId, `vendor_${area}_${action}`, 'vendor', vendorId, reason);
    if (action !== 'approved') { const actionText = String(action) === 'rejected' ? 'rejected' : 'needs changes'; const areaText = area.charAt(0).toUpperCase() + area.slice(1); const title = `${areaText} verification ${actionText}`; const message = reason || `Your ${area} verification ${actionText}.`; const data = { destination: 'vendor_verification', area, action: String(action) }; await db.insert(notifications).values({ userId: vendor.userId, type: 'vendor_verification', title, message, data }); void sendExpoPush({ userIds: [vendor.userId], title: 'Vendor verification update', body: 'Open TurfBookPK to review your verification status.', data }); }
    response.json({ verification: { status: vendorStatus, identity_status: updated?.identityStatus, business_status: updated?.businessStatus, payout_status: updated?.payoutStatus } });
  };

  approveVendor = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const actorId = request.auth!.userId; const vendorId = param(request.params.id, 'Vendor id');
    const verification = (await db.select().from(vendorVerifications).where(eq(vendorVerifications.vendorId, vendorId)).limit(1))[0];
    const vendor = (await db.select({ id: vendors.id, userId: vendors.userId }).from(vendors).where(eq(vendors.id, vendorId)).limit(1))[0];
    if (!verification || !vendor) throw new AppError('not_found', 'Vendor verification was not found', 404);
    if (![verification.identityStatus, verification.businessStatus, verification.payoutStatus].every((status) => status === 'approved')) throw new AppError('verification_incomplete', 'Approve identity, business, and payout before approving this vendor', 422);
    await db.transaction(async (tx) => { await tx.update(vendorVerifications).set({ status: 'approved', reviewedBy: actorId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(vendorVerifications.id, verification.id)); await tx.update(vendors).set({ verificationStatus: 'approved', verificationReason: null, isVerified: true, updatedAt: new Date() }).where(eq(vendors.id, vendorId)); });
    await audit(actorId, 'vendor_final_approved', 'vendor', vendorId, null);
    const data = { destination: 'vendor_verification', action: 'approved' };
    await db.insert(notifications).values({ userId: vendor.userId, type: 'vendor_verification', title: 'Vendor account approved', message: 'Your vendor account is approved. You can now switch to vendor mode and add grounds.', data });
    void sendExpoPush({ userIds: [vendor.userId], title: 'Vendor account approved', body: 'Your TurfBookPK vendor account is ready.', data });
    response.json({ vendor: { id: vendorId, verification_status: 'approved', is_verified: true } });
  };

  vendorDocumentDownload = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Document id'); const document = (await db.select().from(vendorVerificationDocuments).where(eq(vendorVerificationDocuments.id, id)).limit(1))[0];
    if (!document) throw new AppError('not_found', 'Document was not found', 404);
    response.setHeader('Cache-Control', 'no-store');
    response.json({ download_url: privateDocumentUrl(document.storageKey, document.contentType), expires_in_seconds: 300 });
  };

  listGrounds = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const status = typeof request.query.status === 'string' ? request.query.status : 'under_review';
    const { page, limit, offset } = pagination(request);
    const includeChangesRequested = request.query.include_changes_requested === 'true';
    if (!['draft', 'pending', 'under_review', 'changes_requested', 'approved', 'rejected', 'suspended', 'all'].includes(status)) throw new AppError('invalid_status', 'Use a valid ground status', 422);
    const rows = await db.select({ ground: grounds, vendor: vendors }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id))
      .leftJoin(groundVerifications, eq(groundVerifications.groundId, grounds.id))
      .where(status === 'all' ? undefined : status === 'under_review' && includeChangesRequested ? or(eq(grounds.verificationStatus, 'under_review'), and(eq(grounds.verificationStatus, 'draft'), eq(groundVerifications.authorityStatus, 'changes_requested'))) : eq(grounds.verificationStatus, status)).orderBy(desc(grounds.createdAt)).limit(limit + 1).offset(offset);
    response.json({ grounds: rows.slice(0, limit).map(({ ground, vendor }) => ({ id: ground.id, title: ground.title, city: ground.city, address: ground.address, amenities: ground.amenities, images: ground.images, cover_image: ground.coverImage, pitch_type: ground.pitchType, price_per_hour: ground.pricePerHour, verification_status: ground.verificationStatus, verification_reason: ground.verificationReason, is_active: ground.isActive, vendor: { id: vendor.id, business_name: vendor.businessName }, created_at: ground.createdAt.toISOString() })), pagination: { page, limit, has_more: rows.length > limit } });
  };

  groundDetail = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Ground id');
    const row = (await db.select({ ground: grounds, vendor: vendors, owner: users }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).innerJoin(users, eq(vendors.userId, users.id)).where(eq(grounds.id, id)).limit(1))[0];
    if (!row) throw new AppError('not_found', 'Ground was not found', 404);
    const entries = await db.select({ review: reviews, player: users }).from(reviews).innerJoin(users, eq(reviews.playerId, users.id)).where(eq(reviews.groundId, id)).orderBy(desc(reviews.createdAt)).limit(100);
    response.json({
      ground: {
        id: row.ground.id, title: row.ground.title, description: row.ground.description, location: row.ground.location, city: row.ground.city, address: row.ground.address,
        latitude: row.ground.latitude, longitude: row.ground.longitude, amenities: row.ground.amenities, images: row.ground.images, cover_image: row.ground.coverImage,
        pitch_type: row.ground.pitchType, price_per_hour: row.ground.pricePerHour, peak_percentage: row.ground.peakPercentage, peak_windows: row.ground.peakWindows,
        operating_hours: row.ground.operatingHours, rules: row.ground.rules, cancellation_policy: row.ground.cancellationPolicy, is_active: row.ground.isActive,
        is_verified: row.ground.isVerified, verification_status: row.ground.verificationStatus, verification_reason: row.ground.verificationReason,
        rating: row.ground.rating, total_reviews: row.ground.totalReviews, created_at: row.ground.createdAt.toISOString(),
      },
      vendor: { id: row.vendor.id, business_name: row.vendor.businessName, business_phone: row.vendor.businessPhone, owner_name: row.owner.fullName },
      reviews: entries.map(({ review, player }) => ({ id: review.id, rating: review.rating, comment: review.comment, is_hidden: review.isHidden, hidden_reason: review.hiddenReason, created_at: review.createdAt.toISOString(), player: { id: player.id, full_name: player.fullName } })),
    });
  };

  groundVerification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Ground id');
    const row = (await db.select({ ground: grounds, vendor: vendors, owner: users }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).innerJoin(users, eq(vendors.userId, users.id)).where(eq(grounds.id, id)).limit(1))[0];
    if (!row) throw new AppError('not_found', 'Ground was not found', 404);
    const verification = (await db.select().from(groundVerifications).where(eq(groundVerifications.groundId, id)).limit(1))[0];
    const documents = verification ? await db.select({ id: groundVerificationDocuments.id, type: groundVerificationDocuments.type, contentType: groundVerificationDocuments.contentType, originalFilename: groundVerificationDocuments.originalFilename }).from(groundVerificationDocuments).where(eq(groundVerificationDocuments.verificationId, verification.id)) : [];
    response.json({ ground: { id: row.ground.id, title: row.ground.title, description: row.ground.description, location: row.ground.location, city: row.ground.city, address: row.ground.address, latitude: row.ground.latitude, longitude: row.ground.longitude, images: row.ground.images, cover_image: row.ground.coverImage, pitch_type: row.ground.pitchType, amenities: row.ground.amenities, price_per_hour: row.ground.pricePerHour, operating_hours: row.ground.operatingHours, cancellation_policy: row.ground.cancellationPolicy, verification_status: row.ground.verificationStatus, verification_reason: row.ground.verificationReason }, vendor: { id: row.vendor.id, business_name: row.vendor.businessName, owner_name: row.owner.fullName }, verification: verification ? { id: verification.id, status: verification.status, authority_status: verification.authorityStatus, authority_reason: verification.authorityReason, relationship: verification.relationship, document_expiry_date: verification.documentExpiryDate, documents } : null });
  };

  reviewGroundVerification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const actorId = request.auth!.userId; const id = param(request.params.id, 'Ground id'); const body = request.body as Record<string, unknown>; const action = String(body?.action || ''); const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;
    if (!['approved', 'rejected', 'changes_requested'].includes(action)) throw new AppError('invalid_verification', 'Use approved, rejected, or changes_requested', 422);
    if (action !== 'approved' && !reason) throw new AppError('invalid_verification', 'A reason is required when rejecting or requesting changes', 422);
    const row = (await db.select({ ground: grounds, vendor: vendors }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(eq(grounds.id, id)).limit(1))[0];
    const verification = (await db.select().from(groundVerifications).where(eq(groundVerifications.groundId, id)).limit(1))[0];
    if (!row || !verification) throw new AppError('not_found', 'Ground verification was not found', 404);
    const groundStatus = action === 'rejected' ? 'rejected' : action === 'changes_requested' ? 'draft' : 'under_review';
    await db.transaction(async (tx) => { await tx.update(groundVerifications).set({ status: groundStatus, authorityStatus: action, authorityReason: reason, reviewedAt: new Date(), reviewedBy: actorId, updatedAt: new Date() }).where(eq(groundVerifications.id, verification.id)); await tx.update(grounds).set({ verificationStatus: groundStatus, verificationReason: reason, isVerified: false, updatedAt: new Date() }).where(eq(grounds.id, id)); });
    await audit(actorId, `ground_authority_${action}`, 'ground', id, reason);
    if (action !== 'approved') { const data = { destination: 'ground_verification', ground_id: id, action }; await db.insert(notifications).values({ userId: row.vendor.userId, type: 'ground_verification', title: `Ground verification ${action === 'rejected' ? 'rejected' : 'needs changes'}`, message: reason || 'Open TurfBookPK to review the ground verification.', data }); void sendExpoPush({ userIds: [row.vendor.userId], title: 'Ground verification update', body: 'Open TurfBookPK to review your ground verification.', data }); }
    response.json({ ground: { id, verification_status: groundStatus } });
  };

  approveGround = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const actorId = request.auth!.userId; const id = param(request.params.id, 'Ground id');
    const row = (await db.select({ ground: grounds, vendor: vendors }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(eq(grounds.id, id)).limit(1))[0];
    const verification = (await db.select().from(groundVerifications).where(eq(groundVerifications.groundId, id)).limit(1))[0];
    if (!row || !verification) throw new AppError('not_found', 'Ground verification was not found', 404);
    if (row.vendor.verificationStatus !== 'approved') throw new AppError('vendor_verification_required', 'The vendor must be approved before this ground can be approved', 422);
    if (verification.authorityStatus !== 'approved') throw new AppError('verification_incomplete', 'Approve the ground authority proof before final approval', 422);
    await db.transaction(async (tx) => { await tx.update(groundVerifications).set({ status: 'approved', reviewedAt: new Date(), reviewedBy: actorId, updatedAt: new Date() }).where(eq(groundVerifications.id, verification.id)); await tx.update(grounds).set({ verificationStatus: 'approved', verificationReason: null, isVerified: true, isActive: true, updatedAt: new Date() }).where(eq(grounds.id, id)); });
    await audit(actorId, 'ground_final_approved', 'ground', id, null);
    const data = { destination: 'ground_verification', ground_id: id, action: 'approved' };
    await db.insert(notifications).values({ userId: row.vendor.userId, type: 'ground_verification', title: 'Ground approved', message: `${row.ground.title} is approved and can now accept bookings.`, data });
    void sendExpoPush({ userIds: [row.vendor.userId], title: 'Ground approved', body: 'Your ground is now live on TurfBookPK.', data });
    response.json({ ground: { id, verification_status: 'approved', is_verified: true } });
  };

  groundDocumentDownload = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Document id'); const document = (await db.select().from(groundVerificationDocuments).where(eq(groundVerificationDocuments.id, id)).limit(1))[0];
    if (!document) throw new AppError('not_found', 'Document was not found', 404);
    response.setHeader('Cache-Control', 'no-store');
    response.json({ download_url: privateDocumentUrl(document.storageKey, document.contentType), expires_in_seconds: 300 });
  };

  listUsers = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : '';
    const { page, limit, offset } = pagination(request);
    const rows = await db.select({ id: users.id, fullName: users.fullName, phone: users.phone, city: users.city, role: users.role, isSuspended: users.isSuspended, createdAt: users.createdAt })
      .from(users).where(query ? sql`(${users.fullName} ILIKE ${`%${query}%`} OR ${users.phone} ILIKE ${`%${query}%`} OR ${users.city} ILIKE ${`%${query}%`})` : undefined).orderBy(desc(users.createdAt)).limit(limit + 1).offset(offset);
    response.json({ users: rows.slice(0, limit).map((user) => ({ id: user.id, full_name: user.fullName, phone: user.phone, city: user.city, role: user.role, is_suspended: user.isSuspended, created_at: user.createdAt.toISOString() })), pagination: { page, limit, has_more: rows.length > limit } });
  };

  auditLogs = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const action = typeof request.query.action === 'string' ? request.query.action.trim().slice(0, 120) : '';
    const targetType = typeof request.query.target_type === 'string' ? request.query.target_type.trim().slice(0, 80) : '';
    const actorId = typeof request.query.actor_id === 'string' ? request.query.actor_id.trim() : '';
    const page = Number(request.query.page || 1); const limit = Number(request.query.limit || 50);
    const cursor = parsePaginationCursor(request.query.cursor);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10_000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new AppError('invalid_pagination', 'Use a valid page and limit', 422);
    const conditions = [action ? eq(adminAuditLogs.action, action) : undefined, targetType ? eq(adminAuditLogs.targetType, targetType) : undefined, actorId ? eq(adminAuditLogs.actorId, actorId) : undefined].filter(Boolean) as ReturnType<typeof eq>[];
    const rows = await db.select({ log: adminAuditLogs, actor: users }).from(adminAuditLogs).innerJoin(users, eq(adminAuditLogs.actorId, users.id)).where(and(...conditions, cursor ? or(lt(adminAuditLogs.createdAt, cursor.createdAt), and(eq(adminAuditLogs.createdAt, cursor.createdAt), lt(adminAuditLogs.id, cursor.id))) : undefined)).orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id)).limit(limit + 1).offset(cursor ? 0 : (page - 1) * limit);
    const pageRows = rows.slice(0, limit);
    response.json({ logs: pageRows.map(({ log, actor }) => ({ id: log.id, action: log.action, target_type: log.targetType, target_id: log.targetId, reason: log.reason, metadata: log.metadata, created_at: log.createdAt.toISOString(), actor: { id: actor.id, full_name: actor.fullName, phone: actor.phone } })), pagination: { page, limit, has_more: rows.length > limit, next_cursor: rows.length > limit ? nextPaginationCursor(pageRows.at(-1)?.log) : null } });
  };

  listTransactions = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const status = typeof request.query.status === 'string' ? request.query.status : 'all';
    if (!['all', 'pending', 'paid', 'failed', 'cancelled', 'refund_pending', 'refunded', 'expired', 'unknown', 'manual_review'].includes(status)) throw new AppError('invalid_status', 'Invalid payment status', 422);
    const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : ''; const { page, limit, offset } = pagination(request);
    const cursor = parsePaginationCursor(request.query.cursor);
    const statusCondition = status === 'manual_review' ? eq(paymentAttempts.reviewStatus, 'manual_review') : status === 'unknown' ? eq(paymentAttempts.providerStatus, 'unknown') : status === 'expired' ? eq(paymentAttempts.providerStatus, 'expired') : status === 'all' ? undefined : eq(paymentAttempts.status, status as typeof paymentAttempts.status.enumValues[number]);
    const rows = await db.select({ attempt: paymentAttempts, booking: bookings, order: bookingOrders, ground: grounds, player: users, vendor: vendors }).from(paymentAttempts)
      .leftJoin(bookings, eq(paymentAttempts.bookingId, bookings.id)).leftJoin(bookingOrders, eq(paymentAttempts.orderId, bookingOrders.id)).leftJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(users, eq(paymentAttempts.playerId, users.id)).innerJoin(vendors, eq(paymentAttempts.vendorId, vendors.id))
      .where(and(statusCondition, query ? sql`(${bookings.bookingNumber} ILIKE ${`%${query}%`} OR ${bookingOrders.orderNumber} ILIKE ${`%${query}%`} OR ${paymentAttempts.providerReference} ILIKE ${`%${query}%`} OR ${paymentAttempts.consumerNumber} ILIKE ${`%${query}%`} OR ${grounds.title} ILIKE ${`%${query}%`} OR ${users.fullName} ILIKE ${`%${query}%`} OR ${vendors.businessName} ILIKE ${`%${query}%`})` : undefined, cursor ? or(lt(paymentAttempts.createdAt, cursor.createdAt), and(eq(paymentAttempts.createdAt, cursor.createdAt), lt(paymentAttempts.id, cursor.id))) : undefined)).orderBy(desc(paymentAttempts.createdAt), desc(paymentAttempts.id)).limit(limit + 1).offset(cursor ? 0 : offset);
    const pageRows = rows.slice(0, limit);
    response.json({ transactions: pageRows.map(({ attempt, booking, order, ground, player, vendor }) => ({ id: attempt.id, provider: attempt.provider, provider_reference: attempt.providerReference, clink_id: attempt.providerReference, consumer_number: attempt.consumerNumber, provider_status: attempt.providerStatus, review_status: attempt.reviewStatus, expiry_retry_count: attempt.expiryRetryCount, expiry_next_attempt_at: attempt.expiryNextAttemptAt?.toISOString() || null, amount: attempt.amount, service_charge: attempt.serviceCharge, final_payable_amount: attempt.finalPayableAmount, status: attempt.status, booking_number: booking?.bookingNumber || order?.orderNumber || 'Payment attempt', ground_title: ground?.title || (order ? 'Multi-slot order' : 'Unknown ground'), player_name: player.fullName, vendor_name: vendor.businessName, created_at: attempt.createdAt.toISOString(), expires_at: attempt.expiresAt?.toISOString() || null, paid_at: attempt.paidAt?.toISOString() || null })), pagination: { page, limit, has_more: rows.length > limit, next_cursor: rows.length > limit ? nextPaginationCursor(pageRows.at(-1)?.attempt) : null } });
  };

  operations = async (_request: AuthenticatedRequest, response: Response): Promise<void> => {
    const [bookingTotals, paymentTotals, cityRows, payoutRows, outboxRows] = await Promise.all([
      db.select({ total: count(), refunded: sql<number>`coalesce(sum(${bookings.refundAmount}), 0)::int` }).from(bookings),
      db.select({ amount: sql<number>`coalesce(sum(${paymentAttempts.amount}), 0)::int` }).from(paymentAttempts).where(eq(paymentAttempts.status, 'paid')),
      db.select({ city: grounds.city, total: count() }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).groupBy(grounds.city).orderBy(desc(count())).limit(8),
      db.select({ amount: ledgerEntries.amount, status: ledgerEntries.status, createdAt: ledgerEntries.createdAt, vendorId: ledgerEntries.vendorId }).from(ledgerEntries).where(eq(ledgerEntries.type, 'payout')).orderBy(desc(ledgerEntries.createdAt)).limit(200),
      db.select({ status: notificationOutbox.status, total: count() }).from(notificationOutbox).groupBy(notificationOutbox.status),
    ]);
    response.json({ analytics: { total_bookings: bookingTotals[0]?.total ?? 0, paid_gmv: paymentTotals[0]?.amount ?? 0, refunded_amount: bookingTotals[0]?.refunded ?? 0, commission_bps: env.platformCommissionBps, bookings_by_city: cityRows.map(({ city, total }) => ({ city, count: total })) }, push_outbox: Object.fromEntries(outboxRows.map((row) => [row.status, row.total])), payouts: payoutRows.map((row) => ({ vendor_id: row.vendorId, amount: row.amount, status: row.status, created_at: row.createdAt.toISOString() })) });
  };

  deadPushes = async (_request: AuthenticatedRequest, response: Response): Promise<void> => {
    const rows = await db.select({ id: notificationOutbox.id, notificationId: notificationOutbox.notificationId, attempts: notificationOutbox.attempts, lastError: notificationOutbox.lastError, createdAt: notificationOutbox.createdAt, updatedAt: notificationOutbox.updatedAt })
      .from(notificationOutbox).where(eq(notificationOutbox.status, 'dead')).orderBy(desc(notificationOutbox.updatedAt)).limit(100);
    response.json({ pushes: rows.map((row) => ({ id: row.id, notification_id: row.notificationId, attempts: row.attempts, last_error: row.lastError, created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString() })) });
  };

  retryDeadPush = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Outbox id');
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim().slice(0, 500) : '';
    if (!reason) throw new AppError('reason_required', 'Explain why this push should be retried', 422);
    const [row] = await db.update(notificationOutbox).set({ status: 'pending', attempts: 0, availableAt: new Date(), lockedUntil: null, lastError: null, updatedAt: new Date() })
      .where(and(eq(notificationOutbox.id, id), eq(notificationOutbox.status, 'dead'))).returning({ id: notificationOutbox.id });
    if (!row) throw new AppError('not_found', 'Dead push was not found', 404);
    await audit(request.auth!.userId, 'push_outbox_manual_retry', 'notification_outbox', id, reason);
    response.json({ id, status: 'pending' });
  };

  listRefunds = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : ''; const status = typeof request.query.status === 'string' ? request.query.status : 'all'; const { page, limit, offset } = pagination(request);
    if (!['all', ...bookings.paymentStatus.enumValues].includes(status)) throw new AppError('invalid_status', 'Invalid refund status', 422);
    const rows = await db.select({ booking: bookings, ground: grounds, player: users, vendor: vendors }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(users, eq(bookings.playerId, users.id)).innerJoin(vendors, eq(bookings.vendorId, vendors.id))
      .where(and(sql`${bookings.refundAmount} > 0`, status === 'all' ? undefined : eq(bookings.paymentStatus, status as typeof bookings.paymentStatus.enumValues[number]), query ? sql`(${bookings.bookingNumber} ILIKE ${`%${query}%`} OR ${grounds.title} ILIKE ${`%${query}%`} OR ${users.fullName} ILIKE ${`%${query}%`} OR ${vendors.businessName} ILIKE ${`%${query}%`})` : undefined))
      .orderBy(desc(bookings.cancelledAt), desc(bookings.id)).limit(limit + 1).offset(offset);
    response.json({ refunds: rows.slice(0, limit).map(({ booking, ground, player, vendor }) => ({ id: booking.id, booking_number: booking.bookingNumber, ground_title: ground.title, player_name: player.fullName, vendor_name: vendor.businessName, amount: booking.refundAmount, status: booking.paymentStatus, reason: booking.cancellationReason, cancelled_at: booking.cancelledAt?.toISOString() || null })), pagination: { page, limit, has_more: rows.length > limit } });
  };

  setVendorVerification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const actorId = request.auth!.userId; const id = param(request.params.id, 'Vendor id'); const { status, reason } = verificationBody(request.body);
    const [vendor] = await db.update(vendors).set({ verificationStatus: status, verificationReason: reason, isVerified: status === 'approved', updatedAt: new Date() }).where(eq(vendors.id, id)).returning();
    if (!vendor) throw new AppError('not_found', 'Vendor was not found', 404);
    await audit(actorId, `vendor_verification_${status}`, 'vendor', id, reason);
    response.json({ vendor: { id: vendor.id, verification_status: vendor.verificationStatus, verification_reason: vendor.verificationReason, is_verified: vendor.isVerified } });
  };

  setGroundVerification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const actorId = request.auth!.userId; const id = param(request.params.id, 'Ground id'); const { status, reason } = verificationBody(request.body);
    const [ground] = await db.update(grounds).set({ verificationStatus: status, verificationReason: reason, isVerified: status === 'approved', updatedAt: new Date() }).where(eq(grounds.id, id)).returning();
    if (!ground) throw new AppError('not_found', 'Ground was not found', 404);
    await audit(actorId, `ground_verification_${status}`, 'ground', id, reason);
    response.json({ ground: { id: ground.id, verification_status: ground.verificationStatus, verification_reason: ground.verificationReason, is_verified: ground.isVerified } });
  };

  setGroundActivation = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const actorId = request.auth!.userId; const id = param(request.params.id, 'Ground id'); const active = (request.body as Record<string, unknown>)?.is_active;
    const reason = typeof (request.body as Record<string, unknown>)?.reason === 'string' ? String((request.body as Record<string, unknown>).reason).trim().slice(0, 500) || null : null;
    if (typeof active !== 'boolean') throw new AppError('invalid_ground', 'is_active must be true or false', 422);
    if (!active && !reason) throw new AppError('invalid_ground', 'A suspension reason is required', 422);
    const [ground] = await db.update(grounds).set({ isActive: active, updatedAt: new Date() }).where(eq(grounds.id, id)).returning();
    if (!ground) throw new AppError('not_found', 'Ground was not found', 404);
    await audit(actorId, active ? 'ground_activated' : 'ground_suspended', 'ground', id, reason);
    response.json({ ground: { id: ground.id, is_active: ground.isActive } });
  };

  listReports = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const status = typeof request.query.status === 'string' ? request.query.status : 'all'; const { page, limit, offset } = pagination(request);
    if (!['all', 'open', 'resolved', 'dismissed'].includes(status)) throw new AppError('invalid_status', 'Use a valid report status', 422);
    const rows = await db.select({ report: reviewReports, review: reviews, reporter: users, ground: grounds }).from(reviewReports)
      .innerJoin(reviews, eq(reviewReports.reviewId, reviews.id)).innerJoin(users, eq(reviewReports.reporterId, users.id)).innerJoin(grounds, eq(reviews.groundId, grounds.id))
      .where(status === 'all' ? undefined : eq(reviewReports.status, status)).orderBy(desc(reviewReports.createdAt)).limit(limit + 1).offset(offset);
    response.json({ reports: rows.slice(0, limit).map(({ report, review, reporter, ground }) => ({ id: report.id, status: report.status, reason: report.reason, resolution_reason: report.resolutionReason, review: { id: review.id, rating: review.rating, comment: review.comment, is_hidden: review.isHidden }, reporter: { id: reporter.id, full_name: reporter.fullName }, ground: { id: ground.id, title: ground.title }, created_at: report.createdAt.toISOString() })), pagination: { page, limit, has_more: rows.length > limit } });
  };

  resolveReport = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const actorId = request.auth!.userId; const id = param(request.params.id, 'Report id'); const body = request.body as Record<string, unknown>;
    const status = body?.status; const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;
    if (status !== 'resolved' && status !== 'dismissed') throw new AppError('invalid_report', 'Status must be resolved or dismissed', 422);
    const [report] = await db.update(reviewReports).set({ status, resolutionReason: reason, resolvedBy: actorId, resolvedAt: new Date() }).where(eq(reviewReports.id, id)).returning();
    if (!report) throw new AppError('not_found', 'Report was not found', 404);
    if (typeof body?.hide_review === 'boolean') await db.update(reviews).set({ isHidden: body.hide_review, hiddenReason: body.hide_review ? reason || 'Hidden by administrator' : null, hiddenAt: body.hide_review ? new Date() : null, updatedAt: new Date() }).where(eq(reviews.id, report.reviewId));
    await audit(actorId, `review_report_${status}`, 'review_report', id, reason, { hide_review: body?.hide_review === true });
    response.json({ report: { id: report.id, status: report.status } });
  };

  setUserSuspension = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const actorId = request.auth!.userId; const id = param(request.params.id, 'User id'); const suspended = (request.body as Record<string, unknown>)?.is_suspended;
    const reason = typeof (request.body as Record<string, unknown>)?.reason === 'string' ? String((request.body as Record<string, unknown>).reason).trim().slice(0, 500) || null : null;
    if (typeof suspended !== 'boolean') throw new AppError('invalid_user', 'is_suspended must be true or false', 422);
    if (id === actorId) throw new AppError('invalid_user', 'You cannot suspend your own administrator account', 422);
    const [user] = await db.update(users).set({ isSuspended: suspended, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    if (!user) throw new AppError('not_found', 'User was not found', 404);
    await audit(actorId, suspended ? 'user_suspended' : 'user_unsuspended', 'user', id, reason);
    response.json({ user: { id: user.id, is_suspended: user.isSuspended } });
  };
}
