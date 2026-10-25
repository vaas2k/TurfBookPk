# Scalability Task Journal

## 2026-10-24 — Day 1 database/query pass

- Added `0024_scalability_query_indexes.sql` and registered it in the Drizzle journal. The migration adds read, expiry, queue, and admin indexes.
- Found `push_receipts` missing from the live local schema because its old `0014` migration was omitted from the journal. The new migration creates it idempotently before indexing it.
- Validated the migration inside a transaction that rolled back, then applied it successfully to the local development database.
- Changed ordinary public discovery and vendor ground listing to paginate in PostgreSQL. Ordinary discovery now aggregates availability for the selected page in SQL.
- Limited ground detail reads to the current booking horizon. Added bounded paging for public reviews and player favorites.
- Moved admin dashboard totals, city counts, top grounds, and daily revenue aggregation into SQL.
- Added a k6 read-path baseline harness and a local query smoke script.
- Verified backend typecheck, build, all 28 tests, migration validation/application, and discovery/detail/dashboard query smoke against the local database.
- Those deferred items were addressed in the follow-up below using a separate load-test database; hosted staging measurements remain necessary.

## 2026-10-24 — Day 1 follow-up and realistic load data

- Added a guarded, deterministic seed that creates a separate `_loadtest` database with 10,000 users, 100 vendors, 1,000 grounds, 10,000 recurring templates, 500,000 slots, 50,000 bookings/payment attempts/ledger entries, and 100,000 notifications. It is rerunnable and refuses ordinary or production databases.
- Moved selected-date discovery, effective-price sorting/filtering, admin operations aggregates, and refund queues into SQL. Batched recurring schedule checks across ground pages and added an indexed schedule-horizon lookup.
- Added optional cursor pagination for player/vendor bookings, notifications, admin transactions, and audit logs without breaking offset clients.
- Added and applied migrations `0025`–`0027` for search, cursor, schedule-horizon, and verified unique template/blackout indexes. Local and load-test duplicate audits returned zero.
- Added query, cursor, `EXPLAIN ANALYZE`, mixed-read, and booking-write harnesses. The seeded database passed route/cursor smoke checks. The 10-client read mix delivered about 77.5 requests/s with zero errors; 50 unique holds succeeded with zero failures. Results and reproduction commands are in `Server/SCALABILITY_BASELINE.md`.
- Backend typecheck, build, and all 30 tests passed. These local measurements are a comparison baseline, not a production user-capacity estimate. Hosted staging, database CPU/connection telemetry, OTP-specific load, and provider callbacks remain outstanding.

## 2026-10-24 — Day 2 P0 started

- Installed the Redis client and added validated `REDIS_URL`, namespaced atomic per-IP counters, readiness/reconnect handling, and an explicit trusted-proxy hop setting. Production now refuses to boot without Redis; development retains only a single-process fallback.
- Applied global and sensitive-route rate limits. Kept existing database-backed OTP phone cooldown and attempt enforcement.
- Removed booking/payment/push maintenance timers from API startup. Added `npm run worker` and `npm run worker:dev` for a separate process, with PostgreSQL advisory locks preventing duplicate scheduled scans across worker replicas.
- Made recurring reservation, ended-booking, and Clink expiry scans due-only and bounded. Worker outcomes are logged; all 30 tests, typecheck, and build pass.
- Removed a provider password and username from the tracked `.env.example`. Those values were present in a tracked file and must be rotated with the provider; ignored `Server/.env` was not changed.
- Remaining Day 2 work: durable outbox/queue for push and post-commit side effects, retries/dead-letter handling, worker-based schedule materialization, Clink ambiguity escalation, and multi-instance integration tests. Do not deploy multiple API instances until these are finished.

## 2026-10-24 — Day 2 continuation

