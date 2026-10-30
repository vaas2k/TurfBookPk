// Read and booking-hold mix through the isolated VM proxy. Cleans up its own holds.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL || '');
const name = decodeURIComponent(url.pathname.slice(1));
if (process.env.NODE_ENV === 'production' || !name.endsWith('_loadtest')) throw new Error('Requires an isolated _loadtest database');
const target = process.env.BENCHMARK_TARGET_URL?.replace(/\/$/, '');
if (!target || !['api-proxy', '127.0.0.1', 'localhost'].includes(new URL(target).hostname)) throw new Error('Requires the local rehearsal proxy');
const flag = (key, fallback) => Number(process.argv.find((arg) => arg.startsWith(`--${key}=`))?.split('=')[1] ?? fallback);
const readers = flag('readers', 20);
const writes = flag('writes', 50);
const seconds = flag('seconds', 30);
if (!Number.isInteger(readers) || readers < 1 || readers > 60 || !Number.isInteger(writes) || writes < 1 || writes > 50 || !Number.isInteger(seconds) || seconds < 10 || seconds > 120) throw new Error('Use 1-60 readers, 1-50 writes, and 10-120 seconds');
const db = postgres(url.toString(), { max: 2, prepare: false });
const runId = randomUUID();
const sessions = [];
const writeSamples = [];
const readSamples = new Map();
let drained = false;

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]) : null;
}
async function tokenFor(userId) {
  const id = randomUUID();
  await db`insert into refresh_sessions (id, user_id, token_hash, expires_at) values (${id}, ${userId}, ${randomUUID()}, now() + interval '1 hour')`;
  sessions.push(id);
  return jwt.sign({ sub: userId, sid: id }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
}
async function request(path, token, method = 'GET', body, key) {
  const started = performance.now();
  try {
    const response = await fetch(`${target}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(method === 'POST' ? 10_000 : 5_000),
    });
    await response.arrayBuffer();
    return { status: response.status, ms: performance.now() - started };
  } catch {
    return { status: 0, ms: performance.now() - started };
  }
}
async function readerLoop(routes, deadline, offset) {
  let index = offset;
  while (Date.now() < deadline) {
    const route = routes[index++ % routes.length];
    const result = await request(route.path, route.token);
    const samples = readSamples.get(route.name) || [];
    samples.push(result);
    readSamples.set(route.name, samples);
  }
}
async function writeLoop(slotIds, tokens, started) {
  for (let index = 0; index < slotIds.length; index++) {
    const due = started + Math.floor(index * seconds * 1000 / slotIds.length);
    if (Date.now() < due) await new Promise((resolve) => setTimeout(resolve, due - Date.now()));
    writeSamples.push(await request('/bookings', tokens[index], 'POST', { slot_id: slotIds[index] }, `mixed:${runId}:${index}`));
  }
}

try {
  const [ground] = await db`select id from grounds where is_active and is_verified order by rating desc limit 1`;
  const [payment] = await db`select id from payment_attempts where player_id = md5('loadtest-user-101')::uuid order by created_at desc limit 1`;
  const slots = await db`select s.id from slots s join grounds g on g.id = s.ground_id join vendors v on v.id = g.vendor_id
    where s.date >= ((now() at time zone 'Asia/Karachi')::date + 2) and not s.is_booked and not s.is_blocked and s.hold_booking_id is null
      and g.is_active and g.is_verified and g.verification_status = 'approved' and v.is_active and v.verification_status = 'approved'
    order by s.date, s.ground_id, s.start_time limit ${writes}`;
  if (!ground || !payment || slots.length !== writes) throw new Error('Full seed or available slots are missing');
  const [player] = await db`select md5('loadtest-user-101')::uuid as id`;
  const [vendor] = await db`select md5('loadtest-user-1')::uuid as id`;
  const playerToken = await tokenFor(player.id);
  const vendorToken = await tokenFor(vendor.id);
  const writeTokens = [];
  for (let index = 0; index < writes; index++) {
    const [account] = await db`select md5(${'loadtest-user-' + (102 + index)})::uuid as id`;
    writeTokens.push(await tokenFor(account.id));
  }
  const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const routes = [
    { name: 'discovery', path: '/grounds?page=1&limit=24' },
    { name: 'date_discovery', path: `/grounds?availability_date=${date}&page=1&limit=24` },
    { name: 'ground_detail', path: `/grounds/${ground.id}` },
    { name: 'player_bookings', path: '/bookings/mine?page=1&limit=20', token: playerToken },
    { name: 'vendor_bookings', path: '/bookings/vendor?page=1&limit=20', token: vendorToken },
    { name: 'notifications', path: '/notifications?page=1&limit=20', token: playerToken },
    { name: 'payment_status', path: `/payments/${payment.id}`, token: playerToken },
  ];
  for (const route of routes) {
    const warm = await request(route.path, route.token);
    if (warm.status !== 200) throw new Error(`Warm-up ${route.name} returned HTTP ${warm.status}`);
  }
  const started = Date.now();
  await Promise.all([
    ...Array.from({ length: readers }, (_, index) => readerLoop(routes, started + seconds * 1000, index)),
    writeLoop(slots.map((slot) => slot.id), writeTokens, started),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 45_000));
  drained = true;
  const keys = Array.from({ length: writes }, (_, index) => `mixed:${runId}:${index}`);
  const [persisted] = await db`select count(*)::int as count from bookings where idempotency_key in ${db(keys)}`;
  const readReport = Object.fromEntries(routes.map((route) => {
    const samples = readSamples.get(route.name) || [];
    const good = samples.filter((sample) => sample.status === 200);
    return [route.name, { requests: samples.length, failures: samples.length - good.length, rps: Number((good.length / seconds).toFixed(1)), p95_ms: percentile(good.map((sample) => sample.ms), 0.95) }];
  }));
  const goodWrites = writeSamples.filter((sample) => sample.status === 201);
  const valid = goodWrites.length === writes && persisted.count === writes && Object.values(readReport).every((route) => route.failures === 0);
  console.log(JSON.stringify({ target: name, readers, duration_seconds: seconds, writes, read_routes: readReport,
    booking_writes: { successes: goodWrites.length, failures: writes - goodWrites.length, persisted: persisted.count,
      status_counts: writeSamples.reduce((acc, sample) => ({ ...acc, [sample.status || 'network_error']: (acc[sample.status || 'network_error'] || 0) + 1 }), {}),
      p50_ms: percentile(goodWrites.map((sample) => sample.ms), 0.5), p95_ms: percentile(goodWrites.map((sample) => sample.ms), 0.95), p99_ms: percentile(goodWrites.map((sample) => sample.ms), 0.99) }, valid }, null, 2));
  if (!valid) process.exitCode = 1;
} catch (error) {
  console.error('Mixed benchmark failed:', error.message);
  process.exitCode = 1;
} finally {
  if (!drained && writeSamples.length) await new Promise((resolve) => setTimeout(resolve, 45_000));
  const keys = Array.from({ length: writes }, (_, index) => `mixed:${runId}:${index}`);
  await db.begin(async (tx) => {
    const rows = await tx`select id from bookings where idempotency_key in ${tx(keys)}`;
    if (rows.length) {
      const ids = rows.map((row) => row.id);
      await tx`update slots set held_by = null, hold_booking_id = null, hold_expires_at = null where hold_booking_id in ${tx(ids)}`;
      await tx`delete from payment_attempts where booking_id in ${tx(ids)}`;
      await tx`delete from bookings where id in ${tx(ids)}`;
    }
  });
  for (const id of sessions) await db`delete from refresh_sessions where id = ${id}`;
  const [leftovers] = await db`select count(*)::int as count from bookings where idempotency_key in ${db(keys)}`;
  if (leftovers.count) throw new Error(`Mixed benchmark cleanup left ${leftovers.count} bookings`);
  await db.end();
}
