import { boolean, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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

export type UserRow = typeof users.$inferSelect;
export type OtpChallengeRow = typeof otpChallenges.$inferSelect;
export type RefreshSessionRow = typeof refreshSessions.$inferSelect;