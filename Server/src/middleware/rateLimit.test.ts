import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { NextFunction, Request, Response } from 'express';
import { createRateLimiter } from './rateLimit.js';
import { closeRedis, connectRedis, redis } from '../services/redisClient.js';

test('rate limiter rejects requests beyond the configured IP limit', async () => {
  await connectRedis();
  try {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1, code: `limited_${randomUUID()}`, message: 'Limited' });
    const request = { ip: '127.0.0.1', socket: {} } as Request;
    const response = { setHeader() {} } as unknown as Response;
    const outcomes: unknown[] = [];
    let finished!: () => void;
    const completion = new Promise<void>((resolve) => { finished = resolve; });
    const next = ((error?: unknown) => { outcomes.push(error || null); if (outcomes.length === 2) finished(); }) as NextFunction;
    limiter(request, response, next);
    limiter(request, response, next);
    await completion;
    assert.equal(outcomes.filter((outcome) => outcome === null).length, 1);
    assert.equal(outcomes.filter((outcome) => (outcome as { statusCode?: number } | null)?.statusCode === 429).length, 1);
  } finally {
    await closeRedis();
  }
});

test('configured Redis limiter fails closed and recovers after reconnect', async () => {
  if (!redis) return;
  await connectRedis();
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2, code: `redis_recovery_${randomUUID()}`, message: 'Limited' });
  const request = { ip: '127.0.0.2', socket: {} } as Request;
  const response = { setHeader() {} } as unknown as Response;
  const invoke = () => new Promise<unknown>((resolve) => limiter(request, response, ((error?: unknown) => resolve(error || null)) as NextFunction));
  try {
    await closeRedis();
    assert.equal((await invoke() as { statusCode: number }).statusCode, 503);
    await connectRedis();
    assert.equal(await invoke(), null);
  } finally {
    await closeRedis();
  }
});
