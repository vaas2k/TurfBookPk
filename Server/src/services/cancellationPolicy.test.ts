import assert from 'node:assert/strict';
import test from 'node:test';
import { cancellationQuote } from './cancellationPolicy.js';

const now = new Date('2030-01-01T00:00:00.000Z');

test('unpaid cancellations never create refunds', () => {
  assert.equal(cancellationQuote({ amountPaid: 2000, paymentStatus: 'pending', cancelledByVendor: false, startsAt: new Date(now.getTime() + 48 * 3_600_000), bookedAt: new Date(now.getTime() - 60_000), policy: 'standard', now }).refundAmount, 0);
});

test('vendor cancellation gives a full refund', () => {
  assert.equal(cancellationQuote({ amountPaid: 2000, paymentStatus: 'paid', cancelledByVendor: true, startsAt: new Date(now.getTime() + 60_000), bookedAt: new Date(now.getTime() - 60_000), policy: 'standard', now }).refundAmount, 2000);
});

test('policy tiers use the more generous tier at exact boundaries', () => {
  const input = { amountPaid: 2000, paymentStatus: 'paid', cancelledByVendor: false, bookedAt: new Date(now.getTime() - 60 * 60_000), policy: 'standard' as const, now };
  assert.equal(cancellationQuote({ ...input, startsAt: new Date(now.getTime() + 12 * 3_600_000) }).refundAmount, 1500);
  assert.equal(cancellationQuote({ ...input, startsAt: new Date(now.getTime() + 6 * 3_600_000) }).refundAmount, 1000);
  assert.equal(cancellationQuote({ ...input, startsAt: new Date(now.getTime() + 60 * 60_000) }).refundAmount, 0);
});

test('grace window overrides an otherwise no-refund tier', () => {
  const quote = cancellationQuote({ amountPaid: 1850, paymentStatus: 'paid', cancelledByVendor: false, startsAt: new Date(now.getTime() + 30 * 60_000), bookedAt: new Date(now.getTime() - 4 * 60_000), policy: 'strict', now });
  assert.equal(quote.refundAmount, 1850);
  assert.equal(quote.withinGraceWindow, true);
});
