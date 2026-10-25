import assert from 'node:assert/strict';
import test from 'node:test';
import { expiryRetryDelayMs, MAX_EXPIRY_ATTEMPTS } from './paymentExpiryRetry.js';

test('Clink expiry retries use bounded exponential backoff', () => {
  assert.equal(MAX_EXPIRY_ATTEMPTS, 6);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(expiryRetryDelayMs), [60_000, 120_000, 240_000, 480_000, 960_000, 1_800_000]);
});
