import assert from 'node:assert/strict';
import test from 'node:test';
import { acknowledgmentTime } from './paymentController.js';

test('Clink payment time is parsed from Pakistan local time into UTC', () => {
  assert.equal(acknowledgmentTime('2026-10-30 12:15:00').toISOString(), '2026-10-30T07:15:00.000Z');
});

test('Clink payment time rejects impossible and malformed dates', () => {
  for (const value of ['2026-02-31 23:00:00', '2026-10-30 24:00:00', '2026-10-30 12:60:00', '2026-10-30T12:15:00']) {
    assert.throws(() => acknowledgmentTime(value), (error: any) => error.code === 'invalid_acknowledgment');
  }
});
