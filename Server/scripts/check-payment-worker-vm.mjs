// Isolated VM drill for notification outbox recovery after worker interruption.
import 'dotenv/config';
import assert from 'node:assert/strict';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL || '');
if (process.env.NODE_ENV === 'production' || url.pathname !== '/turfbookpk_payment_loadtest') throw new Error('Requires isolated payment test database');
const db = postgres(url.toString(), { max: 2, prepare: false });
const phone = '+923799999998';
const mode = process.argv[2];

try {
  if (mode === 'seed') {
    const existing = await db`SELECT id FROM users WHERE phone = ${phone}`;
    assert.equal(existing.length, 0, 'Previous drill fixture must be cleaned first');
    const [user] = await db`INSERT INTO users (phone, full_name) VALUES (${phone}, 'VM Worker Recovery Fixture') RETURNING id`;
    const [pending] = await db`INSERT INTO notifications (user_id, type, title, message) VALUES (${user.id}, 'payment', 'Pending payment update', 'VM worker recovery drill') RETURNING id`;
    const [leased] = await db`INSERT INTO notifications (user_id, type, title, message) VALUES (${user.id}, 'payment', 'Interrupted payment update', 'VM worker recovery drill') RETURNING id`;
    await db`UPDATE notification_outbox SET status = 'processing', attempts = 1, locked_until = now() - interval '1 second' WHERE notification_id = ${leased.id}`;
    const rows = await db`SELECT status, attempts FROM notification_outbox WHERE notification_id IN (${pending.id}, ${leased.id}) ORDER BY attempts`;
    assert.deepEqual(rows.map((row) => row.status), ['pending', 'processing']);
    console.log(JSON.stringify({ phase: 'seed', pending: 1, crashed_lease: 1, valid: true }));
  } else if (mode === 'verify') {
    const [user] = await db`SELECT id FROM users WHERE phone = ${phone}`;
    assert.ok(user, 'Fixture missing');
    const rows = await db`SELECT o.status, o.attempts, o.sent_at FROM notification_outbox o JOIN notifications n ON n.id = o.notification_id WHERE n.user_id = ${user.id} ORDER BY o.attempts`;
    const valid = rows.length === 2 && rows.every((row) => row.status === 'sent' && row.sent_at) && rows[0].attempts === 1 && rows[1].attempts === 2;
    console.log(JSON.stringify({ phase: 'verify', rows: rows.map((row) => ({ status: row.status, attempts: row.attempts })), valid }));
    if (!valid) process.exitCode = 1;
  } else if (mode === 'cleanup') {
    await db`DELETE FROM users WHERE phone = ${phone}`;
    console.log(JSON.stringify({ phase: 'cleanup', valid: true }));
  } else throw new Error('Expected seed, verify, or cleanup');
} finally {
  await db.end();
}
