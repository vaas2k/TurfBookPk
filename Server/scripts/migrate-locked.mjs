import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for migrations');
if (process.env.DB_POOL_MODE === 'transaction') throw new Error('Migrations require direct PostgreSQL or session pooling for advisory locks');

// All deployments must run this single migration job before starting replicas.
// A session lock serializes concurrent invocations of this script.
const client = postgres(databaseUrl, { max: 2, prepare: false, connect_timeout: 10 });
let reserved;
let lockHeld = false;
try {
  reserved = await client.reserve();
  await reserved`SET lock_timeout = '60s'`;
  await reserved`SELECT pg_advisory_lock(728614, 1)`;
  lockHeld = true;
  console.log('Migration lock acquired');
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  console.log('Migrations complete');
} finally {
  if (reserved) {
    try { if (lockHeld) await reserved`SELECT pg_advisory_unlock(728614, 1)`; } finally { reserved.release(); }
  }
  await client.end();
}
