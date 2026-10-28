export function databaseStartupOptions(
  poolMode: string,
  statementTimeoutMs: number,
  lockTimeoutMs: number,
) {
  if (poolMode === "transaction") return {};
  return {
    connection: {
      statement_timeout: statementTimeoutMs,
      lock_timeout: lockTimeoutMs,
    },
  };
}
