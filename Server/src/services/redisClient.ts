import { createClient } from 'redis';
import { env } from '../configs/env.js';
import { logEvent } from './operationalLogger.js';

export const redis = env.redisUrl ? createClient({
  url: env.redisUrl,
  socket: { reconnectStrategy: (retries) => Math.min(250 * 2 ** Math.min(retries, 6), 10_000) },
}) : null;

redis?.on('error', (error) => logEvent('error', 'redis_error', { code: typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown' }));
redis?.on('reconnecting', () => logEvent('warn', 'redis_reconnecting'));
redis?.on('ready', () => logEvent('info', 'redis_ready'));

export async function connectRedis(): Promise<void> {
  if (redis && !redis.isOpen) await redis.connect();
}

export async function closeRedis(): Promise<void> {
  if (redis?.isOpen) await redis.quit();
}
