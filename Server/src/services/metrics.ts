import { createHash, timingSafeEqual } from 'node:crypto';

const buckets = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
type Observation = { count: number; sum: number; buckets: number[] };
const requests = new Map<string, Observation>();
const cache = { metadata: { hit: 0, miss: 0, error: 0 }, discovery: { hit: 0, miss: 0, error: 0 } };
let activeRequests = 0;

function label(value: string): string { return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n'); }

export function metricsTokenValid(token: string | undefined, expected: string): boolean {
  if (!token || !expected) return false;
  const actualHash = createHash('sha256').update(token).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function requestStarted(): void { activeRequests += 1; }
export function requestFinished(method: string, route: string, status: number, durationSeconds: number): void {
  activeRequests = Math.max(0, activeRequests - 1);
  // Route templates come from Express registrations, never from user-provided URLs.
  const safeRoute = route.startsWith('/api/') && route.length <= 120 && /^[a-zA-Z0-9_/:.-]+$/.test(route) ? route : 'unmatched';
  const safeMethod = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? method : 'OTHER';
  const statusClass = `${Math.floor(status / 100)}xx`;
  const key = `${safeMethod}|${safeRoute}|${statusClass}`;
  let observation = requests.get(key);
  if (!observation) {
    observation = { count: 0, sum: 0, buckets: buckets.map(() => 0) };
    requests.set(key, observation);
  }
  observation.count += 1;
  observation.sum += durationSeconds;
  buckets.forEach((bound, index) => { if (durationSeconds <= bound) observation!.buckets[index]! += 1; });
}

export function cacheAccess(kind: 'metadata' | 'discovery', outcome: 'hit' | 'miss' | 'error'): void {
  cache[kind][outcome] += 1;
}

export function renderMetrics(database: { outboxPending: number; outboxDead: number; outboxOldestSeconds: number; paymentPending: number; paymentManualReview: number; paymentExpiryRetry: number; dbConnections?: number; dbMaxConnections?: number; workerHeartbeatAgeSeconds?: number }, workerJobs: Record<string, string> = {}): string {
  const lines = [
    '# HELP turfbook_http_requests_total HTTP responses by route template and status class.',
    '# TYPE turfbook_http_requests_total counter',
  ];
  for (const [key, observation] of [...requests].sort(([a], [b]) => a.localeCompare(b))) {
    const [method, route, status] = key.split('|');
    const labels = `method="${label(method!)}",route="${label(route!)}",status="${label(status!)}"`;
    lines.push(`turfbook_http_requests_total{${labels}} ${observation.count}`);
  }
  lines.push('# HELP turfbook_http_request_duration_seconds HTTP response duration.', '# TYPE turfbook_http_request_duration_seconds histogram');
  for (const [key, observation] of [...requests].sort(([a], [b]) => a.localeCompare(b))) {
    const [method, route, status] = key.split('|');
    const labels = `method="${label(method!)}",route="${label(route!)}",status="${label(status!)}"`;
    buckets.forEach((bound, index) => lines.push(`turfbook_http_request_duration_seconds_bucket{${labels},le="${bound}"} ${observation.buckets[index]}`));
    lines.push(`turfbook_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${observation.count}`);
    lines.push(`turfbook_http_request_duration_seconds_sum{${labels}} ${observation.sum}`);
    lines.push(`turfbook_http_request_duration_seconds_count{${labels}} ${observation.count}`);
  }
  lines.push('# TYPE turfbook_http_active_requests gauge', `turfbook_http_active_requests ${activeRequests}`);
  lines.push('# TYPE turfbook_process_rss_bytes gauge', `turfbook_process_rss_bytes ${process.memoryUsage().rss}`);
  lines.push('# HELP turfbook_cache_access_total Public metadata and discovery cache accesses.', '# TYPE turfbook_cache_access_total counter');
  for (const kind of ['metadata', 'discovery'] as const) for (const outcome of ['hit', 'miss', 'error'] as const) {
    lines.push(`turfbook_cache_access_total{kind="${kind}",outcome="${outcome}"} ${cache[kind][outcome]}`);
  }
  for (const [name, value] of Object.entries(database)) {
    lines.push(`# TYPE turfbook_${name.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)} gauge`);
    lines.push(`turfbook_${name.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)} ${value}`);
  }
  lines.push('# HELP turfbook_worker_jobs_total Background job outcomes recorded in Redis.', '# TYPE turfbook_worker_jobs_total counter');
  for (const [key, value] of Object.entries(workerJobs).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^[a-z_]+:(success|failure|retry|dead)$/.test(key) || !/^\d+$/.test(value)) continue;
    const [job, result] = key.split(':');
    lines.push(`turfbook_worker_jobs_total{job="${job}",result="${result}"} ${value}`);
  }
  return `${lines.join('\n')}\n`;
}
