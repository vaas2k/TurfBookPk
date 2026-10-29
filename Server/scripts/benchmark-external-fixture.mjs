// Prepare short-lived synthetic auth for a load generator outside the VM.
// Run inside an API container connected ONLY to the isolated *_loadtest DB.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL || '');
const databaseName = decodeURIComponent(url.pathname.slice(1));
if (process.env.NODE_ENV === 'production' || !databaseName.endsWith('_loadtest')) throw new Error('External benchmark fixture requires a non-production *_loadtest database');
const mode = process.argv[2];
if (!['prepare', 'cleanup'].includes(mode)) throw new Error('Use prepare or cleanup');
const database = postgres(url.toString(), { max: 1, prepare: false });
const sessionPrefix = 'loadtest-external:';

try {
  if (mode === 'cleanup') {
    const runId = process.argv[3];
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(runId || '')) throw new Error('A valid run ID is required');
    const deleted = await database`delete from refresh_sessions where token_hash like ${`${sessionPrefix}${runId}:%`} returning id`;
    console.log(`Removed ${deleted.length} temporary benchmark sessions.`);
  } else {
    const [ground] = await database`select id from grounds where is_active and is_verified order by rating desc limit 1`;
    const [player] = await database`select id from users where id = md5('loadtest-user-101')::uuid limit 1`;
    const [vendor] = await database`select id from users where id = md5('loadtest-user-1')::uuid limit 1`;
    const [payment] = player ? await database`select id from payment_attempts where player_id = ${player.id} order by created_at desc limit 1` : [];
    if (!ground || !player || !vendor || !payment || !process.env.JWT_ACCESS_SECRET) throw new Error('Seed the load-test DB and configure JWT_ACCESS_SECRET before preparing a fixture');
    const runId = randomUUID();
    const expiresAt = new Date(Date.now() + 45 * 60_000);
    const makeToken = async (user, label) => {
      const sessionId = randomUUID();
      await database`insert into refresh_sessions (id, user_id, token_hash, expires_at) values (${sessionId}, ${user.id}, ${`${sessionPrefix}${runId}:${label}`}, ${expiresAt})`;
      return jwt.sign({ sub: user.id, sid: sessionId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '45m' });
    };
    const playerToken = await makeToken(player, 'player');
    const vendorToken = await makeToken(vendor, 'vendor');
    const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    console.log(JSON.stringify({ database: databaseName, run_id: runId, expires_at: expiresAt.toISOString(), routes: [
      { name: 'discovery', path: '/grounds?page=1&limit=24' },
      { name: 'date_discovery', path: `/grounds?availability_date=${date}&page=1&limit=24` },
      { name: 'ground_detail', path: `/grounds/${ground.id}` },
      { name: 'player_bookings', path: '/bookings/mine?page=1&limit=20', token: playerToken },
      { name: 'vendor_bookings', path: '/bookings/vendor?page=1&limit=20', token: vendorToken },
      { name: 'notifications', path: '/notifications?page=1&limit=20', token: playerToken },
      { name: 'payment_status', path: `/payments/${payment.id}`, token: playerToken },
    ] }));
  }
} finally {
  await database.end();
}
