// Verifies synthetic OTP challenges and session creation in the isolated VM DB.
import 'dotenv/config';
import { createHash, randomInt } from 'node:crypto';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL || '');
const name = decodeURIComponent(url.pathname.slice(1));
if (process.env.NODE_ENV === 'production' || !name.endsWith('_loadtest')) throw new Error('Requires an isolated _loadtest database');
const target = process.env.BENCHMARK_TARGET_URL?.replace(/\/$/, '');
if (!target || !['api-proxy', '127.0.0.1', 'localhost'].includes(new URL(target).hostname)) throw new Error('Requires the local rehearsal proxy');
const flag = (key, fallback) => Number(process.argv.find((arg) => arg.startsWith(`--${key}=`))?.split('=')[1] ?? fallback);
const requests = flag('requests', 100);
const concurrency = flag('vus', 20);
if (!Number.isInteger(requests) || requests < 1 || requests > 500 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) throw new Error('Use 1-500 requests and 1-100 clients');
const db = postgres(url.toString(), { max: 2, prepare: false });
const prefix = randomInt(100000, 999999);
const phones = Array.from({ length: requests }, (_, index) => `923${prefix}${String(index).padStart(3, '0')}`);
const code = '654321'; // Exists only in synthetic challenges; never sent or stored as plaintext.
const hash = createHash('sha256').update(code).digest('hex');
const samples = [];
let cursor = 0;
let ownsPhones = false;
let drained = false;

async function worker() {
  while (cursor < requests) {
    const index = cursor++;
    const started = performance.now();
    try {
      const response = await fetch(`${target}/auth/otp/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phones[index], code }), signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json().catch(() => null);
      samples.push({ status: response.status, session: Boolean(body?.session?.accessToken && body?.session?.refreshToken), ms: performance.now() - started });
    } catch {
      samples.push({ status: 0, session: false, ms: performance.now() - started });
    }
  }
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]) : null;
}

try {
  const [existing] = await db`select
    (select count(*)::int from otp_challenges where phone in ${db(phones)}) as challenges,
    (select count(*)::int from users where phone in ${db(phones)}) as users`;
  if (existing.challenges || existing.users) throw new Error('Synthetic prefix collided with existing data; rerun for another prefix');
  await db.begin(async (tx) => {
    for (const phone of phones) await tx`insert into otp_challenges (phone, code_hash, expires_at)
      values (${phone}, ${hash}, now() + interval '10 minutes')`;
  });
  ownsPhones = true;
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsed = (performance.now() - started) / 1000;
  await new Promise((resolve) => setTimeout(resolve, 45_000));
  drained = true;
  const [persisted] = await db`select
    (select count(*)::int from users where phone in ${db(phones)}) as users,
    (select count(*)::int from refresh_sessions where user_id in (select id from users where phone in ${db(phones)})) as sessions,
    (select count(*)::int from otp_challenges where phone in ${db(phones)}) as remaining_challenges`;
  const statuses = samples.reduce((acc, sample) => ({ ...acc, [sample.status || 'network_error']: (acc[sample.status || 'network_error'] || 0) + 1 }), {});
  const successes = samples.filter((sample) => sample.status === 200 && sample.session).length;
  const valid = successes === requests && persisted.users === requests && persisted.sessions === requests && persisted.remaining_challenges === 0;
  console.log(JSON.stringify({ target: name, requests, concurrency, successes, failures: requests - successes,
    status_counts: statuses, created_users: persisted.users, created_sessions: persisted.sessions,
    remaining_challenges: persisted.remaining_challenges, valid,
    rps: Number((successes / elapsed).toFixed(1)), p50_ms: percentile(samples.map((sample) => sample.ms), 0.5),
    p95_ms: percentile(samples.map((sample) => sample.ms), 0.95), p99_ms: percentile(samples.map((sample) => sample.ms), 0.99) }, null, 2));
  if (!valid) process.exitCode = 1;
} catch (error) {
  console.error('OTP verification benchmark failed:', error.message);
  process.exitCode = 1;
} finally {
  if (!drained && ownsPhones) await new Promise((resolve) => setTimeout(resolve, 45_000));
  if (ownsPhones) {
    await db`delete from otp_challenges where phone in ${db(phones)}`;
    await db`delete from users where phone in ${db(phones)}`;
  }
  await db.end();
}
