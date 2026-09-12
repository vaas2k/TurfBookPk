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
