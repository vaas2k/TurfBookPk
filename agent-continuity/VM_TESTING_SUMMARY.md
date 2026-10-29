# VirtualBox backend testing summary

**Test environment:** Ubuntu VM on a laptop, 2 vCPUs and about 3.3 GB usable RAM. Docker ran PostgreSQL, Redis, one worker, two API replicas, PgBouncer, an Nginx proxy, and monitoring. All payment traffic in these tests used synthetic/mock data. Tests were completed on 29 October 2026.

## What we verified

- **Recovery:** When Redis or PostgreSQL stopped, `/api/health` still reported a live process while `/api/ready` returned 503. Readiness returned to 200 after each dependency restarted. The worker reconnected.
- **API failover:** Nginx distributed requests across both API replicas. Stopping either replica left the proxy serving successful database-backed requests through the other. This protects against one API process failing; all components still share one VM.
- **Worker alerts:** Prometheus scraped the private metrics endpoint. Stopping the worker triggered the missing-worker alert in the test Alertmanager receiver; restarting it resolved the alert. Eleven alert rules validated. The receiver was a test sink, not a real on-call destination.
- **Backup and restore:** A PostgreSQL archive was created, checksum-checked, and restored into a separate disposable database. The rehearsal database had no users at that point, so the restored user count was zero; the restore procedure itself succeeded.
- **Connection pooling:** PgBouncer used transaction pooling for the two APIs; the worker and migration job used direct PostgreSQL connections for their session locks. With 30 waiting/active read clients, PgBouncer held the server pool at 10 connections. We fixed incompatible PostgreSQL startup parameters that initially prevented the APIs from becoming ready.

## Load-test results

The seven read routes were discovery, dated discovery, ground detail, player bookings, vendor bookings, notifications, and payment status. **Concurrency means active request clients, not total registered users.** RPS means successful requests per second; p95 is the time within which 95% of successful requests finished.

| Data volume and generator | Active clients | Successful requests / 30 s | Total RPS | Failures | Slowest p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Small seed, VM generator | 60 | 4,961 | ~165 | 0 | Vendor bookings: 689 ms |
| Full seed, VM generator | 30 | 3,103 | ~103 | 0 | Vendor bookings: 567 ms |
| Full seed, Windows generator via SSH tunnel | 30 | 3,079 | ~103 | 0 | Vendor bookings: 546 ms |
| Full seed, Windows generator via SSH tunnel | 60 | 3,065 | ~102 | 0 | Vendor bookings: 1,042 ms |

The full seed contained about **10,000 users, 1,000 grounds, 500,000 slots, 50,000 bookings, and 100,000 notifications** in the isolated `turfbookpk_loadtest` database. The normal rehearsal database was kept separate. On the full seed, raising concurrency from 30 to 60 did not increase throughput and made responses slower. For this specific read mix, the VM's measured plateau was about **100 RPS**.

## What the tests changed

- Booking and notification list reads now use fewer database round trips. Dated discovery skips effective-price subqueries unless a price filter or price sort needs them.
- PostgreSQL planner statistics are refreshed after bulk seeding. The harness warms routes, identifies HTTP errors versus client timeouts, and waits for old requests to drain between runs. These changes eliminated misleading cold-run and leftover-request results.
- Increasing each API's database pool from three to five made the 2-vCPU test worse, so the VM kept three. Turning off API compression made no meaningful throughput difference, so compression stayed enabled. Disabling routine success logs produced inconclusive runs, so the default remains full logging.
- Representative query plans selected the expected indexes. CPU samples showed substantial usage across both APIs and PostgreSQL; the VM's CPU budget, rather than RAM or a single missing index, constrained the full-volume run.

## What this does not prove yet

This is a **single-host rehearsal**, not a production user-capacity guarantee. The next tests are booking-write and OTP traffic, mixed read/write load, worker interruption during active jobs, and measurements on the actual staging/VPS hardware. Production also needs TLS, a real alert receiver, encrypted off-host backups/PITR, and live payment-provider contracts and tests.

Detailed commands and individual test events are in [VIRTUALBOX_REHEARSAL.md](../Server/deploy/VIRTUALBOX_REHEARSAL.md), [DAY4_OPERATIONS.md](../Server/deploy/DAY4_OPERATIONS.md), and [SCALABILITY_TASK_JOURNAL.md](SCALABILITY_TASK_JOURNAL.md).
