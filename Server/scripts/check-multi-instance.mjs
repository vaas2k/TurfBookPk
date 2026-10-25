// Isolated two-API/two-worker smoke test. Never targets the ordinary database.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import postgres from 'postgres';

const source = new URL(process.env.DATABASE_URL || '');
const name = decodeURIComponent(source.pathname.slice(1));
source.pathname = `/${name.endsWith('_loadtest') ? name : `${name}_loadtest`}`;
if (process.env.NODE_ENV === 'production' || !source.pathname.endsWith('_loadtest') || !process.env.REDIS_URL) throw new Error('This drill requires a non-production _loadtest database and Redis');
const db = postgres(source.toString(), { max: 3, prepare: false });
const children = [];
const locks = [2026102401, 2026102402, 2026102403, 2026102405, 2026102406, 2026102407];
let lockConnection;
let fixtureUserId;

async function availablePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function launch(entry, extraEnv = {}) {
  const child = spawn(process.execPath, [`dist/${entry}.js`], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DATABASE_URL: source.toString(), NODE_ENV: 'development', PAYMENT_PROVIDER: 'mock', ALLOW_LOADTEST_RATE_LIMIT_BYPASS: 'false', MAX_ADVANCE_BOOKING_DAYS: '39', ...extraEnv },
    stdio: 'ignore',
  });
  children.push(child);
  return child;
}

async function until(check, childrenToWatch, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childrenToWatch.some((child) => child.exitCode !== null)) throw new Error('A test process exited unexpectedly');
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the test processes');
}

try {
  const [leftPort, rightPort] = await Promise.all([availablePort(), availablePort()]);
  assert.notEqual(leftPort, rightPort);
  const apis = [launch('server', { PORT: String(leftPort), TRUST_PROXY_HOPS: '1' }), launch('server', { PORT: String(rightPort), TRUST_PROXY_HOPS: '1' })];
  await until(async () => {
    const statuses = await Promise.all([leftPort, rightPort].map(async (port) => {
      try { return (await fetch(`http://127.0.0.1:${port}/api/ready`, { signal: AbortSignal.timeout(1000) })).status; }
      catch { return 0; }
    }));
    return statuses.every((status) => status === 200);
  }, apis);
  const sharedIp = `198.18.${randomInt(1, 255)}.${randomInt(1, 255)}`;
  const responses = [];
  for (let offset = 0; offset < 301; offset += 25) {
    const batch = await Promise.all(Array.from({ length: Math.min(25, 301 - offset) }, (_, index) => {
      const port = (offset + index) % 2 ? leftPort : rightPort;
      return fetch(`http://127.0.0.1:${port}/api/test`, { headers: { 'X-Forwarded-For': sharedIp }, signal: AbortSignal.timeout(3000) }).then((response) => response.status);
    }));
    responses.push(...batch);
  }
  assert.equal(responses.filter((status) => status === 200).length, 300);
  assert.equal(responses.filter((status) => status === 429).length, 1);

  // Hold unrelated maintenance locks so this smoke test cannot alter seeded slots.
  lockConnection = await db.reserve();
  for (const id of locks) {
    const [result] = await lockConnection`SELECT pg_try_advisory_lock(${id}) AS acquired`;
    assert.equal(result.acquired, true);
  }
  const [user] = await db`INSERT INTO users (phone, full_name) VALUES (${`+92312${randomUUID().replaceAll('-', '').slice(0, 10)}`}, 'Multi-worker Test') RETURNING id`;
  fixtureUserId = user.id;
  const [notification] = await db`INSERT INTO notifications (user_id, type, title, message) VALUES (${fixtureUserId}, 'booking', 'Multi-worker test', 'Test message') RETURNING id`;
  const workers = [launch('worker'), launch('worker')];
  const outcome = await until(async () => {
    const [row] = await db`SELECT status, attempts FROM notification_outbox WHERE notification_id = ${notification.id}`;
    return row?.status === 'sent' ? row : null;
  }, workers);
  assert.equal(outcome.attempts, 1);
  console.log(JSON.stringify({ database: source.pathname.slice(1), api_processes: 2, shared_limit: { accepted: 300, rejected: 1 }, worker_processes: 2, notification_outbox: outcome }));
} finally {
  for (const child of children) if (child.exitCode === null) child.kill();
  if (fixtureUserId) await db`DELETE FROM users WHERE id = ${fixtureUserId}`;
  if (lockConnection) { await lockConnection`SELECT pg_advisory_unlock_all()`; lockConnection.release(); }
  await db.end();
}
