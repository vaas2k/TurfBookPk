import { desc, eq, and, count } from 'drizzle-orm';
import { Response } from 'express';
import { db } from '../database/client.js';
import { favoriteGrounds, grounds, recentlyViewedGrounds, vendors } from '../database/schema.js';
import { AppError } from '../helpers/errors.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { toGround } from './groundController.js';

export class EngagementController {
  favorites = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const page = Number(request.query.page ?? 1); const limit = Number(request.query.limit ?? 50);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10_000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new AppError('invalid_pagination', 'Use a valid page and limit', 422);
    const condition = and(eq(favoriteGrounds.userId, request.auth.userId), eq(grounds.isActive, true), eq(vendors.isActive, true));
    const base = () => db.select({ favorite: favoriteGrounds, ground: grounds }).from(favoriteGrounds).innerJoin(grounds, eq(favoriteGrounds.groundId, grounds.id)).innerJoin(vendors, eq(grounds.vendorId, vendors.id));
    const [totalRow, rows] = await Promise.all([
      db.select({ value: count() }).from(favoriteGrounds).innerJoin(grounds, eq(favoriteGrounds.groundId, grounds.id)).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(condition),
      base().where(condition).orderBy(desc(favoriteGrounds.createdAt), desc(favoriteGrounds.id)).limit(limit).offset((page - 1) * limit),
    ]);
    const total = totalRow[0]?.value ?? 0;
    response.json({ grounds: rows.map(({ ground }) => toGround(ground)), pagination: { page, limit, total, has_more: page * limit < total } });
  };
  recent = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const rows = await db.select({ recent: recentlyViewedGrounds, ground: grounds }).from(recentlyViewedGrounds).innerJoin(grounds, eq(recentlyViewedGrounds.groundId, grounds.id)).innerJoin(vendors, eq(grounds.vendorId, vendors.id)).where(and(eq(recentlyViewedGrounds.userId, request.auth.userId), eq(grounds.isActive, true), eq(vendors.isActive, true))).orderBy(desc(recentlyViewedGrounds.viewedAt)).limit(20);
    response.json({ grounds: rows.map(({ ground }) => toGround(ground)) });
  };
  addFavorite = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = String(request.params.groundId || '');
    const ground = (await db.select({ id: grounds.id }).from(grounds).where(eq(grounds.id, groundId)).limit(1))[0];
    if (!ground) throw new AppError('not_found', 'Ground was not found', 404);
    const existing = (await db.select({ id: favoriteGrounds.id }).from(favoriteGrounds).where(and(eq(favoriteGrounds.userId, request.auth.userId), eq(favoriteGrounds.groundId, groundId))).limit(1))[0];
    if (!existing) await db.insert(favoriteGrounds).values({ userId: request.auth.userId, groundId });
    response.status(201).json({ favorited: true });
  };
  removeFavorite = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    await db.delete(favoriteGrounds).where(and(eq(favoriteGrounds.userId, request.auth.userId), eq(favoriteGrounds.groundId, String(request.params.groundId || ''))));
    response.status(204).send();
  };
  viewGround = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
    const groundId = String(request.params.groundId || ''); const now = new Date();
    const existing = (await db.select({ id: recentlyViewedGrounds.id }).from(recentlyViewedGrounds).where(and(eq(recentlyViewedGrounds.userId, request.auth.userId), eq(recentlyViewedGrounds.groundId, groundId))).limit(1))[0];
    if (existing) await db.update(recentlyViewedGrounds).set({ viewedAt: now }).where(eq(recentlyViewedGrounds.id, existing.id));
    else await db.insert(recentlyViewedGrounds).values({ userId: request.auth.userId, groundId, viewedAt: now });
    response.status(204).send();
  };
}
