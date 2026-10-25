# TurfBookPK Operations Runbook

This runbook applies to the Express API and its PostgreSQL database. It is intentionally provider-neutral so the same process works with a managed PostgreSQL service or a self-hosted instance.

## Logging and support

The API writes newline-delimited JSON logs to standard output. Every request has an `X-Request-Id` response header and the same `request_id` in its completion/error log. Ask a user for that ID when investigating a failed request.

The logger redacts values in sensitive fields and masks common bearer/JWT tokens, Expo push tokens, Pakistani phone numbers, CNICs, and Pakistani IBANs. Request bodies are not logged. Do not add raw request bodies, authorization headers, OTP values, Cloudinary credentials, private document URLs, or payment details to logs.

Use a vetted, access-controlled log platform for production collection. Configure alerts for:

- `/api/health` failure or elevated 5xx responses;
- elevated 4xx/5xx rates and p95 request latency;
- `worker_job_failed`, `notification_outbox_delivery_failed`, and elevated dead-letter queue counts;
- database connection failures and failed migration deployments.

Do not forward raw exceptions to an arbitrary webhook. If external error monitoring is added, use an approved provider, its server-side SDK, and the same redaction rules before enabling it.

## Time and dates

- Store instants in PostgreSQL and API records as UTC.
- Calculate booking holds, cancellation tiers, no-shows, and payment windows in UTC.
- Present dates/times in the mobile app using the user's Pakistan-local context (`Asia/Karachi` by default).
- Servers should run with UTC system time. `Asia/Karachi` is the product-facing display timezone and must not be inferred from a server's local clock.

## Database backup and restore

Take an encrypted PostgreSQL custom-format backup before every production migration and on a scheduled basis. Retain copies in a separate access-controlled location and periodically restore one into a non-production database.

Example backup (set `DATABASE_URL` in the shell; never paste production credentials into command history or source files):

```powershell
pg_dump --format=custom --no-owner --file turfbookpk-2026-10-06.dump $env:DATABASE_URL
```

Example restore to an empty non-production database:

```powershell
pg_restore --clean --if-exists --no-owner --dbname $env:RESTORE_DATABASE_URL turfbookpk-2026-10-06.dump
```

After restoring, run a health check and verify row counts for `users`, `grounds`, `slots`, `bookings`, `payments`, and `notifications`. Never test a restore against the live production database.

## Deployment and migrations

1. Confirm a fresh backup exists and can be located.
2. Run `npm run typecheck`, `npm test`, and `npm run build` in `Server/`.
3. Review the migration against a staging database first.
4. Run `npm run db:migrate` as one deployment job before starting new API or worker replicas. This command holds a PostgreSQL advisory lock and serializes concurrent invocations; do not run `drizzle-kit migrate` directly in replica startup commands.
5. Check `/api/health`, create/read a non-production test record where permitted, and inspect structured logs by request ID.
6. If a migration must be reversed, use a reviewed compensating migration. Do not use destructive rollback commands against production data.

## API, Redis, and worker

Run one or more API processes and at least one separate `npm run worker` process. Set the same `REDIS_URL` in every process. Production refuses to start without Redis; set `TRUST_PROXY_HOPS` to the verified number of trusted reverse proxies, never to a guessed value. `/api/health` is liveness; `/api/ready` checks PostgreSQL and configured Redis. Apply migrations before starting the new worker.

The worker owns recurring payment-window updates, ended-booking completion, Clink expiry/ambiguity escalation, Expo push delivery/receipts, and recurring schedule-horizon extension. PostgreSQL advisory locks avoid duplicate scheduled scans across worker replicas. Notification inserts create outbox jobs transactionally; check `GET /api/admin/operations` for `push_outbox` counts and `GET /api/admin/operations/push-outbox/dead` for failed jobs. Admins can retry a dead job with `POST /api/admin/operations/push-outbox/:id/retry` and a required JSON `reason`; this writes an audit entry.

Push delivery is at-least-once, not exactly-once. If the worker crashes after Expo accepts a ticket but before the outbox row is marked sent, the push can repeat. A dead job is never retried automatically after six attempts.

The worker removes at most 500 unused slots per hourly run once their date is older than three full Pakistan calendar days. It never removes a slot linked to any booking, or one that is booked, blocked, club-reserved, or held. Run `node scripts/audit-slot-retention.mjs` before a new deployment to see the number currently eligible. Migration `0030_unbooked_slot_retention` adds the lookup indexes; it does not itself delete rows. Deletion begins when the new worker starts and is recoverable only from a database backup.

## Connection budget and multi-process check

Set `DB_POOL_MAX` per API and worker process. Keep direct worker and migration connections plus PgBouncer's PostgreSQL server pool below `max_connections`, with room for administration and monitoring. Defaults are 10 in production and 3 in development. `DB_CONNECT_TIMEOUT_SECONDS`, `DB_IDLE_TIMEOUT_SECONDS`, `DB_STATEMENT_TIMEOUT_MS`, `DB_LOCK_TIMEOUT_MS`, and `SHUTDOWN_GRACE_MS` are configurable. The API may use PgBouncer transaction pooling with `DB_POOL_MODE=transaction`; booking uses transaction-scoped advisory locks and `prepare: false` is already set. The worker uses session-scoped advisory locks, so its `DATABASE_URL` must connect directly to PostgreSQL or through a session pool with `DB_POOL_MODE=direct` or `session`. The migration job also needs a direct/session connection for its advisory lock and must not share the API transaction-pool URL. Worker and migration startup reject `DB_POOL_MODE=transaction`. Enable PostgreSQL slow-query logging on the deployed database and review log access before logging query parameters.

