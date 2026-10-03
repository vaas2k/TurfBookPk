import { boolean, date, integer, jsonb, numeric, pgEnum, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending_payment',
  'confirmed',
  'cancelled',
  'expired',
  'completed',
  'no_show',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refund_pending',
  'refunded',
]);

export const bookingOrderStatusEnum = pgEnum('booking_order_status', ['pending_payment', 'confirmed', 'cancelled', 'expired']);

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', ['booking_earning', 'refund', 'adjustment', 'payout']);
export const ledgerEntryStatusEnum = pgEnum('ledger_entry_status', ['pending', 'posted', 'reversed']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: text('phone').unique(),
  email: text('email').unique(),
  fullName: text('full_name').default('Player'),
  city: text('city'),
  bio: text('bio'),
  preferredFoot: text('preferred_foot'),
  preferredPosition: text('preferred_position'),
  skillLevel: text('skill_level'),
  role: text('role').notNull().default('player'),
  avatarUrl: text('avatar_url'),
  isVerified: boolean('is_verified').notNull().default(false),
  isSuspended: boolean('is_suspended').notNull().default(false),
  isSetupComplete: boolean('is_setup_complete').notNull().default(false),
  noShowStrikes: integer('no_show_strikes').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const otpChallenges = pgTable('otp_challenges', {
  phone: text('phone').primaryKey(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  requestCount: integer('request_count').notNull().default(1),
  requestWindowStartedAt: timestamp('request_window_started_at', { withTimezone: true }).notNull().defaultNow(),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refreshSessions = pgTable('refresh_sessions', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vendors = pgTable('vendors', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  businessName: text('business_name').notNull(),
  businessPhone: text('business_phone').notNull(),
  businessCity: text('business_city').notNull(),
  businessDescription: text('business_description'),
  businessLogo: text('business_logo'),
  businessCoverImage: text('business_cover_image'),
  isVerified: boolean('is_verified').notNull().default(false),
  verificationStatus: text('verification_status').notNull().default('pending'),
  verificationReason: text('verification_reason'),
  isActive: boolean('is_active').notNull().default(true),
  totalEarnings: integer('total_earnings').notNull().default(0),
  pendingEarnings: integer('pending_earnings').notNull().default(0),
  totalWithdrawn: integer('total_withdrawn').notNull().default(0),
  rating: numeric('rating', { precision: 3, scale: 2, mode: 'number' }).notNull().default(0),
  totalReviews: integer('total_reviews').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const grounds = pgTable('grounds', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location').notNull(),
  city: text('city').notNull(),
  address: text('address').notNull(),
  latitude: numeric('latitude', { precision: 10, scale: 7, mode: 'number' }),
  longitude: numeric('longitude', { precision: 10, scale: 7, mode: 'number' }),
  amenities: text('amenities').array().notNull().default([]),
  images: text('images').array().notNull().default([]),
  coverImage: text('cover_image'),
  pitchType: text('pitch_type'),
  pricePerHour: integer('price_per_hour').notNull(),
  peakPercentage: integer('peak_percentage'),
  peakWindows: jsonb('peak_windows').$type<{ days: number[]; startTime: string; endTime: string }[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  isVerified: boolean('is_verified').notNull().default(false),
  verificationStatus: text('verification_status').notNull().default('pending'),
  verificationReason: text('verification_reason'),
  rating: numeric('rating', { precision: 3, scale: 2, mode: 'number' }).notNull().default(0),
  totalReviews: integer('total_reviews').notNull().default(0),
  operatingHours: jsonb('operating_hours').$type<{ open: string; close: string }>().notNull().default({ open: '06:00', close: '23:00' }),
  rules: text('rules').array().notNull().default([]),
  cancellationPolicy: text('cancellation_policy'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const slots = pgTable('slots', {
  id: uuid('id').defaultRandom().primaryKey(),
  groundId: uuid('ground_id').notNull().references(() => grounds.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  price: integer('price').notNull(),
  isBooked: boolean('is_booked').notNull().default(false),
  isBlocked: boolean('is_blocked').notNull().default(false),
  isClubReserved: boolean('is_club_reserved').notNull().default(false),
  reservationNote: text('reservation_note'),
  scheduleTemplateId: uuid('schedule_template_id'),
  bookedBy: uuid('booked_by').references(() => users.id),
  bookingId: uuid('booking_id'),
  heldBy: uuid('held_by').references(() => users.id),
  holdBookingId: uuid('hold_booking_id'),
  holdExpiresAt: timestamp('hold_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingNumber: text('booking_number').notNull().unique(),
  playerId: uuid('player_id').notNull().references(() => users.id),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  groundId: uuid('ground_id').notNull().references(() => grounds.id),
  slotId: uuid('slot_id').notNull().references(() => slots.id),
  orderId: uuid('order_id'),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  totalAmount: integer('total_amount').notNull(),
  platformFee: integer('platform_fee').notNull().default(0),
  vendorAmount: integer('vendor_amount').notNull(),
  status: bookingStatusEnum('status').notNull().default('pending_payment'),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
  paymentMethod: text('payment_method').notNull().default('mock'),
  paymentReference: text('payment_reference'),
  idempotencyKey: text('idempotency_key').unique(),
  holdExpiresAt: timestamp('hold_expires_at', { withTimezone: true }),
  isRecurringReservation: boolean('is_recurring_reservation').notNull().default(false),
  paymentWindowOpensAt: timestamp('payment_window_opens_at', { withTimezone: true }),
  reservationExpiresAt: timestamp('reservation_expires_at', { withTimezone: true }),
  paymentWindowNotifiedAt: timestamp('payment_window_notified_at', { withTimezone: true }),
  cancellationPolicy: text('cancellation_policy').notNull().default('standard'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledBy: uuid('cancelled_by').references(() => users.id),
  cancellationReason: text('cancellation_reason'),
  cancellationFee: integer('cancellation_fee').notNull().default(0),
  refundAmount: integer('refund_amount').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vendorVerifications = pgTable('vendor_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorId: uuid('vendor_id').notNull().unique().references(() => vendors.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('draft'),
  identityStatus: text('identity_status').notNull().default('draft'),
  identityReason: text('identity_reason'),
  cnicHash: text('cnic_hash').unique(),
  cnicLastFour: text('cnic_last_four'),
  businessStatus: text('business_status').notNull().default('draft'),
  businessReason: text('business_reason'),
  businessType: text('business_type'),
  businessNumberHash: text('business_number_hash'),
  businessNumberLastFour: text('business_number_last_four'),
  registrantRelationship: text('registrant_relationship').notNull().default('owner_director'),
  payoutStatus: text('payout_status').notNull().default('draft'),
  payoutReason: text('payout_reason'),
  payoutBankName: text('payout_bank_name'),
  payoutAccountTitle: text('payout_account_title'),
  payoutAccountCiphertext: text('payout_account_ciphertext'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vendorVerificationDocuments = pgTable('vendor_verification_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  verificationId: uuid('verification_id').notNull().references(() => vendorVerifications.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  storageKey: text('storage_key').notNull().unique(),
  contentType: text('content_type').notNull(),
  originalFilename: text('original_filename'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Ground ownership/operating authority is intentionally distinct from vendor KYC. */
export const groundVerifications = pgTable('ground_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  groundId: uuid('ground_id').notNull().unique().references(() => grounds.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('draft'),
  authorityStatus: text('authority_status').notNull().default('draft'),
  authorityReason: text('authority_reason'),
  relationship: text('relationship'),
  documentExpiryDate: date('document_expiry_date'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groundVerificationDocuments = pgTable('ground_verification_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  verificationId: uuid('verification_id').notNull().references(() => groundVerifications.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  storageKey: text('storage_key').notNull().unique(),
  contentType: text('content_type').notNull(),
  originalFilename: text('original_filename'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const slotScheduleTemplates = pgTable('slot_schedule_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  groundId: uuid('ground_id').notNull().references(() => grounds.id, { onDelete: 'cascade' }),
  days: integer('days').array().notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  price: integer('price').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groundBlackoutDates = pgTable('ground_blackout_dates', {
  id: uuid('id').defaultRandom().primaryKey(),
  groundId: uuid('ground_id').notNull().references(() => grounds.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bookingOrders = pgTable('booking_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  playerId: uuid('player_id').notNull().references(() => users.id),
  totalAmount: integer('total_amount').notNull(),
  platformFee: integer('platform_fee').notNull().default(0),
  status: bookingOrderStatusEnum('status').notNull().default('pending_payment'),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const paymentAttempts = pgTable('payment_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id').references(() => bookings.id),
  orderId: uuid('order_id').references(() => bookingOrders.id),
  playerId: uuid('player_id').notNull().references(() => users.id),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  provider: text('provider').notNull(),
  providerReference: text('provider_reference'),
  amount: integer('amount').notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id),
  paymentAttemptId: uuid('payment_attempt_id').references(() => paymentAttempts.id),
  type: ledgerEntryTypeEnum('type').notNull(),
  status: ledgerEntryStatusEnum('status').notNull().default('pending'),
  amount: integer('amount').notNull(),
  description: text('description').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pushTokens = pgTable('push_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  platform: text('platform').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pushReceipts = pgTable('push_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  token: text('token').notNull().references(() => pushTokens.token, { onDelete: 'cascade' }),
  ticketId: text('ticket_id').notNull().unique(),
  checkedAt: timestamp('checked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = pgTable('reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id').notNull().unique().references(() => bookings.id, { onDelete: 'cascade' }),
  groundId: uuid('ground_id').notNull().references(() => grounds.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  isHidden: boolean('is_hidden').notNull().default(false),
  hiddenReason: text('hidden_reason'),
  hiddenAt: timestamp('hidden_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reviewReports = pgTable('review_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reviewId: uuid('review_id').notNull().references(() => reviews.id, { onDelete: 'cascade' }),
  reporterId: uuid('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('open'),
  resolutionReason: text('resolution_reason'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  reason: text('reason'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const favoriteGrounds = pgTable('favorite_grounds', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  groundId: uuid('ground_id').notNull().references(() => grounds.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recentlyViewedGrounds = pgTable('recently_viewed_grounds', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  groundId: uuid('ground_id').notNull().references(() => grounds.id, { onDelete: 'cascade' }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type OtpChallengeRow = typeof otpChallenges.$inferSelect;
export type RefreshSessionRow = typeof refreshSessions.$inferSelect;
