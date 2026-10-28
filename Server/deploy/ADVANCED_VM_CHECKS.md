    # Later Day 3 checks on the VirtualBox VM

First complete [the simple VirtualBox setup](VIRTUALBOX_REHEARSAL.md). That stack has one API, one worker, PostgreSQL, and Redis. It is a starting point for practice, not a capacity benchmark.

For the first multi-instance rehearsal, combine `compose.vm.yml` with `compose.ha-rehearsal.yml`. It starts a second API plus Nginx on VM localhost port `5080`; both APIs share PostgreSQL and Redis. Nginx uses passive failure detection and retries a safe request against the surviving upstream. It hides the private metrics path and adds `X-TurfBook-Rehearsal-Upstream` so the test can show which API responded.

```bash
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml -f deploy/compose.ha-rehearsal.yml up -d api api-replica api-proxy
curl -i http://127.0.0.1:5080/api/ready
```

Stop `api`, call the same proxy URL again, and confirm it remains 200. Start `api`, then stop `api-replica` and repeat. Restore both services when finished. The proxy is HTTP-only and bound to VM localhost for rehearsal; production still requires TLS and a real on-call/monitoring configuration. To access it from Windows, add an optional VirtualBox NAT rule from host `127.0.0.1:5580` to guest port `5080`.

For a production-like rehearsal, run two API replicas behind an HTTPS reverse proxy and two workers sharing Redis. Route API database connections through PgBouncer transaction pooling (`DB_POOL_MODE=transaction`), and connect workers and a single migration job directly to PostgreSQL or through session pooling. Apply migrations once before starting replicas.

The API-only PgBouncer rehearsal is provided by `compose.pgbouncer-rehearsal.yml`. Combine all three application files so only `api` and `api-replica` use the transaction pool; `worker` and `migrate` retain the direct database URL from `compose.vm.yml`.

```bash
sudo docker compose --env-file deploy/.env.vm \
  -f deploy/compose.vm.yml \
  -f deploy/compose.ha-rehearsal.yml \
  -f deploy/compose.pgbouncer-rehearsal.yml \
  up -d pgbouncer api api-replica api-proxy

curl -i http://127.0.0.1:5080/api/ready

sudo docker compose --env-file deploy/.env.vm \
  -f deploy/compose.vm.yml \
  -f deploy/compose.ha-rehearsal.yml \
  -f deploy/compose.pgbouncer-rehearsal.yml \
  exec -T pgbouncer sh -c \
  'PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p 5432 -U turfbookpk -d pgbouncer -c "SHOW POOLS;"'
```

The pinned PgBouncer 1.26.1 image includes the October 2026 security fixes. PgBouncer is internal-only and publishes no host port. `SHOW POOLS` must report `transaction` for `turfbookpk`. Do not route the worker or migration job through this pool.

Then check:

1. `/api/health` and `/api/ready` work through the proxy. Briefly interrupt PostgreSQL or Redis and confirm readiness becomes unavailable; restore the service.
2. Set `STAGING_API_URL` and run `node scripts/check-staging-day3.mjs` from `Server/`. Use a disposable `_loadtest` database for `node scripts/check-multi-instance.mjs`.
3. Inspect PgBouncer `SHOW POOLS` and PostgreSQL `pg_stat_activity` while the test runs. Keep server connections within your configured budget.
4. Apply `postgres-observability.conf.example` to the test database and verify slow query logging without query parameters or private customer data.
5. Stop one API and one worker while work is active. Check that the remaining replicas continue, queued jobs resume, and no duplicate database effects appear.
6. Compare discovery p95 and CPU with `API_COMPRESSION=true` and `false`. Check response cache headers and run `node scripts/check-public-media-cache.mjs` for public images.

Record VM CPU/RAM, request rate, p50/p95/p99, errors, database connections, and worker queue lag in `SCALABILITY_BASELINE.md`. Repeat the checks on hosted staging before using these numbers for production sizing.
