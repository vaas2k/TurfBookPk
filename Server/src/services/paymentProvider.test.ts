import assert from 'node:assert/strict';
import test from 'node:test';
import { MockPaymentProvider } from './paymentProvider.js';

test('mock provider returns a provider-neutral paid confirmation', async () => {
  const result = await new MockPaymentProvider().confirm({ bookingId: 'booking-id', amount: 1500, requestedReference: 'test-reference' });
  assert.equal(result.provider, 'mock');
  assert.equal(result.status, 'paid');
  assert.equal(result.providerReference, 'test-reference');
  assert.ok(result.paidAt instanceof Date);
});
