import assert from 'node:assert/strict';
import test from 'node:test';
import { canCancelBooking, paymentStatusForCancellation, slotState } from './bookingLifecycle.js';

test('only pending payment and confirmed bookings can be cancelled', () => {
  assert.equal(canCancelBooking('pending_payment'), true);
  assert.equal(canCancelBooking('confirmed'), true);
  assert.equal(canCancelBooking('completed'), false);
  assert.equal(canCancelBooking('cancelled'), false);
});

test('cancellation never marks unpaid or paid bookings as refunded', () => {
  assert.equal(paymentStatusForCancellation('pending'), 'cancelled');
  assert.equal(paymentStatusForCancellation('paid'), 'refund_pending');
  assert.equal(paymentStatusForCancellation('failed'), 'failed');
});

test('slot state derives an expired hold as available', () => {
  const now = new Date('2026-09-08T12:00:00.000Z');
  assert.equal(slotState({ isBooked: false, isBlocked: false, holdExpiresAt: new Date('2026-09-08T12:01:00.000Z'), now }), 'held');
  assert.equal(slotState({ isBooked: false, isBlocked: false, holdExpiresAt: new Date('2026-09-08T11:59:00.000Z'), now }), 'available');
  assert.equal(slotState({ isBooked: true, isBlocked: false, holdExpiresAt: null, now }), 'booked');
  assert.equal(slotState({ isBooked: false, isBlocked: true, holdExpiresAt: null, now }), 'blocked');
});
