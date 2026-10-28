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

## 2026-10-25 — Beginner VirtualBox rehearsal setup

- Rewrote the VirtualBox guide as a short first-run walkthrough and moved multi-instance scaling checks to a separate advanced page.
- Added a disposable Docker Compose stack for PostgreSQL, Redis, a one-time migration, one API, and one worker. Its test-only environment file is isolated from the server's real `.env` and ignored by Git.
- Validated Compose syntax without resolving local credentials. Docker image build/start was not available because the local Docker engine denied access; the VM run remains to be tested on the user's machine.

## 2026-10-26 — Day 4 local operations preparation

- Added a bearer-protected Prometheus endpoint with bounded route labels and request/latency histograms, active requests, PostgreSQL connection counts, worker heartbeat age, push outbox depth/lag, payment review/expiry gauges, and public-cache access counters. A local API probe returned 403 without the token and Prometheus metrics with it.
- Added sample Prometheus scrape and alert rules for API availability, latency/errors, PostgreSQL saturation, missing worker, outbox lag/dead letters, payment expiry retries, manual-review growth, and callback failures. Alertmanager routing and alert delivery are still to be tested on the VM.
- Added bounded worker cleanup for expired OTP challenges, old revoked/expired refresh sessions, checked push receipts, and sent outbox rows. A rollback-only integration test verified expired rows are removed and fresh/pending rows survive. Read-only audit showed one eligible OTP row and zero in the other groups on the local development database. Migration `0032` was applied locally.
- Hardened production browser CORS to explicit HTTPS origins, validated request IDs, added `no-store` to private verification document URL responses, and removed production error stacks unless explicitly enabled. Structured log redaction now also masks configured gateway/database secrets embedded in messages.
- Added a VM backup script, separate-database restore-check script, operations guide, and updated the agent guide. Production encrypted off-host backups/PITR, central log/APM destination, real alert routing, proxy/domain checks, failure drills, and the final load test still depend on the VM/host setup.
- Backend typecheck, build, and all 48 tests pass; `git diff --check` and the VM Compose syntax check pass. Migration `0033` adds partial indexes for payment metrics and was applied locally. The actual Docker image/VM stack still needs to run on the user's VirtualBox host.
- Follow-up added Redis-backed worker success/failure/retry/dead counters to the private metrics endpoint and a worker-failure alert. Focused metrics test, typecheck, final build, and YAML parsing passed. Bash script syntax and backup restoration still need the Ubuntu VM because WSL Bash was unavailable locally.
- Admin export review found a CSV formula risk in user-controlled text. Shared CSV export now escapes formula-prefixed strings and caps the file at the current 100-row page. Admin TypeScript check passed.

## 2026-10-26 — Day 4 isolated Docker rehearsal

- Docker Desktop was available outside the sandbox. Started a separate `turfbookpk-vm` stack with generated ignored test secrets and API bound to localhost port 5501. Migration job, API, Redis, PostgreSQL, and worker started; `/api/ready` returned PostgreSQL/Redis OK.
- The first image audit found four production dependency advisories. Upgraded Express to 5.3.0 and its body-parser/proxy-addr/qs tree, then changed the Dockerfile to ship production dependencies only. The rebuilt runtime image's `npm audit --omit=dev` returned zero vulnerabilities. Four moderate Drizzle Kit build-tool advisories remain and are not in the runtime image.
- A backup archive from the isolated database restored successfully to a separate test database; a synthetic user row was present. The temporary restore database was removed. Both VM Bash scripts passed `bash -n` inside the Linux container.
- Redis and PostgreSQL outage drills each produced `/api/ready` 503 while `/api/health` remained 200; readiness returned to 200 after restart. A temporary second API replica stayed ready when the first was killed; the original was then restarted and the temporary replica removed.
- A synthetic notification with an expired processing lease was reclaimed by a restarted worker as one sent outbox row with two total attempts. Its test notification/user were removed. A new integration test confirms a late Clink acknowledgment enters manual review without allocating the slot or posting vendor earnings.
- Started an isolated Prometheus/Alertmanager/test-receiver overlay; `promtool` validated 11 alert rules and the private API target was UP. Stopping the worker triggered `TurfBookWorkerMissing`; the test receiver logged `firing`. Restarting the worker restored its heartbeat; Prometheus marked the rule inactive and the receiver logged `resolved`.
- Final local checks after the Express dependency update: server typecheck/build and all 49 tests passed; admin typecheck passed. The runtime Docker image had zero production npm audit findings. The metrics endpoint returned 403 without a token, and API readiness returned 200 after recovery. This is a local rehearsal, not a VM/VPS capacity or failover acceptance test.

