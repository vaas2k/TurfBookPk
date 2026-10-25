import assert from 'node:assert/strict';
import { createClient } from 'redis';

const first = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const second = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
try {
  await Promise.all([first.connect(), second.connect()]);
  const key = `turfbookpk:smoke:${Date.now()}`;
  const script = `local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return count`;
  const counts = await Promise.all([first.eval(script, { keys: [key], arguments: ['5000'] }), second.eval(script, { keys: [key], arguments: ['5000'] })]);
  assert.deepEqual(counts.sort(), [1, 2]);
  console.log(JSON.stringify({ shared_atomic_counter: 'passed', clients: 2 }));
} finally {
  await Promise.all([first.quit(), second.quit()]);
}