For self-hosted PostgreSQL, `deploy/pgbouncer-api.ini.example` is an API-only transaction-pool starting point. Keep the SCRAM authentication file private; do not use its pool port for worker or migration jobs. Validate pool sizing against actual PostgreSQL `max_connections` and observed connection use. If a managed provider supplies separate pooled and direct endpoints, use those instead of running another PgBouncer.

`deploy/postgres-observability.conf.example` gives a 500 ms slow-query threshold and disables parameter values in slow-query/error logs. Apply it using the host's configuration mechanism, confirm log access restrictions, and compare logged queries with `EXPLAIN (ANALYZE, BUFFERS)` before changing indexes. The local PostgreSQL 16 container has `max_connections=100`; a session-only 250 ms threshold recorded a 303 ms test query without changing global settings. The hosted limit and logging behavior still need verification.

For a local multi-process check, build the backend, make sure Redis and the isolated `_loadtest` database are available, then run `node scripts/check-multi-instance.mjs` from `Server/`. It starts two APIs and two workers, checks shared rate limiting and single notification delivery, and holds unrelated maintenance locks so it cannot clean seeded slots. This does not replace a hosted staging drill with the real load balancer and real-device Expo push.

Clink bill-expiry calls are owned by the worker, not payment-status reads. A failed expiry is retried with persisted exponential backoff for at most six attempts; the booking is not released until the provider confirms expiry. After six failures, the attempt remains in the admin manual-review queue and must be checked with the provider before any manual slot release or refund action. Apply migration `0029_clink_expiry_retry` before deploying this worker version.

## Public caching and compression

Public `GET /api/grounds/:id/metadata` checks ground and vendor approval in PostgreSQL, then uses a versioned 60-second Redis cache for static ground metadata. It returns an ETag and supports `If-None-Match`. Ground detail, discovery, and slot routes return `Cache-Control: no-store` because they include live availability. Metadata keys contain the PostgreSQL ground row version; vendor suspension is checked on every read. Cache failures fall back to PostgreSQL.

Ordinary discovery caches only its static filtered ground page and total for 30 seconds. Migration `0031_public_ground_catalog_revision` adds a transactional revision that changes on ground edits and vendor visibility changes; each request checks that revision before reading the cache. Availability counts and next available times still come from PostgreSQL. Dated discovery remains uncached because slot-based price and availability change frequently. Apply migration `0031` before starting this API version; readiness checks for its revision table.

Public ground JSON responses are compressed in the API by default above 1 KB (`API_COMPRESSION=true`) with gzip level 5 and low-cost Brotli quality 2. Set `API_COMPRESSION=false` if the deployment proxy will handle compression or staging CPU/p95 results favor disabling it. Keep `Vary: Accept-Encoding`; image bytes are served by Cloudinary and are not recompressed by this API. New signed public uploads use unique, non-overwritable Cloudinary IDs and `/v1/` URLs, while private verification documents have no public URL. Verify CDN headers on the deployed account. API-only PgBouncer transaction pooling and deployed slow-query logs remain rollout checks because this repository does not configure the target host.

With an API running, benchmark a representative public response using `node scripts/benchmark-json-compression.mjs http://localhost:5000/api/grounds?limit=24`. This reports payload ratio and local compression CPU time; repeat on the eventual VPS before enabling proxy gzip. Ground image URLs already use unique object IDs, so changing an image creates a new URL. Cloudinary controls those asset response headers; verify them against the deployed account/CDN.

`deploy/nginx-api.conf.example` is an alternative API proxy snippet with gzip level 5 for JSON. If using it for compression, disable API compression and include the snippet inside the deployed TLS server block after validating the real proxy chain and setting `TRUST_PROXY_HOPS` accordingly. Test `nginx -t` and compare p95 and CPU on staging.

After building, run `node scripts/check-public-ground-cache.mjs` against a local database with an approved ground. It starts a temporary API and checks metadata ETag/304 plus `no-store` on dynamic discovery and detail responses. The smoke test is read-only and does not start the maintenance worker.

Run `node scripts/check-migration-lock.mjs` to verify migration serialization against the isolated `_loadtest` database. It holds the same advisory lock, starts a second migrator, checks that it waits, then releases the lock and confirms completion. It never targets the ordinary development database.

For a deployed staging check, set `STAGING_API_URL` to the HTTPS API origin and run `node scripts/check-staging-day3.mjs`. It checks health/readiness, live discovery cache headers, gzip, and metadata ETag/304 without changing data. Optionally set `STAGING_PUBLIC_GROUND_ID` if the first discovery page is empty and `STAGING_DIRECT_DATABASE_URL` to read PostgreSQL connection and slow-log settings. Keep database credentials in the environment, not command history or tracked files. This check does not replace the separate signal, PgBouncer, and real-device push drills.

## Privacy and access boundaries

- CNIC, business identifiers, and payout identifiers are fingerprinted/encrypted as implemented by the verification workflow; do not expose raw values in admin list views or logs.
- CNIC, business, authority, and payout documents use private media access. Public ground photos are the only media intended for public discovery.
- Admin actions must remain behind admin-role authorization and leave audit records.
- Vendors should receive only the player information required to operate a booking. Any future phone disclosure must have an explicit consent and masking rule.
- Retention periods, deletion/export handling, legal notices, and dispute evidence retention require a business/legal decision before public launch. Until approved, limit production access to authorized operators and avoid collecting optional data.

## Known deferred integrations

Real SMS, payment-provider refunds/payouts, and third-party error monitoring are not active. Do not represent mock payment status as a settled financial transaction. When a gateway is selected, document its webhook verification, reconciliation, refund, payout, retention, and incident procedures here before enabling live money movement.
