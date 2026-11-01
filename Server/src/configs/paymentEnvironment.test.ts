import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const productionEnvironment = {
  ...process.env,
  NODE_ENV: 'production',
  FRONTEND_ORIGINS: 'https://admin.example.test',
  REDIS_URL: 'redis://localhost:6379',
  DATABASE_URL: 'postgres://test:test@localhost:5432/turfbookpk_startup_test',
  JWT_ACCESS_SECRET: 'test-access-secret-for-startup-guard-only',
  SENSITIVE_DATA_HMAC_SECRET: 'test-sensitive-hmac-for-startup-guard-only',
  PAYOUT_ENCRYPTION_KEY: 'test-payout-key-for-startup-guard-only',
  PAYMENT_PII_ENCRYPTION_KEY: 'test-payment-key-for-startup-guard-only',
  PAYMENT_PII_HMAC_SECRET: 'test-payment-hmac-for-startup-guard-only',
  PAYMENT_PROVIDER: 'clink',
  PAYMENT_ENVIRONMENT: 'sandbox',
  CLINK_USERNAME: 'test-user',
  CLINK_PASSWORD: 'test-password',
};

function inspectStartup(flag: string, overrides: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "import './src/configs/env.ts'"], {
    cwd: process.cwd(),
    env: { ...productionEnvironment, CLINK_ALLOW_UNVERIFIED_SANDBOX_ACK: flag, ...overrides },
    encoding: 'utf8',
    timeout: 10_000,
  });
}

test('production refuses unsigned sandbox acknowledgments', () => {
  const rejected = inspectStartup('true');
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Unsigned Clink acknowledgments are forbidden in production/);

  const accepted = inspectStartup('false');
  assert.equal(accepted.status, 0, accepted.stderr);
});

test('production refuses missing database and weak authentication secrets', () => {
  const missingDatabase = inspectStartup('false', { DATABASE_URL: '' });
  assert.equal(missingDatabase.status, 1);
  assert.match(missingDatabase.stderr, /DATABASE_URL must be configured in production/);
  const weakJwt = inspectStartup('false', { JWT_ACCESS_SECRET: 'short' });
  assert.equal(weakJwt.status, 1);
  assert.match(weakJwt.stderr, /JWT_ACCESS_SECRET must contain at least 32 characters/);
});
