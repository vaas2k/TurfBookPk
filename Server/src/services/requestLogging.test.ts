import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldLogHttpRequest } from './requestLogging.js';

test('request logging never samples errors or slow requests', () => {
  assert.equal(shouldLogHttpRequest(500, 10, 0, () => 1), true);
  assert.equal(shouldLogHttpRequest(404, 10, 0, () => 1), true);
  assert.equal(shouldLogHttpRequest(200, 1_000, 0, () => 1), true);
});

test('request logging samples only ordinary successful requests', () => {
  assert.equal(shouldLogHttpRequest(200, 50, 0, () => 0), false);
  assert.equal(shouldLogHttpRequest(204, 50, 1, () => 1), true);
  assert.equal(shouldLogHttpRequest(200, 50, 0.25, () => 0.2), true);
  assert.equal(shouldLogHttpRequest(200, 50, 0.25, () => 0.3), false);
});
