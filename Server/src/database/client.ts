import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../configs/env.js';
import { logEvent } from '../services/operationalLogger.js';
import * as schema from './schema.js';

export const sql = postgres(env.databaseUrl, {
  max: env.nodeEnv === 'production' ? 10 : 3,
  prepare: false,
});

export const db = drizzle(sql, { schema });

logEvent('info', 'database_client_initialized');


