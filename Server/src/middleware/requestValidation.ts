import { NextFunction, Request, Response } from 'express';
import { AppError } from '../helpers/errors.js';

export function requireJsonBody(request: Request, _response: Response, next: NextFunction): void {
  if (!request.is('application/json')) {
    next(new AppError('unsupported_media_type', 'Content-Type must be application/json', 415));
    return;
  }
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    next(new AppError('invalid_request', 'Request body must be a JSON object', 422));
    return;
  }
  next();
}
