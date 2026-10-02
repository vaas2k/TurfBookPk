import { Response } from 'express';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { bookings, grounds, ledgerEntries, users, vendorVerificationDocuments, vendorVerifications, vendors } from '../database/schema.js';
import { encryptPayoutValue, identifierFingerprint, identifierLastFour, normalizedIdentifier } from '../services/sensitiveData.js';

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
    verification_status: row.verificationStatus,
    verification_reason: row.verificationReason,
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

const documentTypes = ['cnic_front', 'cnic_back', 'business_registration', 'authorization_letter'] as const;
type DocumentType = typeof documentTypes[number];
function text(value: unknown, name: string, max = 160): string { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AppError('invalid_verification', `${name} is required`, 422); return value.trim(); }
function documentList(value: unknown, ownerId: string, allowed: readonly DocumentType[]): { type: DocumentType; storageKey: string; contentType: string; originalFilename: string | null }[] {
  if (!Array.isArray(value)) throw new AppError('invalid_verification', 'Verification documents are required', 422);
  const result = value.map((item) => item as Record<string, unknown>).map((item) => ({ type: item.type, storageKey: item.storage_key, contentType: item.content_type, originalFilename: item.original_filename }));
  const purposeFor = (type: unknown) => type === 'cnic_front' || type === 'cnic_back' ? 'vendor_identity_document' : type === 'business_registration' ? 'vendor_business_document' : type === 'authorization_letter' ? 'vendor_authorization_document' : null;
  if (!result.length || result.length > allowed.length || result.some((item) => { const purpose = purposeFor(item.type); return !allowed.includes(item.type as DocumentType) || !purpose || typeof item.storageKey !== 'string' || !item.storageKey.startsWith(`turfbookpk/${ownerId}/${purpose}/`) || typeof item.contentType !== 'string' || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(item.contentType); })) throw new AppError('invalid_verification_document', 'Use valid private documents uploaded for this account', 422);
  return result.map((item) => ({ type: item.type as DocumentType, storageKey: item.storageKey as string, contentType: item.contentType as string, originalFilename: typeof item.originalFilename === 'string' ? item.originalFilename.slice(0, 180) : null }));
}

export class VendorController {
  verification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendor = (await db.select().from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    if (!vendor) { response.json({ verification: null }); return; }
    const verification = (await db.select().from(vendorVerifications).where(eq(vendorVerifications.vendorId, vendor.id)).limit(1))[0];
    if (!verification) { response.json({ verification: { status: 'draft', identity_status: 'draft', business_status: 'draft', payout_status: 'draft', cnic_last_four: null, business_number_last_four: null, documents: [] } }); return; }
    const documents = await db.select({ id: vendorVerificationDocuments.id, type: vendorVerificationDocuments.type, contentType: vendorVerificationDocuments.contentType, originalFilename: vendorVerificationDocuments.originalFilename }).from(vendorVerificationDocuments).where(eq(vendorVerificationDocuments.verificationId, verification.id));
    response.json({ verification: { status: verification.status, identity_status: verification.identityStatus, identity_reason: verification.identityReason, business_status: verification.businessStatus, business_reason: verification.businessReason, payout_status: verification.payoutStatus, payout_reason: verification.payoutReason, business_type: verification.businessType, registrant_relationship: verification.registrantRelationship, cnic_last_four: verification.cnicLastFour, business_number_last_four: verification.businessNumberLastFour, payout_bank_name: verification.payoutBankName, payout_account_title: verification.payoutAccountTitle, documents, submitted_at: verification.submittedAt?.toISOString() || null } });
  };

