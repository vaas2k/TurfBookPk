# TurfBookPK Backend Scalability and Deployment-Readiness Checklist

Created from the backend architecture audit on 2026-10-24. This checklist is intentionally separate from the functional and UI backlogs. Complete the P0 items before running more than one API instance or accepting production payments.

## Audit conclusions

- The request/response API is mostly stateless because durable auth, booking, payment, notification, and verification state lives in PostgreSQL and media lives in Cloudinary.
- It is not yet operationally safe to scale horizontally: rate-limit state is process-local, scheduled work runs inside every API process, and external side effects are not dispatched through a durable queue.
- PostgreSQL and query shape will become the first capacity limit. Several public/admin paths retrieve complete matching datasets and paginate or aggregate in Node.js.
- Recurring schedule materialization currently runs during public ground reads. Read traffic can therefore create write traffic and contention.
- The schema has strong uniqueness/idempotency foundations but too few secondary indexes for growing slot, booking, notification, payment, and admin datasets.
- Slot booking/payment confirmation uses conditional writes, transactions, unique keys, and a PostgreSQL advisory lock. Preserve these correctness guarantees during optimization.
- Static ground metadata is cacheable. Slot availability, active holds, booking state, payment state, balances, and verification decisions must remain authoritative from PostgreSQL and must not be served from a long-lived cache.

## Day 1 progress note (2026-10-24)

Day 1 implementation and local measurements are recorded in `Server/SCALABILITY_BASELINE.md`. A separate, guarded `_loadtest` database contains 10k users, 1k grounds, 500k slots, 50k bookings, and 100k notifications. The ordinary development database was not seeded. Dated discovery now pages and aggregates in SQL; recurring schedule checks are batched. Hosted staging measurements, database CPU/connection telemetry, and an OTP-specific load scenario remain necessary before making a capacity claim.

## Day 1 — P0 database and query foundations

- [ ] Capture a baseline before modifying code.
  - [x] Seed an isolated local load-test database with at least 10k users, 1k grounds, 500k slots, 50k bookings, and 100k notifications.
  - [ ] Add a dedicated OTP-login scenario; the repeatable HTTP harness already covers home/discovery, ground detail, booking hold, payment status, and vendor booking lists.
  - [ ] Record throughput, error rate, database CPU/connections, and p50/p95/p99 latency.
- [x] Add initial PostgreSQL lookup indexes through migration `0024_scalability_query_indexes.sql`; migration validated and applied to the local development database.
  - [x] `slots (ground_id, date, start_time)` and partial indexes for available slots and expiring active holds.
  - [x] `bookings (player_id, created_at desc)`, `(vendor_id, created_at desc)`, `(status, date, end_time)`, `(order_id)`, and recurring payment-window columns.
  - [x] `grounds (vendor_id)`, public active/verified discovery fields, city, rating, and price sorting fields.
  - [x] `notifications (user_id, created_at desc)` and unread-notification lookup.
  - [x] `payment_attempts (provider_status, expires_at)`, player/booking/order lookup, and manual-review lookup.
  - [x] Pending push-receipt, ledger, review/report, favorite, recent-view, verification, and audit-log lookup indexes.
  - [x] Verify representative index selection on the seeded load-test database; repeat on hosted staging before production acceptance.
  - [x] Audit blackout/template duplicates on local and load-test databases and add uniqueness migration `0027`; audit production separately before applying it there.
- [x] Replace application-side public-ground pagination for ordinary discovery with SQL `LIMIT/OFFSET` plus a database count query.
- [x] Aggregate ordinary discovery availability in SQL for only the requested page.
- [x] Replace availability-date loading for every matching ground with SQL paging and aggregation constrained to the requested page.
- [x] Bound ground detail slots to the current booking horizon and skip past dates in SQL.
- [x] Replace vendor ground list fetch-then-slice with SQL pagination and count.
- [x] Paginate public reviews and favorites; retain a small explicit limit for recent grounds.
- [x] Move admin dashboard aggregation from 5,000-row Node.js scans to SQL aggregate/group queries.
- [x] Add optional cursor pagination for notifications, bookings, transactions, and audit logs while preserving page/offset compatibility.
- [x] Run `EXPLAIN (ANALYZE, BUFFERS)` on representative load-test queries and record results in `Server/SCALABILITY_BASELINE.md`; repeat on hosted staging.

