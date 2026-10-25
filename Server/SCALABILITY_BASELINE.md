# Day 1 scalability baseline — 2026-10-24

## Dataset and safety

The repeatable seed creates a separate PostgreSQL database named `turfbookpk_loadtest`. It refuses to run against the ordinary development database, any database without `_loadtest` or `_staging` suffix, or `NODE_ENV=production`. The seed is deterministic and can be rerun without duplicating its records.

The full local dataset contains 10,000 synthetic users, 100 approved vendors, 1,000 approved grounds across five cities, 10,000 recurring schedule templates, 500,000 hourly slots across 50 days, 50,000 paid bookings, 50,000 payment attempts, 50,000 earnings entries, and 100,000 player/vendor notifications. About 10% of slots are booked. Ground prices vary; later slots carry a higher price. All names and phones are synthetic. Images, external provider latency, real OTP delivery, refunds, and complex concurrent payment callbacks are not represented.

The tests ran on one local machine with 8 logical CPUs and 16 GB RAM. PostgreSQL and the API share that machine. These numbers are useful for comparing code changes, not as a hosted production capacity promise.

## Reproduce

From `Server/`:

```powershell
node scripts/prepare-scalability-database.mjs --small
node scripts/prepare-scalability-database.mjs
npm run build
node scripts/check-scalability-queries.mjs --loadtest
node scripts/check-scalability-cursors.mjs
node scripts/explain-scalability.mjs
node scripts/benchmark-scalability.mjs
node scripts/benchmark-scalability.mjs --vus=30 --seconds=15
node scripts/benchmark-booking-writes.mjs
```

The preparer derives `_loadtest` from the configured `Server/.env` database URL, creates that separate database, applies migrations, and seeds it. `--small` makes a quick 300-user/3,000-slot validation dataset. The full command grows it to the dataset above. `--migrate-only` applies new migrations without rerunning the seed. The HTTP benchmarks start their own local API process against the load-test database; they do not switch the ordinary API's database. The booking-write benchmark cleans up only bookings and sessions created by its own run.

The load harness uses a 39-day advance horizon because the seeded schedule covers today plus 39 future days. Deployment testing should use the intended production horizon and a matching larger seed.

## Measured HTTP results

The seven-route read mix covers ordinary discovery, date discovery, ground detail, player and vendor booking lists, notification history, and payment status. These are 15-second warm-cache runs with no artificial think time.

| Concurrency | Successful requests | Errors | Aggregate throughput | Discovery p95 | Dated discovery p95 | Ground detail p95 | Player bookings p95 | Vendor bookings p95 | Notifications p95 | Payment status p95 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 1,162 | 0 | about 77.5 req/s | 275 ms | 274 ms | 225 ms | 158 ms | 235 ms | 209 ms | 116 ms |
| 30 | 1,085 | 0 | about 72.3 req/s | 933 ms | 724 ms | 694 ms | 524 ms | 683 ms | 669 ms | 346 ms |

The throughput flattening and higher latency at 30 clients indicate saturation on this shared local setup. A 10-client run is the useful initial comparison point; hosted capacity must be measured again on staging hardware.

A separate booking-write run made 50 unique holds with 10 concurrent clients: 50 succeeded, 0 failed, about 19.5 writes/s, p50 363 ms, p95 930 ms, p99 1,378 ms. Those test holds and sessions were removed afterward.

The earlier discovery-only run with recurring templates but before the schedule-horizon lookup reached about 14.3 req/s total with 859–877 ms p95. After batching schedule checks and adding the indexed horizon lookup, a discovery-only run reached about 36.8 req/s total with 416–476 ms p95. The mixed-route numbers above are the final baseline.

## Representative query plans

`node scripts/explain-scalability.mjs` runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` on the isolated seeded database. A warm-cache sample showed:

| Query | Execution | Main index |
| --- | ---: | --- |
| Public ground page | 0.118 ms | `grounds_public_rating_idx` |
| Page availability aggregation | 7.759 ms | `slots_available_ground_date_idx` |
| Dated slots for a page | 0.896 ms | `slots_available_ground_date_idx` |
| Recurring schedule horizon | 8.617 ms | `slots_template_latest_idx` |
| Player bookings page | 0.132 ms | `bookings_player_created_idx` |
| Notification page | 0.135 ms | `notifications_user_created_idx` |
| Global paid GMV aggregate | 18.443 ms | Full scan of 50,000 bookings |

The global GMV aggregate deliberately scans paid bookings. If dashboard traffic or booking volume makes that costly later, introduce a materialized summary maintained from ledger/payment events. The query plans must be repeated on hosted staging because cache size and PostgreSQL settings will differ.

## Known limits of this baseline

- OTP login is protected by deliberate per-IP and per-phone rate limits, so it was not sprayed from one localhost IP. Authenticated read requests did exercise session lookup on every call.
- The write run measured unique slot holds, not 1-Bill generation or external provider acknowledgment. Payment-provider timing needs a separate sandbox test.
- No database CPU, connection-pool wait, or queue-lag telemetry is available yet. Add those metrics in the observability phase before setting autoscaling limits.
- Public reads still check recurring schedule horizons; Day 2/3 worker extraction should remove the remaining write possibility from these routes and be rebenchmarked.
