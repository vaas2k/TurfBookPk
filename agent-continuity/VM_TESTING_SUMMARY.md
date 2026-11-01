# VirtualBox backend testing summary

**Test environment:** Ubuntu VM on a laptop, first with 2 vCPUs and then 4 vCPUs, with about 3.3 GB usable RAM. Docker ran PostgreSQL, Redis, one worker, two API replicas, PgBouncer, an Nginx proxy, and monitoring. All payment traffic in these tests used synthetic/mock data. The latest tests were completed on 30 October 2026.

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
| Full seed, VM generator, 4 vCPUs | 30 | 4,835 | ~161 | 0 | Vendor bookings: 373 ms |
| Full seed, VM generator, 4 vCPUs | 60 | 4,567 | ~152 | 0 | Vendor bookings: 749 ms |
| Full seed, Windows generator via SSH tunnel, 4 vCPUs | 30 | 3,869 | ~129 | 0 | Vendor bookings: 486 ms |
| Full seed, Windows generator via SSH tunnel, 4 vCPUs | 60 | 4,056 | ~135 | 0 | Vendor bookings: 871 ms |

The full seed contained about **10,000 users, 1,000 grounds, 500,000 slots, 50,000 bookings, and 100,000 notifications** in the isolated `turfbookpk_loadtest` database. The normal rehearsal database was kept separate. The like-for-like VM-generator comparison at 30 clients improved from about **103 to 161 RPS (+56%)** after moving from 2 to 4 vCPUs; slowest-route p95 fell from **567 to 373 ms**. With 4 vCPUs, raising concurrency to 60 reduced throughput slightly to 152 RPS and increased slowest-route p95 to 749 ms. The observed plateau for this read mix is around **150–160 RPS** on the 4-vCPU VM.

The separate like-for-like **Windows-generator** comparison improved from about **103 to 129 RPS (+26%)** at 30 clients and **102 to 135 RPS (+32%)** at 60 clients after adding two vCPUs. Both new runs had zero failures. The slowest p95 fell from 546 to 486 ms at 30 clients and from 1,042 to 871 ms at 60 clients. These requests crossed a local SSH tunnel; its overhead and laptop load mean the Windows and VM-generator rows should be compared within their own method only.

## What the tests changed

- Booking and notification list reads now use fewer database round trips. Dated discovery skips effective-price subqueries unless a price filter or price sort needs them.
- PostgreSQL planner statistics are refreshed after bulk seeding. The harness warms routes, identifies HTTP errors versus client timeouts, and waits for old requests to drain between runs. These changes eliminated misleading cold-run and leftover-request results.
- Increasing each API's database pool from three to five made the 2-vCPU test worse, so the VM kept three. Turning off API compression made no meaningful throughput difference, so compression stayed enabled. Disabling routine success logs produced inconclusive runs, so the default remains full logging.
- Representative query plans selected the expected indexes. CPU samples showed substantial usage across both APIs and PostgreSQL; the VM's CPU budget, rather than RAM or a single missing index, constrained the full-volume run.

## What this does not prove yet

This is a **single-host rehearsal**, not a production user-capacity guarantee. Booking writes through Nginx, both APIs, and PgBouncer passed 50/50 distinct holds at p95 290 ms. A ten-player race for one slot produced one success, nine HTTP 409 conflicts, and exactly one persisted matching hold. Ten concurrent mock-payment confirmations returned ten HTTP 200 responses while producing only one ledger entry, two notifications, and one vendor-earnings increment. OTP requests passed 100/100 at p95 279 ms; OTP verification passed 100/100 at p95 476 ms and created exactly 100 users and sessions. On two vCPUs, the 20-reader/50-write mixed run failed. After increasing the VM to four vCPUs, the same mix passed 4,519 reads and 50 writes with zero failures; read-route p95 was at most 282 ms and write p95 was 492 ms.

The final isolated multi-instance drill used a small `turfbookpk_worker_loadtest` database. Two API processes sharing Redis accepted 300 general requests and rejected request 301, then accepted five OTP requests and rejected request six from the same test IP. A worker was killed immediately after claiming one notification; another worker reclaimed it after the 45-second lease and marked it sent with two total claim attempts. Its temporary notification and outbox row were cleaned up, and the normal API remained ready. This verifies database recovery of that job state, while Expo delivery remains at-least-once if a worker dies after Expo accepts a push.

The next capacity measurement is on actual staging/VPS hardware. Production also needs TLS, a real alert receiver, encrypted off-host backups/PITR, and live payment-provider contracts and tests.

Detailed commands and individual test events are in [VIRTUALBOX_REHEARSAL.md](../Server/deploy/VIRTUALBOX_REHEARSAL.md), [DAY4_OPERATIONS.md](../Server/deploy/DAY4_OPERATIONS.md), and [SCALABILITY_TASK_JOURNAL.md](SCALABILITY_TASK_JOURNAL.md).
