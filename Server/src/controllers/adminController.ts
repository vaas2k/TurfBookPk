import { and, count, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { Response } from 'express';
import { createHash } from 'node:crypto';
import { db } from '../database/client.js';
import { adminAuditLogs, bookingOrders, bookings, financialDisputes, groundVerificationDocuments, groundVerifications, grounds, ledgerEntries, notificationOutbox, notifications, paymentAttempts, refundBankProfiles, refundCases, refreshSessions, reviewReports, reviews, slots, users, vendorPayoutItems, vendorPayouts, vendorVerificationDocuments, vendorVerifications, vendors } from '../database/schema.js';
import { env } from '../configs/env.js';
import { AppError } from '../helpers/errors.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendExpoPush } from '../services/expoPushService.js';
import { nextPaginationCursor, parsePaginationCursor } from '../services/paginationCursor.js';
import { decryptPayoutValue, identifierLastFour } from '../services/sensitiveData.js';
import { ObjectStorageProvider } from '../services/objectStorageProvider.js';

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
  constructor(private readonly storage?: ObjectStorageProvider) {}

  attentionCounts = async (_request: AuthenticatedRequest, response: Response): Promise<void> => {
    const [vendorRows, groundRows, refundRows, disputeRows, payoutRows, reviewRows] = await Promise.all([
      db.select({ total: count() }).from(vendors).leftJoin(vendorVerifications, eq(vendorVerifications.vendorId, vendors.id)).where(or(eq(vendors.verificationStatus, 'under_review'), and(eq(vendors.verificationStatus, 'draft'), or(eq(vendorVerifications.identityStatus, 'changes_requested'), eq(vendorVerifications.businessStatus, 'changes_requested'), eq(vendorVerifications.payoutStatus, 'changes_requested'))))),
      db.select({ total: count() }).from(grounds).leftJoin(groundVerifications, eq(groundVerifications.groundId, grounds.id)).where(or(eq(grounds.verificationStatus, 'under_review'), and(eq(grounds.verificationStatus, 'draft'), eq(groundVerifications.authorityStatus, 'changes_requested')))),
      db.select({ total: count() }).from(refundCases).where(inArray(refundCases.status, ['pending_review', 'approved', 'processing', 'failed'])),
      db.select({ total: count() }).from(financialDisputes).where(inArray(financialDisputes.status, ['open', 'waiting', 'under_review'])),
      db.select({ total: count() }).from(vendorPayouts).where(inArray(vendorPayouts.status, ['draft', 'processing', 'failed'])),
      db.select({ total: count() }).from(reviewReports).where(eq(reviewReports.status, 'open')),
    ]);
    response.setHeader('Cache-Control', 'private, no-store');
    response.json({ vendor_verification: vendorRows[0]?.total ?? 0, ground_verification: groundRows[0]?.total ?? 0, refunds: refundRows[0]?.total ?? 0, disputes: disputeRows[0]?.total ?? 0, payouts: payoutRows[0]?.total ?? 0, reviews: reviewRows[0]?.total ?? 0 });
  };

  financialProofUpload = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!this.storage) throw new AppError('storage_not_configured', 'Financial proof storage is unavailable', 503);
    const contentType = typeof request.body?.content_type === 'string' ? request.body.content_type : '';
    const contentLength = Number(request.body?.content_length);
    const target = await this.storage.createUploadTarget({ ownerId: request.auth!.userId, contentType, contentLength, purpose: 'admin_financial_document' });
    response.status(201).json({ target: { key: target.key, upload_url: target.uploadUrl, fields: target.fields, method: target.method, expires_at: target.expiresAt.toISOString() } });
  };
  dashboard = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const requestedDays = Number(request.query.days || 30);
    const daysCount = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const periodStart = new Date(Date.now() - daysCount * 24 * 60 * 60 * 1000);
    const previousStart = new Date(periodStart.getTime() - daysCount * 24 * 60 * 60 * 1000);
    const [pendingVendors, pendingGrounds, openReports, suspendedUsers, totalUsers, activeGrounds, approvedVendors, totalGrounds, paidTotals, periodPaid, previousPaid, newUsers, newVendors, revenueRows, cityRows, topGroundRows, bookingStatuses, paymentStatuses, refundSummary, refundStatuses, payoutSummary, payoutStatuses, disputeSummary, todaySlots, recentBookings, recentRefunds, recentPayouts] = await Promise.all([
      db.select({ total: count() }).from(vendors).leftJoin(vendorVerifications, eq(vendorVerifications.vendorId, vendors.id)).where(or(eq(vendors.verificationStatus, 'under_review'), and(eq(vendors.verificationStatus, 'draft'), or(eq(vendorVerifications.identityStatus, 'changes_requested'), eq(vendorVerifications.businessStatus, 'changes_requested'), eq(vendorVerifications.payoutStatus, 'changes_requested'))))),
      db.select({ total: count() }).from(grounds).leftJoin(groundVerifications, eq(groundVerifications.groundId, grounds.id)).where(or(eq(grounds.verificationStatus, 'under_review'), and(eq(grounds.verificationStatus, 'draft'), eq(groundVerifications.authorityStatus, 'changes_requested')))),
      db.select({ total: count() }).from(reviewReports).where(eq(reviewReports.status, 'open')),
      db.select({ total: count() }).from(users).where(eq(users.isSuspended, true)),
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(grounds).where(and(eq(grounds.isActive, true), eq(grounds.verificationStatus, 'approved'))),
      db.select({ total: count() }).from(vendors).where(and(eq(vendors.isActive, true), eq(vendors.verificationStatus, 'approved'))),
      db.select({ total: count() }).from(grounds),
      db.select({ amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int`, bookings: count() }).from(bookings).where(eq(bookings.paymentStatus, 'paid')),
      db.select({ amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int`, platform: sql<number>`coalesce(sum(${bookings.platformFee}), 0)::int`, vendor: sql<number>`coalesce(sum(${bookings.vendorAmount}), 0)::int`, bookings: count() }).from(bookings).where(and(eq(bookings.paymentStatus, 'paid'), gte(bookings.createdAt, periodStart))),
      db.select({ amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int`, bookings: count() }).from(bookings).where(and(eq(bookings.paymentStatus, 'paid'), gte(bookings.createdAt, previousStart), lt(bookings.createdAt, periodStart))),
      db.select({ total: count() }).from(users).where(gte(users.createdAt, periodStart)),
      db.select({ total: count() }).from(vendors).where(gte(vendors.createdAt, periodStart)),
      db.select({ date: sql<string>`(${bookings.createdAt} AT TIME ZONE 'Asia/Karachi')::date::text`, amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int`, bookings: count() }).from(bookings).where(and(eq(bookings.paymentStatus, 'paid'), gte(bookings.createdAt, periodStart))).groupBy(sql`(${bookings.createdAt} AT TIME ZONE 'Asia/Karachi')::date`),
      db.select({ city: grounds.city, bookings: count(), amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int` }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).where(and(eq(bookings.paymentStatus, 'paid'), gte(bookings.createdAt, periodStart))).groupBy(grounds.city).orderBy(desc(count())).limit(6),
      db.select({ id: grounds.id, title: grounds.title, image: grounds.coverImage, images: grounds.images, amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int`, bookings: count() }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).where(and(eq(bookings.paymentStatus, 'paid'), gte(bookings.createdAt, periodStart))).groupBy(grounds.id).orderBy(desc(sql`sum(${bookings.totalAmount})`)).limit(5),
      db.select({ status: bookings.status, total: count(), amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int` }).from(bookings).where(gte(bookings.createdAt, periodStart)).groupBy(bookings.status),
      db.select({ status: paymentAttempts.providerStatus, total: count(), amount: sql<number>`coalesce(sum(${paymentAttempts.amount}), 0)::int` }).from(paymentAttempts).where(gte(paymentAttempts.createdAt, periodStart)).groupBy(paymentAttempts.providerStatus),
      db.select({ total: count(), calculated: sql<number>`coalesce(sum(${refundCases.calculatedAmount}), 0)::int`, approved: sql<number>`coalesce(sum(${refundCases.approvedAmount}), 0)::int`, platformFunded: sql<number>`coalesce(sum(${refundCases.platformFundedAmount}) filter (where ${refundCases.status} = 'refunded'), 0)::int`, vendorFunded: sql<number>`coalesce(sum(${refundCases.vendorFundedAmount}) filter (where ${refundCases.status} = 'refunded'), 0)::int` }).from(refundCases).where(gte(refundCases.createdAt, periodStart)),
      db.select({ status: refundCases.status, total: count(), amount: sql<number>`coalesce(sum(coalesce(${refundCases.approvedAmount}, ${refundCases.calculatedAmount})), 0)::int` }).from(refundCases).where(gte(refundCases.createdAt, periodStart)).groupBy(refundCases.status),
      db.select({ total: count(), amount: sql<number>`coalesce(sum(${vendorPayouts.amount}), 0)::int` }).from(vendorPayouts).where(and(eq(vendorPayouts.status, 'paid'), gte(vendorPayouts.createdAt, periodStart))),
      db.select({ status: vendorPayouts.status, total: count(), amount: sql<number>`coalesce(sum(${vendorPayouts.amount}), 0)::int` }).from(vendorPayouts).where(gte(vendorPayouts.createdAt, periodStart)).groupBy(vendorPayouts.status),
      db.select({ total: count(), held: sql<number>`coalesce(sum(${financialDisputes.vendorHoldAmount}), 0)::int` }).from(financialDisputes).where(inArray(financialDisputes.status, ['open', 'waiting', 'under_review'])),
      db.select({ total: count(), booked: sql<number>`count(*) filter (where ${slots.isBooked} = true)::int`, blocked: sql<number>`count(*) filter (where ${slots.isBlocked} = true)::int`, held: sql<number>`count(*) filter (where ${slots.heldBy} is not null)::int` }).from(slots).where(sql`${slots.date} = (now() at time zone 'Asia/Karachi')::date`),
      db.select({ id: bookings.id, number: bookings.bookingNumber, status: bookings.status, paymentStatus: bookings.paymentStatus, amount: bookings.totalAmount, createdAt: bookings.createdAt, ground: grounds.title, player: users.fullName }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(users, eq(bookings.playerId, users.id)).orderBy(desc(bookings.createdAt)).limit(6),
      db.select({ id: refundCases.id, status: refundCases.status, amount: refundCases.calculatedAmount, createdAt: refundCases.createdAt, bookingNumber: bookings.bookingNumber }).from(refundCases).innerJoin(bookings, eq(refundCases.bookingId, bookings.id)).orderBy(desc(refundCases.createdAt)).limit(4),
      db.select({ id: vendorPayouts.id, status: vendorPayouts.status, amount: vendorPayouts.amount, createdAt: vendorPayouts.createdAt, vendor: vendors.businessName }).from(vendorPayouts).innerJoin(vendors, eq(vendorPayouts.vendorId, vendors.id)).orderBy(desc(vendorPayouts.createdAt)).limit(4),
    ]);
    const now = new Date(Date.now() + 5 * 60 * 60 * 1000); const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const days = Array.from({ length: daysCount }, (_, index) => { const day = new Date(today); day.setUTCDate(day.getUTCDate() - (daysCount - 1 - index)); return day; });
    const key = (date: Date) => date.toISOString().slice(0, 10);
    const daily = new Map(revenueRows.map((row) => [row.date, row.amount]));
    const growth = (current: number, previous: number) => previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : current > 0 ? 100 : 0;
    response.setHeader('Cache-Control', 'private, no-store');
    response.json({ period_days: daysCount, counts: { pending_vendors: pendingVendors[0]?.total ?? 0, pending_grounds: pendingGrounds[0]?.total ?? 0, open_review_reports: openReports[0]?.total ?? 0, suspended_users: suspendedUsers[0]?.total ?? 0, total_users: totalUsers[0]?.total ?? 0, new_users: newUsers[0]?.total ?? 0, approved_vendors: approvedVendors[0]?.total ?? 0, new_vendors: newVendors[0]?.total ?? 0, total_grounds: totalGrounds[0]?.total ?? 0, active_verified_grounds: activeGrounds[0]?.total ?? 0 }, analytics: { lifetime_paid_gmv: paidTotals[0]?.amount ?? 0, lifetime_paid_bookings: paidTotals[0]?.bookings ?? 0, paid_gmv: periodPaid[0]?.amount ?? 0, platform_revenue: periodPaid[0]?.platform ?? 0, paid_bookings: periodPaid[0]?.bookings ?? 0, gmv_growth_pct: growth(periodPaid[0]?.amount ?? 0, previousPaid[0]?.amount ?? 0), bookings_growth_pct: growth(periodPaid[0]?.bookings ?? 0, previousPaid[0]?.bookings ?? 0), revenue_trend: days.map((day) => ({ date: key(day), amount: daily.get(key(day)) || 0 })), bookings_by_city: cityRows.map(({ city, bookings, amount }) => ({ city, count: bookings, amount })), top_grounds: topGroundRows.map(({ id, title, image, images, amount, bookings }) => ({ id, title, image: image || images[0] || null, amount, bookings })), booking_statuses: bookingStatuses, payment_statuses: paymentStatuses, refunds: { total: refundSummary[0]?.total ?? 0, calculated_amount: refundSummary[0]?.calculated ?? 0, approved_amount: refundSummary[0]?.approved ?? 0, statuses: refundStatuses }, payouts: { paid_count: payoutSummary[0]?.total ?? 0, paid_amount: payoutSummary[0]?.amount ?? 0, statuses: payoutStatuses }, disputes: { open: disputeSummary[0]?.total ?? 0, vendor_hold_amount: disputeSummary[0]?.held ?? 0 }, today_slots: { total: todaySlots[0]?.total ?? 0, booked: todaySlots[0]?.booked ?? 0, blocked: todaySlots[0]?.blocked ?? 0, held: todaySlots[0]?.held ?? 0 } }, recent_activity: { bookings: recentBookings.map(row => ({ id: row.id, booking_number: row.number, ground: row.ground, player: row.player, status: row.status, payment_status: row.paymentStatus, amount: row.amount, created_at: row.createdAt.toISOString() })), refunds: recentRefunds.map(row => ({ id: row.id, booking_number: row.bookingNumber, status: row.status, amount: row.amount, created_at: row.createdAt.toISOString() })), payouts: recentPayouts.map(row => ({ id: row.id, vendor: row.vendor, status: row.status, amount: row.amount, created_at: row.createdAt.toISOString() })) } });
  };

  platformFinance = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const requestedDays = Number(request.query.days || 30); const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const start = new Date(Date.now() - days * 86_400_000);
    const [bookingTotals, platformRefunds, vendorRefunds, vendorPayoutTotals, vendorBalances, trend, transactions] = await Promise.all([
      db.select({ gmv: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int`, platformGross: sql<number>`coalesce(sum(${bookings.platformFee}), 0)::int`, vendorGross: sql<number>`coalesce(sum(${bookings.vendorAmount}), 0)::int`, total: count() }).from(bookings).where(and(eq(bookings.paymentStatus, 'paid'), gte(bookings.createdAt, start))),
      db.select({ amount: sql<number>`coalesce(sum(${refundCases.platformFundedAmount}), 0)::int`, total: count() }).from(refundCases).where(and(eq(refundCases.status, 'refunded'), gte(refundCases.completedAt, start))),
      db.select({ amount: sql<number>`coalesce(sum(${refundCases.vendorFundedAmount}), 0)::int` }).from(refundCases).where(and(eq(refundCases.status, 'refunded'), gte(refundCases.completedAt, start))),
      db.select({ amount: sql<number>`coalesce(sum(${vendorPayouts.amount}), 0)::int`, total: count() }).from(vendorPayouts).where(and(eq(vendorPayouts.status, 'paid'), gte(vendorPayouts.completedAt, start))),
      db.select({ earned: sql<number>`coalesce(sum(${vendors.totalEarnings}), 0)::int`, withdrawn: sql<number>`coalesce(sum(${vendors.totalWithdrawn}), 0)::int`, pending: sql<number>`coalesce(sum(${vendors.pendingEarnings}), 0)::int` }).from(vendors),
      db.select({ date: sql<string>`(${bookings.createdAt} at time zone 'Asia/Karachi')::date::text`, gmv: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::int`, platform: sql<number>`coalesce(sum(${bookings.platformFee}), 0)::int`, vendor: sql<number>`coalesce(sum(${bookings.vendorAmount}), 0)::int` }).from(bookings).where(and(eq(bookings.paymentStatus, 'paid'), gte(bookings.createdAt, start))).groupBy(sql`(${bookings.createdAt} at time zone 'Asia/Karachi')::date`).orderBy(sql`(${bookings.createdAt} at time zone 'Asia/Karachi')::date`),
      db.select({ id: bookings.id, number: bookings.bookingNumber, total: bookings.totalAmount, platform: bookings.platformFee, vendorAmount: bookings.vendorAmount, createdAt: bookings.createdAt, ground: grounds.title, vendor: vendors.businessName, player: users.fullName }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(vendors, eq(bookings.vendorId, vendors.id)).innerJoin(users, eq(bookings.playerId, users.id)).where(and(eq(bookings.paymentStatus, 'paid'), gte(bookings.createdAt, start))).orderBy(desc(bookings.createdAt)).limit(100),
    ]);
    const gross = bookingTotals[0]?.platformGross ?? 0; const deductions = platformRefunds[0]?.amount ?? 0;
    response.setHeader('Cache-Control', 'private, no-store');
    response.json({ period_days: days, platform: { gross_earnings: gross, refund_deductions: deductions, net_earnings: gross - deductions, paid_bookings: bookingTotals[0]?.total ?? 0 }, marketplace: { collected_gmv: bookingTotals[0]?.gmv ?? 0 }, vendors: { gross_allocation: bookingTotals[0]?.vendorGross ?? 0, refund_deductions: vendorRefunds[0]?.amount ?? 0, payouts_sent: vendorPayoutTotals[0]?.amount ?? 0, payouts_count: vendorPayoutTotals[0]?.total ?? 0, lifetime_earned: vendorBalances[0]?.earned ?? 0, lifetime_withdrawn: vendorBalances[0]?.withdrawn ?? 0, currently_pending: vendorBalances[0]?.pending ?? 0, currently_available: Math.max(0, (vendorBalances[0]?.earned ?? 0) - (vendorBalances[0]?.withdrawn ?? 0)) }, trend, transactions: transactions.map(item => ({ id: item.id, booking_number: item.number, ground: item.ground, vendor: item.vendor, player: item.player, total_amount: item.total, platform_earning: item.platform, vendor_earning: item.vendorAmount, created_at: item.createdAt.toISOString() })) });
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
    response.setHeader('Cache-Control', 'private, no-store');
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
    const [managedGrounds, bookingSummary, bookingStatuses, payoutSummary, refundSummary, disputeSummary, recentBookings] = await Promise.all([
      db.select({ id: grounds.id, title: grounds.title, city: grounds.city, address: grounds.address, pitchType: grounds.pitchType, isActive: grounds.isActive, verificationStatus: grounds.verificationStatus, rating: grounds.rating, createdAt: grounds.createdAt }).from(grounds).where(eq(grounds.vendorId, id)).orderBy(desc(grounds.createdAt)),
      db.select({ total: count(), paidValue: sql<number>`coalesce(sum(${bookings.totalAmount}) filter (where ${bookings.paymentStatus} = 'paid'), 0)::int`, vendorValue: sql<number>`coalesce(sum(${bookings.vendorAmount}) filter (where ${bookings.paymentStatus} = 'paid'), 0)::int`, completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')::int`, cancelled: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')::int` }).from(bookings).where(eq(bookings.vendorId, id)),
      db.select({ status: bookings.status, total: count() }).from(bookings).where(eq(bookings.vendorId, id)).groupBy(bookings.status),
      db.select({ status: vendorPayouts.status, amount: sql<number>`coalesce(sum(${vendorPayouts.amount}), 0)::int`, total: count() }).from(vendorPayouts).where(eq(vendorPayouts.vendorId, id)).groupBy(vendorPayouts.status),
      db.select({ status: refundCases.status, amount: sql<number>`coalesce(sum(${refundCases.vendorFundedAmount}), 0)::int`, total: count() }).from(refundCases).where(eq(refundCases.vendorId, id)).groupBy(refundCases.status),
      db.select({ open: count(), held: sql<number>`coalesce(sum(${financialDisputes.vendorHoldAmount}), 0)::int` }).from(financialDisputes).where(and(eq(financialDisputes.vendorId, id), inArray(financialDisputes.status, ['open', 'waiting', 'under_review']))),
      db.select({ id: bookings.id, number: bookings.bookingNumber, ground: grounds.title, date: bookings.date, status: bookings.status, paymentStatus: bookings.paymentStatus, amount: bookings.totalAmount, createdAt: bookings.createdAt }).from(bookings).innerJoin(grounds, eq(bookings.groundId, grounds.id)).where(eq(bookings.vendorId, id)).orderBy(desc(bookings.createdAt)).limit(6),
    ]);
    const paidOut = payoutSummary.filter(item => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
    const payoutReserved = payoutSummary.filter(item => ['draft', 'processing', 'failed'].includes(item.status)).reduce((sum, item) => sum + item.amount, 0);
    const disputeHold = disputeSummary[0]?.held ?? 0;
    const available = Math.max(0, row.vendor.totalEarnings - row.vendor.totalWithdrawn - payoutReserved - disputeHold);
    const refundsPaid = refundSummary.filter(item => item.status === 'refunded').reduce((sum, item) => sum + item.amount, 0);
    const refundsOpen = refundSummary.filter(item => !['refunded', 'rejected'].includes(item.status)).reduce((sum, item) => sum + item.amount, 0);
    response.setHeader('Cache-Control', 'private, no-store');
    response.json({ vendor: { id: row.vendor.id, business_name: row.vendor.businessName, business_phone: row.vendor.businessPhone, business_city: row.vendor.businessCity, business_description: row.vendor.businessDescription, verification_status: row.vendor.verificationStatus, verification_reason: row.vendor.verificationReason, is_active: row.vendor.isActive, is_verified: row.vendor.isVerified, rating: row.vendor.rating, total_reviews: row.vendor.totalReviews, total_earnings: row.vendor.totalEarnings, pending_earnings: row.vendor.pendingEarnings, created_at: row.vendor.createdAt.toISOString(), owner: { id: row.owner.id, full_name: row.owner.fullName, phone: row.owner.phone, email: row.owner.email, city: row.owner.city, is_suspended: row.owner.isSuspended } }, position: { bookings_total: bookingSummary[0]?.total ?? 0, bookings_completed: bookingSummary[0]?.completed ?? 0, bookings_cancelled: bookingSummary[0]?.cancelled ?? 0, paid_booking_value: bookingSummary[0]?.paidValue ?? 0, vendor_earning_value: bookingSummary[0]?.vendorValue ?? 0, available_balance: available, pending_earnings: row.vendor.pendingEarnings, paid_out: paidOut, payout_processing: payoutReserved, refunds_paid: refundsPaid, refunds_open: refundsOpen, open_disputes: disputeSummary[0]?.open ?? 0, dispute_hold: disputeHold, booking_statuses: bookingStatuses }, recent_bookings: recentBookings.map(item => ({ id: item.id, booking_number: item.number, ground_title: item.ground, date: item.date, status: item.status, payment_status: item.paymentStatus, amount: item.amount, created_at: item.createdAt.toISOString() })), grounds: managedGrounds.map((ground) => ({ id: ground.id, title: ground.title, city: ground.city, address: ground.address, pitch_type: ground.pitchType, is_active: ground.isActive, verification_status: ground.verificationStatus, rating: ground.rating, created_at: ground.createdAt.toISOString() })) });
  };

  vendorFinancialActivity = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const vendorId = param(request.params.id, 'Vendor id');
    const type = typeof request.query.type === 'string' ? request.query.type : 'transactions';
    if (!['transactions', 'payouts', 'refunds', 'disputes'].includes(type)) throw new AppError('invalid_activity_type', 'Use transactions, payouts, refunds, or disputes', 422);
    const vendor = (await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, vendorId)).limit(1))[0];
    if (!vendor) throw new AppError('not_found', 'Vendor was not found', 404);
    response.setHeader('Cache-Control', 'private, no-store');
    if (type === 'transactions') {
      const rows = await db.select({ attempt: paymentAttempts, booking: bookings, ground: grounds, player: users }).from(paymentAttempts).leftJoin(bookings, eq(paymentAttempts.bookingId, bookings.id)).leftJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(users, eq(paymentAttempts.playerId, users.id)).where(eq(paymentAttempts.vendorId, vendorId)).orderBy(desc(paymentAttempts.createdAt)).limit(100);
      response.json({ type, items: rows.map(({ attempt, booking, ground, player }) => ({ id: attempt.id, reference: booking?.bookingNumber || attempt.applicantReference || 'Payment attempt', title: ground?.title || 'Order payment', person: player.fullName, amount: attempt.finalPayableAmount ?? attempt.amount, status: booking?.paymentStatus === 'refunded' ? 'refunded' : booking?.paymentStatus === 'refund_pending' ? 'refund_pending' : booking?.status === 'cancelled' ? 'cancelled' : attempt.reviewStatus === 'manual_review' ? 'manual_review' : attempt.providerStatus, detail: booking?.status === 'cancelled' ? 'Booking cancelled; see Refunds for money movement' : attempt.providerReference ? `Clink ${attempt.providerReference}` : attempt.provider, created_at: attempt.createdAt.toISOString() })) }); return;
    }
    if (type === 'payouts') {
      const rows = await db.select().from(vendorPayouts).where(eq(vendorPayouts.vendorId, vendorId)).orderBy(desc(vendorPayouts.createdAt)).limit(100);
      response.json({ type, items: rows.map(item => ({ id: item.id, reference: item.transferReference || 'Manual payout', title: item.bankName, person: item.accountTitle, amount: item.amount, status: item.status, detail: item.reason || (item.receiptStorageKey ? 'Receipt proof saved' : 'Awaiting bank proof'), created_at: item.createdAt.toISOString() })) }); return;
    }
    if (type === 'refunds') {
      const rows = await db.select({ refund: refundCases, booking: bookings, player: users }).from(refundCases).innerJoin(bookings, eq(refundCases.bookingId, bookings.id)).innerJoin(users, eq(refundCases.playerId, users.id)).where(eq(refundCases.vendorId, vendorId)).orderBy(desc(refundCases.createdAt)).limit(100);
      response.json({ type, items: rows.map(({ refund, booking, player }) => ({ id: refund.id, reference: booking.bookingNumber, title: `Refund to ${player.fullName}`, person: refund.bankName ? `${refund.bankName} ••••${refund.accountLastFour}` : 'Bank details missing', amount: refund.approvedAmount ?? refund.calculatedAmount, status: refund.status, detail: `Vendor share ${refund.vendorFundedAmount.toLocaleString()} · Platform share ${refund.platformFundedAmount.toLocaleString()}`, created_at: refund.createdAt.toISOString() })) }); return;
    }
    const rows = await db.select({ dispute: financialDisputes, booking: bookings }).from(financialDisputes).innerJoin(bookings, eq(financialDisputes.bookingId, bookings.id)).where(eq(financialDisputes.vendorId, vendorId)).orderBy(desc(financialDisputes.createdAt)).limit(100);
    response.json({ type, items: rows.map(({ dispute, booking }) => ({ id: dispute.id, reference: booking.bookingNumber, title: dispute.category.replaceAll('_', ' '), person: dispute.responsibility ? `Responsibility: ${dispute.responsibility}` : 'Responsibility pending', amount: dispute.refundAmount || dispute.vendorHoldAmount, status: dispute.status, detail: dispute.resolution || dispute.description, created_at: dispute.createdAt.toISOString() })) });
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
    response.setHeader('Cache-Control', 'private, no-store');
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

  refundCases = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const status = typeof request.query.status === 'string' ? request.query.status : 'all';
    const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : '';
    const { page, limit, offset } = pagination(request);
    const allowed = ['all', 'awaiting_bank_details', 'pending_review', 'approved', 'processing', 'refunded', 'failed', 'rejected'];
    if (!allowed.includes(status)) throw new AppError('invalid_status', 'Use a valid refund status', 422);
    const rows = await db.select({ refund: refundCases, booking: bookings, ground: grounds, player: users, vendor: vendors }).from(refundCases)
      .innerJoin(bookings, eq(refundCases.bookingId, bookings.id)).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(users, eq(refundCases.playerId, users.id)).innerJoin(vendors, eq(refundCases.vendorId, vendors.id))
      .where(and(status === 'all' ? undefined : eq(refundCases.status, status), query ? sql`(${bookings.bookingNumber} ILIKE ${`%${query}%`} OR ${users.fullName} ILIKE ${`%${query}%`} OR ${vendors.businessName} ILIKE ${`%${query}%`} OR ${grounds.title} ILIKE ${`%${query}%`})` : undefined))
      .orderBy(desc(refundCases.createdAt), desc(refundCases.id)).limit(limit + 1).offset(offset);
    response.json({ refunds: rows.slice(0, limit).map(({ refund, booking, ground, player, vendor }) => ({ id: refund.id, booking_id: booking.id, booking_number: booking.bookingNumber, ground_title: ground.title, player_name: player.fullName, vendor_name: vendor.businessName, status: refund.status, responsibility: refund.responsibility, calculated_amount: refund.calculatedAmount, approved_amount: refund.approvedAmount, vendor_funded_amount: refund.vendorFundedAmount, platform_funded_amount: refund.platformFundedAmount, bank_name: refund.bankName, account_title: refund.accountTitle, account_last_four: refund.accountLastFour, transfer_reference: refund.transferReference, has_receipt: Boolean(refund.receiptStorageKey), failure_reason: refund.failureReason, admin_notes: refund.adminNotes, created_at: refund.createdAt.toISOString(), completed_at: refund.completedAt?.toISOString() || null })), pagination: { page, limit, has_more: rows.length > limit } });
  };

  approveRefund = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Refund id'); const actorId = request.auth!.userId;
    const amount = Number(request.body?.amount); const responsibility = String(request.body?.responsibility || 'policy');
    const notes = typeof request.body?.notes === 'string' ? request.body.notes.trim().slice(0, 1000) || null : null;
    if (!Number.isSafeInteger(amount) || amount <= 0 || !['policy', 'vendor', 'platform', 'shared'].includes(responsibility)) throw new AppError('invalid_refund', 'Enter a valid refund amount and responsibility', 422);
    const current = (await db.select({ refund: refundCases, booking: bookings }).from(refundCases).innerJoin(bookings, eq(refundCases.bookingId, bookings.id)).where(eq(refundCases.id, id)).limit(1))[0];
    if (!current) throw new AppError('not_found', 'Refund case was not found', 404);
    if (!['pending_review', 'failed'].includes(current.refund.status)) throw new AppError('refund_not_reviewable', 'This refund is not awaiting approval', 409);
    if (!current.refund.accountCiphertext) throw new AppError('refund_bank_required', 'The player must provide refund bank details first', 409);
    if (amount > current.booking.totalAmount) throw new AppError('invalid_refund', 'Refund cannot exceed the amount paid', 422);
    const proportionalVendor = Math.round(amount * current.booking.vendorAmount / current.booking.totalAmount);
    const vendorFunded = responsibility === 'platform' ? 0 : responsibility === 'vendor' ? amount : proportionalVendor;
    const platformFunded = amount - vendorFunded;
    const [updated] = await db.update(refundCases).set({ status: 'approved', approvedAmount: amount, responsibility, vendorFundedAmount: vendorFunded, platformFundedAmount: platformFunded, adminNotes: notes, approvedBy: actorId, approvedAt: new Date(), failureReason: null, updatedAt: new Date() }).where(and(eq(refundCases.id, id), inArray(refundCases.status, ['pending_review', 'failed']))).returning();
    if (!updated) throw new AppError('refund_conflict', 'Another administrator already changed this refund', 409);
    await audit(actorId, 'refund_approved', 'refund_case', id, notes, { amount, responsibility, vendor_funded: vendorFunded, platform_funded: platformFunded });
    response.json({ refund: { id, status: updated.status, approved_amount: updated.approvedAmount } });
  };

  completeRefund = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Refund id'); const actorId = request.auth!.userId;
    const reference = typeof request.body?.transfer_reference === 'string' ? request.body.transfer_reference.trim().slice(0, 160) : '';
    const receipt = typeof request.body?.receipt_storage_key === 'string' ? request.body.receipt_storage_key.trim().slice(0, 500) : '';
    if (!reference || !receipt.startsWith(`turfbookpk/${actorId}/admin_financial_document/`)) throw new AppError('refund_proof_required', 'Bank reference and an uploaded receipt proof are required', 422);
    const result = await db.transaction(async (tx) => {
      const [refund] = await tx.update(refundCases).set({ status: 'refunded', transferReference: reference, receiptStorageKey: receipt, completedBy: actorId, completedAt: new Date(), updatedAt: new Date() }).where(and(eq(refundCases.id, id), eq(refundCases.status, 'approved'))).returning();
      if (!refund) throw new AppError('refund_conflict', 'Only an approved refund can be completed, and it can only be completed once', 409);
      const [booking] = await tx.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, refund.bookingId)).limit(1);
      await tx.update(bookings).set({ paymentStatus: 'refunded', updatedAt: new Date() }).where(eq(bookings.id, refund.bookingId));
      await tx.update(paymentAttempts).set({ status: 'refunded', updatedAt: new Date() }).where(and(eq(paymentAttempts.bookingId, refund.bookingId), eq(paymentAttempts.status, 'refund_pending')));
      await tx.update(ledgerEntries).set({ status: 'posted', postedAt: new Date(), updatedAt: new Date() }).where(and(eq(ledgerEntries.bookingId, refund.bookingId), eq(ledgerEntries.type, 'refund'), eq(ledgerEntries.status, 'pending')));
      if (booking?.status !== 'cancelled' && refund.vendorFundedAmount > 0) {
        await tx.update(vendors).set({ totalEarnings: sql`${vendors.totalEarnings} - ${refund.vendorFundedAmount}`, updatedAt: new Date() }).where(eq(vendors.id, refund.vendorId));
      }
      await tx.insert(notifications).values({
        userId: refund.playerId,
        type: 'refund',
        title: 'Refund sent',
        message: `Your refund of PKR ${(refund.approvedAmount ?? 0).toLocaleString()} has been sent. Bank processing time may still apply.`,
        data: { bookingId: refund.bookingId, refundId: refund.id, destination: 'booking_details' },
      });
      return refund;
    });
    await audit(actorId, 'refund_completed', 'refund_case', id, null, { amount: result.approvedAmount, transfer_reference: reference });
    response.json({ refund: { id, status: 'refunded', completed_at: result.completedAt?.toISOString() } });
  };

  failRefund = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Refund id'); const actorId = request.auth!.userId;
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim().slice(0, 500) : '';
    if (!reason) throw new AppError('reason_required', 'Explain why the refund failed', 422);
    const [row] = await db.update(refundCases).set({ status: 'failed', failureReason: reason, updatedAt: new Date() }).where(and(eq(refundCases.id, id), inArray(refundCases.status, ['approved', 'processing']))).returning();
    if (!row) throw new AppError('refund_conflict', 'This refund cannot be marked failed', 409);
    await audit(actorId, 'refund_failed', 'refund_case', id, reason);
    await db.insert(notifications).values({ userId: row.playerId, type: 'refund', title: 'Refund needs attention', message: 'Your refund transfer could not be completed yet. Our team will retry or contact you.', data: { bookingId: row.bookingId, refundId: row.id, destination: 'booking_details' } });
    response.json({ refund: { id, status: 'failed' } });
  };

  listFinancialDisputes = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const status = typeof request.query.status === 'string' ? request.query.status : 'all';
    if (!['all', 'open', 'waiting', 'under_review', 'resolved', 'rejected'].includes(status)) throw new AppError('invalid_status', 'Use a valid dispute status', 422);
    const rows = await db.select({ dispute: financialDisputes, booking: bookings, player: users, vendor: vendors, ground: grounds }).from(financialDisputes)
      .innerJoin(bookings, eq(financialDisputes.bookingId, bookings.id)).innerJoin(users, eq(financialDisputes.playerId, users.id)).innerJoin(vendors, eq(financialDisputes.vendorId, vendors.id)).innerJoin(grounds, eq(bookings.groundId, grounds.id))
      .where(status === 'all' ? undefined : eq(financialDisputes.status, status)).orderBy(desc(financialDisputes.createdAt));
    response.json({ disputes: rows.map(({ dispute, booking, player, vendor, ground }) => ({ id: dispute.id, booking_id: booking.id, booking_number: booking.bookingNumber, player_name: player.fullName, vendor_name: vendor.businessName, ground_title: ground.title, status: dispute.status, category: dispute.category, description: dispute.description, vendor_response: dispute.vendorResponse, vendor_responded_at: dispute.vendorRespondedAt?.toISOString() || null, vendor_appeal: dispute.vendorAppeal, appealed_at: dispute.appealedAt?.toISOString() || null, responsibility: dispute.responsibility, resolution: dispute.resolution, refund_amount: dispute.refundAmount, vendor_hold_amount: dispute.vendorHoldAmount, created_at: dispute.createdAt.toISOString(), resolved_at: dispute.resolvedAt?.toISOString() || null })) });
  };

  createFinancialDispute = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const actorId = request.auth!.userId; const bookingId = typeof request.body?.booking_id === 'string' ? request.body.booking_id.trim() : '';
    const bookingNumber = typeof request.body?.booking_number === 'string' ? request.body.booking_number.trim() : '';
    const category = typeof request.body?.category === 'string' ? request.body.category.trim().slice(0, 80) : '';
    const description = typeof request.body?.description === 'string' ? request.body.description.trim().slice(0, 1000) : '';
    const row = (await db.select({ booking: bookings }).from(bookings).where(bookingId ? eq(bookings.id, bookingId) : eq(bookings.bookingNumber, bookingNumber)).limit(1))[0];
    if (!row || !category || !description) throw new AppError('invalid_dispute', 'Choose a booking and provide a category and description', 422);
    const [created] = await db.insert(financialDisputes).values({ bookingId: row.booking.id, playerId: row.booking.playerId, vendorId: row.booking.vendorId, category, description, vendorHoldAmount: row.booking.vendorAmount }).returning();
    if (!created) throw new AppError('dispute_failed', 'Unable to open dispute', 500);
    await audit(actorId, 'financial_dispute_opened', 'financial_dispute', created.id, description, { booking_id: row.booking.id, vendor_hold: created.vendorHoldAmount });
    response.status(201).json({ dispute: { id: created.id, status: created.status } });
  };

  resolveFinancialDispute = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Dispute id'); const actorId = request.auth!.userId;
    const resolution = String(request.body?.resolution || ''); const responsibility = String(request.body?.responsibility || 'shared');
    const refundAmount = Number(request.body?.refund_amount || 0);
    if (!['refund', 'no_refund'].includes(resolution) || !['vendor', 'platform', 'shared'].includes(responsibility) || !Number.isSafeInteger(refundAmount) || refundAmount < 0) throw new AppError('invalid_resolution', 'Enter a valid dispute resolution', 422);
    const current = (await db.select({ dispute: financialDisputes, booking: bookings }).from(financialDisputes).innerJoin(bookings, eq(financialDisputes.bookingId, bookings.id)).where(eq(financialDisputes.id, id)).limit(1))[0];
    if (!current || !['open', 'waiting', 'under_review'].includes(current.dispute.status)) throw new AppError('dispute_conflict', 'This dispute is no longer open', 409);
    if (resolution === 'refund' && (refundAmount <= 0 || refundAmount > current.booking.totalAmount)) throw new AppError('invalid_refund', 'Refund must be between PKR 1 and the amount paid', 422);
    const vendorFunded = resolution === 'no_refund' || responsibility === 'platform' ? 0 : responsibility === 'vendor' ? refundAmount : Math.round(refundAmount * current.booking.vendorAmount / current.booking.totalAmount);
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(financialDisputes).set({ status: 'resolved', resolution, responsibility, refundAmount, vendorHoldAmount: 0, resolvedBy: actorId, resolvedAt: new Date(), updatedAt: new Date() }).where(and(eq(financialDisputes.id, id), inArray(financialDisputes.status, ['open', 'waiting', 'under_review']))).returning();
      if (!updated) throw new AppError('dispute_conflict', 'Another administrator already resolved this dispute', 409);
      if (resolution === 'refund') {
        const profile = (await tx.select().from(refundBankProfiles).where(eq(refundBankProfiles.playerId, current.booking.playerId)).limit(1))[0];
        await tx.insert(refundCases).values({ bookingId: current.booking.id, playerId: current.booking.playerId, vendorId: current.booking.vendorId, status: profile ? 'pending_review' : 'awaiting_bank_details', responsibility, calculatedAmount: refundAmount, vendorFundedAmount: vendorFunded, platformFundedAmount: refundAmount - vendorFunded, bankName: profile?.bankName ?? null, accountTitle: profile?.accountTitle ?? null, accountCiphertext: profile?.accountCiphertext ?? null, accountLastFour: profile?.accountLastFour ?? null }).onConflictDoNothing();
        await tx.insert(ledgerEntries).values({ vendorId: current.booking.vendorId, bookingId: current.booking.id, type: 'refund', status: 'pending', amount: -vendorFunded, description: `Dispute refund pending for booking ${current.booking.bookingNumber}`, idempotencyKey: `dispute-refund:${current.booking.id}` }).onConflictDoNothing();
      }
      const vendor = (await tx.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, current.booking.vendorId)).limit(1))[0];
      await tx.insert(notifications).values({ userId: current.booking.playerId, type: 'dispute', title: 'Match issue reviewed', message: resolution === 'refund' ? 'Your issue was approved for a refund. Follow the refund status from your booking.' : 'Your match issue review is complete. Open the booking for details.', data: { bookingId: current.booking.id, disputeId: id, destination: 'booking_details' } });
      if (vendor) await tx.insert(notifications).values({ userId: vendor.userId, type: 'dispute', title: 'Dispute decision recorded', message: resolution === 'refund' ? `A PKR ${refundAmount.toLocaleString()} refund was approved for this booking.` : 'The dispute was closed without a player refund.', data: { bookingId: current.booking.id, disputeId: id, destination: 'booking_details' } });
    });
    await audit(actorId, 'financial_dispute_resolved', 'financial_dispute', id, resolution, { refund_amount: refundAmount, responsibility, vendor_funded: vendorFunded });
    response.json({ dispute: { id, status: 'resolved', resolution } });
  };

  vendorBalances = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : ''; const { page, limit, offset } = pagination(request);
    const rows = await db.select({ vendor: vendors, verification: vendorVerifications }).from(vendors).leftJoin(vendorVerifications, eq(vendorVerifications.vendorId, vendors.id))
      .where(query ? or(sql`${vendors.businessName} ILIKE ${`%${query}%`}`, sql`${vendors.businessCity} ILIKE ${`%${query}%`}`) : undefined).orderBy(desc(vendors.totalEarnings), desc(vendors.id)).limit(limit + 1).offset(offset);
    const output = [];
    for (const { vendor, verification } of rows.slice(0, limit)) {
      const [reserved] = await db.select({ amount: sql<number>`coalesce(sum(${vendorPayouts.amount}), 0)::int` }).from(vendorPayouts).where(and(eq(vendorPayouts.vendorId, vendor.id), inArray(vendorPayouts.status, ['draft', 'processing', 'failed'])));
      const [holds] = await db.select({ amount: sql<number>`coalesce(sum(${financialDisputes.vendorHoldAmount}), 0)::int` }).from(financialDisputes).where(and(eq(financialDisputes.vendorId, vendor.id), inArray(financialDisputes.status, ['open', 'waiting', 'under_review'])));
      const available = Math.max(0, vendor.totalEarnings - vendor.totalWithdrawn - (reserved?.amount || 0) - (holds?.amount || 0));
      let payoutLastFour: string | null = null;
      if (verification?.payoutAccountCiphertext) {
        try { payoutLastFour = identifierLastFour(decryptPayoutValue(verification.payoutAccountCiphertext)); } catch { payoutLastFour = null; }
      }
      output.push({ vendor_id: vendor.id, vendor_name: vendor.businessName, city: vendor.businessCity, pending_earnings: vendor.pendingEarnings, earned_total: vendor.totalEarnings, paid_total: vendor.totalWithdrawn, reserved_payout: reserved?.amount || 0, dispute_hold: holds?.amount || 0, available_balance: available, negative_balance: Math.max(0, vendor.totalWithdrawn - vendor.totalEarnings), payout_bank_name: verification?.payoutBankName || null, payout_account_title: verification?.payoutAccountTitle || null, payout_account_last_four: payoutLastFour });
    }
    response.json({ vendors: output, pagination: { page, limit, has_more: rows.length > limit } });
  };

  vendorPayableEntries = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const vendorId = param(request.params.id, 'Vendor id');
    const rows = await db.select({ entry: ledgerEntries, booking: bookings, ground: grounds, payoutItemId: vendorPayoutItems.id, refundStatus: refundCases.status, disputeStatus: financialDisputes.status }).from(ledgerEntries)
      .innerJoin(bookings, eq(ledgerEntries.bookingId, bookings.id)).innerJoin(grounds, eq(bookings.groundId, grounds.id))
      .leftJoin(vendorPayoutItems, eq(vendorPayoutItems.ledgerEntryId, ledgerEntries.id)).leftJoin(refundCases, eq(refundCases.bookingId, bookings.id)).leftJoin(financialDisputes, and(eq(financialDisputes.bookingId, bookings.id), inArray(financialDisputes.status, ['open', 'waiting', 'under_review'])))
      .where(and(eq(ledgerEntries.vendorId, vendorId), eq(ledgerEntries.type, 'booking_earning'), eq(ledgerEntries.status, 'posted'), isNull(vendorPayoutItems.id), isNull(financialDisputes.id), or(isNull(refundCases.id), inArray(refundCases.status, ['refunded', 'rejected'])))).orderBy(ledgerEntries.postedAt, ledgerEntries.id);
    response.json({ entries: rows.map(({ entry, booking, ground }) => ({ id: entry.id, booking_id: booking.id, booking_number: booking.bookingNumber, ground_title: ground.title, amount: entry.amount, posted_at: entry.postedAt?.toISOString() || entry.createdAt.toISOString() })), total: rows.reduce((sum, row) => sum + row.entry.amount, 0) });
  };

  createPayout = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const vendorId = param(request.params.id, 'Vendor id'); const actorId = request.auth!.userId;
    const ledgerIds: string[] = Array.isArray(request.body?.ledger_entry_ids) ? [...new Set<string>(request.body.ledger_entry_ids.filter((value: unknown): value is string => typeof value === 'string'))] : [];
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim().slice(0, 500) || null : null;
    if (!ledgerIds.length || ledgerIds.length > 500) throw new AppError('payout_entries_required', 'Select one or more eligible earnings', 422);
    const verification = (await db.select().from(vendorVerifications).where(eq(vendorVerifications.vendorId, vendorId)).limit(1))[0];
    if (!verification?.payoutAccountCiphertext || verification.payoutStatus !== 'approved' || !verification.payoutBankName || !verification.payoutAccountTitle) throw new AppError('payout_account_unverified', 'The vendor needs approved payout details', 409);
    const entries = await db.select({ entry: ledgerEntries, payoutItemId: vendorPayoutItems.id }).from(ledgerEntries)
      .innerJoin(bookings, eq(ledgerEntries.bookingId, bookings.id))
      .leftJoin(vendorPayoutItems, eq(vendorPayoutItems.ledgerEntryId, ledgerEntries.id))
      .leftJoin(refundCases, eq(refundCases.bookingId, bookings.id))
      .leftJoin(financialDisputes, and(eq(financialDisputes.bookingId, bookings.id), inArray(financialDisputes.status, ['open', 'waiting', 'under_review'])))
      .where(and(inArray(ledgerEntries.id, ledgerIds), eq(ledgerEntries.vendorId, vendorId), eq(ledgerEntries.type, 'booking_earning'), eq(ledgerEntries.status, 'posted'), isNull(vendorPayoutItems.id), isNull(financialDisputes.id), or(isNull(refundCases.id), inArray(refundCases.status, ['refunded', 'rejected']))));
    if (entries.length !== ledgerIds.length) throw new AppError('payout_entry_conflict', 'One or more earnings are no longer payable', 409);
    const [eligible] = await db.select({ count: sql<number>`count(*)::int` }).from(ledgerEntries)
      .innerJoin(bookings, eq(ledgerEntries.bookingId, bookings.id))
      .leftJoin(vendorPayoutItems, eq(vendorPayoutItems.ledgerEntryId, ledgerEntries.id))
      .leftJoin(refundCases, eq(refundCases.bookingId, bookings.id))
      .leftJoin(financialDisputes, and(eq(financialDisputes.bookingId, bookings.id), inArray(financialDisputes.status, ['open', 'waiting', 'under_review'])))
      .where(and(eq(ledgerEntries.vendorId, vendorId), eq(ledgerEntries.type, 'booking_earning'), eq(ledgerEntries.status, 'posted'), isNull(vendorPayoutItems.id), isNull(financialDisputes.id), or(isNull(refundCases.id), inArray(refundCases.status, ['refunded', 'rejected']))));
    if ((eligible?.count || 0) > ledgerIds.length && !reason) throw new AppError('partial_payout_reason_required', 'Explain why only part of the available vendor balance is being paid', 422);
    const amount = entries.reduce((sum, row) => sum + row.entry.amount, 0);
    if (amount <= 0) throw new AppError('invalid_payout', 'Payout amount must be positive', 422);
    const payout = await db.transaction(async (tx) => {
      const [created] = await tx.insert(vendorPayouts).values({ vendorId, status: 'processing', amount, reason, bankName: verification.payoutBankName!, accountTitle: verification.payoutAccountTitle!, accountLastFour: identifierLastFour(decryptPayoutValue(verification.payoutAccountCiphertext!)), preparedBy: actorId }).returning();
      if (!created) throw new AppError('payout_failed', 'Unable to create payout', 500);
      await tx.insert(vendorPayoutItems).values(entries.map(({ entry }) => ({ payoutId: created.id, ledgerEntryId: entry.id, amount: entry.amount })));
      return created;
    });
    await audit(actorId, 'payout_created', 'vendor_payout', payout.id, reason, { vendor_id: vendorId, amount, entries: entries.length });
    response.status(201).json({ payout: { id: payout.id, status: payout.status, amount: payout.amount, vendor_id: vendorId } });
  };

  listPayouts = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const status = typeof request.query.status === 'string' ? request.query.status : 'all'; const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : ''; const { page, limit, offset } = pagination(request);
    if (!['all', 'draft', 'processing', 'paid', 'failed', 'cancelled'].includes(status)) throw new AppError('invalid_status', 'Use a valid payout status', 422);
    const rows = await db.select({ payout: vendorPayouts, vendor: vendors, preparer: users }).from(vendorPayouts).innerJoin(vendors, eq(vendorPayouts.vendorId, vendors.id)).innerJoin(users, eq(vendorPayouts.preparedBy, users.id)).where(and(status === 'all' ? undefined : eq(vendorPayouts.status, status), query ? sql`(${vendors.businessName} ILIKE ${`%${query}%`} OR ${vendorPayouts.transferReference} ILIKE ${`%${query}%`})` : undefined)).orderBy(desc(vendorPayouts.createdAt), desc(vendorPayouts.id)).limit(limit + 1).offset(offset);
    response.json({ payouts: rows.slice(0, limit).map(({ payout, vendor, preparer }) => ({ id: payout.id, vendor_id: vendor.id, vendor_name: vendor.businessName, amount: payout.amount, status: payout.status, bank_name: payout.bankName, account_title: payout.accountTitle, account_last_four: payout.accountLastFour, transfer_reference: payout.transferReference, has_receipt: Boolean(payout.receiptStorageKey), reason: payout.reason, failure_reason: payout.failureReason, prepared_by: preparer.fullName, created_at: payout.createdAt.toISOString(), completed_at: payout.completedAt?.toISOString() || null })), pagination: { page, limit, has_more: rows.length > limit } });
  };

  completePayout = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Payout id'); const actorId = request.auth!.userId;
    const reference = typeof request.body?.transfer_reference === 'string' ? request.body.transfer_reference.trim().slice(0, 160) : '';
    const receipt = typeof request.body?.receipt_storage_key === 'string' ? request.body.receipt_storage_key.trim().slice(0, 500) : '';
    if (!reference || !receipt.startsWith(`turfbookpk/${actorId}/admin_financial_document/`)) throw new AppError('payout_proof_required', 'Bank reference and an uploaded receipt proof are required', 422);
    const payout = await db.transaction(async (tx) => {
      const [updated] = await tx.update(vendorPayouts).set({ status: 'paid', transferReference: reference, receiptStorageKey: receipt, failureReason: null, completedBy: actorId, completedAt: new Date(), updatedAt: new Date() }).where(and(eq(vendorPayouts.id, id), inArray(vendorPayouts.status, ['processing', 'failed']))).returning();
      if (!updated) throw new AppError('payout_conflict', 'This payout is already complete or cannot be paid', 409);
      const items = await tx.select({ item: vendorPayoutItems, entry: ledgerEntries }).from(vendorPayoutItems).innerJoin(ledgerEntries, eq(vendorPayoutItems.ledgerEntryId, ledgerEntries.id)).where(eq(vendorPayoutItems.payoutId, id));
      for (const { item, entry } of items) await tx.insert(ledgerEntries).values({ vendorId: updated.vendorId, bookingId: entry.bookingId, paymentAttemptId: entry.paymentAttemptId, type: 'payout', status: 'posted', amount: -item.amount, description: `Manual vendor payout ${updated.id}`, idempotencyKey: `payout:${updated.id}:${item.id}`, postedAt: updated.completedAt }).onConflictDoNothing();
      await tx.update(vendors).set({ totalWithdrawn: sql`${vendors.totalWithdrawn} + ${updated.amount}`, updatedAt: new Date() }).where(eq(vendors.id, updated.vendorId));
      return updated;
    });
    await audit(actorId, 'payout_completed', 'vendor_payout', id, null, { amount: payout.amount, transfer_reference: reference });
    response.json({ payout: { id, status: 'paid', completed_at: payout.completedAt?.toISOString() } });
  };

  failPayout = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = param(request.params.id, 'Payout id'); const actorId = request.auth!.userId;
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim().slice(0, 500) : '';
    if (!reason) throw new AppError('reason_required', 'Explain why the payout failed', 422);
    const [row] = await db.update(vendorPayouts).set({ status: 'failed', failureReason: reason, updatedAt: new Date() }).where(and(eq(vendorPayouts.id, id), eq(vendorPayouts.status, 'processing'))).returning();
    if (!row) throw new AppError('payout_conflict', 'This payout cannot be marked failed', 409);
    await audit(actorId, 'payout_failed', 'vendor_payout', id, reason);
    response.json({ payout: { id, status: 'failed' } });
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
    const [user] = await db.transaction(async (tx) => {
      const updated = await tx.update(users).set({ isSuspended: suspended, updatedAt: new Date() }).where(eq(users.id, id)).returning();
      if (suspended && updated[0]) await tx.update(refreshSessions).set({ revokedAt: new Date() }).where(eq(refreshSessions.userId, id));
      return updated;
    });
    if (!user) throw new AppError('not_found', 'User was not found', 404);
    await audit(actorId, suspended ? 'user_suspended' : 'user_unsuspended', 'user', id, reason);
    response.json({ user: { id: user.id, is_suspended: user.isSuspended } });
  };
}
