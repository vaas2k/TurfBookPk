import assert from 'node:assert/strict';
import test from 'node:test';
import { NextFunction, Request, Response } from 'express';
import { createRateLimiter } from './rateLimit.js';

test('rate limiter rejects requests beyond the configured IP limit', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1, code: 'limited', message: 'Limited' });
  const request = { ip: '127.0.0.1', socket: {} } as Request;
  const response = { setHeader() {} } as unknown as Response;
  const outcomes: unknown[] = [];
  const next = ((error?: unknown) => outcomes.push(error || null)) as NextFunction;
  limiter(request, response, next);
  limiter(request, response, next);
  assert.equal(outcomes[0], null);
  assert.equal((outcomes[1] as { statusCode: number }).statusCode, 429);
});