## Day 2 — P0 worker, Redis, and multi-instance safety

- [x] Add a Redis client with validated `REDIS_URL`, readiness reporting, reconnect policy, and namespaced rate-limit keys. Production refuses to start without Redis; local development can still use a single-process fallback.
- [x] Replace the in-memory OTP/IP rate limiter with a Redis-backed atomic limiter when configured.
  - [x] Add explicit trusted proxy hop count; set it to the exact production proxy chain after validating forwarded IP headers.
  - [x] Keep the existing database-backed phone-number OTP cooldown/attempt protections as the authoritative second layer.
  - [x] Add global and sensitive-route limits for auth, uploads, payment generation/status, acknowledgments, booking creation, and admin operations; tune thresholds with staging traffic.
- [x] Create a separate worker entry point/process and remove maintenance timers from API startup.
- [x] Move these jobs to the worker:
  - [x] recurring reservation payment-window opening and expiry;
  - [x] ended-booking completion;
  - [x] Clink reference expiry and interrupted-generation manual-review escalation run in the worker; unknown provider results are never retried automatically.
  - [x] Expo push delivery and receipt processing run in the worker through the notification outbox.
  - [x] Recurring-slot horizon extension and bounded cleanup of unbooked slots older than three full Pakistan calendar days run in the worker. Booking-linked, blocked, club-reserved, and held slots are excluded.
- [x] Push delivery uses a durable PostgreSQL outbox with unique notification identity, bounded retry, dead-letter/manual-review state, and observability. Indexed maintenance scans derive due work from authoritative rows and use idempotent state changes; Clink expiry retry state is persisted, so a duplicate per-item job table is not required for those scans.
- [x] Protect current scheduled maintenance with PostgreSQL session advisory locks so multiple workers cannot own the same scan.
- [x] Replace booking and payment full-table 15-second scans with due-only batches of at most 200 and 100 records respectively; receipt scans were already bounded.
- [x] Move push sending out of request paths and into a PostgreSQL outbox; direct legacy calls are compatibility no-ops and the worker sends from committed notification rows.
- [x] Add a transactional notification outbox for booking/payment/admin notifications. Expand to any other external side effects before they are introduced.
- [x] Add bounded exponential push retry, dead-letter state, worker logs, admin queue counts, and audited manual retry. Expo transport remains at-least-once: a crash after Expo accepts a ticket but before marking it sent can cause a duplicate push.
- [x] Parallel worker claim, advisory-lock exclusivity, booking-completion earnings, and duplicate Clink acknowledgment integration tests prove one local database state transition, ledger entry, payment event, and notification/outbox record. Repeat across deployed API/worker processes on staging.
- [ ] Run a real-device Expo retry/tap test and a hosted staging failure drill. An isolated local drill with two API and two worker processes passed: one shared Redis limit and one outbox delivery; fail-closed/reconnect, abandoned-lease recovery, and dead-letter tests pass.

## Day 3 — P0 caching, connection management, and lifecycle

- [x] Split recurring schedule materialization from public read endpoints.
  - [x] Materialize on schedule creation/change and through worker horizon-extension jobs.
  - [x] Make public discovery/detail endpoints read-only.
  - [x] Make materialization bulk/idempotent and enforce database uniqueness for generated slots.
