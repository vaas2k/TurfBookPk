import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../configs/env.js';
import { logEvent } from '../services/operationalLogger.js';
import * as schema from './schema.js';

export const sql = postgres(env.databaseUrl, {
  max: env.dbPoolMax,
  prepare: false,
  connect_timeout: env.dbConnectTimeoutSeconds,
  idle_timeout: env.dbIdleTimeoutSeconds,
  connection: { statement_timeout: env.dbStatementTimeoutMs, lock_timeout: env.dbLockTimeoutMs },
});

export const db = drizzle(sql, { schema });

logEvent('info', 'database_client_initialized', { pool_max: env.dbPoolMax, statement_timeout_ms: env.dbStatementTimeoutMs });


