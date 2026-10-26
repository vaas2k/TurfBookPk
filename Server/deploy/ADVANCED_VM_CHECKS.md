    # Later Day 3 checks on the VirtualBox VM

First complete [the simple VirtualBox setup](VIRTUALBOX_REHEARSAL.md). That stack has one API, one worker, PostgreSQL, and Redis. It is a starting point for practice, not a capacity benchmark.

For a multi-instance rehearsal, run two API replicas behind an HTTPS reverse proxy and two workers sharing Redis. Route API database connections through PgBouncer transaction pooling (`DB_POOL_MODE=transaction`), and connect workers and a single migration job directly to PostgreSQL or through session pooling. Apply migrations once before starting replicas.

Then check:

1. `/api/health` and `/api/ready` work through the proxy. Briefly interrupt PostgreSQL or Redis and confirm readiness becomes unavailable; restore the service.
2. Set `STAGING_API_URL` and run `node scripts/check-staging-day3.mjs` from `Server/`. Use a disposable `_loadtest` database for `node scripts/check-multi-instance.mjs`.
3. Inspect PgBouncer `SHOW POOLS` and PostgreSQL `pg_stat_activity` while the test runs. Keep server connections within your configured budget.
4. Apply `postgres-observability.conf.example` to the test database and verify slow query logging without query parameters or private customer data.
5. Stop one API and one worker while work is active. Check that the remaining replicas continue, queued jobs resume, and no duplicate database effects appear.
6. Compare discovery p95 and CPU with `API_COMPRESSION=true` and `false`. Check response cache headers and run `node scripts/check-public-media-cache.mjs` for public images.

Record VM CPU/RAM, request rate, p50/p95/p99, errors, database connections, and worker queue lag in `SCALABILITY_BASELINE.md`. Repeat the checks on hosted staging before using these numbers for production sizing.
