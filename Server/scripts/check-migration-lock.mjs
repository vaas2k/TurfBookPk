import 'dotenv/config';
import { spawn } from 'node:child_process';
import postgres from 'postgres';

if (!process.env.DATABASE_URL || process.env.NODE_ENV === 'production') throw new Error('Use a non-production DATABASE_URL');
const url = new URL(process.env.DATABASE_URL);
const databaseName = decodeURIComponent(url.pathname.slice(1));
if (!databaseName) throw new Error('DATABASE_URL must name a database');
url.pathname = `/${databaseName.endsWith('_loadtest') ? databaseName : `${databaseName}_loadtest`}`;
const client = postgres(url.toString(), { max: 1, prepare: false, connect_timeout: 5 });
const reserved = await client.reserve();
let child;
let lockHeld = false;
try {
  await reserved`SELECT pg_advisory_lock(728614, 1)`;
  lockHeld = true;
  child = spawn(process.execPath, ['scripts/migrate-locked.mjs'], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: ['ignore', 'pipe', 'pipe'] });
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
    setTimeout(() => reject(new Error('Migrator did not finish after lock release')), 10_000).unref();
  });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (part) => { output += part; });
  child.stderr.setEncoding('utf8').on('data', (part) => { output += part; });
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (child.exitCode !== null || output.includes('Migration lock acquired')) throw new Error('Migrator did not wait for the lock');
  await reserved`SELECT pg_advisory_unlock(728614, 1)`;
  lockHeld = false;
  const exitCode = await completion;
  if (exitCode !== 0 || !output.includes('Migrations complete')) throw new Error(`Migrator failed after lock release: ${output.slice(-500)}`);
  console.log(JSON.stringify({ database: databaseName.endsWith('_loadtest') ? databaseName : `${databaseName}_loadtest`, waited_for_lock: true, migrated_after_release: true }));
} finally {
  child?.kill();
  if (lockHeld) await reserved`SELECT pg_advisory_unlock(728614, 1)`;
  reserved.release();
  await client.end();
}
