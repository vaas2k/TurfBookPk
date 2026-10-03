import { and, count, desc, eq, or, sql } from 'drizzle-orm';
import { Response } from 'express';
import { createHash } from 'node:crypto';
import { db } from '../database/client.js';
import { adminAuditLogs, bookings, groundVerificationDocuments, groundVerifications, grounds, ledgerEntries, notifications, paymentAttempts, reviewReports, reviews, users, vendorVerificationDocuments, vendorVerifications, vendors } from '../database/schema.js';
import { env } from '../configs/env.js';
import { AppError } from '../helpers/errors.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendExpoPush } from '../services/expoPushService.js';

type VerificationStatus = 'pending' | 'approved' | 'rejected';

function param(value: string | string[] | undefined, name: string): string {
  if (typeof value !== 'string' || !value) throw new AppError('invalid_request', `${name} is required`, 422);
  return value;
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
    const [pendingVendors, pendingGrounds, openReports, suspendedUsers, totalUsers, activeGrounds] = await Promise.all([
      db.select({ total: count() }).from(vendors).where(eq(vendors.verificationStatus, 'pending')),
      db.select({ total: count() }).from(grounds).where(eq(grounds.verificationStatus, 'pending')),
      db.select({ total: count() }).from(reviewReports).where(eq(reviewReports.status, 'open')),
      db.select({ total: count() }).from(users).where(eq(users.isSuspended, true)),
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(grounds).where(and(eq(grounds.isActive, true), eq(grounds.verificationStatus, 'approved'))),
    ]);
    response.json({ counts: { pending_vendors: pendingVendors[0]?.total ?? 0, pending_grounds: pendingGrounds[0]?.total ?? 0, open_review_reports: openReports[0]?.total ?? 0, suspended_users: suspendedUsers[0]?.total ?? 0, total_users: totalUsers[0]?.total ?? 0, active_verified_grounds: activeGrounds[0]?.total ?? 0 } });
  };

  listVendors = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const status = typeof request.query.status === 'string' ? request.query.status : 'pending';
    const includeChangesRequested = request.query.include_changes_requested === 'true';
    if (!['draft', 'pending', 'under_review', 'approved', 'rejected', 'suspended', 'all'].includes(status)) throw new AppError('invalid_status', 'Use a valid vendor status', 422);
    const changesRequested = or(eq(vendorVerifications.identityStatus, 'changes_requested'), eq(vendorVerifications.businessStatus, 'changes_requested'), eq(vendorVerifications.payoutStatus, 'changes_requested'));
    const where = status === 'all' ? undefined : status === 'under_review' && includeChangesRequested ? or(eq(vendors.verificationStatus, 'under_review'), and(eq(vendors.verificationStatus, 'draft'), changesRequested)) : eq(vendors.verificationStatus, status);
    const rows = await db.select({ vendor: vendors, user: users, verification: vendorVerifications }).from(vendors).innerJoin(users, eq(vendors.userId, users.id)).leftJoin(vendorVerifications, eq(vendorVerifications.vendorId, vendors.id))
      .where(where).orderBy(desc(vendors.createdAt)).limit(100);
    response.json({ vendors: rows.map(({ vendor, user, verification }) => ({ id: vendor.id, business_name: vendor.businessName, business_city: vendor.businessCity, business_phone: vendor.businessPhone, verification_status: verification && [verification.identityStatus, verification.businessStatus, verification.payoutStatus].includes('changes_requested') ? 'changes_requested' : vendor.verificationStatus, verification_reason: vendor.verificationReason, is_active: vendor.isActive, owner: { id: user.id, full_name: user.fullName, phone: user.phone, is_suspended: user.isSuspended }, created_at: vendor.createdAt.toISOString() })) });
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
    response.json({ download_url: privateDocumentUrl(document.storageKey, document.contentType), expires_in_seconds: 300 });
  };

  listGrounds = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const status = typeof request.query.status === 'string' ? request.query.status : 'under_review';
    const includeChangesRequested = request.query.include_changes_requested === 'true';
    if (!['draft', 'pending', 'under_review', 'changes_requested', 'approved', 'rejected', 'suspended', 'all'].includes(status)) throw new AppError('invalid_status', 'Use a valid ground status', 422);
    const rows = await db.select({ ground: grounds, vendor: vendors }).from(grounds).innerJoin(vendors, eq(grounds.vendorId, vendors.id))
      .leftJoin(groundVerifications, eq(groundVerifications.groundId, grounds.id))
      .where(status === 'all' ? undefined : status === 'under_review' && includeChangesRequested ? or(eq(grounds.verificationStatus, 'under_review'), and(eq(grounds.verificationStatus, 'draft'), eq(groundVerifications.authorityStatus, 'changes_requested'))) : eq(grounds.verificationStatus, status)).orderBy(desc(grounds.createdAt)).limit(100);
    response.json({ grounds: rows.map(({ ground, vendor }) => ({ id: ground.id, title: ground.title, city: ground.city, address: ground.address, amenities: ground.amenities, images: ground.images, cover_image: ground.coverImage, pitch_type: ground.pitchType, price_per_hour: ground.pricePerHour, verification_status: ground.verificationStatus, verification_reason: ground.verificationReason, is_active: ground.isActive, vendor: { id: vendor.id, business_name: vendor.businessName }, created_at: ground.createdAt.toISOString() })) });
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
    response.json({ download_url: privateDocumentUrl(document.storageKey, document.contentType), expires_in_seconds: 300 });
  };

  listUsers = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : '';
    const rows = await db.select({ id: users.id, fullName: users.fullName, phone: users.phone, city: users.city, role: users.role, isSuspended: users.isSuspended, createdAt: users.createdAt })
      .from(users).where(query ? sql`(${users.fullName} ILIKE ${`%${query}%`} OR ${users.phone} ILIKE ${`%${query}%`})` : undefined).orderBy(desc(users.createdAt)).limit(100);
    response.json({ users: rows.map((user) => ({ id: user.id, full_name: user.fullName, phone: user.phone, city: user.city, role: user.role, is_suspended: user.isSuspended, created_at: user.createdAt.toISOString() })) });
  };

  listTransactions = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const status = typeof request.query.status === 'string' ? request.query.status : 'all';
    if (!['all', 'pending', 'paid', 'failed', 'cancelled', 'refund_pending', 'refunded'].includes(status)) throw new AppError('invalid_status', 'Invalid payment status', 422);
    const rows = await db.select({ attempt: paymentAttempts, booking: bookings, ground: grounds, player: users, vendor: vendors }).from(paymentAttempts)
      .innerJoin(bookings, eq(paymentAttempts.bookingId, bookings.id)).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(users, eq(paymentAttempts.playerId, users.id)).innerJoin(vendors, eq(paymentAttempts.vendorId, vendors.id))
      .where(status === 'all' ? undefined : eq(paymentAttempts.status, status as typeof paymentAttempts.status.enumValues[number])).orderBy(desc(paymentAttempts.createdAt)).limit(200);
    response.json({ transactions: rows.map(({ attempt, booking, ground, player, vendor }) => ({ id: attempt.id, provider: attempt.provider, provider_reference: attempt.providerReference, amount: attempt.amount, status: attempt.status, booking_number: booking.bookingNumber, ground_title: ground.title, player_name: player.fullName, vendor_name: vendor.businessName, created_at: attempt.createdAt.toISOString(), paid_at: attempt.paidAt?.toISOString() || null })) });
  };

  operations = async (_request: AuthenticatedRequest, response: Response): Promise<void> => {
    const [bookingRows, paymentRows, payoutRows] = await Promise.all([
      db.select({ booking: bookings, city: grounds.city }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).limit(5_000),
      db.select({ amount: paymentAttempts.amount, status: paymentAttempts.status }).from(paymentAttempts).limit(5_000),
      db.select({ amount: ledgerEntries.amount, status: ledgerEntries.status, createdAt: ledgerEntries.createdAt, vendorId: ledgerEntries.vendorId }).from(ledgerEntries).where(eq(ledgerEntries.type, 'payout')).orderBy(desc(ledgerEntries.createdAt)).limit(200),
    ]);
    const cities = new Map<string, number>();
    for (const row of bookingRows) cities.set(row.city, (cities.get(row.city) || 0) + 1);
    const paidAmount = paymentRows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0);
    const refundedAmount = bookingRows.reduce((sum, row) => sum + row.booking.refundAmount, 0);
    response.json({ analytics: { total_bookings: bookingRows.length, paid_gmv: paidAmount, refunded_amount: refundedAmount, commission_bps: env.platformCommissionBps, bookings_by_city: [...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([city, count]) => ({ city, count })) }, payouts: payoutRows.map((row) => ({ vendor_id: row.vendorId, amount: row.amount, status: row.status, created_at: row.createdAt.toISOString() })) });
  };

  listRefunds = async (_request: AuthenticatedRequest, response: Response): Promise<void> => {
    const rows = await db.select({ booking: bookings, ground: grounds, player: users, vendor: vendors }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(users, eq(bookings.playerId, users.id)).innerJoin(vendors, eq(bookings.vendorId, vendors.id)).where(sql`${bookings.refundAmount} > 0`).orderBy(desc(bookings.cancelledAt)).limit(200);
    response.json({ refunds: rows.map(({ booking, ground, player, vendor }) => ({ id: booking.id, booking_number: booking.bookingNumber, ground_title: ground.title, player_name: player.fullName, vendor_name: vendor.businessName, amount: booking.refundAmount, status: booking.paymentStatus, reason: booking.cancellationReason, cancelled_at: booking.cancelledAt?.toISOString() || null })) });
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

  listReports = async (_request: AuthenticatedRequest, response: Response): Promise<void> => {
    const rows = await db.select({ report: reviewReports, review: reviews, reporter: users, ground: grounds }).from(reviewReports)
      .innerJoin(reviews, eq(reviewReports.reviewId, reviews.id)).innerJoin(users, eq(reviewReports.reporterId, users.id)).innerJoin(grounds, eq(reviews.groundId, grounds.id))
      .orderBy(desc(reviewReports.createdAt)).limit(100);
    response.json({ reports: rows.map(({ report, review, reporter, ground }) => ({ id: report.id, status: report.status, reason: report.reason, resolution_reason: report.resolutionReason, review: { id: review.id, rating: review.rating, comment: review.comment, is_hidden: review.isHidden }, reporter: { id: reporter.id, full_name: reporter.fullName }, ground: { id: ground.id, title: ground.title }, created_at: report.createdAt.toISOString() })) });
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
