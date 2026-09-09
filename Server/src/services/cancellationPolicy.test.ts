import assert from 'node:assert/strict';
import test from 'node:test';
import { cancellationQuote } from './cancellationPolicy.js';

const now = new Date('2030-01-01T00:00:00.000Z');

test('unpaid cancellations never create refunds', () => {
  assert.deepEqual(cancellationQuote({ totalAmount: 2000, paymentStatus: 'pending', cancelledByVendor: false, startsAt: new Date(now.getTime() + 48 * 3_600_000), now }), { cancellationFee: 0, refundAmount: 0, refundRequired: false });
});

test('vendor cancellation gives a full refund', () => {
  assert.deepEqual(cancellationQuote({ totalAmount: 2000, paymentStatus: 'paid', cancelledByVendor: true, startsAt: new Date(now.getTime() + 60_000), now }), { cancellationFee: 0, refundAmount: 2000, refundRequired: true });
});

test('player cancellation applies deadline-based fees', () => {
  assert.equal(cancellationQuote({ totalAmount: 2000, paymentStatus: 'paid', cancelledByVendor: false, startsAt: new Date(now.getTime() + 25 * 3_600_000), now }).refundAmount, 2000);
  assert.deepEqual(cancellationQuote({ totalAmount: 2000, paymentStatus: 'paid', cancelledByVendor: false, startsAt: new Date(now.getTime() + 12 * 3_600_000), now }), { cancellationFee: 1000, refundAmount: 1000, refundRequired: true });
  assert.deepEqual(cancellationQuote({ totalAmount: 2000, paymentStatus: 'paid', cancelledByVendor: false, startsAt: new Date(now.getTime() + 60 * 60_000), now }), { cancellationFee: 2000, refundAmount: 0, refundRequired: false });
});
