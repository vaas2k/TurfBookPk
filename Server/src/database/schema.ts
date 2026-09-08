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
  isSetupComplete: boolean('is_setup_complete').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const otpChallenges = pgTable('otp_challenges', {
  phone: text('phone').primaryKey(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
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
  peakPrice: integer('peak_price'),
  isActive: boolean('is_active').notNull().default(true),
  isVerified: boolean('is_verified').notNull().default(false),
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
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledBy: uuid('cancelled_by').references(() => users.id),
  cancellationReason: text('cancellation_reason'),
  notes: text('notes'),
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

export type UserRow = typeof users.$inferSelect;
export type OtpChallengeRow = typeof otpChallenges.$inferSelect;
export type RefreshSessionRow = typeof refreshSessions.$inferSelect;