  saveVerificationStep = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendor = (await db.select().from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    if (!vendor) throw new AppError('vendor_required', 'Create your basic vendor profile before verification', 409);
    const existing = (await db.select().from(vendorVerifications).where(eq(vendorVerifications.vendorId, vendor.id)).limit(1))[0] || (await db.insert(vendorVerifications).values({ vendorId: vendor.id }).returning())[0];
    if (!existing) throw new AppError('verification_failed', 'Unable to prepare verification', 500);
    if (['approved', 'under_review'].includes(existing.status)) throw new AppError('verification_locked', 'This verification is already under review or approved', 409);
    const step = String(request.params.step || ''); const body = request.body || {}; const values: Partial<typeof vendorVerifications.$inferInsert> = { updatedAt: new Date(), status: 'draft' };
    let documents: { type: DocumentType; storageKey: string; contentType: string; originalFilename: string | null }[] = [];
    if (step === 'identity') {
      const cnic = normalizedIdentifier(text(body.cnic_number, 'CNIC number', 20)); if (!/^\d{13}$/.test(cnic)) throw new AppError('invalid_cnic', 'CNIC must contain 13 digits', 422);
      values.cnicHash = identifierFingerprint(cnic); values.cnicLastFour = identifierLastFour(cnic); values.identityStatus = 'pending'; values.identityReason = null;
      documents = documentList(body.documents, request.auth.userId, ['cnic_front', 'cnic_back']); if (!['cnic_front', 'cnic_back'].every((type) => documents.some((document) => document.type === type))) throw new AppError('invalid_verification_document', 'Upload both CNIC front and back', 422);
    } else if (step === 'business') {
      const type = body.business_type; if (!['sole_proprietor', 'partnership', 'private_limited', 'other'].includes(type)) throw new AppError('invalid_business', 'Choose a valid business type', 422);
      const number = normalizedIdentifier(text(body.business_number, 'NTN or registration number', 60)); if (number.length < 5) throw new AppError('invalid_business', 'Enter a valid NTN or registration number', 422);
      const relationship = body.registrant_relationship; if (!['owner_director', 'authorized_representative'].includes(relationship)) throw new AppError('invalid_business', 'Choose the registrant relationship', 422);
      values.businessType = type; values.businessNumberHash = identifierFingerprint(number); values.businessNumberLastFour = identifierLastFour(number); values.registrantRelationship = relationship; values.businessStatus = 'pending'; values.businessReason = null;
      documents = documentList(body.documents, request.auth.userId, ['business_registration', 'authorization_letter']); if (!documents.some((document) => document.type === 'business_registration') || (relationship === 'authorized_representative' && !documents.some((document) => document.type === 'authorization_letter'))) throw new AppError('invalid_verification_document', 'Upload business proof and an authorization letter when registering for someone else', 422);
    } else if (step === 'payout') {
      const bank = text(body.bank_name, 'Bank name'); const title = text(body.account_title, 'Account title'); const account = normalizedIdentifier(text(body.account_number, 'IBAN or account number', 40)); if (!/^(PK\d{2}[A-Z0-9]{15,30}|\d{8,34})$/.test(account)) throw new AppError('invalid_payout', 'Enter a valid Pakistan IBAN or account number', 422);
      values.payoutBankName = bank; values.payoutAccountTitle = title; values.payoutAccountCiphertext = encryptPayoutValue(account); values.payoutStatus = 'pending'; values.payoutReason = null;
    } else throw new AppError('invalid_verification_step', 'Use identity, business, or payout', 422);
    const updated = await db.transaction(async (tx) => { const row = (await tx.update(vendorVerifications).set(values).where(eq(vendorVerifications.id, existing.id)).returning())[0]; if (documents.length) { const replacing = step === 'identity' ? ['cnic_front', 'cnic_back'] : ['business_registration', 'authorization_letter']; await tx.delete(vendorVerificationDocuments).where(and(eq(vendorVerificationDocuments.verificationId, existing.id), inArray(vendorVerificationDocuments.type, replacing))); await tx.insert(vendorVerificationDocuments).values(documents.map((document) => ({ verificationId: existing.id, type: document.type, storageKey: document.storageKey, contentType: document.contentType, originalFilename: document.originalFilename }))); } return row; });
    response.json({ verification: { status: updated?.status, identity_status: updated?.identityStatus, business_status: updated?.businessStatus, payout_status: updated?.payoutStatus } });
  };