## 2026-10-27 — VM backup transfer follow-up

- On the user's VirtualBox VM, a direct `pg_dump -f` inside PostgreSQL completed successfully, while the original backup script stalled while streaming the archive through `docker compose exec` to host stdout. Revised backup and restore scripts to create/read archive files inside the database container and transfer them with `docker compose cp`, with visible progress messages and restricted host permissions. Bash syntax and Docker Compose CLI behavior were checked; the revised scripts still need a full run on the VM.
- The revised backup and restore rehearsal passed on the VM, including checksum validation and restoring into a separate disposable database. The restored user count was zero because the new rehearsal database was empty.
- Prometheus initially reported `TurfBookApiUnavailable`; its target diagnostics showed permission denied reading the mode-600 bind-mounted metrics token. The monitoring overlay now mounts a Compose secret at `/run/secrets/metrics_token`, and a helper installs the ignored host source at mode `400` for Prometheus UID/GID 65534. The target then became healthy and the false API alert cleared.

## 2026-10-28 — VirtualBox monitoring rehearsal

- On the user's Ubuntu VirtualBox VM, the API remained ready with PostgreSQL and Redis OK while the worker was stopped. Prometheus changed the worker heartbeat from current to missing, held `TurfBookWorkerMissing` pending for its configured two minutes, then fired it. The Alertmanager rehearsal receiver logged `firing`.
- Restarting the worker restored its heartbeat to zero seconds of age. Prometheus and Alertmanager both returned no active alerts, and the receiver logged `resolved`. The test worker was left running.
- Stopping Redis kept liveness at 200 and changed readiness to 503. After Redis restarted, readiness recovered immediately and the worker re-established its heartbeat automatically within about 20 seconds.
- Stopping PostgreSQL also kept liveness at 200 and changed readiness to 503. After restart, readiness returned to 200, a database-backed public grounds request returned 200, and the worker heartbeat remained current. The persisted database volume was preserved.
- These deliberate readiness 503 checks exposed a noisy general 5xx alert in the low-traffic rehearsal. Updated it to exclude health/readiness/metrics routes and require at least 0.1 application requests per second; dedicated availability and callback alerts remain responsible for those failure modes.

## 2026-10-28 — VirtualBox Nginx/API failover rehearsal

- Added an optional `compose.ha-rehearsal.yml` overlay with a second stateless API and Nginx 1.30.6 on VM localhost port 5080. Nginx load-balances with passive failure detection, retries safe failed requests once, preserves forwarding headers, and returns 404 for the private metrics path.
- With both APIs running, repeated proxy requests alternated between the two upstream container addresses. Both returned the same readiness and database-backed public-ground response while sharing PostgreSQL and Redis.
- Stopping API 1 made its direct port unavailable while every Nginx request remained 200 through API 2. After API 1 recovered, Nginx returned it to rotation following the five-second failure timeout.
- Stopping API 2 also left the proxy available. One response recorded both upstream addresses, proving Nginx attempted the failed replica and retried the healthy primary before returning 200. Database-backed discovery remained available and proxy access to metrics stayed 404.
- Final state: both APIs alternate through Nginx, proxy readiness is 200 with PostgreSQL/Redis OK, worker heartbeat age is zero, and Prometheus has no active alerts. This validates the stateless application path on the rehearsal VM; production TLS, PgBouncer, managed/host proxy configuration, and multi-target monitoring remain deployment work.

## 2026-10-28 — PgBouncer rehearsal startup fix

