import { createHash } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../helpers/errors.js';
import { redis } from '../services/redisClient.js';
import { env } from '../configs/env.js';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  code: string;
  message: string;
  scope?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const localEntries = new Map<string, RateLimitEntry>();
const atomicIncrement = `local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return { count, redis.call('PTTL', KEYS[1]) };`;

export function createRateLimiter(options: RateLimitOptions) {
  const scope = options.scope || options.code;
  return (request: Request, response: Response, next: NextFunction): void => {
    if (env.loadTestRateLimitBypass) return next();
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const key = `turfbookpk:rate:v1:${scope}:${createHash('sha256').update(ip).digest('hex')}`;
    const now = Date.now();
    void (async () => {
      let count: number;
      let resetAt: number;
      if (redis) {
        if (!redis.isReady) throw new AppError('rate_limit_unavailable', 'Please try again shortly', 503);
        const [hits, remainingMs] = await redis.eval(atomicIncrement, { keys: [key], arguments: [String(options.windowMs)] }) as [number, number];
        count = Number(hits);
        resetAt = now + Math.max(0, Number(remainingMs));
      } else {
        // Local-only convenience; production requires REDIS_URL at startup.
        const previous = localEntries.get(key);
        const entry = !previous || previous.resetAt <= now ? { count: 1, resetAt: now + options.windowMs } : { count: previous.count + 1, resetAt: previous.resetAt };
        localEntries.set(key, entry);
        count = entry.count;
        resetAt = entry.resetAt;
        if (localEntries.size > 10_000) for (const [name, value] of localEntries) if (value.resetAt <= now) localEntries.delete(name);
      }
      response.setHeader('RateLimit-Limit', String(options.maxRequests));
      response.setHeader('RateLimit-Remaining', String(Math.max(0, options.maxRequests - count)));
      response.setHeader('RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
      if (count > options.maxRequests) {
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - now) / 1000))));
        throw new AppError(options.code, options.message, 429);
      }
      next();
    })().catch(next);
  };
}
