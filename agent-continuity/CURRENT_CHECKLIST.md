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
- [x] Add notification read/unread endpoints and unread counts.
- [x] Add a vendor notification screen and connect the dashboard button.
- [x] Move notifications to a dedicated API resource.
- [x] Add recurring and bulk slot creation.
- [x] Add atomic multi-slot orders: player multi-select across dates/times, weekly-repeat shortcut, one payment attempt, all-or-nothing confirmation, and independent per-booking cancellation/refund.
- [x] Add full slot editing for date, time, and price.
- [x] Enforce operating hours, maximum slot duration, and advance-booking windows.
- [x] Define and apply vendor-configured peak windows: a vendor-configured percentage increases the base slot price only within the ground's configured peak days/times.
- [x] Fix Pakistan-local default dates instead of deriving them through UTC `toISOString()`.

## P0 - Mobile UI/UX correctness and navigation

- [ ] Add a consistent accessible back button/header to every pushed player and vendor screen, starting with player notifications, booking lists reached from deep links, and profile edit flows.
- [ ] Connect player and vendor notification screens to the new notification API: unread badge/count, visible read state, mark-one-read, mark-all-read, pull-to-refresh, and booking deep links.
- [ ] Remove the disconnected player-home notification modal so the notification bell has one reliable destination.
- [ ] Wire or remove player discovery filter/settings controls that currently render without an action.
- [ ] Replace hardcoded vendor dashboard statistics (`todayBookings`, revenue, rating) with real data or an explicit “not available yet” state.
- [ ] Add loading/disabled states and duplicate-submit prevention to vendor ground, slot, recurrence, activation, and profile actions.
- [ ] Ensure all icon-only/touchable controls have accessibility labels, 44px minimum touch targets, and visible pressed/disabled states.
- [ ] Add confirmation dialogs for ground activation/deactivation and destructive slot/ground actions, including a clear player-visibility consequence.
- [ ] Show server policy constraints (operating hours, max duration, advance window) in vendor slot creation/edit UI before submission.

## P1 - Mobile UI/UX completeness

- [ ] Redesign the vendor earnings screen around clear business balances: available-to-withdraw, pending/processing, paid out, and refunds/adjustments; replace raw ledger labels and booking IDs with plain-language explanations, dates, booking/ground context, status badges, filters, and a transaction-detail view.
- [ ] Add editable operating-hours controls to vendor ground creation/editing and display them on public ground detail.
- [ ] Define and expose peak-price UI only after the business provides peak-hour rules; do not display a price users cannot understand.
- [ ] Replace raw date/time text fields with platform-accessible date/time pickers and validate them inline.
- [ ] Build a weekly calendar/grid view for vendor slot management with date navigation, availability legend, and bulk actions.
- [ ] Add search, sort, filter, and empty/error/retry states to player ground discovery.
- [ ] Add a player-friendly booking cancellation preview that shows fee/refund before confirmation.
- [ ] Add booking detail shortcuts from notifications and calendar/reminder status feedback.
- [ ] Add real vendor booking dashboard counts and actionable “today”/“requires attention” cards.
- [ ] Show no-show eligibility, completion timing, and policy explanations in vendor booking details.
- [ ] Consolidate repeated headers, cards, form fields, and empty/error states into shared mobile components.

## P2 - Mobile UX polish and accessibility

- [ ] Audit all screens for text scaling, keyboard avoidance, safe-area padding, focus order, color contrast, and screen-reader labels.
- [ ] Virtualize long ground, slot, notification, booking, and earnings lists with `FlatList`/`SectionList` and stable keys.
- [ ] Add skeleton loading states and offline/retry messaging for all network-backed screens.
- [ ] Replace placeholder imagery and mock/payment development copy with production-ready empty states once providers are integrated.
- [ ] Add analytics/error telemetry for failed booking, payment, slot-management, and role-switching journeys.

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
- [x] Remove the user-facing checkout hold countdown and create the booking only when Confirm is pressed.
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
