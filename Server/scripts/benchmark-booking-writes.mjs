// Uses isolated synthetic users/slots and deletes only bookings made by this run.
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import postgres from 'postgres';

const source = new URL(process.env.DATABASE_URL || '');
const name = decodeURIComponent(source.pathname.slice(1));
const targetName = name.endsWith('_loadtest') ? name : `${name}_loadtest`;
if (process.env.NODE_ENV === 'production' || !targetName.endsWith('_loadtest')) throw new Error('Requires isolated load-test database');
source.pathname = `/${targetName}`;
const database = postgres(source.toString(), { max: 2, prepare: false });
const runId = randomUUID();
const flag = (name, fallback) => Number(process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const requests = flag('requests', 50);
const concurrency = flag('vus', 10);
if (!Number.isInteger(requests) || requests < 1 || requests > 50 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) throw new Error('Use 1-50 requests and 1-50 clients');
const port = 5102;
const externalTarget = process.env.BENCHMARK_TARGET_URL?.replace(/\/$/, '');
if (externalTarget && !/^https?:\/\//.test(externalTarget)) throw new Error('BENCHMARK_TARGET_URL must be an http(s) URL');
if (externalTarget && !['api-proxy', '127.0.0.1', 'localhost'].includes(new URL(externalTarget).hostname)) throw new Error('Write benchmark accepts only the local rehearsal proxy');
const base = externalTarget || `http://127.0.0.1:${port}/api`;
const selected = await database`
  select id from slots where date >= ((now() at time zone 'Asia/Karachi')::date + 2)
    and not is_booked and not is_blocked and hold_booking_id is null
  order by date, ground_id, start_time limit ${requests}`;
if (selected.length < requests) throw new Error(`Seed ${requests} available future slots before running write benchmark`);
const sessions = [];
const tokens = [];
for (let index = 0; index < requests; index++) {
  const [player] = await database`select md5(${'loadtest-user-' + (101 + index)})::uuid as id`;
  const sessionId = randomUUID();
  sessions.push(sessionId);
  await database`insert into refresh_sessions (id, user_id, token_hash, expires_at) values (${sessionId}, ${player.id}, ${randomUUID()}, now() + interval '1 hour')`;
  tokens.push(jwt.sign({ sub: player.id, sid: sessionId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' }));
}
const server = externalTarget ? null : spawn(process.execPath, ['dist/server.js'], { cwd: new URL('..', import.meta.url), env: { ...process.env, DATABASE_URL: source.toString(), PORT: String(port), NODE_ENV: 'development', PAYMENT_PROVIDER: 'mock', MAX_ADVANCE_BOOKING_DAYS: '39' }, stdio: 'ignore' });
const results = [];
let cursor = 0;
async function ready() {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server && server.exitCode !== null) throw new Error('Write benchmark API exited during startup');
    try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Write benchmark API did not become ready');
}
async function worker() {
  while (cursor < selected.length) {
    const index = cursor++;
    const started = performance.now();
    try {
      const response = await fetch(`${base}/bookings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens[index]}`, 'Content-Type': 'application/json', 'Idempotency-Key': `loadbench:${runId}:${index}` },
        body: JSON.stringify({ slot_id: selected[index].id }),
        signal: AbortSignal.timeout(10_000),
      });
      await response.arrayBuffer();
      results.push({ status: response.status, ms: performance.now() - started });
    } catch {
      results.push({ status: 0, ms: performance.now() - started });
    }
  }
}
try {
  await ready();
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsed = (performance.now() - started) / 1000;
  const times = results.map((row) => row.ms).sort((a, b) => a - b);
  const percentile = (fraction) => Math.round(times[Math.ceil(times.length * fraction) - 1]);
  const successes = results.filter((row) => row.status === 201).length;
  console.log(JSON.stringify({ target: targetName, concurrency, requests: results.length, successes, failures: results.length - successes, failure_statuses: results.filter((row) => row.status !== 201).reduce((acc, row) => ({ ...acc, [row.status || 'network_error']: (acc[row.status || 'network_error'] || 0) + 1 }), {}), rps: Number((successes / elapsed).toFixed(1)), p50_ms: percentile(0.5), p95_ms: percentile(0.95), p99_ms: percentile(0.99) }, null, 2));
  if (successes !== requests) process.exitCode = 1;
} catch (error) {
  console.error('Write benchmark failed:', error.message);
  process.exitCode = 1;
} finally {
  server?.kill();
  // A timed-out client request can still finish upstream. Wait past the proxy
  // timeout before removing its booking so it cannot recreate a hold afterward.
  if (externalTarget) await new Promise((resolve) => setTimeout(resolve, 45_000));
  const keys = Array.from({ length: requests }, (_, index) => `loadbench:${runId}:${index}`);
  await database.begin(async (tx) => {
    const rows = await tx`select id from bookings where idempotency_key in ${tx(keys)}`;
    if (rows.length) {
      const ids = rows.map((row) => row.id);
      await tx`update slots set held_by = null, hold_booking_id = null, hold_expires_at = null where hold_booking_id in ${tx(ids)}`;
      await tx`delete from payment_attempts where booking_id in ${tx(ids)}`;
      await tx`delete from bookings where id in ${tx(ids)}`;
    }
  });
  for (const id of sessions) await database`delete from refresh_sessions where id = ${id}`;
  const [leftovers] = await database`select count(*)::int as count from bookings where idempotency_key in ${database(keys)}`;
  if (leftovers.count !== 0) throw new Error(`Write benchmark cleanup left ${leftovers.count} bookings`);
  const [heldSlots] = await database`select count(*)::int as count from slots where id in ${database(selected.map((row) => row.id))} and hold_booking_id is not null`;
  if (heldSlots.count !== 0) throw new Error(`Write benchmark cleanup left ${heldSlots.count} slot holds`);
  await database.end();
}
