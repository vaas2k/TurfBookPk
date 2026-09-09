import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBookingPrice } from './bookingPricing.js';

test('booking pricing calculates a deterministic commission split', () => {
  assert.deepEqual(calculateBookingPrice(2_000, 500), {
    totalAmount: 2_000,
    platformFee: 100,
    vendorAmount: 1_900,
  });
  assert.deepEqual(calculateBookingPrice(2_000, 0), {
    totalAmount: 2_000,
    platformFee: 0,
    vendorAmount: 2_000,
  });
});

test('booking pricing rejects invalid inputs', () => {
  assert.throws(() => calculateBookingPrice(-1, 0));
  assert.throws(() => calculateBookingPrice(1_000, 10_001));
});
