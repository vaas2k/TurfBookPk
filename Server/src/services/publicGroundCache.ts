import { createHash } from 'node:crypto';
import { redis } from './redisClient.js';
import { logEvent } from './operationalLogger.js';

const CACHE_VERSION = 'v1';
const TTL_SECONDS = 60;
const DISCOVERY_TTL_SECONDS = 30;
const CACHE_BUDGET_MS = 100;

async function withinBudget<T>(operation: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('cache_timeout')), CACHE_BUDGET_MS); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function publicGroundEtag(ground: unknown): string {
  return `"${createHash('sha256').update(JSON.stringify(ground)).digest('hex')}"`;
}

export async function cachedPublicGround<T>(id: string, version: string, build: () => Promise<T>): Promise<T> {
  const key = `turfbookpk:public-ground:${CACHE_VERSION}:${id}:${version}`;
  if (redis?.isReady) {
    try {
      const cached = await withinBudget(redis.get(key));
      if (cached) return JSON.parse(cached) as T;
    } catch (error) {
      logEvent('warn', 'public_ground_cache_read_failed', { error_name: error instanceof Error ? error.name : 'unknown' });
    }
  }
  const value = await build();
  if (redis?.isReady) {
    try {
      await withinBudget(redis.set(key, JSON.stringify(value), { EX: TTL_SECONDS }));
    } catch (error) {
      logEvent('warn', 'public_ground_cache_write_failed', { error_name: error instanceof Error ? error.name : 'unknown' });
    }
  }
  return value;
}

export async function cachedPublicDiscovery<T>(query: unknown, revision: number, build: () => Promise<T>): Promise<T> {
  const queryHash = createHash('sha256').update(JSON.stringify(query)).digest('hex');
  const key = `turfbookpk:public-discovery:${CACHE_VERSION}:${revision}:${queryHash}`;
  if (redis?.isReady) {
    try {
      const cached = await withinBudget(redis.get(key));
      if (cached) return JSON.parse(cached) as T;
    } catch (error) {
      logEvent('warn', 'public_discovery_cache_read_failed', { error_name: error instanceof Error ? error.name : 'unknown' });
    }
  }
  const value = await build();
  if (redis?.isReady) {
    try {
      await withinBudget(redis.set(key, JSON.stringify(value), { EX: DISCOVERY_TTL_SECONDS }));
    } catch (error) {
      logEvent('warn', 'public_discovery_cache_write_failed', { error_name: error instanceof Error ? error.name : 'unknown' });
    }
  }
  return value;
}
