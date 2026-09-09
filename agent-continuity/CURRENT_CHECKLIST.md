# TurfBookPK Current Checklist

This is the working backlog from the 2026-09-08 project audit. Complete tasks in priority order unless a documented dependency requires otherwise.

## P0 - Booking and data integrity

- [x] Define explicit booking, payment, and slot state machines before changing the schema.
  - [x] Define allowed booking states and transitions.
  - [x] Define allowed payment states and transitions.
  - [x] Define slot states, including temporary holds and hold expiry.
  - [x] Decide which states are stored and which are derived from time/data.
- [x] Replace free-form booking/payment status strings with database-enforced values.
- [x] Stop creating mock bookings as implicitly `paid` without an explicit mock-payment decision.
- [x] Stop marking every cancelled booking as automatically `refunded`.
- [x] Make cancellation conditional and idempotent.
  - [ ] Lock or conditionally update the booking only from a cancellable state.
  - [ ] Release the slot only when `slots.booking_id` matches the cancelled booking.
  - [ ] Prevent concurrent cancellations from releasing a newly rebooked slot.
  - [ ] Prevent duplicate cancellation notifications.
  - [ ] Record cancellation actor, reason, and timestamp.
- [x] Add temporary slot holds for checkout.
  - [ ] Store hold owner and expiry.
  - [ ] Prevent other players from booking an active hold.
  - [ ] Release expired holds safely.
- [x] Add booking/payment idempotency keys for retries and future gateway webhooks.
- [x] Require both the ground and owning vendor to be active before booking.
- [x] Decide whether verification is mandatory, then consistently enforce vendor/ground verification in public discovery and booking. (Decision: not mandatory until an admin verification workflow exists.)
- [x] Prevent vendors from creating slots in the past.
- [x] Filter past slots out of public ground and availability responses.
- [x] Fix ground deletion with historical bookings by using archival/deactivation instead of destructive deletion.
- [x] Apply and verify `Server/drizzle/0005_slot_time_integrity.sql` against the target database.
  - [x] Detect and resolve existing overlapping slot records first. (Migration applied successfully; the exclusion constraint would reject any pre-existing overlaps.)
  - [x] Confirm the required `btree_gist` extension can be installed.
  - [x] Map exclusion-constraint violations to a user-facing HTTP `409`.
- [x] Add PostgreSQL constraints preventing contradictory slot flags/states.
- [x] Add integration tests for double booking, overlapping slots, cancellation races, slot holds, and state transitions. (Rollback-only PostgreSQL tests cover overlap, contradictory state, and one-active-booking constraints; lifecycle tests cover holds and transitions.)

## P0 - Authentication and API safety

- [x] Add server-side OTP request and verification rate limiting.
- [x] Prevent OTP re-request from indefinitely resetting brute-force protection.
- [x] Serialize/deduplicate concurrent mobile refresh-token attempts.
- [x] Ensure a failed stale refresh request cannot clear a newly rotated valid session.
- [x] Decide whether logout must immediately invalidate access tokens or whether the 15-minute expiry is acceptable. (Decision: logout immediately invalidates the backing session and therefore its access token.)
- [x] Use `JWT_ACCESS_TTL` instead of the currently hardcoded access-token duration.
- [x] Validate `EXPO_PUBLIC_API_URL` at mobile startup and show a clear configuration error.
- [x] Add request-size limits and consistent request validation at server boundaries.

## P1 - Complete the core MVP

- [x] Introduce a separate payments/payment-attempts table.
- [x] Implement a mock payment adapter behind the same interface future real gateways will use.
- [x] Build booking details screens for players and vendors.
- [x] Add player and vendor cancellation actions to the mobile UI.
- [x] Implement cancellation deadlines, fees, and refund eligibility.
- [x] Notify the correct counterparty when either player or vendor cancels.
- [x] Implement scheduled booking completion and no-show handling.
- [x] Add vendor earnings ledger, commission calculation, and balance updates.
- [x] Build the vendor earnings screen using real ledger data.
- [ ] Integrate a real SMS provider for OTP delivery.
- [ ] Implement cloud image upload/storage and stop persisting local device URIs.
- [ ] Add image validation, ownership, replacement, and deletion behavior.
- [ ] Implement player profile editing and avatar upload.
- [ ] Implement vendor profile editing, logo, cover image, activation, and deactivation.
- [ ] Add notification read/unread endpoints and unread counts.
- [ ] Add a vendor notification screen and connect the dashboard button.
- [ ] Move notifications to a dedicated API resource.
- [ ] Add recurring and bulk slot creation.
- [ ] Add full slot editing for date, time, and price.
- [ ] Enforce operating hours, maximum slot duration, and advance-booking windows.
- [ ] Define and apply peak-price behavior instead of leaving `peak_price` unused.
- [ ] Fix Pakistan-local default dates instead of deriving them through UTC `toISOString()`.