- [x] Add cache-aside Redis caching only for stable public ground metadata and low-risk discovery fragments. Ordinary discovery caches the static filtered page; current slot summaries remain separate PostgreSQL queries. Dated discovery stays uncached because effective price and availability are live.
  - [x] Version cache keys and use a short TTL for public ground metadata.
  - [x] Invalidate ground metadata cache by PostgreSQL row version and static discovery pages by transactional catalog revision after ground edits, approval, suspension, activation, image, pricing, rules, amenities, and vendor visibility changes.
  - [x] Never long-cache live slots, holds, bookings, payment attempts, earnings/balances, unread counts, or verification queues; cache keys exist only for public ground metadata and static discovery pages.
  - [x] Fetch current slot availability from PostgreSQL separately from cached ground metadata and discovery pages.
  - [x] Allow metadata cache failure to degrade to PostgreSQL instead of failing requests.
- [x] Add HTTP caching headers/ETags for safe public metadata and immutable Cloudinary assets. Metadata ETag and dynamic `no-store` are implemented. New signed public uploads cannot overwrite their UUID-backed `/v1/` URL; a public CDN sample returned a 30-day cache header and ETag. Recheck headers on the deployed account.
- [x] Add response compression at the API layer after measuring CPU trade-offs. Public ground routes use gzip/Brotli above 1 KB; `API_COMPRESSION=false` disables it if proxy or staging measurements favor another setup.
- [x] Make database pool size and timeouts configurable; the runbook documents the API/worker connection budget. Confirm the actual VPS/PostgreSQL limit before rollout.
- [ ] Put only API replicas behind PgBouncer transaction pooling and retain `prepare: false` compatibility. Worker and migration session advisory locks require direct PostgreSQL or PgBouncer session pooling; a startup guard and separate-URL runbook are in place. Verify the actual host configuration before rollout.
  - [x] Verify on VirtualBox that both APIs use transaction pooling while worker/migration stay direct; a 30-client rehearsal capped PgBouncer server connections at 10 and preserved API/worker health.
- [ ] Database statement, lock, connection, and idle timeouts are configured; enable and verify slow-query logging on deployed PostgreSQL.
- [x] Add explicit timeouts and bounded response-size handling to Clink, Cloudinary deletion, and Expo push/receipt HTTP integrations.
- [x] Add graceful shutdown for `SIGTERM`/`SIGINT`: API stops accepting requests and drains connections; worker waits for active jobs; both close PostgreSQL/Redis. Verify signal delivery and grace timing on hosted staging.
- [x] Separate liveness from readiness.
  - [x] Liveness confirms the Node process is responsive.
  - [x] Readiness checks PostgreSQL connectivity, required schema objects, and configured Redis; it fails during shutdown.
- [x] Add migration locking/a single migration job so replicas never race migrations during rollout; `npm run db:migrate` takes a PostgreSQL advisory lock. Keep migration execution outside replica startup.

## Day 4 — P1 reliability, security, and verified capacity

Local Day 4 preparation is documented in `Server/deploy/DAY4_OPERATIONS.md`. The VM/staging drill remains the acceptance gate for operational items; source files alone do not prove alerts, backups, or capacity.

The completed VirtualBox rehearsal and measured read-load results are summarized in `agent-continuity/VM_TESTING_SUMMARY.md`.

- [ ] Add structured metrics for request count, status, route latency, active requests, DB pool wait, query latency, queue depth/age, job retries/failures, payment states, and cache hit ratio.
  - [x] Add token-protected Prometheus metrics for route response counts/latency, active requests, database connection count, outbox depth/age, payment states, worker heartbeat, job outcomes/retries, and cache access.
  - [ ] Add measured DB pool wait/query latency on the chosen production telemetry stack.
- [ ] Add centralized error reporting/APM with the existing sensitive-data redaction rules.
- [ ] Add alerts for p95 latency, 5xx rate, database saturation, queue lag/dead letters, payment expiry failures, manual-review growth, and callback failures. Eleven rules pass `promtool`; both local Docker and the VirtualBox VM scraped the private API metrics, and a missing-worker alert fired, reached the rehearsal receiver, and resolved. Connect and verify a real on-call receiver before deployment.
- [x] Avoid logging full error stacks in production unless explicitly enabled for an access-controlled log destination; continue excluding request bodies and credentials.
- [ ] Harden CORS, proxy trust, security headers, request-body limits, admin export limits, and private-document delivery for the actual deployment domains/proxy.
  - [x] Require explicit production HTTPS browser origins, validate request IDs, retain Helmet/body-size limits, mark private document URLs `no-store`, and bound/admin CSV exports to 100 current-page rows with spreadsheet-formula escaping.
  - [ ] Verify proxy trust and private document behavior on the deployed domains.
