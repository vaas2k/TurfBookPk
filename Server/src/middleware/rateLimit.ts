import { NextFunction, Request, Response } from 'express';
import { AppError } from '../helpers/errors.js';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  code: string;
  message: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>();
  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const current = entries.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 1, resetAt: now + options.windowMs }
      : { count: current.count + 1, resetAt: current.resetAt };
    entries.set(key, entry);
    response.setHeader('RateLimit-Limit', String(options.maxRequests));
    response.setHeader('RateLimit-Remaining', String(Math.max(0, options.maxRequests - entry.count)));
    response.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > options.maxRequests) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      next(new AppError(options.code, options.message, 429));
      return;
    }
    if (entries.size > 10_000) {
      for (const [entryKey, value] of entries) if (value.resetAt <= now) entries.delete(entryKey);
    }
    next();
  };
}
