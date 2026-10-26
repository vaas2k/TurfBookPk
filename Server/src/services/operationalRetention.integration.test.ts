import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { sql } from '../database/client.js';
import { cleanupOperationalRecords } from './operationalRetention.js';

after(async () => { await sql.end(); });

test('retention removes only aged terminal operational rows and rolls back fixtures', async () => {
  const rollback = new Error('rollback retention fixtures');
  await assert.rejects(sql.begin(async (tx) => {
    const [user] = await tx<{ id: string }[]>`INSERT INTO users DEFAULT VALUES RETURNING id`;
    assert.ok(user);
    const oldPhone = `retention-${randomUUID()}`;
    const freshPhone = `retention-${randomUUID()}`;
    await tx`INSERT INTO otp_challenges (phone, code_hash, expires_at) VALUES (${oldPhone}, 'test', now() - interval '2 days'), (${freshPhone}, 'test', now() + interval '10 minutes')`;
    const oldSession = randomUUID();
    const freshSession = randomUUID();
    await tx`INSERT INTO refresh_sessions (id, user_id, token_hash, expires_at)
      VALUES (${oldSession}, ${user.id}, ${randomUUID()}, now() - interval '31 days'),
             (${freshSession}, ${user.id}, ${randomUUID()}, now() + interval '1 day')`;
    const token = `ExpoPushToken[${randomUUID()}]`;
    await tx`INSERT INTO push_tokens (user_id, token, platform) VALUES (${user.id}, ${token}, 'android')`;
    const oldTicket = randomUUID();
    const freshTicket = randomUUID();
    await tx`INSERT INTO push_receipts (token, ticket_id, checked_at) VALUES
      (${token}, ${oldTicket}, now() - interval '8 days'), (${token}, ${freshTicket}, null)`;
    const [oldNotification] = await tx<{ id: string }[]>`INSERT INTO notifications (user_id, type, title, message) VALUES (${user.id}, 'test', 'test', 'test') RETURNING id`;
    const [freshNotification] = await tx<{ id: string }[]>`INSERT INTO notifications (user_id, type, title, message) VALUES (${user.id}, 'test', 'test', 'test') RETURNING id`;
    assert.ok(oldNotification && freshNotification);
    await tx`UPDATE notification_outbox SET status = 'sent', sent_at = now() - interval '31 days' WHERE notification_id = ${oldNotification.id}`;
    const result = await cleanupOperationalRecords(tx);
    assert.ok(result.otp >= 1 && result.sessions >= 1 && result.receipts >= 1 && result.sent_outbox >= 1);
    const [survivors] = await tx<{ old_otp: number; fresh_otp: number; old_session: number; fresh_session: number; old_receipt: number; fresh_receipt: number; old_outbox: number; fresh_outbox: number }[]>`
      SELECT
        (SELECT count(*)::int FROM otp_challenges WHERE phone = ${oldPhone}) AS old_otp,
        (SELECT count(*)::int FROM otp_challenges WHERE phone = ${freshPhone}) AS fresh_otp,
        (SELECT count(*)::int FROM refresh_sessions WHERE id = ${oldSession}) AS old_session,
        (SELECT count(*)::int FROM refresh_sessions WHERE id = ${freshSession}) AS fresh_session,
        (SELECT count(*)::int FROM push_receipts WHERE ticket_id = ${oldTicket}) AS old_receipt,
        (SELECT count(*)::int FROM push_receipts WHERE ticket_id = ${freshTicket}) AS fresh_receipt,
        (SELECT count(*)::int FROM notification_outbox WHERE notification_id = ${oldNotification.id}) AS old_outbox,
        (SELECT count(*)::int FROM notification_outbox WHERE notification_id = ${freshNotification.id}) AS fresh_outbox`;
    assert.deepEqual(survivors, { old_otp: 0, fresh_otp: 1, old_session: 0, fresh_session: 1, old_receipt: 0, fresh_receipt: 1, old_outbox: 0, fresh_outbox: 1 });
    throw rollback;
  }), (error) => error === rollback);
});
