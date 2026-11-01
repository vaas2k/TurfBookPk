# Current payment workflow test plan

Status: in progress. Local focused tests, backend checks, and an Android Expo Go payment UI rehearsal passed. Provider-origin and native-device checks remain. This document does not approve live payments.

## Android emulator rehearsal — 1 November 2026

- A disposable player signed in through the local OTP API, selected a real catalog slot for the following day, and reached checkout. Invalid billing data was rejected; valid test billing data saved privately.
- The current Clink sandbox reference request returned 502, so the remaining UI flow used a fake reference attached only to that disposable unresolved attempt while its hold was still owned by the test player. This did not test Clink reference generation or bank payment.
- Booking Details reopened the pending 1-Bill screen, including consumer number, QR, countdown, and status. The pending booking survived an Expo Go process restart.
- A controlled local acknowledgment returned status `1`; repeating it returned `2`. The app showed confirmation and moved the booking to Upcoming. Database inspection found exactly one confirmed booking, booked slot, ledger entry, and payment event. All test rows and the slot claim were removed afterward and verified absent.
- The installed old development build could not run SDK 58 JavaScript. A fresh Android native build was blocked by a Reanimated CMake path-length error on Windows, so remote push and native development-build behavior were not tested. Real provider IP whitelisting and authenticated callback tests remain external gates.

## Results so far — 30 October 2026

- Created and migrated a separate local `turfbookpk_payment_loadtest` database. The ordinary application database was not used. The full backend suite passed **58/58** tests against it; afterward, users, bookings, payment attempts, ledger entries, and payment events were all back to zero.
- Concurrent Clink confirmation test passed: one booking/slot confirmation, one earning ledger row, one payment event, and one vendor balance increment. A duplicate confirmation did not repeat effects.
- Late acknowledgment test passed: paid-unallocated/manual-review status, no booked slot, no vendor earning, and one payment event.
- Added and passed a same-day two-slot order test: both slots confirmed atomically from one attempt, two earning ledger rows totaling the expected vendor amount, one payment event, and expected notifications. Duplicate confirmation did not repeat effects.
- Found that an impossible provider date such as 31 February rolled into March. The acknowledgment parser now rejects impossible dates and converts valid Pakistan-local times to UTC; focused tests pass.
- Found that the unsigned sandbox acknowledgment flag could be set with `NODE_ENV=production` while the provider environment was still `sandbox`. Production now refuses that flag at startup; a subprocess test verifies the guard. Unexpected internal callback errors now return a generic description instead of raw error text.
- Typecheck passed. These initial results exercised database transitions and configuration; they did **not** yet prove real provider-origin acknowledgment or the later race scenarios.

### Follow-up local results — 30 October 2026

- Simultaneous reference requests against an injected fake Clink provider resulted in exactly one provider generation call and one persisted reference. The other request received an in-progress conflict. Reference initialization now uses an atomic payment-attempt claim.
- A stale expiry worker result after a paid confirmation did not release the booked slot or overwrite the paid attempt. Late payment after an expired hold still enters manual review. A real provider response arriving concurrently with expiry remains an external sandbox/staging test.
- Reference generation now rechecks slot ownership and availability before contacting Clink. A blocked slot was rejected without another provider call. Future recurring bookings cannot generate a reference before their payment window opens.
- Local HTTP checks returned 401 without auth, 404 when another user requested the attempt, and 200 for its owner. The callback endpoint refused a known reference when the sandbox flag was off. With the flag on in a loopback-only test API, malformed JSON, impossible dates, unknown references, and a body over 32 KB were rejected without changing payment state.
- Added a read-only per-attempt reconciliation check for paid/confirmed booking and slot state, earning ledger amounts, payment events, and paid-unallocated review state. It reported no issues on valid fixtures and detected a deliberately altered ledger amount.
- The full isolated backend suite passed **59/59** tests; server typecheck and build passed. Test users, bookings, attempts, ledger entries, events, and refresh sessions returned to zero.
- The isolated four-vCPU VM rehearsal passed ten concurrent paid acknowledgments through two API instances: one first response, nine duplicates, one booking confirmation, one ledger row, one payment event, and one vendor earnings increment. With one API stopped, the surviving API produced the same single-effect result.
- A second VM case sent ten concurrent paid acknowledgments after the hold expired. It produced one first response, nine duplicates, paid-unallocated/manual-review state, one payment event and player notification, and no booking allocation, ledger row, or vendor earning.
- The isolated VM worker recovery drill passed: with the payment worker stopped, one outbox notification stayed pending and another was left with an expired processing lease. On restart, the worker sent both; their attempt counts were 1 and 2 respectively and stayed unchanged on a second check. Test rows were removed and the isolated worker stopped.
- Remaining external gates: real Clink reference/expiry/acknowledgment timing, callback authentication or status inquiry, actual paid amount/fees, refunds and settlement. Worker interruption during a real provider expiry call and mobile device payment-state tests still remain.

