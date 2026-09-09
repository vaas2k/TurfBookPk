import 'dotenv/config';
import { randomInt } from 'node:crypto';
import { spawn } from 'node:child_process';
import postgres from 'postgres';

const port = Number(process.env.PORT || 5000);
const baseUrl = `http://127.0.0.1:${port}/api`;
const otp = process.env.AUTH_OTP_FIXED_CODE;
if (!otp) throw new Error('AUTH_OTP_FIXED_CODE is required for the local smoke test');
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const suffix = String(randomInt(100_000_000, 999_999_999));
const playerPhone = `3${suffix}`;
const vendorPhone = `3${String((Number(suffix) + 1) % 1_000_000_000).padStart(9, '0')}`;
const ids = { users: [], vendor: null, ground: null, slot: null, booking: null, noShowSlot: null, noShowBooking: null };
const server = spawn(process.execPath, ['dist/server.js'], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}
async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { await request('/health'); return; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
  }
  throw new Error('Server did not become ready');
}
async function login(phone) {
  await request('/auth/otp/request', { method: 'POST', body: { phone } });
  const result = await request('/auth/otp/verify', { method: 'POST', body: { phone, code: otp } });
  ids.users.push(result.user.id);
  return result.session.accessToken;
}

try {
  await waitForServer();
  const playerToken = await login(playerPhone);
  const vendorToken = await login(vendorPhone);
  const vendor = await request('/vendors', { method: 'POST', token: vendorToken, body: { business_name: 'Smoke Test Vendor', business_phone: vendorPhone, business_city: 'Karachi' } });
  ids.vendor = vendor.profile.id;
  await request('/vendors/mode', { method: 'PATCH', token: vendorToken, body: {} });
  const ground = await request('/grounds', { method: 'POST', token: vendorToken, body: { title: 'Smoke Test Ground', location: 'Test', city: 'Karachi', address: 'Test address', price_per_hour: 2000 } });
  ids.ground = ground.ground.id;
  const slot = await request(`/grounds/${ids.ground}/slots`, { method: 'POST', token: vendorToken, body: { date: '2030-01-01', start_time: '10:00', end_time: '11:00', price: 2000 } });
  ids.slot = slot.slot.id;
  const pending = await request('/bookings', { method: 'POST', token: playerToken, body: { slot_id: ids.slot, idempotency_key: `smoke-${suffix}` } });
  ids.booking = pending.booking.id;
  if (pending.booking.status !== 'pending_payment') throw new Error('Booking did not enter pending_payment');
  const confirmed = await request(`/bookings/${ids.booking}/mock-confirm`, { method: 'POST', token: playerToken, body: { payment_reference: `smoke-payment-${suffix}` } });
  if (confirmed.booking.status !== 'confirmed' || confirmed.booking.payment_status !== 'paid') throw new Error('Mock payment did not confirm booking');
  await request(`/bookings/${ids.booking}`, { token: playerToken });
  await request(`/bookings/${ids.booking}`, { token: vendorToken });
  const beforeCancel = await request('/vendors/earnings', { token: vendorToken });
  if (beforeCancel.summary.pending_earnings !== 2000) throw new Error('Pending vendor earning was not created');
  const cancelled = await request(`/bookings/${ids.booking}/cancel`, { method: 'PATCH', token: playerToken, body: { reason: 'Smoke test cancellation' } });
  if (cancelled.booking.status !== 'cancelled' || cancelled.booking.refund_amount !== 2000) throw new Error('Cancellation/refund policy failed');
  const afterCancel = await request('/vendors/earnings', { token: vendorToken });
  if (afterCancel.summary.pending_earnings !== 0) throw new Error('Cancelled earning was not reversed');
  const vendorNotifications = await request('/bookings/notifications', { token: vendorToken });
  if (!vendorNotifications.notifications.some((notification) => notification.data?.bookingId === ids.booking && notification.title === 'Booking cancelled')) throw new Error('Vendor cancellation notification missing');
  const groundAfterCancel = await request(`/grounds/${ids.ground}`);
  const released = groundAfterCancel.slots.find((candidate) => candidate.id === ids.slot);
  if (!released || released.is_booked || released.is_held) throw new Error('Cancelled slot was not released');

  const noShowSlot = await request(`/grounds/${ids.ground}/slots`, { method: 'POST', token: vendorToken, body: { date: '2030-01-02', start_time: '10:00', end_time: '11:00', price: 1500 } });
  ids.noShowSlot = noShowSlot.slot.id;
  const noShowPending = await request('/bookings', { method: 'POST', token: playerToken, body: { slot_id: ids.noShowSlot, idempotency_key: `smoke-no-show-${suffix}` } });
  ids.noShowBooking = noShowPending.booking.id;
  await request(`/bookings/${ids.noShowBooking}/mock-confirm`, { method: 'POST', token: playerToken, body: { payment_reference: `smoke-no-show-payment-${suffix}` } });
  await sql`update bookings set date = '2020-01-01' where id = ${ids.noShowBooking}`;
  const noShow = await request(`/bookings/${ids.noShowBooking}/no-show`, { method: 'PATCH', token: vendorToken, body: {} });
  if (noShow.booking.status !== 'no_show') throw new Error('Vendor no-show transition failed');
  const afterNoShow = await request('/vendors/earnings', { token: vendorToken });
  if (afterNoShow.summary.pending_earnings !== 0 || afterNoShow.summary.total_earnings !== 1500) throw new Error('No-show did not post vendor earnings');
  const playerNotifications = await request('/bookings/notifications', { token: playerToken });
  if (!playerNotifications.notifications.some((notification) => notification.data?.bookingId === ids.noShowBooking && notification.title === 'Booking marked as no-show')) throw new Error('Player no-show notification missing');
  console.log('Core MVP smoke test passed');
} finally {
  server.kill();
  if (ids.noShowBooking) { await sql`delete from ledger_entries where booking_id = ${ids.noShowBooking}`; await sql`delete from payment_attempts where booking_id = ${ids.noShowBooking}`; await sql`delete from bookings where id = ${ids.noShowBooking}`; }
  if (ids.booking) { await sql`delete from ledger_entries where booking_id = ${ids.booking}`; await sql`delete from payment_attempts where booking_id = ${ids.booking}`; await sql`delete from bookings where id = ${ids.booking}`; }
  if (ids.noShowSlot) await sql`delete from slots where id = ${ids.noShowSlot}`;
  if (ids.slot) await sql`delete from slots where id = ${ids.slot}`;
  if (ids.ground) await sql`delete from grounds where id = ${ids.ground}`;
  if (ids.vendor) await sql`delete from vendors where id = ${ids.vendor}`;
  if (ids.users.length) { await sql`delete from notifications where user_id in ${sql(ids.users)}`; await sql`delete from refresh_sessions where user_id in ${sql(ids.users)}`; await sql`delete from users where id in ${sql(ids.users)}`; }
  await sql`delete from otp_challenges where phone in (${`92${playerPhone}`}, ${`92${vendorPhone}`})`;
  await sql.end();
}
