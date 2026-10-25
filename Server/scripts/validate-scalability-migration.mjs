import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const filename = process.argv[2] || '0024_scalability_query_indexes.sql';
if (!/^002[45]_scalability_[a-z_]+\.sql$/.test(filename) && !/^002[67]_(schedule_horizon_lookup|schedule_identity_constraints)\.sql$/.test(filename)) throw new Error('Invalid scalability migration filename');
const sql = await readFile(new URL(`../drizzle/${filename}`, import.meta.url), 'utf8');
const rollback = new Error('validation rollback');
try {
  await client.begin(async (tx) => {
    await tx.unsafe(sql);
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) {
    console.error('Migration validation failed:', error.code || '', error.message);
    process.exitCode = 1;
  } else {
    console.log(`${filename} is valid; validation transaction rolled back.`);
  }
} finally {
  await client.end();
}
