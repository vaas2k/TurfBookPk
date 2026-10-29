// Exercises mock confirmation through the isolated VM proxy; never uses real payments.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL || '');
const name = decodeURIComponent(url.pathname.slice(1));
if (process.env.NODE_ENV === 'production' || !name.endsWith('_loadtest')) throw new Error('Requires an isolated _loadtest database');
const target = process.env.BENCHMARK_TARGET_URL?.replace(/\/$/, '');
if (!target || !['api-proxy', '127.0.0.1', 'localhost'].includes(new URL(target).hostname)) throw new Error('Requires the local rehearsal proxy');
const db = postgres(url.toString(), { max: 2, prepare: false });
const runId = randomUUID();
const key = `confirm-race:${runId}`;
const sessionId = randomUUID();
let bookingId;
let drained = false;

async function post(path, token, body) {
  try {
    const response = await fetch(`${target}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json().catch(() => null);
    return { status: response.status, idempotent: data?.idempotent ?? null };
  } catch {
    return { status: 0, idempotent: null };
  }
}

try {
  const [player] = await db`select md5('loadtest-user-101')::uuid as id`;
  const [selected] = await db`
    select s.id, s.ground_id, g.vendor_id, v.pending_earnings
    from slots s join grounds g on g.id = s.ground_id join vendors v on v.id = g.vendor_id
    where s.date >= ((now() at time zone 'Asia/Karachi')::date + 2)
      and not s.is_booked and not s.is_blocked and s.hold_booking_id is null
      and g.is_active and g.is_verified and g.verification_status = 'approved'
      and v.is_active and v.verification_status = 'approved' and v.user_id <> ${player.id}
    order by s.date, s.ground_id, s.start_time limit 1`;
  if (!selected) throw new Error('No eligible test slot found');
  await db`insert into refresh_sessions (id, user_id, token_hash, expires_at) values (${sessionId}, ${player.id}, ${randomUUID()}, now() + interval '1 hour')`;
  const token = jwt.sign({ sub: player.id, sid: sessionId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
  const hold = await post('/bookings', token, { slot_id: selected.id });
  if (hold.status !== 201) throw new Error(`Test hold returned HTTP ${hold.status}`);
  const [created] = await db`select id, vendor_amount from bookings where idempotency_key = ${key}`;
  if (!created) throw new Error('Test booking was not persisted');
  bookingId = created.id;

  const confirmations = await Promise.all(Array.from({ length: 10 }, () =>
    post(`/bookings/${bookingId}/mock-confirm`, token, { payment_reference: `confirm-race-${runId}` })));
  await new Promise((resolve) => setTimeout(resolve, 45_000));
  drained = true;
  const [booking] = await db`select status, payment_status from bookings where id = ${bookingId}`;
  const [slot] = await db`select is_booked, booking_id from slots where id = ${selected.id}`;
  const [ledger] = await db`select count(*)::int as count from ledger_entries where booking_id = ${bookingId} and type = 'booking_earning'`;
  const [notifications] = await db`select count(*)::int as count from notifications where data->>'bookingId' = ${bookingId}`;
  const [vendor] = await db`select pending_earnings from vendors where id = ${selected.vendor_id}`;
  const statuses = confirmations.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {});
  const first = confirmations.filter((item) => item.status === 200 && item.idempotent === false).length;
  const duplicates = confirmations.filter((item) => item.status === 200 && item.idempotent === true).length;
  const valid = first === 1 && duplicates === 9 && booking.status === 'confirmed' && booking.payment_status === 'paid'
    && slot.is_booked && slot.booking_id === bookingId && ledger.count === 1 && notifications.count === 2
    && Number(vendor.pending_earnings) === Number(selected.pending_earnings) + Number(created.vendor_amount);
  console.log(JSON.stringify({ target: name, confirmations: 10, status_counts: statuses, first, duplicates,
    booking_status: booking.status, payment_status: booking.payment_status, booked_slot: slot.is_booked,
    ledger_entries: ledger.count, notifications: notifications.count, vendor_earnings_incremented_once: Number(vendor.pending_earnings) === Number(selected.pending_earnings) + Number(created.vendor_amount), valid }, null, 2));
  if (!valid) process.exitCode = 1;
} catch (error) {
  console.error('Confirmation race failed:', error.message);
  process.exitCode = 1;
} finally {
  if (!drained && bookingId) await new Promise((resolve) => setTimeout(resolve, 45_000));
  const [created] = await db`select id, vendor_id, vendor_amount, status, slot_id from bookings where idempotency_key = ${key}`;
  if (created) {
    await db.begin(async (tx) => {
      await tx`delete from notifications where data->>'bookingId' = ${created.id}`;
      await tx`delete from ledger_entries where booking_id = ${created.id}`;
      await tx`delete from payment_attempts where booking_id = ${created.id}`;
      await tx`update slots set is_booked = false, booked_by = null, booking_id = null, held_by = null, hold_booking_id = null, hold_expires_at = null where id = ${created.slot_id} and (booking_id = ${created.id} or hold_booking_id = ${created.id})`;
      if (created.status === 'confirmed') await tx`update vendors set pending_earnings = pending_earnings - ${created.vendor_amount} where id = ${created.vendor_id}`;
      await tx`delete from bookings where id = ${created.id}`;
    });
  }
  await db`delete from refresh_sessions where id = ${sessionId}`;
  await db.end();
}