- [x] Add a bounded retention/cleanup worker for expired OTP challenges, revoked/expired refresh sessions, checked push receipts, and sent outbox rows. Payment idempotency/events and unresolved jobs remain retained; Redis cache keys already expire by TTL.
- [x] Review access-token session lookup cost. Current lookup is one primary-key PostgreSQL read per authenticated request, preserving immediate logout/suspension behavior. Do not cache it until the VM load test shows a material bottleneck and revocation invalidation is designed.
- [ ] Add database backup automation, restore rehearsal, point-in-time recovery where supported, and documented rollback/forward-fix procedures. A local `pg_dump` archive restored with its fixture into a separate disposable database; VM scripts passed Bash syntax. Scheduled encrypted off-host backups/PITR and restore-time measurement require the VM or hosted database.
- [ ] Run failure tests: Redis unavailable, one API replica killed, worker killed mid-job, PostgreSQL failover, Clink timeout, Expo timeout, duplicate callback, and delayed callback after expiry. Local and VirtualBox drills passed for Redis/PostgreSQL outage and recovery, Nginx failover in both API directions, worker heartbeat alert/recovery, worker lease reclaim, duplicate callback, and late callback. Actual database failover and external-provider timeout drills remain.
- [ ] Run the final load test against staging with production-like networking and data volume.
  - [ ] No double bookings or duplicate ledger/notification effects.
  - [ ] Error rate below 1% excluding deliberate validation/rate-limit responses.
  - [ ] Define and meet an initial p95 target (recommended: under 500 ms for cached reads and under 1 s for booking writes excluding payment-provider latency).
  - [ ] PostgreSQL connections remain below 70–80% of the configured maximum.
  - [ ] Queue lag remains within the booking/payment timing requirements.
  - [ ] Document the verified RPS/concurrency ceiling and set autoscaling below that ceiling.

## Deployment shape after completion

- [ ] Load balancer/reverse proxy terminating TLS.
  - [x] Verify HTTP-only localhost Nginx rehearsal load balancing and failover across two API containers; production TLS and host routing remain.
- [ ] At least two identical stateless API replicas when high availability is required.
  - [x] Verify two VM API replicas share PostgreSQL/Redis and either replica can serve database-backed requests while the other is stopped.
- [ ] One or more independently scaled worker replicas using distributed job ownership.
- [ ] Managed PostgreSQL with backups/PITR and PgBouncer.
- [ ] Managed Redis with authentication, TLS, persistence appropriate to the selected queue, and eviction rules that do not discard queue data.
- [ ] Cloudinary remains the object-storage adapter; private verification documents remain authenticated/private.
- [ ] Centralized logs, metrics, alerts, and error tracking.

## Explicit non-goals for this pass

- [ ] Do not introduce Kubernetes solely for the first deployment. Use a managed container platform or simple container/VPS deployment until operational scale justifies Kubernetes.
- [ ] Do not cache correctness-critical booking or payment decisions.
- [ ] Do not weaken conditional slot claims, payment idempotency, PostgreSQL transactions, or the late-payment manual-review path for performance.
- [ ] Do not enable live Clink payments until callback authentication/status verification and the remaining provider contract are available.

## Definition of done

- [ ] Two API replicas and at least one worker can run concurrently without duplicate jobs or inconsistent rate limits.
- [ ] API replicas contain no required process-local durable state and run no embedded recurring timers.
- [ ] Discovery, ground detail, booking lists, notifications, admin analytics, and maintenance operate on bounded/index-supported queries.
- [ ] Static metadata caching improves latency without making slot/booking/payment information stale.
- [ ] Graceful rollout, readiness, backup/restore, monitoring, failure tests, and load-test results are documented and verified in staging.
