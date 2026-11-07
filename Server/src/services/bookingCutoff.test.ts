import assert from 'node:assert/strict';
import test from 'node:test';
import { isInsideBookingCutoff } from './bookingCutoff.js';

const now = new Date('2026-11-04T12:00:00+05:00').getTime();

test('slot becomes unavailable exactly 15 minutes before start', () => {
  assert.equal(isInsideBookingCutoff('2026-11-04', '12:15', now, 15), true);
  assert.equal(isInsideBookingCutoff('2026-11-04', '12:16', now, 15), false);
});
