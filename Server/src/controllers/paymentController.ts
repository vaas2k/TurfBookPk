import { createHash } from 'node:crypto';
import { Response } from 'express';
import { and, eq, inArray, isNull, lte, or, sql as expression } from 'drizzle-orm';
import { db } from '../database/client.js';
import { bookingOrders, bookings, grounds, ledgerEntries, notifications, paymentAttempts, paymentBillingProfiles, paymentEvents, slots, users, vendors } from '../database/schema.js';
import { env } from '../configs/env.js';
import { AppError, getErrorMessage } from '../helpers/errors.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { clinkPhone, referencePaymentProvider } from '../services/paymentProvider.js';
import { sendExpoPush } from '../services/expoPushService.js';
import { decryptPaymentValue, encryptPaymentValue, identifierLastFour, paymentIdentifierFingerprint } from '../services/sensitiveData.js';
import { errorMetadata, logEvent, redactOperationalData } from '../services/operationalLogger.js';

function requestId(response: Response): string | null { return typeof response.locals.requestId === 'string' ? response.locals.requestId : null; }
function paymentResponse(response: Response, body: Record<string, unknown>, message: string, workflowStage: string, nextAction: string, status = 200): void {
  response.status(status).json({ ...body, message, workflow_stage: workflowStage, next_action: nextAction, request_id: requestId(response) });
}

function stringValue(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AppError('invalid_billing_profile', `${label} is required`, 422);
  return value.trim();
}
function pakistanDate(date: Date): string { return new Date(date.getTime() + 5 * 3_600_000).toISOString().slice(0, 10); }
function paymentView(row: typeof paymentAttempts.$inferSelect) {
  return { id: row.id, booking_id: row.bookingId, order_id: row.orderId, provider: row.provider, status: row.status, provider_status: row.providerStatus, amount: row.amount, service_charge: row.serviceCharge, final_payable_amount: row.finalPayableAmount, clink_id: row.providerReference, consumer_number: row.consumerNumber, provider_due_date: row.providerDueDate, expires_at: row.expiresAt?.toISOString() || null, paid_at: row.paidAt?.toISOString() || null, review_status: row.reviewStatus, provider_error: row.providerError, manual_acknowledgment_test_enabled: env.paymentProvider === 'clink' && env.paymentEnvironment === 'sandbox' && env.clinkAllowUnverifiedSandboxAck };
}
function acknowledgmentTime(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new AppError('invalid_acknowledgment', 'Payment_DateTime is invalid', 422);
  const parsed = new Date(`${value.replace(' ', 'T')}+05:00`);
  if (Number.isNaN(parsed.getTime())) throw new AppError('invalid_acknowledgment', 'Payment_DateTime is invalid', 422);
  return parsed;
}

export class PaymentController {
  configuration = async (_request: AuthenticatedRequest, response: Response): Promise<void> => {
    const available = env.paymentProvider === 'clink' && env.paymentEnvironment === 'sandbox';
    paymentResponse(response, { provider: env.paymentProvider, environment: env.paymentEnvironment, available, manual_acknowledgment_test_enabled: available && env.clinkAllowUnverifiedSandboxAck }, available ? 'Clink sandbox is ready.' : 'Clink sandbox is not configured.', 'configuration_checked', available ? 'Continue checkout.' : 'Configure the Clink server environment and restart the API.');
  };

