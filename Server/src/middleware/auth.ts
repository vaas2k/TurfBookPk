import { NextFunction, Request, Response } from 'express';
import { TokenService } from '../services/tokenService.js';
import { AppError } from '../helpers/errors.js';
import { db } from '../database/client.js';
import { users } from '../database/schema.js';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; sessionId: string };
}

export function requireAuth(tokenService: TokenService) {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction): Promise<void> => {
    try {
      const header = request.header('authorization');
      if (!header?.startsWith('Bearer ')) throw new AppError('unauthorized', 'Authentication is required', 401);
      request.auth = await tokenService.authenticateAccessToken(header.slice(7));
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin() {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction): Promise<void> => {
    try {
      if (!request.auth) throw new AppError('unauthorized', 'Authentication is required', 401);
      const user = (await db.select({ role: users.role, isSuspended: users.isSuspended }).from(users).where(eq(users.id, request.auth.userId)).limit(1))[0];
      if (!user || user.isSuspended || user.role !== 'admin') throw new AppError('forbidden', 'Administrator access is required', 403);
      next();
    } catch (error) {
      next(error);
    }
  };
}
