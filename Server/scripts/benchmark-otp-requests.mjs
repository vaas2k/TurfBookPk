// Request-only OTP load against isolated synthetic numbers; does not send SMS.
import 'dotenv/config';
import { randomInt } from 'node:crypto';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL || '');
const databaseName = decodeURIComponent(url.pathname.slice(1));
if (process.env.NODE_ENV === 'production' || !databaseName.endsWith('_loadtest')) throw new Error('Requires an isolated _loadtest database');
const target = process.env.BENCHMARK_TARGET_URL?.replace(/\/$/, '');
if (!target || !['api-proxy', '127.0.0.1', 'localhost'].includes(new URL(target).hostname)) throw new Error('Requires the local rehearsal proxy');
const flag = (name, fallback) => Number(process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const requests = flag('requests', 100);
const concurrency = flag('vus', 20);
if (!Number.isInteger(requests) || requests < 1 || requests > 500 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) throw new Error('Use 1-500 requests and 1-100 clients');
const db = postgres(url.toString(), { max: 2, prepare: false });
const runPrefix = randomInt(100000, 999999);
const phones = Array.from({ length: requests }, (_, index) => `923${runPrefix}${String(index).padStart(3, '0')}`);
const samples = [];
let cursor = 0;
let drained = false;
let ownsPhones = false;

async function worker() {
  while (cursor < requests) {
    const index = cursor++;
    const started = performance.now();
    try {
      const response = await fetch(`${target}/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phones[index] }),
        signal: AbortSignal.timeout(10_000),
      });
      await response.arrayBuffer();
      samples.push({ status: response.status, ms: performance.now() - started });
    } catch {
      samples.push({ status: 0, ms: performance.now() - started });
    }
  }
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]) : null;
}

try {
  const [existing] = await db`select count(*)::int as count from otp_challenges where phone in ${db(phones)}`;
  if (existing.count) throw new Error('Synthetic phone prefix collided with existing challenges; rerun to choose another prefix');
  ownsPhones = true;
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsed = (performance.now() - started) / 1000;
  await new Promise((resolve) => setTimeout(resolve, 45_000));
  drained = true;
  const [persisted] = await db`select count(*)::int as count from otp_challenges where phone in ${db(phones)}`;
  const statuses = samples.reduce((acc, sample) => ({ ...acc, [sample.status || 'network_error']: (acc[sample.status || 'network_error'] || 0) + 1 }), {});
  const successes = statuses[202] || 0;
  const valid = successes === requests && persisted.count === requests;
  console.log(JSON.stringify({ target: databaseName, requests, concurrency, successes, failures: requests - successes,
    status_counts: statuses, persisted_challenges: persisted.count, valid,
    rps: Number((successes / elapsed).toFixed(1)), p50_ms: percentile(samples.map((sample) => sample.ms), 0.5),
    p95_ms: percentile(samples.map((sample) => sample.ms), 0.95), p99_ms: percentile(samples.map((sample) => sample.ms), 0.99) }, null, 2));
  if (!valid) process.exitCode = 1;
} catch (error) {
  console.error('OTP benchmark failed:', error.message);
  process.exitCode = 1;
} finally {
  if (!drained) await new Promise((resolve) => setTimeout(resolve, 45_000));
  if (ownsPhones) await db`delete from otp_challenges where phone in ${db(phones)}`;
  await db.end();
}
