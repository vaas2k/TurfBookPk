import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cacheAccess, metricsTokenValid, renderMetrics, requestFinished, requestStarted } from './metrics.js';

test('metrics token is required and route labels never use a supplied URL', () => {
  assert.equal(metricsTokenValid(undefined, 'a'.repeat(32)), false);
  assert.equal(metricsTokenValid('wrong', 'a'.repeat(32)), false);
  assert.equal(metricsTokenValid('a'.repeat(32), 'a'.repeat(32)), true);
  requestStarted();
  requestFinished('GET', '/api/grounds/:id', 200, 0.12);
  requestStarted();
  requestFinished('GET', '/api/grounds/12345?phone=923001234567', 500, 0.6);
  cacheAccess('discovery', 'hit');
  const body = renderMetrics({ outboxPending: 2, outboxDead: 0, outboxOldestSeconds: 10, paymentPending: 1, paymentManualReview: 0, paymentExpiryRetry: 0 }, { 'notification_outbox:retry': '3', 'bad\nlabel:failure': '9' });
  assert.match(body, /route="\/api\/grounds\/:id"/);
  assert.match(body, /route="unmatched"/);
  assert.doesNotMatch(body, /923001234567/);
  assert.match(body, /turfbook_outbox_pending 2/);
  assert.match(body, /turfbook_cache_access_total\{kind="discovery",outcome="hit"\} 1/);
  assert.match(body, /turfbook_worker_jobs_total\{job="notification_outbox",result="retry"\} 3/);
  assert.doesNotMatch(body, /bad\nlabel/);
  assert.equal(body.endsWith('\n'), true);
});