## Test boundary and environment

- Use a disposable migrated `*_payment_loadtest` PostgreSQL database, test users/grounds/slots, and a separate Redis namespace or instance. Never use the ordinary development, rehearsal, or future production database for destructive payment drills.
- Start with local PostgreSQL, Redis, API, and worker. Use a stubbed Clink adapter for deterministic errors/timeouts; use Clink's sandbox only for documented reference generation and expiry calls. Never send a real banking payment during these tests.
- Configure `PAYMENT_PROVIDER=clink`, `PAYMENT_ENVIRONMENT=sandbox`, a 15-minute local hold, and the explicit unsigned-acknowledgment flag only in the isolated test environment. Keep live mode startup blocked. Keep credentials and generated payer data out of tracked files and test output.
- Record test IDs and request IDs, but redact CNIC, billing address, gateway credentials, bearer tokens, and full consumer numbers from logs and reports. Clean up only records created by each test.

## Phase 1 — Map and secure the flow

1. Trace one booking and one order through slot hold, attempt creation, Clink token/reference, payment status, acknowledgment, booking/slot confirmation, payment event, ledger, notifications, and admin view. Document every expected state and database invariant.
2. Review authorization: a player may read/change only their own billing profile and payment attempts; another player, vendor, and unauthenticated caller cannot generate or view them. Check admin visibility and private-document boundaries.
3. Verify sandbox acknowledgment rejects malformed JSON, unknown IDs, invalid status/date, oversized bodies, and excessive requests. Confirm the unsigned endpoint is enabled only by the sandbox flag and production startup always rejects live Clink mode. **An unsigned acknowledgment cannot prove a real payment.** Do not expose this test mode to public users.
4. Inspect request and error logging for sensitive data; verify stored CNIC/address encryption, CNIC masking, key rotation/recovery plan, TLS expectations, and no secret in mobile bundles or API responses. Use OWASP ASVS for API controls and MASVS for mobile storage/network checks.
5. Review the `FAILED` acknowledgment path, concurrent reference-generation path, and the race between acknowledgment and reference expiry. Add failing tests or fixes for any path that can release a paid hold, generate two active bills, omit a payment event, or report a state that differs from the database.

## Phase 2 — Deterministic payment scenarios

For every case, assert the HTTP response **and** the final database rows, including the absence of extra rows.