- Added migration `0028_notification_outbox.sql`: a database trigger queues each newly inserted notification inside the same transaction. The worker claims due rows with `FOR UPDATE SKIP LOCKED`, retries failures with bounded exponential delay, and moves exhausted jobs to a dead-letter state. Existing request-path push calls are compatibility no-ops to avoid duplicate delivery.
- Added admin outbox counts, a dead-letter list, and an audited manual retry endpoint. Sensitive verification/payment-review reasons are replaced with generic lock-screen push text.
- Moved recurring schedule horizon generation to the worker; saving a vendor schedule still materializes immediately. Public discovery and ground detail no longer write slots. Added interrupted Clink-generation escalation to manual review without unsafe automatic retry or hold release.
- Applied migration `0028` to both local and isolated load-test databases. The expanded 36-test suite passes, including transactional rollback, two-worker single-claim, worker delivery without tokens, advisory-lock ownership, and parallel booking-completion earnings checks; backend build/typecheck pass. The worker schedule smoke checked 1,000 seeded grounds and generated no duplicate slots. A guarded 10-client, 10-second load-test read mix completed without errors at roughly 237 aggregate requests/second; this is not a production capacity estimate.
- Automatic old-slot deletion was not added. The attempted cleanup policy was blocked because it would remove historical records without an approved retention rule. Existing data remains untouched; a retention decision is required before implementing cleanup.
- Remaining before multi-instance production: full payment/booking multi-instance integration tests, live Expo delivery/retry testing, production proxy/Redis failure drills, and a decision on whether maintenance scans need durable per-item job records beyond the protected due scans.

## 2026-10-25 — Day 2 local reliability verification

- Added a concurrent Clink acknowledgment integration test that submits the same payment twice and verifies one confirmed booking, one allocated slot, one earnings ledger entry, one vendor earnings increment, one payment event, and one player notification/outbox entry.
- Added Redis rate-limiter fail-closed/reconnect tests, abandoned outbox-lease recovery, and repeated push failure/dead-letter tests. The full backend suite now passes 41 tests.
- Fixed Clink expiry retry behavior: payment-status reads no longer call the provider. Worker expiry attempts use a persisted retry count and bounded exponential backoff; after six failures the payment remains held for manual review and admins receive one notification. Migration `0029_clink_expiry_retry.sql` was applied to local and isolated load-test databases.
- Still requires manual real-device Expo push retry/tap verification and a deployed staging drill with multiple API and worker processes. Historical-slot cleanup remains deferred until a retention policy is approved.

## 2026-10-25 — Three-day unbooked-slot retention

- User selected three days for past unbooked slots. Added a read-only audit script, migration `0030` with cleanup and booking-slot lookup indexes, and an hourly worker-only cleanup capped at 500 rows per run under an advisory lock.
- The delete predicate excludes booked, blocked, club-reserved, held, and any booking-linked slot (including cancelled bookings). Exactly three-day-old dates remain; only dates older than three full Pakistan calendar days qualify.
- Audited the local database before and after a fixture-scoped test: 444 slots currently qualify, and none of those existing rows were deleted during this change. The new test removed only its own fixture slot and confirmed protected rows remained. Backend suite passes 42 tests and typecheck; migration `0030` is applied to local and isolated load-test databases.
- The next worker start will begin removing those 444 eligible local slots. This is expected under the selected policy; recovery would require a database backup because deletion is permanent.

## 2026-10-25 — Isolated multi-process drill and Day 3 lifecycle start

- Added `Server/scripts/check-multi-instance.mjs`. Two API processes shared one Redis limit (300 accepted, one rejected), and two worker processes handled one notification with one outbox attempt. The drill held unrelated maintenance locks; audits confirmed the 72,000 eligible synthetic load-test slots and 444 eligible development slots were unchanged.
- Chose authoritative, indexed, idempotent due scans instead of a duplicate per-item job table. External push delivery remains in the transactional outbox; Clink expiry retry/manual-review state is persisted.
- Added configurable PostgreSQL pool, connection/idle/statement/lock timeouts, stronger readiness schema checks, API shutdown draining, and worker active-job draining. Added bounded/time-limited Clink, Cloudinary deletion, and Expo HTTP responses.
- Backend build/typecheck and all 43 tests pass. Hosted staging signal/failure drills, real-device Expo retry/tap, cache design, PgBouncer, migration locking, and slow-query logging remain.

## 2026-10-25 — Day 3 metadata cache and migration coordination

