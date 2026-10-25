# Local VPS rehearsal for Day 3

Use a disposable Linux VM and the synthetic `_loadtest` database. Keep the VM separate from the ordinary development database and do not copy Clink, SMS, or production secrets into it.

## Process layout

| Process | Database connection | Pool mode |
| --- | --- | --- |
| API replica 1 and 2 | PgBouncer transaction endpoint | `DB_POOL_MODE=transaction` |
| Worker 1 and 2 | Direct PostgreSQL or session pool | `DB_POOL_MODE=direct` or `session` |
| One migration job | Direct PostgreSQL or session pool | `DB_POOL_MODE=direct` or `session` |
| All processes | Same Redis instance | `REDIS_URL` configured |

Put an HTTPS reverse proxy in front of the two API replicas. Set `TRUST_PROXY_HOPS` to the actual proxy hop count after checking forwarded IP headers. Keep worker and migration traffic away from the API transaction pool. Apply `npm run db:migrate` once before starting API/worker replicas. Do not run migrations in each replica's startup command.

## Rehearsal checks

1. Confirm `GET /api/health` and `GET /api/ready` return 200 through the proxy. Stop Redis or PostgreSQL briefly and confirm readiness turns 503 while liveness remains responsive; restore both before proceeding.
2. Set `STAGING_API_URL` to the VM's HTTPS API origin and run `node scripts/check-staging-day3.mjs` from `Server/`. Optionally set `STAGING_DIRECT_DATABASE_URL` for safe, read-only connection/logging checks.
3. Run the isolated two-API/two-worker drill with `node scripts/check-multi-instance.mjs` against the VM's `_loadtest` database. It checks shared rate limiting and one notification outbox delivery.
4. Confirm the API connects through PgBouncer transaction pooling while workers and migrations use direct/session connections. Inspect PgBouncer `SHOW POOLS` and PostgreSQL `pg_stat_activity` during the drill; keep total server connections under the configured budget.
5. Apply the host's slow-query settings from `postgres-observability.conf.example`, verify parameter logging is disabled, and check that a deliberately slow synthetic query appears in restricted PostgreSQL logs. Do not log real payer or identity data.
6. Send `SIGTERM` to one API and one worker while requests/jobs are active. Confirm API readiness fails during drain, current work finishes within `SHUTDOWN_GRACE_MS`, and the remaining replicas continue serving. Restart and confirm queued outbox work resumes without duplicate database effects.
7. Compare discovery p95 and host CPU with `API_COMPRESSION=true` and `false`. If Nginx handles compression, disable API compression to avoid competing work. Confirm `Cache-Control: no-store` on dynamic discovery/detail and ETag/304 on metadata.
8. Verify a public Cloudinary image returns an ETag and cache header with `node scripts/check-public-media-cache.mjs`; private verification documents must never appear in public ground responses.

Record the VM CPU/RAM, PostgreSQL `max_connections`, PgBouncer pool sizes, request rate, p50/p95/p99, errors, and worker queue lag in `SCALABILITY_BASELINE.md`. Repeat the same checks on the actual hosted staging environment before claiming a production capacity ceiling.
