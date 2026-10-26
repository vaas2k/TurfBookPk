import 'dotenv/config';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });
try {
  const [counts] = await sql`
    SELECT
      (SELECT count(*)::int FROM otp_challenges WHERE expires_at < now() - interval '1 day') AS otp,
      (SELECT count(*)::int FROM refresh_sessions WHERE expires_at < now() - interval '30 days' OR revoked_at < now() - interval '30 days') AS sessions,
      (SELECT count(*)::int FROM push_receipts WHERE checked_at < now() - interval '7 days') AS receipts,
      (SELECT count(*)::int FROM notification_outbox WHERE status = 'sent' AND sent_at < now() - interval '30 days') AS sent_outbox`;
  console.log(JSON.stringify({ database: 'configured_database', eligible_rows: counts }, null, 2));
} finally {
  await sql.end();
}