- Added versioned, 60-second Redis cache-aside for public ground metadata. Public eligibility is checked in PostgreSQL on every read; cache failures fall back to PostgreSQL. Ground detail still reads slots from PostgreSQL and is marked `no-store`.
- Added `GET /api/grounds/:id/metadata` with ETag/conditional 304 responses. Dynamic discovery and slot routes are `no-store` to avoid stale availability.
- Replaced `db:migrate` with a single-job migrator guarded by a PostgreSQL session advisory lock; a local rerun completed successfully. Updated the runbook for reverse-proxy compression, CDN headers, and PgBouncer/slow-query rollout checks.
- Day 3 still needs measured discovery-fragment caching, hosted PgBouncer and slow-query setup, asset cache headers, compression measurements, and staging lifecycle validation.
- Follow-up: switched cache versioning to PostgreSQL row-version (`xmin`) so edits in the same millisecond cannot reuse old metadata. A 100 ms Redis operation budget prevents a stalled cache from delaying the database fallback. The metadata route fetches only eligibility/version on cache hits. A read-only API smoke passed ETag/304 and dynamic `no-store` checks. Added a JSON compression benchmark script for the eventual proxy measurement.
- Local discovery compression sample (3,260-byte JSON): gzip level 5 produced 1,178 bytes in 0.066 ms mean local CPU time; Brotli produced 1,026 bytes in 4.513 ms. This small local response favors gzip for a first proxy configuration, but staging measurements are still required before enabling it.
- A two-process migration-lock check passed on the isolated `_loadtest` database: the second migrator waited until the first connection released the advisory lock, then completed. The migration script now times out lock waits after 60 seconds and releases its connection on failure.
- Added a deployment-ready Nginx API snippet with measured gzip level 5 and no proxy cache. It still requires real TLS host configuration, `nginx -t`, and p95/CPU comparison on staging before activation.

## 2026-10-25 — Day 3 static discovery fragments

- Added migration `0031_public_ground_catalog_revision`, applied to both local development and isolated `_loadtest` databases. Statement-level ground changes and vendor visibility updates bump a transactional catalog revision, invalidating Redis discovery page keys across API replicas.
- Ordinary discovery caches only the filtered, sorted static ground page and count for 30 seconds. Every response still queries current slot availability from PostgreSQL; dated discovery remains uncached. Corrected the ordinary maximum-price filter to apply to the SQL ground page.
- A rollback-only smoke verified both revision triggers and no persistent fixture change. The public API smoke passed metadata ETag/304 and dynamic `no-store` checks. Cache misses and Redis failures still use PostgreSQL.
- Corrected the PgBouncer plan: API transaction pooling is compatible with booking transaction locks, but worker/migration session advisory locks require direct or session-pooled connections. Added `DB_POOL_MODE` validation and worker/migrator startup guards, and documented separate connection URLs for deployment.
- Verified that both worker and migration job refuse `DB_POOL_MODE=transaction` at startup. Added an API-only PgBouncer example with SCRAM authentication and a bounded server pool; actual connection limits and slow-query logging must be validated on the host.

## 2026-10-25 — Day 3 compression and asset cache completion

- Added API-layer compression for public ground JSON above 1 KB, with gzip level 5, Brotli quality 2, and an `API_COMPRESSION` switch. A local smoke confirmed gzip, ETag/304, and `no-store` on dynamic ground responses. A route-relative `request.path` check initially skipped gzip; using the original URL fixed it.
- Added `overwrite=false` to both the Cloudinary signature and signed upload form fields, and `/v1/` to new public URLs with slash-containing UUID paths. A focused test caught the missing form field before the fix. Existing approved public Cloudinary sample returned HTTP 200, ETag, and `Cache-Control: private, no-transform, max-age=2592000`.
- Local PostgreSQL 16 reported `max_connections=100`; session-only slow-query settings logged a 303 ms test query at a 250 ms threshold. Added a parameter-free 500 ms staging configuration example. Hosted logging access, pool sizing, and signal drills remain.
- The 10-client, 10-second synthetic mixed-read comparison had zero failures in both runs. Discovery p95 was 75 ms with API compression off and 70 ms with it on; ground detail p95 was 64 ms in both. This short local result shows no obvious regression but is not a VPS capacity claim. Production dependency audit reported zero vulnerabilities.
- Added a read-only Day 3 staging check command and a VirtualBox rehearsal guide for the user's planned local VPS. There is no hosted staging/VPS yet, so PgBouncer behavior, proxy TLS/headers, real signal delivery, and slow-log configuration remain deployment gates.
