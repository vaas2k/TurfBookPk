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