| Scenario | Required outcome |
| --- | --- |
| Single-slot payment, one valid paid acknowledgment | One confirmed booking and booked slot; one paid attempt, one payment event, one earning ledger row, one vendor balance increment, expected player/vendor notifications. |
| Same-day multi-slot order | Every payable slot confirms atomically under one attempt/reference; one earning row per booking; order status and totals agree. |
| Future recurring slot | Initial day's payable slots confirm; future dates stay reserved and receive separate attempts only in their payment windows. |
| Duplicate and concurrent paid acknowledgments | First response succeeds, later responses are duplicates; no repeated booking, event, ledger, balance, or notification effects. |
| Duplicate/concurrent reference requests | At most one active provider reference per attempt; ambiguous provider calls are never retried automatically. |
| Definite generation rejection | Attempt fails and the held slots release exactly once. |
| Token/generation timeout or lost response | Attempt becomes unknown/manual review; no automatic second bill and no false booking confirmation. |
| Expiry at, before, and after the 15-minute boundary | Provider expiry succeeds before releasing the hold; failure retains a reviewable state and does not silently free an active bill. |
| Paid acknowledgment racing expiry, or arriving after expiry/another booking | No slot is stolen. If paid but unallocated, preserve payment evidence and open manual review without vendor earnings. |
| Failed acknowledgment, duplicate failure, and failure followed by paid | Final state is deterministic; no paid booking or ledger entry without valid payment evidence. |
| API/worker killed between each stage | Recovery leaves a visible, reconcilable attempt; no duplicate external call or database effect. |
| Cancellation/refund liability | Refund calculation uses amount paid and locked policy; `refund_pending` is not displayed as a completed gateway refund. |

## Phase 3 — Reconciliation and security abuse tests

- Build a read-only reconciliation report over a bounded test period: paid attempts without matching confirmed bookings; confirmed bookings without paid attempts; booked slots without matching confirmed bookings; duplicate payment events/earning keys; vendor pending earnings versus ledger sum; paid-unallocated attempts without manual-review state; expired attempts whose bill/hold status conflicts.
- Reconcile amounts for single bookings, multi-slot orders, discounted bookings, commission, cancellation, and partial-refund liability. Confirm that the report identifies deliberately injected inconsistencies, then remove only those fixtures.
- Test ID swapping, role changes, revoked sessions, forged `X-Forwarded-For`, repeated callbacks, body-size limits, SQL/input validation, and rate limits through the same proxy configuration planned for deployment. Verify metrics and alerts expose growing manual-review or expiry-retry queues without payer identity.
- Test the provider adapter with a local fake server for slow responses, malformed JSON, wrong IDs/amounts, 4xx/5xx, connection resets, and retry behavior. Never use real sandbox calls for a high-rate fault test.

## Phase 4 — Mobile and full-path rehearsal

- On Android and iPhone development builds, complete checkout, copy/scan the consumer number, restart the app while payment is pending, refresh status, receive a controlled acknowledgment, and confirm the booking screen matches the server. Repeat for failed, expired, unknown, and manual-review states.
- Test offline/slow network, double taps, back navigation, app background/foreground, expired session during polling, and a notification tap. The app must never claim payment or booking success before the server confirms it.
- After local tests pass, run the same limited scenarios on the four-vCPU VM with two APIs, one worker, Nginx, Redis, and PgBouncer. Kill one API or worker during a payment and inspect reconciliation afterward. A public HTTPS callback test with a genuine provider-origin acknowledgment waits for Clink's documented authentication and test setup.

## Evidence and stop conditions

- Keep a case-by-case result table with request IDs, sanitized attempt IDs, expected/actual statuses, row counts, ledger sums, and pass/fail. A test is not complete because the UI looked correct.
- Stop on any confirmed booking without a paid attempt, paid attempt without a booking or manual-review case, missing/duplicate ledger effect, unauthorized payment action, or unexplained provider call. Fix the cause and rerun the affected flow before continuing.
- Live mode remains blocked until Clink supplies an authenticated callback or status inquiry, exact bill-expiry behavior, amount/fee confirmation, refund and settlement contracts, and real end-to-end provider testing.

## Do we need the VM now?

No. Phases 1–3 can start locally with an isolated database and a fake provider. Start the VM for Phase 4 after those tests pass; it adds value for multi-instance failover and proxy/pool behavior. It is not needed just to write tests or inspect the payment logic.