  billingProfile = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const row = (await db.select().from(paymentBillingProfiles).where(eq(paymentBillingProfiles.userId, request.auth!.userId)).limit(1))[0];
    logEvent('info', 'payment_billing_profile_read', { request_id: requestId(response), user_id: request.auth!.userId, profile_exists: Boolean(row) });
    paymentResponse(response, { billing_profile: row ? { full_name: row.fullName, masked_cnic: `*********${row.cnicLastFour}`, billing_address: decryptPaymentValue(row.billingAddressCiphertext), email: row.email, phone: row.phone, consented_at: row.consentedAt.toISOString() } : null }, row ? 'Payment profile loaded.' : 'No payment profile exists yet.', 'billing_profile_loaded', row ? 'Review the saved profile or continue checkout.' : 'Complete the payment profile before generating a reference.');
  };

  updateBillingProfile = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const fullName = stringValue(request.body?.full_name, 'Full name', 120);
    if (fullName.length < 5) throw new AppError('invalid_billing_profile', 'Full name must contain at least 5 characters', 422);
    const cnic = stringValue(request.body?.cnic, 'CNIC', 20).replace(/\D/g, '');
    if (!/^[1-9]\d{12}$/.test(cnic)) throw new AppError('invalid_billing_profile', 'Enter a valid 13-digit CNIC', 422);
    const billingAddress = stringValue(request.body?.billing_address, 'Billing address', 240);
    if (billingAddress.length < 5) throw new AppError('invalid_billing_profile', 'Billing address must contain at least 5 characters', 422);
    const email = stringValue(request.body?.email, 'Email', 160).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new AppError('invalid_billing_profile', 'Enter a valid email address', 422);
    const phone = stringValue(request.body?.phone, 'Phone', 24);
    if (request.body?.consent !== true) throw new AppError('billing_consent_required', 'Consent is required to securely store payment information', 422);
    const values = { fullName, cnicCiphertext: encryptPaymentValue(cnic), cnicHash: paymentIdentifierFingerprint(cnic), cnicLastFour: identifierLastFour(cnic), billingAddressCiphertext: encryptPaymentValue(billingAddress), email, phone, consentedAt: new Date(), updatedAt: new Date() };
    const [row] = await db.insert(paymentBillingProfiles).values({ userId: request.auth!.userId, ...values }).onConflictDoUpdate({ target: paymentBillingProfiles.userId, set: values }).returning();
    logEvent('info', 'payment_billing_profile_saved', { request_id: requestId(response), user_id: request.auth!.userId, billing_profile_id: row!.id });
    paymentResponse(response, { billing_profile: { full_name: row!.fullName, masked_cnic: `*********${row!.cnicLastFour}`, billing_address: billingAddress, email: row!.email, phone: row!.phone, consented_at: row!.consentedAt.toISOString() } }, 'Payment profile saved securely.', 'billing_profile_saved', 'Review the checkout and generate the 1-Bill reference.');
  };

  generateReference = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const bookingId = typeof request.body?.booking_id === 'string' ? request.body.booking_id : null;
    const orderId = typeof request.body?.order_id === 'string' ? request.body.order_id : null;
    if (Boolean(bookingId) === Boolean(orderId)) throw new AppError('invalid_payment_target', 'Provide exactly one booking_id or order_id', 422);
    const profile = (await db.select().from(paymentBillingProfiles).where(eq(paymentBillingProfiles.userId, request.auth!.userId)).limit(1))[0];
    if (!profile) throw new AppError('billing_profile_required', 'Complete your private payment profile first', 422);
    let attempt = (await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.playerId, request.auth!.userId), bookingId ? eq(paymentAttempts.bookingId, bookingId) : eq(paymentAttempts.orderId, orderId!))).limit(1))[0];
    if (!attempt && bookingId) {
      const booking = (await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.playerId, request.auth!.userId))).limit(1))[0];
      if (!booking || !booking.isRecurringReservation) throw new AppError('payment_attempt_missing', 'Payment attempt was not found', 404);
      [attempt] = await db.insert(paymentAttempts).values({ bookingId, playerId: booking.playerId, vendorId: booking.vendorId, provider: 'clink', amount: booking.totalAmount, idempotencyKey: `recurring-payment:${booking.id}:clink` }).onConflictDoNothing().returning();
      if (!attempt) attempt = (await db.select().from(paymentAttempts).where(eq(paymentAttempts.idempotencyKey, `recurring-payment:${booking.id}:clink`)).limit(1))[0];
    }
    if (!attempt) throw new AppError('payment_attempt_missing', 'Payment attempt was not found', 404);
    const targetAttempt = attempt;
    logEvent('info', 'payment_reference_generation_started', { request_id: requestId(response), payment_attempt_id: targetAttempt.id, booking_id: targetAttempt.bookingId, order_id: targetAttempt.orderId, amount: targetAttempt.amount, provider: env.paymentProvider, environment: env.paymentEnvironment });
    if (env.paymentProvider !== 'clink' || env.paymentEnvironment !== 'sandbox') {
      await db.update(paymentAttempts).set({ status: 'failed', providerStatus: 'failed', providerError: 'Clink sandbox payments are not enabled', failedAt: new Date(), updatedAt: new Date() }).where(eq(paymentAttempts.id, targetAttempt.id));
      await this.releaseTarget(targetAttempt);
      throw new AppError('payment_provider_unavailable', 'Clink sandbox payments are not enabled. The checkout hold has been released.', 503);
    }
    clinkPhone(profile.phone);
    if (targetAttempt.providerReference && ['pending', 'paid'].includes(targetAttempt.providerStatus)) return paymentResponse(response, { payment: paymentView(targetAttempt), idempotent: true }, 'Existing Clink reference returned; no duplicate was generated.', 'reference_already_exists', targetAttempt.providerStatus === 'paid' ? 'Open the confirmed booking.' : 'Wait for Clink payment acknowledgment.');
    if (targetAttempt.providerStatus === 'unknown') throw new AppError('payment_under_review', 'The previous provider request has an unknown result and cannot be retried automatically', 409);
    const expiresAt = new Date(Date.now() + env.paymentHoldMinutes * 60_000); const dueDate = pakistanDate(expiresAt);
    if (['failed', 'expired'].includes(targetAttempt.providerStatus)) await this.reacquireTarget(targetAttempt, expiresAt);
    const applicantReference = `TB-${targetAttempt.id.replace(/-/g, '').slice(0, 24)}`;
    await db.update(paymentAttempts).set({ provider: 'clink', providerStatus: 'initializing', applicantReference, expiresAt, providerDueDate: dueDate, providerError: null, updatedAt: new Date() }).where(eq(paymentAttempts.id, targetAttempt.id));
    const targetBookings = targetAttempt.bookingId
      ? [targetAttempt.bookingId]
      : (await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.orderId, targetAttempt.orderId!), eq(bookings.status, 'pending_payment')))).map((row) => row.id);
    if (targetBookings.length) {
      await db.update(bookings).set({ holdExpiresAt: expiresAt, updatedAt: new Date() }).where(inArray(bookings.id, targetBookings));
      await db.update(slots).set({ holdExpiresAt: expiresAt, updatedAt: new Date() }).where(inArray(slots.holdBookingId, targetBookings));
    }
    try {
      const correlationId = requestId(response);
      const generated = await referencePaymentProvider().generateReference({ amount: targetAttempt.amount, dueDate, applicantReference, payer: { cnic: decryptPaymentValue(profile.cnicCiphertext), fullName: profile.fullName, address: decryptPaymentValue(profile.billingAddressCiphertext), phone: profile.phone, email: profile.email }, diagnostics: { ...(correlationId ? { requestId: correlationId } : {}), paymentAttemptId: targetAttempt.id } });
      const [updatedAttempt] = await db.update(paymentAttempts).set({ providerReference: generated.clinkId, consumerNumber: generated.consumerNumber, providerStatus: 'pending', expiresAt, providerDueDate: dueDate, finalPayableAmount: null, updatedAt: new Date() }).where(eq(paymentAttempts.id, targetAttempt.id)).returning();
      logEvent('info', 'payment_reference_generation_completed', { request_id: requestId(response), payment_attempt_id: targetAttempt.id, clink_id_suffix: generated.clinkId.slice(-6), expires_at: expiresAt.toISOString() });
      paymentResponse(response, { payment: paymentView(updatedAttempt!), idempotent: false, fee_notice: 'Clink may add a service charge that is not returned by the current sandbox API.' }, '1-Bill reference generated successfully.', 'reference_generated', 'Pay using 1-Bill and wait for Clink acknowledgment.', 201);
    } catch (error) {
      const definite = error instanceof AppError && error.code === 'payment_reference_rejected';
      await db.update(paymentAttempts).set({ status: definite ? 'failed' : 'pending', providerStatus: definite ? 'failed' : 'unknown', reviewStatus: definite ? 'none' : 'manual_review', providerError: getErrorMessage(error).slice(0, 240), failedAt: definite ? new Date() : null, updatedAt: new Date() }).where(eq(paymentAttempts.id, targetAttempt.id));
      if (definite) await this.releaseTarget(targetAttempt);
      logEvent('error', 'payment_reference_generation_failed', { request_id: requestId(response), payment_attempt_id: targetAttempt.id, definite_rejection: definite, ...errorMetadata(error) });
      if (error instanceof AppError) throw error;
      throw new AppError('payment_provider_unknown', `Clink did not provide a definite result: ${String(redactOperationalData(getErrorMessage(error))).slice(0, 180)}`, 504);
    }
  };

  paymentStatus = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const id = String(request.params.id || '');
    let attempt = (await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.id, id), eq(paymentAttempts.playerId, request.auth!.userId))).limit(1))[0];
    if (!attempt) throw new AppError('not_found', 'Payment was not found', 404);
    attempt = await this.expireAttempt(attempt);
    logEvent('info', 'payment_status_checked', { request_id: requestId(response), payment_attempt_id: attempt.id, status: attempt.status, provider_status: attempt.providerStatus, review_status: attempt.reviewStatus });
    paymentResponse(response, { payment: paymentView(attempt) }, `Payment status is ${attempt.providerStatus.replaceAll('_', ' ')}.`, 'status_checked', attempt.providerStatus === 'pending' ? 'Complete payment and wait for provider acknowledgment.' : attempt.providerStatus === 'paid' ? 'Open the confirmed booking.' : attempt.reviewStatus === 'manual_review' ? 'Contact support with the request ID and payment attempt ID.' : 'Start a new checkout if the slot remains available.');
  };

  bookingPaymentStatus = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const bookingId = String(request.params.bookingId || '');
    let attempt = (await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.bookingId, bookingId), eq(paymentAttempts.playerId, request.auth!.userId))).limit(1))[0];
    if (attempt) attempt = await this.expireAttempt(attempt);
    paymentResponse(response, { payment: attempt ? paymentView(attempt) : null }, attempt ? `Booking payment status is ${attempt.providerStatus.replaceAll('_', ' ')}.` : 'No payment attempt exists for this booking.', 'booking_payment_checked', attempt ? 'Open the payment attempt for details.' : 'Generate a payment reference when the payment window is open.');
  };

  acknowledge = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const fail = (message: string) => response.json([{ Status_Code: '0', Status_Desc: message.slice(0, 200) }]);
    try {
      if (env.paymentProvider !== 'clink' || env.paymentEnvironment !== 'sandbox' || !env.clinkAllowUnverifiedSandboxAck) return void fail('Sandbox acknowledgment is disabled.');
      const body = typeof request.body === 'string' ? JSON.parse(request.body) as Record<string, unknown> : request.body as Record<string, unknown>;
      const clinkId = typeof body?.Clink_ID === 'string' ? body.Clink_ID.trim() : '';
      if (!/^\d{18}$/.test(clinkId)) return void fail('Invalid Clink ID.');
      const paymentStatus = typeof body?.Payment_Status === 'string' ? body.Payment_Status.trim().toUpperCase() : 'PAID';
      if (!['PAID', 'FAILED'].includes(paymentStatus)) return void fail('Payment_Status must be PAID or FAILED.');
      const attempt = (await db.select().from(paymentAttempts).where(eq(paymentAttempts.providerReference, clinkId)).limit(1))[0];
      if (!attempt) return void fail('Payment reference was not found.');
      if (attempt.status === 'paid') { logEvent('info', 'clink_acknowledgment_duplicate', { request_id: requestId(response), payment_attempt_id: attempt.id }); return void response.json([{ Status_Code: '2', Status_Desc: 'Already Acknowledged' }]); }
      if (paymentStatus === 'FAILED') {
        const expired = await this.expireAttempt(attempt, true);
        logEvent('info', 'clink_failed_payment_acknowledged', { request_id: requestId(response), payment_attempt_id: attempt.id, provider_status: expired.providerStatus });
        return void response.json([{ Status_Code: '1', Status_Desc: 'Failed payment acknowledged; bill expired and slot released' }]);
      }
      const paidAt = acknowledgmentTime(body?.Payment_DateTime);
      logEvent('info', 'clink_acknowledgment_received', { request_id: requestId(response), clink_id_suffix: clinkId.slice(-6), payment_time_utc: paidAt.toISOString() });
      const eventKey = `clink:${clinkId}:paid`; const payloadHash = createHash('sha256').update(`${clinkId}|${String(body.Payment_DateTime)}`).digest('hex');
      const result = await this.confirmAttempt(attempt.id, paidAt, eventKey, payloadHash);
      logEvent('info', 'clink_acknowledgment_processed', { request_id: requestId(response), payment_attempt_id: attempt.id, processing_result: result });
      if (result === 'duplicate') return void response.json([{ Status_Code: '2', Status_Desc: 'Already Acknowledged' }]);
      if (result === 'confirmed') {
        const linkedBookingId = attempt.bookingId || (await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.orderId, attempt.orderId!)).limit(1))[0]?.id;
        void sendExpoPush({ userIds: [attempt.playerId], title: 'Payment confirmed', body: 'Your 1-Bill payment was received and your booking is confirmed.', data: linkedBookingId ? { bookingId: linkedBookingId } : { paymentId: attempt.id } });
        const vendorUsers = attempt.bookingId
          ? await db.select({ id: vendors.userId }).from(bookings).innerJoin(vendors, eq(bookings.vendorId, vendors.id)).where(eq(bookings.id, attempt.bookingId))
          : await db.select({ id: vendors.userId }).from(bookings).innerJoin(vendors, eq(bookings.vendorId, vendors.id)).where(eq(bookings.orderId, attempt.orderId!));
        for (const vendorUserId of [...new Set(vendorUsers.map((row) => row.id))]) void sendExpoPush({ userIds: [vendorUserId], title: 'New paid booking', body: 'A booking was paid through 1-Bill.', data: linkedBookingId ? { bookingId: linkedBookingId } : {} });
        return void response.json([{ Status_Code: '1', Status_Desc: 'Acknowledged' }]);
      }
      void sendExpoPush({ userIds: [attempt.playerId], title: 'Payment under review', body: 'Your 1-Bill payment was received but needs manual review.', data: { paymentId: attempt.id } });
      response.json([{ Status_Code: '1', Status_Desc: 'Acknowledged - payment requires manual review' }]);
    } catch (error) { logEvent('error', 'clink_acknowledgment_failed', { request_id: requestId(response), ...errorMetadata(error) }); fail(error instanceof SyntaxError ? 'Invalid JSON body.' : String(redactOperationalData(getErrorMessage(error)))); }
  };

  private async releaseTarget(attempt: typeof paymentAttempts.$inferSelect): Promise<void> {
    const ids = attempt.bookingId ? [attempt.bookingId] : (await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.orderId, attempt.orderId!))).map((row) => row.id);
    if (!ids.length) return;
    await db.transaction(async (tx) => { await tx.update(bookings).set({ status: 'expired', paymentStatus: 'failed', updatedAt: new Date() }).where(and(inArray(bookings.id, ids), eq(bookings.status, 'pending_payment'))); await tx.update(slots).set({ heldBy: null, holdBookingId: null, holdExpiresAt: null, updatedAt: new Date() }).where(inArray(slots.holdBookingId, ids)); });
  }

  private async reacquireTarget(attempt: typeof paymentAttempts.$inferSelect, expiresAt: Date): Promise<void> {
    await db.transaction(async (tx) => {
      const targetRows = attempt.bookingId
        ? await tx.select({ booking: bookings, slot: slots }).from(bookings).innerJoin(slots, eq(bookings.slotId, slots.id)).where(eq(bookings.id, attempt.bookingId))
        : await tx.select({ booking: bookings, slot: slots }).from(bookings).innerJoin(slots, eq(bookings.slotId, slots.id)).where(eq(bookings.orderId, attempt.orderId!));
      const payable = attempt.orderId ? targetRows.filter((row) => !row.booking.isRecurringReservation) : targetRows;
      if (!payable.length) throw new AppError('payment_target_unavailable', 'This booking can no longer be paid', 409);
      const now = new Date();
      for (const row of payable) {
        const [held] = await tx.update(slots).set({ heldBy: attempt.playerId, holdBookingId: row.booking.id, holdExpiresAt: expiresAt, updatedAt: now }).where(and(eq(slots.id, row.slot.id), eq(slots.isBooked, false), eq(slots.isBlocked, false), or(isNull(slots.holdExpiresAt), lte(slots.holdExpiresAt, now), eq(slots.holdBookingId, row.booking.id)))).returning();
        if (!held) throw new AppError('slot_unavailable', 'One or more slots are no longer available', 409);
        await tx.update(bookings).set({ status: 'pending_payment', paymentStatus: 'pending', holdExpiresAt: expiresAt, updatedAt: now }).where(eq(bookings.id, row.booking.id));
      }
    });
  }

  async expirePendingAttempts(now = new Date()): Promise<number> {
    const candidates = await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.provider, 'clink'), eq(paymentAttempts.providerStatus, 'pending'), lte(paymentAttempts.expiresAt, now))).orderBy(paymentAttempts.expiresAt).limit(100);
    let expired = 0;
    for (const attempt of candidates) {
      try {
        const result = await this.expireAttempt(attempt);
        if (result.providerStatus === 'expired') expired += 1;
      } catch (error) {
        logEvent('error', 'expired_payment_cleanup_failed', { payment_attempt_id: attempt.id, ...errorMetadata(error) });
      }
    }
    return expired;
  }

  private async expireAttempt(attempt: typeof paymentAttempts.$inferSelect, force = false): Promise<typeof paymentAttempts.$inferSelect> {
    if (attempt.providerStatus !== 'pending' || !attempt.providerReference || (!force && (!attempt.expiresAt || attempt.expiresAt > new Date()))) return attempt;
    try {
      await referencePaymentProvider().expireReference({ clinkId: attempt.providerReference, diagnostics: { paymentAttemptId: attempt.id } });
      await this.releaseTarget(attempt);
      const now = new Date();
      const [expired] = await db.update(paymentAttempts).set({ status: 'failed', providerStatus: 'expired', providerError: force ? 'Payment reported as failed' : 'Payment window expired', failedAt: now, updatedAt: now }).where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.providerStatus, 'pending'))).returning();
      return expired || (await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attempt.id)).limit(1))[0]!;
    } catch (error) {
      await db.update(paymentAttempts).set({ reviewStatus: 'manual_review', providerError: getErrorMessage(error).slice(0, 240), updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
      throw error;
    }
  }

  private async confirmAttempt(attemptId: string, paidAt: Date, eventKey: string, payloadHash: string): Promise<'confirmed' | 'manual_review' | 'duplicate'> {
    return db.transaction(async (tx) => {
      await tx.execute(expression`select pg_advisory_xact_lock(hashtext(${attemptId}))`);
      const attempt = (await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId)).limit(1))[0]!;
      if (attempt.status === 'paid') return 'duplicate';
      const rows = attempt.bookingId
        ? await tx.select({ booking: bookings, slot: slots, ground: grounds, vendor: vendors }).from(bookings).innerJoin(slots, eq(bookings.slotId, slots.id)).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(vendors, eq(bookings.vendorId, vendors.id)).where(eq(bookings.id, attempt.bookingId))
        : await tx.select({ booking: bookings, slot: slots, ground: grounds, vendor: vendors }).from(bookings).innerJoin(slots, eq(bookings.slotId, slots.id)).innerJoin(grounds, eq(bookings.groundId, grounds.id)).innerJoin(vendors, eq(bookings.vendorId, vendors.id)).where(eq(bookings.orderId, attempt.orderId!));
      const payable = attempt.orderId ? rows.filter((row) => !row.booking.isRecurringReservation) : rows;
      const now = new Date(); const invalid = !payable.length || payable.some((row) => row.booking.status !== 'pending_payment' || !row.slot.holdExpiresAt || row.slot.holdExpiresAt <= now || row.slot.holdBookingId !== row.booking.id);
      if (invalid) {
        await tx.update(paymentAttempts).set({ status: 'paid', providerStatus: 'paid_unallocated', reviewStatus: 'manual_review', gatewayPaidAt: paidAt, paidAt, acknowledgedAt: now, updatedAt: now }).where(eq(paymentAttempts.id, attempt.id));
        await tx.insert(notifications).values({ userId: attempt.playerId, type: 'payment', title: 'Payment under review', message: 'Your payment arrived after the reservation changed. Our team will review it.', data: { paymentId: attempt.id } });
        const admins = await tx.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
        if (admins.length) await tx.insert(notifications).values(admins.map((admin) => ({ userId: admin.id, type: 'payment_review', title: 'Payment requires review', message: `Clink payment ${attempt.providerReference} could not allocate its slot.`, data: { paymentId: attempt.id } })));
        await tx.insert(paymentEvents).values({ paymentAttemptId: attempt.id, provider: 'clink', eventType: 'payment_acknowledged', eventKey, providerReference: attempt.providerReference, payloadHash, processingResult: 'manual_review', processedAt: now });
        return 'manual_review';
      }
      for (const row of payable) {
        const [claimed] = await tx.update(slots).set({ isBooked: true, bookedBy: row.booking.playerId, bookingId: row.booking.id, heldBy: null, holdBookingId: null, holdExpiresAt: null, updatedAt: now }).where(and(eq(slots.id, row.slot.id), eq(slots.holdBookingId, row.booking.id))).returning();
        if (!claimed) throw new AppError('slot_unavailable', 'The reserved slot is no longer available', 409);
        await tx.update(bookings).set({ status: 'confirmed', paymentStatus: 'paid', paymentMethod: 'clink_1bill', paymentReference: attempt.providerReference, holdExpiresAt: null, updatedAt: now }).where(eq(bookings.id, row.booking.id));
        const [earning] = await tx.insert(ledgerEntries).values({ vendorId: row.booking.vendorId, bookingId: row.booking.id, paymentAttemptId: attempt.id, type: 'booking_earning', status: 'pending', amount: row.booking.vendorAmount, description: `Pending earning for booking ${row.booking.bookingNumber}`, idempotencyKey: `earning:${row.booking.id}` }).onConflictDoNothing().returning();
        if (earning) await tx.update(vendors).set({ pendingEarnings: expression`${vendors.pendingEarnings} + ${row.booking.vendorAmount}`, updatedAt: now }).where(eq(vendors.id, row.booking.vendorId));
        await tx.insert(notifications).values({ userId: row.vendor.userId, type: 'booking', title: 'New paid booking', message: `A booking at ${row.ground.title} was paid through 1-Bill.`, data: { bookingId: row.booking.id } });
      }
      await tx.update(paymentAttempts).set({ status: 'paid', providerStatus: 'paid', reviewStatus: 'none', gatewayPaidAt: paidAt, paidAt, acknowledgedAt: now, updatedAt: now }).where(eq(paymentAttempts.id, attempt.id));
      if (attempt.orderId) await tx.update(bookingOrders).set({ status: 'confirmed', paymentStatus: 'paid', updatedAt: now }).where(eq(bookingOrders.id, attempt.orderId));
      await tx.insert(notifications).values({ userId: attempt.playerId, type: 'booking', title: payable.length > 1 ? 'Bookings confirmed' : 'Booking confirmed', message: `Your 1-Bill payment was received and ${payable.length} slot${payable.length === 1 ? '' : 's'} confirmed.`, data: { bookingId: payable[0]!.booking.id, orderId: attempt.orderId } });
      await tx.insert(paymentEvents).values({ paymentAttemptId: attempt.id, provider: 'clink', eventType: 'payment_acknowledged', eventKey, providerReference: attempt.providerReference, payloadHash, processingResult: 'confirmed', processedAt: now });
      return 'confirmed';
    });
  }
}
