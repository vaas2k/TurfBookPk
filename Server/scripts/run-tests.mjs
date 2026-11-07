import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tsxCli = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));

// Reference-generation integration tests use an injected fake provider, but
// exercise the Clink-configured checkout path. Give the suite inert credentials
// so it behaves the same with or without a developer's untracked .env file.
const env = {
  ...process.env,
  NODE_ENV: 'test',
  PAYMENT_PROVIDER: 'clink',
  PAYMENT_ENVIRONMENT: 'sandbox',
  CLINK_USERNAME: 'test-only-user',
  CLINK_PASSWORD: 'test-only-password',
  CLINK_ALLOW_UNVERIFIED_SANDBOX_ACK: 'false',
};

const result = spawnSync(process.execPath, [tsxCli, '--test', 'src/**/*.test.ts'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
if (result.error) {
  console.error(result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
