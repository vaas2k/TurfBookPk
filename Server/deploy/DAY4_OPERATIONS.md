# Day 4 operations: prepare locally, verify on the VM

## What is ready in code

- `GET /api/internal/metrics` exposes request counts, route latency buckets, active requests, process memory, database connections, push outbox depth/age, payment review/expiry state, worker heartbeat/job outcomes, and cache hits/misses. It is disabled unless `METRICS_TOKEN` is set, requires a bearer token, and contains no customer identifiers. Keep the route off the public reverse proxy.
- `prometheus.example.yml` and `turfbookpk-alerts.yml` provide a starting scrape job and alerts for availability, p95 latency, 5xx, database connections, missing worker, outbox lag/dead letters, payment expiry retries, manual-review growth, and acknowledgment failures. Attach an Alertmanager receiver during VM/staging setup; alerts do not notify anyone merely by existing in the repository.
- `compose.monitoring.yml` starts a local/VM Prometheus and Alertmanager rehearsal. Its `alert-sink` is a test receiver, not an on-call destination. Prometheus and Alertmanager bind only to localhost ports 9090 and 9093.
- API and worker already emit JSON logs. Production errors omit stacks by default. Ship stdout/stderr to a restricted centralized log service; do not send request bodies, identity documents, billing values, or tokens.
- The worker removes at most 500 rows per category per hour: OTP challenges expired over 1 day, refresh sessions expired or revoked over 30 days, checked push receipts over 7 days, and sent push outbox rows over 30 days. Pending/dead jobs and all payment, booking, ledger, notification, and admin audit history remain. Run `node scripts/audit-operational-retention.mjs` before first deployment to see eligible row counts.
- Production browser CORS now requires explicit HTTPS `FRONTEND_ORIGINS` (comma separated); native mobile requests are unaffected. `TRUST_PROXY_HOPS` must match the deployed proxy chain. Private document URL responses use `Cache-Control: no-store`.

## First VM verification

1. Follow `VIRTUALBOX_REHEARSAL.md`. The Compose migration job applies `0032_operational_retention_indexes.sql` and `0033_payment_observability_indexes.sql` before API and worker startup.
2. Check `curl http://127.0.0.1:5000/api/ready` inside the VM. Then call the private metrics path with `Authorization: Bearer <METRICS_TOKEN from deploy/.env.vm>`. Without a token it should return 403; with it, Prometheus text metrics.
3. Inspect `sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml logs --tail=80 api worker`. Verify no phone/CNIC/token values appear.
4. Run `bash deploy/backup-vm.sh`, then `bash deploy/restore-check-vm.sh backups/<generated-name>.dump`. The restore script creates a separate database and prints its name for explicit cleanup. Backups are ignored by Git and have restrictive file permissions. Do not use this local VM backup as the sole production backup.
5. Validate alert rules with `promtool check rules deploy/turfbookpk-alerts.yml` when Prometheus is installed. Mount the token as a private file for `prometheus.example.yml`; never put it into a public config or dashboard. Configure Alertmanager routing and test a deliberate alert.
6. Run the staged failure and capacity drills in `ADVANCED_VM_CHECKS.md`. Record actual p95, RPS, error rate, database connection use, queue lag, restore time, and alert delivery in `SCALABILITY_BASELINE.md`.

## Decisions before a real VPS

- Choose a restricted central log/APM destination and alert receiver; give only operations staff access. Configure retention and verify redaction with synthetic identifiers.
- Use encrypted off-host backups and PostgreSQL point-in-time recovery where available; rehearse restoring to a separate database. Keep a verified backup before each migration. Never test rollback by deleting live booking/payment rows.
- Confirm the actual admin web origin, TLS proxy hop count, PostgreSQL `max_connections`, PgBouncer pools, worker count, and timeout values on the host. Review private Cloudinary document delivery and admin export limits with real domains.
- Keep live Clink disabled until signed callback or status verification, expiry, fees, refunds, and settlement are contracted and tested.

## Optional local monitoring rehearsal

From `Server/`, copy the `METRICS_TOKEN` value in your ignored `deploy/.env.vm` into an ignored `deploy/metrics-token` file containing only the token, with no extra newline. Keep that file private. Start the overlay:

```bash
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml -f deploy/compose.monitoring.yml up -d prometheus alertmanager alert-sink
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml -f deploy/compose.monitoring.yml exec -T prometheus promtool check rules /etc/prometheus/turfbookpk-alerts.yml
```

Check `http://127.0.0.1:9090/targets` inside the VM; the API target should be **UP**. Stop the rehearsal worker briefly, wait for `TurfBookWorkerMissing` to fire, then check the `alert-sink` container logs for `alert_received`. Start the worker again and confirm the alert resolves. Do this only on the disposable rehearsal stack.

The current runtime image installs production dependencies only. The patched Express/body-parser/proxy-addr/qs tree had zero production npm audit findings in the local Docker build. Four moderate development-tool findings remain in Drizzle Kit's older esbuild chain; avoid exposing its development server and review a compatible upgrade separately.

## Local rehearsal result (2026-10-26)

An isolated Docker Desktop stack on localhost port 5501 applied migrations and returned ready for PostgreSQL and Redis. A synthetic database backup restored into a separate disposable database. Redis and PostgreSQL outages caused readiness to return 503, then 200 after restart; a second API replica remained ready while the first was killed. An expired outbox lease was reclaimed by a restarted worker. All 11 alert rules passed validation, the private metrics target scraped successfully, and the missing-worker alert reached the test receiver as both `firing` and `resolved`. The API returned 403 for metrics without a token. Server typecheck/build and 49 tests passed; admin typecheck passed.

The local stack does not provide PostgreSQL failover, encrypted off-host backups/PITR, real on-call delivery, provider outage simulation, or a capacity result. Perform those checks on the planned VM and then hosted staging before deployment.
