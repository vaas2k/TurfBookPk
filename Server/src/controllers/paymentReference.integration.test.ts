import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import { db, sql } from '../database/client.js';
import { adminAuditLogs, bookings, grounds, paymentAttempts, paymentBillingProfiles, refreshSessions, slots, users, vendors } from '../database/schema.js';
import { env } from '../configs/env.js';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { encryptPaymentValue, paymentIdentifierFingerprint } from '../services/sensitiveData.js';
import type { ReferencePaymentProvider } from '../services/paymentProvider.js';
import { PaymentController } from './paymentController.js';

after(async () => { await sql.end(); });

function responseCapture() {
  const capture: { statusCode: number; body: any } = { statusCode: 200, body: null };
  const response = {
    locals: {},
    status(code: number) { capture.statusCode = code; return this; },
    json(body: unknown) { capture.body = body; return this; },
  } as unknown as Response;
  return { capture, response };
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate HTTP test port');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

test('parallel reference requests make only one provider generation call', async () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const cnic = `3${randomInt(100_000_000_000, 999_999_999_999)}`;
  const player = (await db.insert(users).values({ phone: `+92360${suffix}`, fullName: 'Reference Race Player' }).returning())[0]!;
  const owner = (await db.insert(users).values({ phone: `+92361${suffix}`, fullName: 'Reference Race Vendor', role: 'vendor' }).returning())[0]!;
  const admin = (await db.insert(users).values({ phone: `+92363${suffix}`, fullName: 'Reference Race Admin', role: 'admin' }).returning())[0]!;
  const vendor = (await db.insert(vendors).values({ userId: owner.id, businessName: 'Reference Race Vendor', businessPhone: `+92362${suffix}`, businessCity: 'Karachi' }).returning())[0]!;
  const ground = (await db.insert(grounds).values({ vendorId: vendor.id, title: 'Reference Race Ground', location: 'Karachi', city: 'Karachi', address: 'Test address', pricePerHour: 1000 }).returning())[0]!;
  const slot = (await db.insert(slots).values({ groundId: ground.id, date: '2030-01-04', startTime: '10:00', endTime: '11:00', price: 1000 }).returning())[0]!;
  const holdExpiresAt = new Date(Date.now() + 15 * 60_000);
  const booking = (await db.insert(bookings).values({ bookingNumber: `ref-${suffix}`, playerId: player.id, vendorId: vendor.id, groundId: ground.id, slotId: slot.id, date: slot.date, startTime: slot.startTime, endTime: slot.endTime, totalAmount: 1000, vendorAmount: 900, holdExpiresAt }).returning())[0]!;
  await db.update(slots).set({ heldBy: player.id, holdBookingId: booking.id, holdExpiresAt }).where(eq(slots.id, slot.id));
  const attempt = (await db.insert(paymentAttempts).values({ bookingId: booking.id, playerId: player.id, vendorId: vendor.id, provider: 'clink', amount: 1000, idempotencyKey: `reference-race-${suffix}` }).returning())[0]!;
  let api: ChildProcess | undefined;
  let sandboxApi: ChildProcess | undefined;
  try {
    await db.insert(paymentBillingProfiles).values({ userId: player.id, fullName: 'Reference Race Player', cnicCiphertext: encryptPaymentValue(cnic), cnicHash: paymentIdentifierFingerprint(cnic), cnicLastFour: cnic.slice(-4), billingAddressCiphertext: encryptPaymentValue('Test address, Karachi'), email: 'race@example.test', phone: '03001234567', consentedAt: new Date() });
    let providerCalls = 0;
    const provider: ReferencePaymentProvider = {
      async generateReference() {
        providerCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { provider: 'clink', clinkId: '105026103000046201', consumerNumber: '100806105026103000046201' };
      },
      async expireReference() {},
    };
    const controller = new PaymentController(() => provider);
    const request = { body: { booking_id: booking.id }, auth: { userId: player.id, sessionId: randomUUID() } } as unknown as AuthenticatedRequest;
    const left = responseCapture();
    const right = responseCapture();
    const results = await Promise.allSettled([controller.generateReference(request, left.response), controller.generateReference(request, right.response)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected' && (result.reason as { code?: string }).code === 'payment_reference_in_progress').length, 1);
    assert.equal(providerCalls, 1);
    const [saved] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attempt.id));
    assert.equal(saved?.providerReference, '105026103000046201');
    assert.equal(saved?.providerStatus, 'pending');
    assert.ok([left, right].some(({ capture }) => capture.statusCode === 201 && capture.body?.payment?.clink_id === saved.providerReference));

    const port = await availablePort();
    api = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), TRUST_PROXY_HOPS: '0', CLINK_ALLOW_UNVERIFIED_SANDBOX_ACK: 'false' }, stdio: 'ignore' });
    const root = `http://127.0.0.1:${port}/api`;
    let ready = false;
    for (let index = 0; index < 50; index++) {
      if (api.exitCode !== null) throw new Error('Payment HTTP test API exited before readiness');
      try { ready = (await fetch(`${root}/ready`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* startup */ }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, 'Payment HTTP test API did not become ready');
    const otpStatuses = [];
    for (let index = 0; index < 6; index++) {
      const result = await fetch(`${root}/auth/otp/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${index + 1}` }, body: JSON.stringify({ phone: 'invalid' }) });
      otpStatuses.push(result.status);
    }
    assert.ok(otpStatuses.every((status) => status === 422 || status === 429));
    assert.equal(otpStatuses.at(-1), 429, 'Spoofed forwarding headers must not bypass the OTP IP limit');
    const sessionIds = [randomUUID(), randomUUID(), randomUUID()];
    await db.insert(refreshSessions).values(sessionIds.map((id, index) => ({ id, userId: [player.id, owner.id, admin.id][index]!, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 300_000) })));
    const ownerToken = jwt.sign({ sub: player.id, sid: sessionIds[0] }, env.jwtAccessSecret, { expiresIn: '5m' });
    const otherToken = jwt.sign({ sub: owner.id, sid: sessionIds[1] }, env.jwtAccessSecret, { expiresIn: '5m' });
    const adminToken = jwt.sign({ sub: admin.id, sid: sessionIds[2] }, env.jwtAccessSecret, { expiresIn: '5m' });
    const paymentUrl = `${root}/payments/${attempt.id}`;
    assert.equal((await fetch(paymentUrl)).status, 401);
    assert.equal((await fetch(paymentUrl, { headers: { Authorization: `Bearer ${otherToken}` } })).status, 404);
    const ownerResponse = await fetch(paymentUrl, { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal(ownerResponse.status, 200);
    const playerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const vendorHeaders = { Authorization: `Bearer ${otherToken}` };
    assert.equal((await fetch(`${root}/admin/vendors`)).status, 401);
    assert.equal((await fetch(`${root}/admin/vendors`, { headers: playerHeaders })).status, 403);
    assert.equal((await fetch(`${root}/admin/vendors`, { headers: { Authorization: `Bearer ${adminToken}` } })).status, 200);
    assert.equal((await fetch(`${root}/admin/verification-documents/${randomUUID()}/download`, { headers: vendorHeaders })).status, 403);
    assert.equal((await fetch(`${root}/grounds/${ground.id}/verification`, { headers: playerHeaders })).status, 403);
    assert.equal((await fetch(`${root}/grounds/${ground.id}/verification`, { headers: vendorHeaders })).status, 200);
    await db.update(users).set({ isSuspended: true }).where(eq(users.id, player.id));
    assert.equal((await fetch(paymentUrl, { headers: playerHeaders })).status, 403);
    await db.update(users).set({ isSuspended: false }).where(eq(users.id, player.id));
    const suspensionUrl = `${root}/admin/users/${player.id}/suspension`;
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    assert.equal((await fetch(suspensionUrl, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ is_suspended: true, reason: 'Automated security test' }) })).status, 200);
    assert.equal((await fetch(paymentUrl, { headers: playerHeaders })).status, 401);
    assert.equal((await fetch(suspensionUrl, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ is_suspended: false, reason: 'Automated security test' }) })).status, 200);
    assert.equal((await fetch(paymentUrl, { headers: playerHeaders })).status, 401);
    assert.equal((await ownerResponse.json()).payment.id, attempt.id);
    const acknowledgment = await fetch(`${root}/payments/clink/acknowledgment`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ Clink_ID: saved.providerReference, Payment_DateTime: '2026-10-30 12:00:00' }) });
    assert.equal((await acknowledgment.json())[0].Status_Code, '0');
    const [stillPending] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attempt.id));
    assert.equal(stillPending?.status, 'pending');

    const sandboxPort = await availablePort();
    sandboxApi = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: String(sandboxPort), CLINK_ALLOW_UNVERIFIED_SANDBOX_ACK: 'true' }, stdio: 'ignore' });
    const sandboxRoot = `http://127.0.0.1:${sandboxPort}/api`;
    let sandboxReady = false;
    for (let index = 0; index < 50; index++) {
      if (sandboxApi.exitCode !== null) throw new Error('Sandbox HTTP test API exited before readiness');
      try { sandboxReady = (await fetch(`${sandboxRoot}/ready`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* startup */ }
      if (sandboxReady) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(sandboxReady, true, 'Sandbox HTTP test API did not become ready');
    const callbackUrl = `${sandboxRoot}/payments/clink/acknowledgment`;
    const callback = (body: string) => fetch(callbackUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body });
    assert.equal((await (await callback('{invalid')).json())[0].Status_Code, '0');
    assert.equal((await (await callback(JSON.stringify({ Clink_ID: saved.providerReference, Payment_DateTime: '2026-02-31 12:00:00' }))).json())[0].Status_Code, '0');
    assert.equal((await (await callback(JSON.stringify({ Clink_ID: '999999999999999999', Payment_DateTime: '2026-10-30 12:00:00' }))).json())[0].Status_Code, '0');
    assert.equal((await callback('x'.repeat(33 * 1024))).status, 413);
    const [afterInvalidCallbacks] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attempt.id));
    assert.equal(afterInvalidCallbacks?.status, 'pending');

    // An expired/blocked target must be rejected before contacting Clink again.
    await db.update(paymentAttempts).set({ status: 'failed', providerStatus: 'expired', providerReference: null, consumerNumber: null }).where(eq(paymentAttempts.id, attempt.id));
    await db.update(bookings).set({ status: 'expired' }).where(eq(bookings.id, booking.id));
    await db.update(slots).set({ heldBy: null, holdBookingId: null, holdExpiresAt: null, isBlocked: true }).where(eq(slots.id, slot.id));
    await assert.rejects(controller.generateReference(request, responseCapture().response), (error: any) => error.code === 'slot_unavailable');
    assert.equal(providerCalls, 1);

    await db.update(paymentAttempts).set({ status: 'pending', providerStatus: 'pending' }).where(eq(paymentAttempts.id, attempt.id));
    await db.update(bookings).set({ status: 'pending_payment', isRecurringReservation: true, paymentWindowOpensAt: new Date(Date.now() + 3_600_000), reservationExpiresAt: new Date(Date.now() + 5_400_000) }).where(eq(bookings.id, booking.id));
    await db.update(slots).set({ isBlocked: false, heldBy: player.id, holdBookingId: booking.id, holdExpiresAt: new Date(Date.now() + 5_400_000) }).where(eq(slots.id, slot.id));
    await assert.rejects(controller.generateReference(request, responseCapture().response), (error: any) => error.code === 'payment_window_not_open');
    assert.equal(providerCalls, 1);
  } finally {
    api?.kill();
    sandboxApi?.kill();
    await db.delete(refreshSessions).where(eq(refreshSessions.userId, player.id));
    await db.delete(refreshSessions).where(eq(refreshSessions.userId, owner.id));
    await db.delete(refreshSessions).where(eq(refreshSessions.userId, admin.id));
    await db.delete(adminAuditLogs).where(eq(adminAuditLogs.actorId, admin.id));
    await db.delete(paymentBillingProfiles).where(eq(paymentBillingProfiles.userId, player.id));
    await db.delete(paymentAttempts).where(eq(paymentAttempts.id, attempt.id));
    await db.update(slots).set({ heldBy: null, holdBookingId: null, holdExpiresAt: null, isBlocked: false }).where(eq(slots.id, slot.id));
    await db.delete(bookings).where(eq(bookings.id, booking.id));
    await db.delete(slots).where(eq(slots.id, slot.id));
    await db.delete(grounds).where(eq(grounds.id, ground.id));
    await db.delete(vendors).where(eq(vendors.id, vendor.id));
    await db.delete(users).where(eq(users.id, player.id));
    await db.delete(users).where(eq(users.id, owner.id));
    await db.delete(users).where(eq(users.id, admin.id));
  }
});