  submitVerification = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const vendor = (await db.select().from(vendors).where(eq(vendors.userId, request.auth.userId)).limit(1))[0];
    if (!vendor) throw new AppError('vendor_required', 'Create your basic vendor profile before verification', 409);
    const verification = (await db.select().from(vendorVerifications).where(eq(vendorVerifications.vendorId, vendor.id)).limit(1))[0];
    if (!verification) throw new AppError('verification_incomplete', 'Complete identity, business, and payout details first', 422);
    const documents = await db.select({ type: vendorVerificationDocuments.type }).from(vendorVerificationDocuments).where(eq(vendorVerificationDocuments.verificationId, verification.id)); const types = new Set(documents.map((document) => document.type));
    const complete = verification.cnicHash && verification.businessType && verification.businessNumberHash && verification.payoutAccountCiphertext && ['cnic_front', 'cnic_back', 'business_registration'].every((type) => types.has(type)) && (verification.registrantRelationship !== 'authorized_representative' || types.has('authorization_letter'));
    if (!complete) throw new AppError('verification_incomplete', 'Complete every required verification step and document before submitting', 422);
    await db.transaction(async (tx) => { await tx.update(vendorVerifications).set({ status: 'under_review', identityStatus: 'pending', businessStatus: 'pending', payoutStatus: 'pending', submittedAt: new Date(), updatedAt: new Date() }).where(eq(vendorVerifications.id, verification.id)); await tx.update(vendors).set({ verificationStatus: 'under_review', verificationReason: null, isVerified: false, updatedAt: new Date() }).where(eq(vendors.id, vendor.id)); });
    response.json({ message: 'Verification submitted for review', status: 'under_review' });
  };
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
    const page = request.query.page === undefined ? 1 : Number(request.query.page);
    const limit = request.query.limit === undefined ? 30 : Number(request.query.limit);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10_000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new AppError('invalid_pagination', 'Use a valid page and limit', 422);
    const offset = (page - 1) * limit;
    const [{ total = 0 } = {}] = await db.select({ total: count() }).from(ledgerEntries).where(eq(ledgerEntries.vendorId, vendor.id));
    const entries = await db.select({
      id: ledgerEntries.id, bookingId: ledgerEntries.bookingId, type: ledgerEntries.type, status: ledgerEntries.status,
      amount: ledgerEntries.amount, description: ledgerEntries.description, postedAt: ledgerEntries.postedAt, createdAt: ledgerEntries.createdAt,
      bookingNumber: bookings.bookingNumber, groundTitle: grounds.title,
    }).from(ledgerEntries)
      .innerJoin(bookings, eq(ledgerEntries.bookingId, bookings.id))
      .innerJoin(grounds, eq(bookings.groundId, grounds.id))
      .where(eq(ledgerEntries.vendorId, vendor.id))
      .orderBy(desc(ledgerEntries.createdAt), desc(ledgerEntries.id)).limit(limit).offset(offset);
    const refundEntries = await db.select({ amount: ledgerEntries.amount, type: ledgerEntries.type, status: ledgerEntries.status }).from(ledgerEntries).where(eq(ledgerEntries.vendorId, vendor.id));
    const pendingRefunds = refundEntries
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
      pagination: { page, limit, total, has_more: offset + entries.length < total },
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
      verificationStatus: 'draft',
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
    if (body.business_logo !== undefined) values.businessLogo = typeof body.business_logo === 'string' ? body.business_logo.trim() || null : null;
    if (body.business_cover_image !== undefined) values.businessCoverImage = typeof body.business_cover_image === 'string' ? body.business_cover_image.trim() || null : null;
    if (body.is_active !== undefined) values.isActive = Boolean(body.is_active);
    const [updated] = await db.update(vendors).set(values).where(eq(vendors.id, current.id)).returning();
    if (!updated) throw new AppError('vendor_update_failed', 'Unable to update vendor profile', 500);
    response.json({ profile: toProfile(updated) });
  };
}
