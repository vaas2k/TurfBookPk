import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import postgres from 'postgres';

if (process.env.NODE_ENV === 'production') throw new Error('Do not create a load-test database from a production environment');
const sourceUrl = new URL(process.env.DATABASE_URL || '');
const sourceName = decodeURIComponent(sourceUrl.pathname.slice(1));
const targetName = `${sourceName}_loadtest`;
if (!/^[a-zA-Z][a-zA-Z0-9_]{0,50}_loadtest$/.test(targetName)) throw new Error('Unsafe database name');
const targetUrl = new URL(sourceUrl);
targetUrl.pathname = `/${targetName}`;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
const admin = postgres(adminUrl.toString(), { max: 1, prepare: false });
try {
  const existing = await admin.unsafe('select datname from pg_database where datname = $1', [targetName]);
  if (!existing.length) {
    await admin.unsafe(`create database "${targetName}"`);
    console.log(`Created isolated database ${targetName}.`);
  } else {
    console.log(`Using existing isolated database ${targetName}.`);
  }
} finally {
  await admin.end();
}

const environment = { ...process.env, DATABASE_URL: targetUrl.toString(), ALLOW_SCALABILITY_SEED: 'true' };
const run = (args) => {
  const result = spawnSync(process.execPath, args, { cwd: new URL('..', import.meta.url), env: environment, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Node task ${args.join(' ')} failed`);
};
run(['node_modules/drizzle-kit/bin.cjs', 'migrate']);
if (!process.argv.includes('--migrate-only')) run(['scripts/seed-scalability.mjs', ...(process.argv.includes('--small') ? ['--small'] : [])]);
console.log(`Load-test database ready: ${targetName}. Set DATABASE_URL to its URL only for staging API/load tests.`);