## P1 - Discovery, performance, and contracts

- [ ] Add server-side ground search, city/area filters, pitch type, price, rating, and availability filters.
- [ ] Add pagination and deterministic sorting to grounds, bookings, slots, and notifications.
- [ ] Return ground availability summaries in the ground list to remove N+1 slot requests.
- [ ] Replace the inaccurate `Available Now` label with time-aware next availability.
- [ ] Validate the ground in the public slot-list endpoint.
- [ ] Sort public and vendor slots by date and start time.
- [ ] Consolidate duplicated mobile auth, ground, slot, booking, and vendor types.
- [ ] Replace core `any` usage, especially booking mapping and API error handling.
- [ ] Add runtime API response validation or generate the mobile client from an API contract.
- [ ] Split the mobile `vendors.ts` API module into vendor, ground, and slot modules.
- [ ] Move booking, ground, and vendor business rules out of controllers into testable services.

## P1 - Mobile reliability and UX cleanup

- [x] Remove or clearly isolate disconnected JazzCash, Easypaisa, bank-transfer, and payment-processing mock screens.
- [x] Ensure no payment screen can show booking confirmation without a persisted booking.
- [x] Remove hardcoded payment amounts, account details, references, and timers from production UI paths.
- [x] Group player bookings into upcoming, completed, cancelled, and payment-pending sections.
- [x] Group vendor bookings by date/status and provide actionable booking details.
- [ ] Replace raw date/time text fields with accessible date/time pickers.
- [ ] Build a weekly calendar/grid for vendor slot management.
- [x] Show unavailable slot reasons: booked, blocked, held, or expired.
- [x] Add checkout hold countdown and revalidate when checkout regains focus.
- [x] Show complete pricing breakdown before confirmation.
- [ ] Add consistent loading, retry, empty, offline, and error states.
- [ ] Use `FlatList`/`SectionList` for potentially large ground, slot, booking, and notification lists.
- [ ] Use replace/tab navigation semantics to avoid growing navigation history on tab switches.
- [x] Use replace/tab navigation semantics to avoid growing navigation history on tab switches.
- [ ] Remove corrupted UI characters and remaining debug logs containing phone/OTP data.
- [ ] Break large one-line JSX screens into reusable, testable components.
- [x] Break large one-line JSX screens into reusable, testable components.
- [ ] Add accessibility labels, scalable text, contrast checks, and adequate touch targets.

## P2 - Marketplace functionality

- [ ] Integrate real payment providers with verified server-side webhooks.
- [ ] Add payment reconciliation, refund processing, and partial refunds.
- [ ] Add vendor payout requests and payout history.
- [ ] Implement map rendering, geolocation, distance calculation, and nearby-ground discovery.
- [ ] Build the Search tab using server-side discovery APIs.
- [ ] Add reviews and ratings only after completed bookings.
- [ ] Add review reporting and moderation.
- [ ] Add favorites and recently viewed grounds.
- [ ] Add push notifications and scheduled booking reminders.
- [ ] Add promo codes, discounts, and pricing rules.
- [ ] Add customer-support and booking-dispute workflows.
- [ ] Add admin workflows for vendor/ground verification and account moderation.
- [ ] Decide whether chat is required; implement conversations, retention, notifications, blocking, and moderation only if justified.

## P3 - Expansion ideas

- [ ] Add team creation and player invitations.
- [ ] Add split payments.
- [ ] Add recurring player bookings.
- [ ] Add tournaments and leagues.
- [ ] Add loyalty and referral programs.
- [ ] Add vendor analytics and pricing recommendations.

## Non-functional and delivery requirements

- [ ] Commit an ESLint configuration and make `npm run lint` deterministic/offline-capable after install.
- [x] Add CI checks for TypeScript, lint, tests, migrations, and Expo configuration.
- [ ] Add structured logs and request IDs with token, OTP, and phone-number redaction.
- [ ] Add production error monitoring, tracing, and operational metrics.
- [ ] Add database backup, restore, and migration rollback procedures.
- [ ] Document the canonical timezone as `Asia/Karachi` across API, database, and UI behavior.
- [ ] Define privacy, data-retention, cancellation, refund, and vendor payout policies.
- [ ] Review vendor access to player phone numbers and apply masking/consent rules.
- [ ] Remove stale Supabase configuration if the custom backend remains authoritative.
- [ ] Update `README.md` and `AGENTS.md` when implementation changes make documented limitations stale.

## Baseline verification for every completed task

- [ ] Relevant automated tests pass.
- [ ] Server validation passes with `npm run typecheck`.
- [ ] Mobile validation passes with `npx tsc --noEmit`.
- [ ] `git diff --check` reports no new whitespace errors.
- [ ] Database changes include a reviewed migration and rollout note.
- [ ] `agent-continuity/TASK_JOURNAL.md` is updated with outcome and next step.
