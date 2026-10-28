import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../configs/env.js";
import { logEvent } from "../services/operationalLogger.js";
import { databaseStartupOptions } from "./clientOptions.js";
import * as schema from "./schema.js";

const transactionPooled = env.dbPoolMode === "transaction";

export const sql = postgres(env.databaseUrl, {
  max: env.dbPoolMax,
  prepare: false,
  connect_timeout: env.dbConnectTimeoutSeconds,
  idle_timeout: env.dbIdleTimeoutSeconds,
  // PgBouncer transaction pooling rejects these PostgreSQL startup parameters
  // and cannot safely preserve per-client session state. The pooler enforces
  // query/query-wait limits for API connections instead. Direct and session
  // clients continue to use PostgreSQL's statement and lock timeouts.
  ...databaseStartupOptions(
    env.dbPoolMode,
    env.dbStatementTimeoutMs,
    env.dbLockTimeoutMs,
  ),
});

export const db = drizzle(sql, { schema });

logEvent("info", "database_client_initialized", {
  pool_max: env.dbPoolMax,
  pool_mode: env.dbPoolMode,
  timeout_enforcement: transactionPooled ? "pooler" : "postgresql",
  statement_timeout_ms: env.dbStatementTimeoutMs,
});
