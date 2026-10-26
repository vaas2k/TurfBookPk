import { sql } from '../database/client.js';
import type postgres from 'postgres';

// Bounded, idempotent cleanup. Payment events, bookings, ledger, audit logs,
// customer notifications, and unresolved outbox jobs are intentionally retained.
export async function cleanupOperationalRecords(query: postgres.ISql = sql): Promise<{ otp: number; sessions: number; receipts: number; sent_outbox: number }> {
  const otp = await query`
    DELETE FROM otp_challenges WHERE phone IN (
      SELECT phone FROM otp_challenges
      WHERE expires_at < now() - interval '1 day'
      ORDER BY expires_at LIMIT 500
    ) RETURNING phone`;
  const sessions = await query`
    DELETE FROM refresh_sessions WHERE id IN (
      SELECT id FROM refresh_sessions
      WHERE expires_at < now() - interval '30 days'
         OR revoked_at < now() - interval '30 days'
      ORDER BY expires_at LIMIT 500
    ) RETURNING id`;
  const receipts = await query`
    DELETE FROM push_receipts WHERE id IN (
      SELECT id FROM push_receipts
      WHERE checked_at < now() - interval '7 days'
      ORDER BY checked_at LIMIT 500
    ) RETURNING id`;
  const sentOutbox = await query`
    DELETE FROM notification_outbox WHERE id IN (
      SELECT id FROM notification_outbox
      WHERE status = 'sent' AND sent_at < now() - interval '30 days'
      ORDER BY sent_at LIMIT 500
    ) RETURNING id`;
  return { otp: otp.length, sessions: sessions.length, receipts: receipts.length, sent_outbox: sentOutbox.length };
}
