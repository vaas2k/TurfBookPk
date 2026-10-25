import assert from 'node:assert/strict';
import test from 'node:test';
import { buildClinkExpirationPayload, buildClinkPayload, clinkConsumerNumber, clinkPhone, MockPaymentProvider } from './paymentProvider.js';
import { decryptPaymentValue, encryptPaymentValue, paymentIdentifierFingerprint } from './sensitiveData.js';

test('mock provider returns a provider-neutral paid confirmation', async () => {
  const result = await new MockPaymentProvider().confirm({ bookingId: 'booking-id', amount: 1500, requestedReference: 'test-reference' });
  assert.equal(result.provider, 'mock');
  assert.equal(result.status, 'paid');
  assert.equal(result.providerReference, 'test-reference');
  assert.ok(result.paidAt instanceof Date);
});

test('Clink phone formatting accepts common Pakistani mobile formats', () => {
  assert.equal(clinkPhone('0300-1234567'), '00923001234567');
  assert.equal(clinkPhone('+92 300 1234567'), '00923001234567');
  assert.throws(() => clinkPhone('0211234567'), /Pakistani mobile/);
});

test('Clink consumer number is a six-digit prefix plus an 18-digit ID', () => {
  const value = clinkConsumerNumber('123456789012345678');
  assert.equal(value.length, 24);
  assert.equal(value, '100806123456789012345678');
  assert.throws(() => clinkConsumerNumber('123'), /invalid payment ID/);
});

test('payment PII encrypts round trip and fingerprints deterministically', () => {
  const plain = '37405-1234567-1';
  const encrypted = encryptPaymentValue(plain);
  assert.notEqual(encrypted, plain);
  assert.equal(decryptPaymentValue(encrypted), plain);
  assert.equal(paymentIdentifierFingerprint(plain), paymentIdentifierFingerprint('3740512345671'));
});

test('Clink request mapping uses configured identifiers and normalized payer fields', () => {
  const payload = buildClinkPayload({ amount: 1750, dueDate: '2026-10-18', applicantReference: 'TB-ATTEMPT', payer: { cnic: '3740512345671', fullName: 'Test Player', address: 'Rawalpindi', phone: '03001234567', email: 'player@example.test' } });
  assert.equal(payload.Client_ID, 1050);
  assert.equal(payload.Challan_ID, 105001);
  assert.equal(payload.Total_Amount, 1750);
  assert.equal(payload.Applicant_CellNo, '00923001234567');
  assert.equal(payload.Applicant_Ref, 'TB-ATTEMPT');
  assert.deepEqual(payload.Challan_Amount_Heads, [{ Amount_Head_ID: 105001001, Amount_Head_Title: 'Turf Booking Fee', Amount_Head_Value: 1750 }]);
});

test('Clink expiration request uses the 18-digit bill number and configured consumer', () => {
  assert.deepEqual(buildClinkExpirationPayload('105026101600046189'), {
    Bill_No: '105026101600046189',
    Consumer_ID: 77,
  });
  assert.throws(() => buildClinkExpirationPayload('100806105026101600046189'), /18 digits/);
});
