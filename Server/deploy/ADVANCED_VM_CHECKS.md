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

The pinned PgBouncer 1.26.1 image includes the October 2026 security fixes. PgBouncer is internal-only and publishes no host port. `SHOW POOLS` must report `transaction` for `turfbookpk`. API clients omit PostgreSQL session startup timeouts because transaction pooling cannot preserve them; this rehearsal uses PgBouncer's 15-second query timeout and 10-second pool-wait timeout instead. Do not route the worker or migration job through this pool.

Run `bash deploy/test-pgbouncer-vm.sh` to create 30 read-only three-second clients. During the load, `SHOW POOLS` should show clients active/waiting while server connections remain bounded by `default_pool_size = 10`; the script also prints the direct PostgreSQL active-connection count and verifies proxy readiness afterward. It performs no writes.

Then check:

1. `/api/health` and `/api/ready` work through the proxy. Briefly interrupt PostgreSQL or Redis and confirm readiness becomes unavailable; restore the service.
2. Set `STAGING_API_URL` and run `node scripts/check-staging-day3.mjs` from `Server/`. Use a disposable `_loadtest` database for `node scripts/check-multi-instance.mjs`.
3. Inspect PgBouncer `SHOW POOLS` and PostgreSQL `pg_stat_activity` while the test runs. Keep server connections within your configured budget.
4. Apply `postgres-observability.conf.example` to the test database and verify slow query logging without query parameters or private customer data.
5. Stop one API and one worker while work is active. Check that the remaining replicas continue, queued jobs resume, and no duplicate database effects appear.
6. Compare discovery p95 and CPU with `API_COMPRESSION=true` and `false`. Check response cache headers and run `node scripts/check-public-media-cache.mjs` for public images.

Record VM CPU/RAM, request rate, p50/p95/p99, errors, database connections, and worker queue lag in `SCALABILITY_BASELINE.md`. Repeat the checks on hosted staging before using these numbers for production sizing.

## Booking-write rehearsal

Run this only after the isolated `turfbookpk_loadtest` seed and the load-test Compose overlay are active. It creates 50 temporary player sessions and submits 50 different booking holds through Nginx, both API replicas, and PgBouncer. It waits for in-flight requests, deletes only its own bookings/sessions, and verifies that no selected slot remains held. The normal rehearsal database is not a target.

```bash
files="-f deploy/compose.vm.yml -f deploy/compose.ha-rehearsal.yml -f deploy/compose.pgbouncer-rehearsal.yml -f deploy/compose.loadtest-rehearsal.yml"
sudo docker compose --env-file deploy/.env.vm $files --profile loadtest-tools run --rm loadtest-benchmark \
  node scripts/benchmark-booking-writes.mjs --requests=50 --vus=10
```

Record successes, failure statuses, RPS, and p95. The first target is zero failures and booking-write p95 below 1 second on the VM. A 30- or 60-client read result does not predict write performance. Do not start another write run until the first command finishes its cleanup. Rebuild the VM image after changing this script, since the container executes the image copy.

To check double-booking protection, race ten different players for **one** available slot. The expected result is one HTTP 201, nine HTTP 409 responses, one persisted booking, and a hold pointing to that booking. The report's `valid` field must be `true`. This command waits 45 seconds for any upstream requests to finish before checking and cleaning up.

```bash
sudo docker compose --env-file deploy/.env.vm $files --profile loadtest-tools run --rm \
  --volume "$PWD/scripts/benchmark-booking-writes.mjs:/app/scripts/benchmark-booking-writes.mjs:ro" \
  loadtest-benchmark \
  node scripts/benchmark-booking-writes.mjs --mode=contention --requests=10 --vus=10
```

To check confirmation idempotency, create one synthetic hold and send ten concurrent mock-payment confirmations through the same proxy. Expected: one first confirmation, nine idempotent responses, one earning ledger entry, two in-app notifications, and one vendor-earnings increment. The script restores the synthetic booking, slot, and vendor balance after a 45-second drain; it runs only against `_loadtest`.

```bash
sudo docker compose --env-file deploy/.env.vm $files --profile loadtest-tools run --rm \
  --volume "$PWD/scripts/check-booking-confirmation-race.mjs:/app/scripts/check-booking-confirmation-race.mjs:ro" \
  loadtest-benchmark node scripts/check-booking-confirmation-race.mjs
```

## OTP request load

This request-only scenario uses 100 unique synthetic Pakistani numbers. It checks for HTTP 202 and one persisted challenge per request, then deletes only those challenges. It does not verify a code or create users. The load-test overlay has `ALLOW_LOADTEST_RATE_LIMIT_BYPASS=true`, so this measures OTP generation/database work rather than the Redis IP throttle. Real SMS delivery is not configured in this VM rehearsal.

```bash
sudo docker compose --env-file deploy/.env.vm $files --profile loadtest-tools run --rm \
  --volume "$PWD/scripts/benchmark-otp-requests.mjs:/app/scripts/benchmark-otp-requests.mjs:ro" \
  loadtest-benchmark node scripts/benchmark-otp-requests.mjs --requests=100 --vus=20
```

The second scenario seeds hashed test codes for 100 fresh synthetic numbers, then calls OTP verification and checks that 100 users and 100 refresh sessions were created, with no challenges left. It deletes those synthetic users and sessions afterward. It does not require a configured fixed development OTP or SMS service.

```bash
sudo docker compose --env-file deploy/.env.vm $files --profile loadtest-tools run --rm \
  --volume "$PWD/scripts/benchmark-otp-verifications.mjs:/app/scripts/benchmark-otp-verifications.mjs:ro" \
  loadtest-benchmark node scripts/benchmark-otp-verifications.mjs --requests=100 --vus=20
```

## Mixed read/write load

This 30-second run keeps 20 read clients active across the seven established routes while spreading 50 unique booking holds across the same interval. It checks read errors, write responses, and persisted holds, then drains and removes its own bookings and sessions. The VM's co-located generator consumes CPU, so compare this with the earlier VM-generator baseline rather than the Windows external-generator result.

```bash
sudo docker compose --env-file deploy/.env.vm $files --profile loadtest-tools run --rm \
  --volume "$PWD/scripts/benchmark-mixed-traffic.mjs:/app/scripts/benchmark-mixed-traffic.mjs:ro" \
  loadtest-benchmark node scripts/benchmark-mixed-traffic.mjs --readers=20 --writes=50 --seconds=30
```
