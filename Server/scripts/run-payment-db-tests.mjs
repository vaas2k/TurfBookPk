// Run payment integration tests only against an isolated local database.
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const source = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1'].includes(source.hostname)) throw new Error('Payment DB tests require local PostgreSQL');
source.pathname = '/turfbookpk_payment_loadtest';
const environment = {
  ...process.env,
  DATABASE_URL: source.toString(),
  NODE_ENV: 'test',
  PAYMENT_PROVIDER: process.argv.includes('--clink') || process.argv.includes('--all') ? 'clink' : 'mock',
  CLINK_USERNAME: 'isolated-test-user',
  CLINK_PASSWORD: 'isolated-test-password',
  CLINK_ALLOW_UNVERIFIED_SANDBOX_ACK: 'false',
};

const all = process.argv.includes('--all');
for (const args of [
  ['scripts/migrate-locked.mjs'],
  all
    ? ['node_modules/tsx/dist/cli.mjs', '--test', '--test-concurrency=1', 'src/**/*.test.ts']
    : ['--import', 'tsx', '--test', '--test-isolation=none', 'src/controllers/paymentConfirmation.integration.test.ts', ...(process.argv.includes('--clink') ? ['src/controllers/paymentReference.integration.test.ts'] : [])],
]) {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
