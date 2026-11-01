// Concurrent sandbox acknowledgments through two isolated VM API replicas.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL || '');
if (process.env.NODE_ENV === 'production' || url.pathname !== '/turfbookpk_payment_loadtest') throw new Error('Requires isolated payment test database');
const target = process.env.PAYMENT_TEST_URL?.replace(/\/$/, '');
if (!target || !['payment-proxy', '127.0.0.1', 'localhost'].includes(new URL(target).hostname)) throw new Error('Requires isolated payment proxy');
const db = postgres(url.toString(), { max: 3, prepare: false });
const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
const clinkId = `${Date.now()}${randomInt(0, 100_000).toString().padStart(5, '0')}`;
const paymentTime = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
const latePayment = process.env.PAYMENT_TEST_MODE === 'late';
let player, owner, vendor, ground, slot, booking, attempt;

try {
  [player] = await db`INSERT INTO users (phone, full_name) VALUES (${`+92370${suffix}`}, 'VM Payment Player') RETURNING id`;
  [owner] = await db`INSERT INTO users (phone, full_name, role) VALUES (${`+92371${suffix}`}, 'VM Payment Vendor', 'vendor') RETURNING id`;
  [vendor] = await db`INSERT INTO vendors (user_id, business_name, business_phone, business_city) VALUES (${owner.id}, 'VM Payment Vendor', ${`+92372${suffix}`}, 'Karachi') RETURNING id, pending_earnings`;
  [ground] = await db`INSERT INTO grounds (vendor_id, title, location, city, address, price_per_hour) VALUES (${vendor.id}, 'VM Payment Ground', 'Karachi', 'Karachi', 'Test address', 1000) RETURNING id`;
  [slot] = await db`INSERT INTO slots (ground_id, date, start_time, end_time, price) VALUES (${ground.id}, '2030-01-05', '10:00', '11:00', 1000) RETURNING id`;
  const expiry = new Date(Date.now() + (latePayment ? -60_000 : 15 * 60_000));
  [booking] = await db`INSERT INTO bookings (booking_number, player_id, vendor_id, ground_id, slot_id, date, start_time, end_time, total_amount, vendor_amount, hold_expires_at) VALUES (${`vm-pay-${suffix}`}, ${player.id}, ${vendor.id}, ${ground.id}, ${slot.id}, '2030-01-05', '10:00', '11:00', 1000, 900, ${expiry}) RETURNING id`;
  await db`UPDATE slots SET held_by = ${player.id}, hold_booking_id = ${booking.id}, hold_expires_at = ${expiry} WHERE id = ${slot.id}`;
  [attempt] = await db`INSERT INTO payment_attempts (booking_id, player_id, vendor_id, provider, provider_status, provider_reference, amount, expires_at, idempotency_key) VALUES (${booking.id}, ${player.id}, ${vendor.id}, 'clink', 'pending', ${clinkId}, 1000, ${expiry}, ${`vm-pay-${suffix}`}) RETURNING id`;

  const responses = await Promise.all(Array.from({ length: 10 }, async () => {
    const response = await fetch(`${target}/payments/clink/acknowledgment`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ Clink_ID: clinkId, Payment_Status: 'PAID', Payment_DateTime: paymentTime }), signal: AbortSignal.timeout(10_000) });
    return { http: response.status, status: (await response.json())[0]?.Status_Code, upstream: response.headers.get('x-turfbook-rehearsal-upstream') };
  }));
  const first = responses.filter((row) => row.http === 200 && row.status === '1').length;
  const duplicates = responses.filter((row) => row.http === 200 && row.status === '2').length;
  const upstreams = [...new Set(responses.map((row) => row.upstream?.split(',').at(-1)?.trim()).filter(Boolean))];
  const [state] = await db`SELECT b.status AS booking_status, b.payment_status, s.is_booked, s.booking_id, p.status AS attempt_status, p.provider_status, p.review_status FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN payment_attempts p ON p.booking_id = b.id WHERE b.id = ${booking.id}`;
  const [effects] = await db`SELECT (SELECT count(*)::int FROM ledger_entries WHERE payment_attempt_id = ${attempt.id}) AS ledgers, (SELECT count(*)::int FROM payment_events WHERE payment_attempt_id = ${attempt.id}) AS events, (SELECT count(*)::int FROM notifications WHERE user_id IN (${player.id}, ${owner.id})) AS notifications`;
  const [balance] = await db`SELECT pending_earnings FROM vendors WHERE id = ${vendor.id}`;
  const expectedUpstreams = Number(process.env.PAYMENT_EXPECT_UPSTREAMS || 2);
  const effectsValid = latePayment
    ? state.booking_status === 'pending_payment' && !state.is_booked && state.booking_id === null && state.provider_status === 'paid_unallocated' && state.review_status === 'manual_review' && effects.ledgers === 0 && effects.events === 1 && effects.notifications === 1 && Number(balance.pending_earnings) === Number(vendor.pending_earnings)
    : state.booking_status === 'confirmed' && state.payment_status === 'paid' && state.is_booked && state.booking_id === booking.id && state.attempt_status === 'paid' && state.provider_status === 'paid' && effects.ledgers === 1 && effects.events === 1 && effects.notifications === 2 && Number(balance.pending_earnings) === Number(vendor.pending_earnings) + 900;
  const valid = first === 1 && duplicates === 9 && upstreams.length >= expectedUpstreams && effectsValid;
  console.log(JSON.stringify({ database: 'turfbookpk_payment_loadtest', mode: latePayment ? 'late' : 'on_time', acknowledgments: responses.length, first, duplicates, api_upstreams: upstreams.length, booking_status: state.booking_status, attempt_status: state.provider_status, review_status: state.review_status, ledger_entries: effects.ledgers, payment_events: effects.events, notifications: effects.notifications, vendor_earnings_once: !latePayment && Number(balance.pending_earnings) === Number(vendor.pending_earnings) + 900, valid }, null, 2));
  if (!valid) process.exitCode = 1;
} finally {
  if (player && owner) await db`DELETE FROM notifications WHERE user_id IN (${player.id}, ${owner.id})`;
  if (attempt) {
    await db`DELETE FROM payment_events WHERE payment_attempt_id = ${attempt.id}`;
    await db`DELETE FROM ledger_entries WHERE payment_attempt_id = ${attempt.id}`;
    await db`DELETE FROM payment_attempts WHERE id = ${attempt.id}`;
  }
  if (slot) await db`UPDATE slots SET is_booked = false, booked_by = null, booking_id = null, held_by = null, hold_booking_id = null, hold_expires_at = null WHERE id = ${slot.id}`;
  if (booking) await db`DELETE FROM bookings WHERE id = ${booking.id}`;
  if (slot) await db`DELETE FROM slots WHERE id = ${slot.id}`;
  if (ground) await db`DELETE FROM grounds WHERE id = ${ground.id}`;
  if (vendor) await db`DELETE FROM vendors WHERE id = ${vendor.id}`;
  if (player) await db`DELETE FROM users WHERE id = ${player.id}`;
  if (owner) await db`DELETE FROM users WHERE id = ${owner.id}`;
  await db.end();
}
