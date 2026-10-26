import assert from 'node:assert/strict';
import test from 'node:test';
import { errorMetadata, redactOperationalData } from './operationalLogger.js';

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

test('production error metadata omits stacks unless explicitly enabled', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousStackFlag = process.env.LOG_ERROR_STACKS;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_ERROR_STACKS;
    assert.equal('error_stack' in errorMetadata(new Error('safe')), false);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousStackFlag === undefined) delete process.env.LOG_ERROR_STACKS; else process.env.LOG_ERROR_STACKS = previousStackFlag;
  }
});

test('operational logs redact configured gateway credentials embedded in messages', () => {
  const original = process.env.CLINK_PASSWORD;
  process.env.CLINK_PASSWORD = 'localTestOnlySecret123';
  try {
    const output = String(redactOperationalData('provider said password=localTestOnlySecret123 token=privateABC'));
    assert.doesNotMatch(output, /localTestOnlySecret123|privateABC/);
  } finally {
    if (original === undefined) delete process.env.CLINK_PASSWORD; else process.env.CLINK_PASSWORD = original;
  }
});
