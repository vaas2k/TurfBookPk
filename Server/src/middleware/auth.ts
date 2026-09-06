import { NextFunction, Request, Response } from 'express';
import { TokenService } from '../services/tokenService.js';
import { AppError } from '../helpers/errors.js';

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; sessionId: string };
}

export function requireAuth(tokenService: TokenService) {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction): void => {
    try {
      const header = request.header('authorization');
      if (!header?.startsWith('Bearer ')) throw new AppError('unauthorized', 'Authentication is required', 401);
      request.auth = tokenService.verifyAccessToken(header.slice(7));
      next();
    } catch (error) {
      next(error);
    }
  };
}