import assert from 'node:assert/strict';
import test from 'node:test';
import { redactOperationalData } from './operationalLogger.js';

test('operational logs redact sensitive fields and identifiers', () => {
  const result = JSON.stringify(redactOperationalData({
    authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature',
    phone: '+923001234567',
    cnic: '35202-1234567-1',
    iban: 'PK36SCBL0000001123456702',
    error_message: 'push ExpoPushToken[abc-secret] failed for +923001234567',
  }));

  assert.ok(!result.includes('923001234567'));
  assert.ok(!result.includes('35202-1234567-1'));
  assert.ok(!result.includes('PK36SCBL0000001123456702'));
  assert.ok(!result.includes('ExpoPushToken[abc-secret]'));
  assert.ok(!result.includes('eyJhbGciOiJIUzI1NiJ9'));
  assert.match(result, /\[redacted\]/);
});
