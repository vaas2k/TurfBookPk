// Self-contained, read-only HTTP benchmark against the isolated load-test DB.
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import postgres from 'postgres';

const sourceUrl = new URL(process.env.DATABASE_URL || '');
const sourceName = decodeURIComponent(sourceUrl.pathname.slice(1));
const targetName = sourceName.endsWith('_loadtest') ? sourceName : `${sourceName}_loadtest`;
if (process.env.NODE_ENV === 'production' || !targetName.endsWith('_loadtest')) throw new Error('Benchmark requires a load-test database');
const targetUrl = new URL(sourceUrl);
targetUrl.pathname = `/${targetName}`;
const port = Number(process.env.BENCHMARK_PORT || 5101);
const flag = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1];
const concurrency = Number(flag('vus') || process.env.BENCHMARK_VUS || 10);
const durationSeconds = Number(flag('seconds') || process.env.BENCHMARK_SECONDS || 15);
const settleSeconds = Number(process.env.BENCHMARK_SETTLE_SECONDS ?? (process.env.BENCHMARK_TARGET_URL ? 45 : 0));
if (!Number.isInteger(port) || port < 1024 || port > 65535 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100 || !Number.isInteger(durationSeconds) || durationSeconds < 5 || durationSeconds > 300 || !Number.isInteger(settleSeconds) || settleSeconds < 0 || settleSeconds > 60) throw new Error('Invalid benchmark settings');
const externalTarget = process.env.BENCHMARK_TARGET_URL?.replace(/\/$/, '');
if (externalTarget && !/^https?:\/\//.test(externalTarget)) throw new Error('BENCHMARK_TARGET_URL must be an http(s) URL');
const root = externalTarget || `http://127.0.0.1:${port}/api`;
const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
const database = postgres(targetUrl.toString(), { max: 1, prepare: false });
const benchmarkSessions = [];
const [ground] = await database`select id from grounds where is_active and is_verified order by rating desc limit 1`;
// Resolve synthetic IDs from the seed prefix so the harness does not depend
// on a particular UUID string or record ordering.
const [playerAccount] = await database`select md5('loadtest-user-101')::uuid as id`;
const [vendorAccount] = await database`select md5('loadtest-user-1')::uuid as id`;
const [payment] = await database`select id from payment_attempts where player_id = ${playerAccount.id} order by created_at desc limit 1`;
if (!ground || !payment || !playerAccount || !vendorAccount) throw new Error('Run the full scalability seed before benchmarking');
async function tokenFor(userId) {
  const id = randomUUID();
  benchmarkSessions.push(id);
  await database`insert into refresh_sessions (id, user_id, token_hash, expires_at) values (${id}, ${userId}, ${randomUUID()}, now() + interval '1 hour')`;
  return jwt.sign({ sub: userId, sid: id }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
}
const playerToken = await tokenFor(playerAccount.id);
const vendorToken = await tokenFor(vendorAccount.id);
const routes = [
  { name: 'discovery', path: '/grounds?page=1&limit=24' },
  { name: 'date_discovery', path: `/grounds?availability_date=${date}&page=1&limit=24` },
  { name: 'ground_detail', path: `/grounds/${ground.id}` },
  { name: 'player_bookings', path: '/bookings/mine?page=1&limit=20', token: playerToken },
  { name: 'vendor_bookings', path: '/bookings/vendor?page=1&limit=20', token: vendorToken },
  { name: 'notifications', path: '/notifications?page=1&limit=20', token: playerToken },
  { name: 'payment_status', path: `/payments/${payment.id}`, token: playerToken },
];
const server = externalTarget ? null : spawn(process.execPath, ['dist/server.js'], { cwd: new URL('..', import.meta.url), env: { ...process.env, DATABASE_URL: targetUrl.toString(), PORT: String(port), NODE_ENV: 'development', PAYMENT_PROVIDER: 'mock', MAX_ADVANCE_BOOKING_DAYS: '39', ALLOW_LOADTEST_RATE_LIMIT_BYPASS: 'true' }, stdio: 'ignore' });
const samples = new Map();
const failures = new Map();
const failureReasons = new Map();

function recordFailure(name, reason) {
  failures.set(name, (failures.get(name) || 0) + 1);
  const reasons = failureReasons.get(name) || new Map();
  reasons.set(reason, (reasons.get(reason) || 0) + 1);
  failureReasons.set(name, reasons);
}

function percentile(values, pct) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1)]);
}
async function ready() {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server && server.exitCode !== null) throw new Error('Benchmark API exited during startup');
    try { if ((await fetch(`${root}/health`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Benchmark API did not become ready');
}
async function warmup() {
  for (const route of routes) {
    const result = await fetch(root + route.path, { headers: route.token ? { Authorization: `Bearer ${route.token}` } : undefined, signal: AbortSignal.timeout(5000) });
    await result.arrayBuffer();
    if (!result.ok) throw new Error(`Warm-up failed for ${route.name}: HTTP ${result.status}`);
  }
}
async function load(deadline, initialIndex) {
  let index = initialIndex;
  while (Date.now() < deadline) {
    const route = routes[index++ % routes.length];
    const name = route.name;
    const started = performance.now();
    try {
      const result = await fetch(root + route.path, { headers: route.token ? { Authorization: `Bearer ${route.token}` } : undefined, signal: AbortSignal.timeout(5000) });
      await result.arrayBuffer();
      if (!result.ok) {
        recordFailure(name, `http_${result.status}`);
        continue;
      }
      const list = samples.get(name) || [];
      list.push(performance.now() - started);
      samples.set(name, list);
    } catch (error) {
      recordFailure(name, error?.name === 'TimeoutError' ? 'client_timeout' : 'network_error');
    }
  }
}

try {
  await ready();
  await warmup();
  const deadline = Date.now() + durationSeconds * 1000;
  await Promise.all(Array.from({ length: concurrency }, (_, index) => load(deadline, index)));
  const report = Object.fromEntries(routes.map(({ name }) => {
    const values = samples.get(name) || [];
    const failed = failures.get(name) || 0;
    const attempted = values.length + failed;
    return [name, { requests: values.length, failures: failed, attempts: attempted, error_rate_pct: attempted ? Number((failed * 100 / attempted).toFixed(2)) : 0, failure_reasons: Object.fromEntries(failureReasons.get(name) || []), rps: Number((values.length / durationSeconds).toFixed(1)), p50_ms: percentile(values, 0.5), p95_ms: percentile(values, 0.95), p99_ms: percentile(values, 0.99) }];
  }));
  console.log(JSON.stringify({ database: targetName, concurrency, duration_seconds: durationSeconds, routes: report }, null, 2));
  if (Object.values(report).some((item) => item.failures)) process.exitCode = 1;
} catch (error) {
  console.error('Benchmark failed:', error.message);
  process.exitCode = 1;
} finally {
  server?.kill();
  if (settleSeconds) await new Promise((resolve) => setTimeout(resolve, settleSeconds * 1000));
  for (const id of benchmarkSessions) await database`delete from refresh_sessions where id = ${id}`;
  await database.end();
}
