import { createHash, randomUUID } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { AppError } from '../helpers/errors.js';
import { env } from '../configs/env.js';
import { errorMetadata, logEvent } from './operationalLogger.js';

export interface PaymentConfirmationInput {
  bookingId: string;
  amount: number;
  requestedReference?: string | null;
}

export interface PaymentConfirmation {
  provider: string;
  providerReference: string;
  status: 'paid';
  paidAt: Date;
}

export interface PaymentProvider {
  confirm(input: PaymentConfirmationInput): Promise<PaymentConfirmation>;
}

export type ClinkPayer = { cnic: string; fullName: string; address: string; phone: string; email: string };
export type ClinkReferenceInput = { amount: number; dueDate: string; applicantReference: string; payer: ClinkPayer; diagnostics?: { requestId?: string; paymentAttemptId?: string } };
export type ClinkReference = { provider: 'clink'; clinkId: string; consumerNumber: string };
export type ClinkExpirationInput = { clinkId: string; diagnostics?: { requestId?: string; paymentAttemptId?: string } };
export interface ReferencePaymentProvider {
  generateReference(input: ClinkReferenceInput): Promise<ClinkReference>;
  expireReference(input: ClinkExpirationInput): Promise<void>;
}

function requestJson<T>(urlValue: string, method: 'GET' | 'POST', body: string, contentType: string, authorization?: string, allowErrorJson = false): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlValue);
    const request = httpsRequest(url, { method, headers: { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(body), ...(authorization ? { Authorization: authorization } : {}) }, timeout: 15_000 }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const status = response.statusCode || 0;
        if ((status < 200 || status >= 300) && !allowErrorJson) return reject(new AppError(status === 401 ? 'payment_provider_auth_failed' : 'payment_provider_error', `Clink returned HTTP ${status}`, 502));
        try { resolve(JSON.parse(text) as T); } catch { reject(new AppError('payment_provider_invalid_response', `Clink returned non-JSON with HTTP ${status}`, 502)); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Clink request timed out')));
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

export function clinkPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('92') ? digits.slice(2) : digits.startsWith('0') ? digits.slice(1) : digits;
  if (!/^3\d{9}$/.test(local)) throw new AppError('invalid_billing_profile', 'Enter a valid Pakistani mobile number', 422);
  return `0092${local}`;
}

export function clinkConsumerNumber(clinkId: string): string {
  if (!/^\d{18}$/.test(clinkId)) throw new AppError('payment_provider_invalid_response', 'Clink returned an invalid payment ID', 502);
  return `${env.clinkBillerPrefix}${clinkId}`;
}

export function buildClinkPayload(input: ClinkReferenceInput) {
  return {
    Client_ID: env.clinkClientId, Challan_ID: env.clinkChallanId, Total_Amount: input.amount,
    Master_Category: env.clinkMasterCategory, Challan_Category: env.clinkChallanCategory, Due_Date: input.dueDate,
    Consumer_ID: env.clinkConsumerId, Applicant_CNIC: input.payer.cnic, Applicant_Name: input.payer.fullName,
    Applicant_Father_Name: input.payer.address, Applicant_CellNo: clinkPhone(input.payer.phone), Applicant_Email: input.payer.email,
    Applicant_Ref: input.applicantReference,
    Challan_Amount_Heads: [{ Amount_Head_ID: env.clinkAmountHeadId, Amount_Head_Title: env.clinkAmountHeadTitle, Amount_Head_Value: input.amount }],
  };
}

export function buildClinkExpirationPayload(clinkId: string) {
  if (!/^\d{18}$/.test(clinkId)) throw new AppError('invalid_payment_reference', 'Clink ID must contain exactly 18 digits', 422);
  return { Bill_No: clinkId, Consumer_ID: env.clinkConsumerId };
}

export class ClinkPaymentProvider {
  private async accessToken(context: Record<string, unknown>): Promise<string> {
    logEvent('info', 'clink_token_request_started', { ...context, endpoint_host: new URL(env.clinkTokenUrl).host });
    const tokenBody = new URLSearchParams({ grant_type: 'password', username: env.clinkUsername, password: env.clinkPassword }).toString();
    const token = await requestJson<{ access_token?: string; error?: string; error_description?: string }>(env.clinkTokenUrl, 'GET', tokenBody, 'application/x-www-form-urlencoded', undefined, true);
    if (!token.access_token) throw new AppError('payment_provider_auth_failed', token.error === 'invalid_grant' ? 'Clink rejected the configured sandbox username or password' : 'Clink did not return an access token', 502);
    logEvent('info', 'clink_token_request_succeeded', context);
    return token.access_token;
  }

  async generateReference(input: ClinkReferenceInput): Promise<ClinkReference> {
    const context = { request_id: input.diagnostics?.requestId, payment_attempt_id: input.diagnostics?.paymentAttemptId, applicant_reference: input.applicantReference, amount: input.amount };
    try {
      const accessToken = await this.accessToken(context);
      const payload = buildClinkPayload(input);
      logEvent('info', 'clink_reference_request_started', { ...context, endpoint_host: new URL(env.clinkGenerateUrl).host, due_date: input.dueDate });
      const result = await requestJson<{ CLINK_ID?: string; Error_Msg?: string; Error_detail?: string; Message?: string }>(env.clinkGenerateUrl, 'POST', JSON.stringify(payload), 'application/json', `Bearer ${accessToken}`);
      if (!result.CLINK_ID) {
        const providerMessageHash = createHash('sha256').update(result.Error_Msg || result.Error_detail || result.Message || 'missing_error_message').digest('hex').slice(0, 16);
        logEvent('warn', 'clink_reference_rejected', { ...context, provider_message_hash: providerMessageHash });
        throw new AppError('payment_reference_rejected', `Clink rejected the payment reference (provider message hash: ${providerMessageHash})`, 422);
      }
      logEvent('info', 'clink_reference_request_succeeded', { ...context, clink_id_suffix: result.CLINK_ID.slice(-6) });
      return { provider: 'clink', clinkId: result.CLINK_ID, consumerNumber: clinkConsumerNumber(result.CLINK_ID) };
    } catch (error) {
      logEvent('error', 'clink_provider_request_failed', { ...context, ...errorMetadata(error) });
      throw error;
    }
  }

  async expireReference(input: ClinkExpirationInput): Promise<void> {
    const context = { request_id: input.diagnostics?.requestId, payment_attempt_id: input.diagnostics?.paymentAttemptId, clink_id_suffix: input.clinkId.slice(-6) };
    try {
      const accessToken = await this.accessToken(context);
      logEvent('info', 'clink_expiration_request_started', { ...context, endpoint_host: new URL(env.clinkExpireUrl).host });
      const result = await requestJson<{ Status?: number; Error_Detail?: string; Message?: string }>(env.clinkExpireUrl, 'POST', JSON.stringify(buildClinkExpirationPayload(input.clinkId)), 'application/json', `Bearer ${accessToken}`);
      const alreadyExpired = result.Status === 0 && /already.+expired/i.test(result.Error_Detail || '');
      if (result.Status !== 1 && !alreadyExpired) {
        const providerMessageHash = createHash('sha256').update(result.Error_Detail || result.Message || 'missing_error_message').digest('hex').slice(0, 16);
        throw new AppError('payment_reference_expiration_failed', `Clink could not expire the payment reference (provider message hash: ${providerMessageHash})`, 502);
      }
      logEvent('info', 'clink_expiration_request_succeeded', { ...context, idempotent: alreadyExpired });
    } catch (error) {
      logEvent('error', 'clink_expiration_request_failed', { ...context, ...errorMetadata(error) });
      throw error;
    }
  }
}

export function referencePaymentProvider(): ReferencePaymentProvider {
  if (env.paymentProvider === 'clink') return new ClinkPaymentProvider();
  throw new AppError('payment_provider_unavailable', 'A reference payment provider is not configured', 503);
}

export class MockPaymentProvider implements PaymentProvider {
  async confirm(input: PaymentConfirmationInput): Promise<PaymentConfirmation> {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('payment_provider_required', 'Mock payment confirmation is disabled in production', 403);
    }
    return {
      provider: 'mock',
      providerReference: input.requestedReference?.trim().slice(0, 128) || `mock-${input.bookingId}-${randomUUID().slice(0, 8)}`,
      status: 'paid',
      paidAt: new Date(),
    };
  }
}
