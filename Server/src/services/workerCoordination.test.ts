import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { sql } from '../database/client.js';

after(async () => { await sql.end(); });

test('PostgreSQL advisory ownership allows only one worker at a time', async () => {
  const first = await sql.reserve();
  const second = await sql.reserve();
  const lockId = 2026102499;
  try {
    const [winner] = await first`SELECT pg_try_advisory_lock(${lockId}) AS acquired`;
    const [loser] = await second`SELECT pg_try_advisory_lock(${lockId}) AS acquired`;
    assert.equal(winner?.acquired, true);
    assert.equal(loser?.acquired, false);
    const [released] = await first`SELECT pg_advisory_unlock(${lockId}) AS released`;
    assert.equal(released?.released, true);
    const [nextWinner] = await second`SELECT pg_try_advisory_lock(${lockId}) AS acquired`;
    assert.equal(nextWinner?.acquired, true);
    await second`SELECT pg_advisory_unlock(${lockId})`;
  } finally {
    await first`SELECT pg_advisory_unlock_all()`;
    await second`SELECT pg_advisory_unlock_all()`;
    first.release();
    second.release();
  }
});
