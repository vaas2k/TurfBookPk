import { and, desc, eq, sql } from 'drizzle-orm';
import { Response } from 'express';
import { db } from '../database/client.js';
import { bookings, grounds, reviewReports, reviews, users, vendors } from '../database/schema.js';
import { AppError } from '../helpers/errors.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export class ReviewController {
  list = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const groundId = String(request.params.groundId || '');
    const rows = await db.select({ review: reviews, player: users }).from(reviews).innerJoin(users, eq(reviews.playerId, users.id)).where(and(eq(reviews.groundId, groundId), eq(reviews.isHidden, false))).orderBy(desc(reviews.createdAt));
    response.json({ reviews: rows.map(({ review, player }) => ({ id: review.id, rating: review.rating, comment: review.comment, player_name: player.fullName || 'Player', created_at: review.createdAt.toISOString() })) });
  };
  create = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const bookingId = String(request.params.bookingId || ''); const rating = request.body?.rating; const comment = typeof request.body?.comment === 'string' ? request.body.comment.trim().slice(0, 500) : null;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError('invalid_review', 'Rating must be between 1 and 5', 422);
    const booking = (await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.playerId, request.auth.userId))).limit(1))[0];
    if (!booking || booking.status !== 'completed') throw new AppError('review_not_allowed', 'Only completed bookings can be reviewed', 409);
    const review = await db.transaction(async (tx) => {
      const [created] = await tx.insert(reviews).values({ bookingId, groundId: booking.groundId, playerId: request.auth!.userId, rating, comment }).returning();
      if (!created) throw new AppError('review_failed', 'Unable to save review', 500);
      const stats = (await tx.select({ rating: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)`, count: sql<number>`count(*)::int` }).from(reviews).where(eq(reviews.groundId, booking.groundId)))[0]!;
      await tx.update(grounds).set({ rating: stats.rating, totalReviews: stats.count, updatedAt: new Date() }).where(eq(grounds.id, booking.groundId));
      return created;
    });
    response.status(201).json({ review: { id: review.id, rating: review.rating, comment: review.comment, created_at: review.createdAt.toISOString() } });
  };
  report = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const reviewId = String(request.params.reviewId || '');
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim().slice(0, 300) : '';
    if (!reason) throw new AppError('invalid_report', 'Please provide a report reason', 422);
    const review = (await db.select({ id: reviews.id, playerId: reviews.playerId }).from(reviews).where(eq(reviews.id, reviewId)).limit(1))[0];
    if (!review) throw new AppError('not_found', 'Review was not found', 404);
    if (review.playerId === request.auth.userId) throw new AppError('invalid_report', 'You cannot report your own review', 422);
    const existing = (await db.select({ id: reviewReports.id }).from(reviewReports).where(and(eq(reviewReports.reviewId, reviewId), eq(reviewReports.reporterId, request.auth.userId))).limit(1))[0];
    if (!existing) await db.insert(reviewReports).values({ reviewId, reporterId: request.auth.userId, reason });
    response.status(201).json({ reported: true });
  };
  moderate = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const reviewId = String(request.params.reviewId || '');
    const isHidden = request.body?.is_hidden;
    const hiddenReason = typeof request.body?.reason === 'string' ? request.body.reason.trim().slice(0, 300) : null;
    if (typeof isHidden !== 'boolean') throw new AppError('invalid_review', 'is_hidden must be true or false', 422);
    const row = (await db.select({ review: reviews, vendor: vendors }).from(reviews).innerJoin(grounds, eq(reviews.groundId, grounds.id)).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(eq(reviews.id, reviewId)).limit(1))[0];
    if (!row || row.vendor.userId !== request.auth.userId) throw new AppError('not_found', 'Review was not found', 404);
    await db.update(reviews).set({ isHidden, hiddenReason: isHidden ? hiddenReason || 'Hidden by ground owner pending moderation' : null, hiddenAt: isHidden ? new Date() : null, updatedAt: new Date() }).where(eq(reviews.id, reviewId));
    response.json({ moderated: true, is_hidden: isHidden });
  };
}