- The first API-only transaction-pool run correctly kept worker/migration connections direct, but both APIs became unready. PgBouncer logs identified PostgreSQL protocol error `08P01`: `statement_timeout` and `lock_timeout` were sent as unsupported startup parameters by `postgres-js`.
- Transaction-pooled API clients now omit those session startup parameters. Direct/session clients still apply PostgreSQL statement and lock timeouts; the rehearsal PgBouncer applies a 15-second query timeout, 10-second pool-wait timeout, and 5-second server-connect timeout. VM recreation and pool verification remain.
- After rebuild, both APIs became ready through PgBouncer and alternated normally through Nginx. `SHOW POOLS` reported the application database in transaction mode; API initialization logs reported pooler timeout enforcement while the worker remained healthy on its direct connection.
- A read-only 30-client, three-second pool test showed 12 active clients and 20 waiting clients (including the two persistent API clients), exactly 10 active PgBouncer server connections, and 11 active PostgreSQL application-user connections. The eleventh PostgreSQL connection was the direct inspection query itself. Proxy readiness remained 200, worker heartbeat age returned zero, and no alerts remained.

## 2026-10-28 — Isolated full-path VM load-test preparation

- Added a guarded Compose overlay that points only the two API replicas and PgBouncer at `turfbookpk_loadtest`; the normal rehearsal database and direct-connected worker remain isolated from synthetic data.
- Added one-shot migration, small realistic seed, and benchmark tool services. The initial VM seed contains 300 users, 30 grounds, 3,000 slots, about 300 bookings, payment/ledger rows, and player/vendor notifications.
- Extended the existing read benchmark to target an already-running API URL, allowing measurements through Nginx, both API replicas, PgBouncer, and PostgreSQL instead of silently launching a separate local API.
- Compose merge validation, benchmark syntax validation, and backend typecheck passed. The ordinary Windows build could not overwrite the pre-existing protected `dist` files; the clean VM image build and end-to-end benchmark remain the acceptance checks.

## 2026-10-28 — Full-path VM load baseline and first optimization

- The small realistic VM dataset passed 30 concurrent read clients for 30 seconds with 4,168 successful requests, zero failures, and about 139 aggregate successful requests/second. Every route stayed below the initial 500 ms p95 read target; vendor bookings and notifications were closest at 480 ms and 474 ms.
- A clean 50-client run produced 4,407 successes, zero failures, and about 147 aggregate RPS. Static/dynamic ground reads remained below 445 ms p95; player bookings reached 542 ms, vendor bookings 695 ms, and notifications 698 ms.
- At 60 clients throughput plateaued near 141 aggregate RPS and 60 requests failed (about 1.4%). PgBouncer logs proved queries exceeded its 15-second limit after clients abandoned them. A 40-client run with about 94 RPS and the same 1.4% failure rate was contaminated by leftover timed-out work and is not accepted as a capacity result.
- Reduced player/vendor booking list database round trips by folding the total count into the page query. Reduced notification list round trips from three to one by returning page rows, total count, and unread count from one query while preserving the response contract.
- Benchmark reports now classify HTTP status, client-timeout, and network failures; include attempts/error percentages; and allow a 20-second external-target cooldown before deleting temporary sessions. Rebuild and repeat 30/50/60 runs on the VM to measure the improvement.
- Follow-up logs proved neither API restarted. Abandoned five-second benchmark requests remained in the upstream path until PgBouncer/Nginx timeouts; Nginx then treated one timeout as enough to temporarily eject each otherwise healthy replica, producing a burst of secondary 502 responses in the next run. The harness now warms every route and waits 45 seconds—longer than the 35-second proxy timeout—before deleting sessions/exiting. Rehearsal Nginx requires three failures within ten seconds before passive replica ejection.
- Clean post-optimization results: 50 clients completed 4,904 requests at about 163 aggregate RPS with zero failures. Player bookings p95 fell to 397 ms, notifications to 413 ms, and vendor bookings remained the slowest at 597 ms. At 60 clients the VM crossed a queueing cliff, falling to about 54 aggregate RPS with 60 client timeouts (about 3.6%); all route groups slowed, indicating system-wide database-client queueing rather than one failed route.
- Added a load-test-only A/B configuration of five database clients per API replica. Two replicas now exactly match PgBouncer's ten-connection server pool; the normal rehearsal/production defaults remain unchanged until the 60-client rerun proves whether the 2-vCPU VM benefits or suffers from the extra database concurrency.
