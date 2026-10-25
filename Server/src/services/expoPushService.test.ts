import assert from 'node:assert/strict';
import test from 'node:test';
import { parseExpoResponse } from './expoPushService.js';

test('Expo responses are parsed within the configured size bound', async () => {
  const payload = await parseExpoResponse<{ data: string }>(new Response(JSON.stringify({ data: 'ok' })));
  assert.equal(payload.data, 'ok');
  await assert.rejects(parseExpoResponse(new Response('x'.repeat(512 * 1024 + 1))), /size limit/);
});
