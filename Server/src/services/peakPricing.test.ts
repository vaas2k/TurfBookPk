import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveSlotPrice, isPeakSlot } from './peakPricing.js';

const windows = [{ days: [5, 6], startTime: '18:00', endTime: '22:00' }];

test('peak pricing applies only to slots fully within a Pakistan-local peak window', () => {
  assert.equal(isPeakSlot('2026-09-11', '18:00', '19:00', windows), true);
  assert.deepEqual(effectiveSlotPrice('2026-09-11', '18:00', '19:00', { basePrice: 2_000, peakPercentage: 25, peakWindows: windows }), { amount: 2_500, isPeak: true });
  assert.equal(isPeakSlot('2026-09-11', '21:00:00', '22:00:00', windows), true);
  assert.deepEqual(effectiveSlotPrice('2026-09-11', '17:30', '18:30', { basePrice: 2_000, peakPercentage: 25, peakWindows: windows }), { amount: 2_000, isPeak: false });
  assert.equal(isPeakSlot('2026-09-10', '18:00', '19:00', windows), false);
});

test('overnight peak pricing follows the configured start day across midnight', () => {
  const overnight = [{ days: [5], startTime: '20:00', endTime: '01:00', endNextDay: true }];
  assert.equal(isPeakSlot('2026-09-11', '20:00', '21:00', overnight), true);
  assert.equal(isPeakSlot('2026-09-11', '23:30', '00:30', overnight), true);
  assert.equal(isPeakSlot('2026-09-12', '00:00', '01:00', overnight), true);
  assert.equal(isPeakSlot('2026-09-12', '01:00', '02:00', overnight), false);
  assert.equal(isPeakSlot('2026-09-13', '00:00', '01:00', overnight), false);
});
