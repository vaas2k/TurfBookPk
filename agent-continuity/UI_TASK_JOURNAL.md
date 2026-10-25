# TurfBookPK UI Task Journal

This journal is intentionally separate from `TASK_JOURNAL.md`. It records visual-system decisions, screen design progress, and device visual validation only. It must not record API, database, booking, payment, or other functional changes.

## 2026-09-24 - Figma design program started

- Figma file is the visual source of truth: `Business`, node `0:1`.
- The approved player direction is dark football-first, not the prior generic glass direction.
- Core tokens from the Figma onboarding/discovery frame:
  - Canvas: `#12130F`
  - Raised panel: `#1A1C16`
  - Brand/action: `#3EAF4C`
  - Primary text: `#F5F5F0`
  - Secondary text: `#A1A39D`
  - Display type: Big Shoulders Display ExtraBold / Bold, uppercase where appropriate
  - UI/body type: Space Grotesk Regular / Medium / Bold
- Added the isolated Player Design Lab, reachable from Player Profile, for team approval before production screen redesign.
- Added interactive dark/light preview, component states, status chips, feedback alert, confirmation dialog, and Figma typography preview.
- Light-mode hero contrast was corrected after review.
- Replaced booking status fills with semantic outline chips, and corrected the OTP resend countdown for the dark auth surface.
- Made Space Grotesk the default body font for previously unstyled text, while retaining Big Shoulders Display for display headings.
- Added a persistent appearance preference control in Player Profile. The current player design remains dark-first; a full light-theme token pass remains part of cross-screen theme validation.

## Next design task

## 2026-10-04 - Admin ground profile workspace

- Added a vendor-scoped ground profile screen to the admin visual system: a clear detail header, gallery, compact operational facts, facility/rule chips, status actions, and a readable player-feedback section with visible/hidden moderation state.
- Made ground information on the vendor profile an obvious clickable destination while keeping verification and availability controls alongside it.

## 2026-10-04 - Admin dashboard Figma implementation

- Rebuilt the primary admin dashboard to match the supplied dark Figma dashboard composition: four operational metric cards, a 30-day revenue trend chart, bookings-by-city bars, top-performing ground rows, and a compact attention strip linking the live review queues.
- The design uses real server data rather than mock figures: paid GMV, paid booking count, approved active grounds, total users, daily paid revenue, city distribution, and top ground performance.

## 2026-10-04 - Financial admin screens

- Added dark operational Payouts and Commission & Configuration pages using the same compact table, metric-card, and status-badge system as the supplied admin Figma references.

## 2026-10-04 - Admin Figma visual foundation

- Started the internal Admin Panel visual pass from the supplied `Figma/admin-screens` references, without changing admin APIs, approval rules, or moderation actions.
- Rebuilt the shared shell around the reference hierarchy: compact black/olive sidebar, icon-led active navigation, slim operations top bar, administrator identity block, dense outlined surfaces, restrained green focus state, and responsive navigation fallback.
- Applied shared Figma-aligned spacing, cards, tables, filters, statuses, review surfaces, and action controls so the dashboard, listings, verification, transaction, refund, moderation, and audit views inherit the same visual system.
- Validation: Admin Panel `npm run typecheck` passes.

## 2026-10-04 - Vendor-centred ground layout

- Updated the admin information architecture to remove Ground Listings from primary navigation and place each ground in its vendor context. The vendor detail cards now present review and availability controls as compact operational actions.

## Next design task

## 2026-09-30 - Device validation responsive fixes

- Player ground detail now uses measured gallery/slot-grid widths and wrapping/shrinking copy for long names, review controls, location, and policy content.
- Player bookings now constrains long status chips and booking IDs; tabs scale their label instead of overflowing.
- Vendor dashboard greeting is constrained to the available header width and the notification action is fixed-size, so it stays on-screen.
- Mobile TypeScript and targeted ESLint validation pass with no errors.

## 2026-09-29 - Player light-theme completion pass

- Applied the persisted player appearance preference to the active player navigation, Home, Search, ground detail, bookings, booking detail/confirmation, notifications, profile editing, saved/recent ground library, reviews, support, wallet, and shared dialog surfaces.
- Kept the dark Figma baseline unchanged and used the existing light token set for canvas, cards, borders, text, and semantic green states.
- Kept legacy provider-specific mock payment screens out of this pass because they are not active production flows.
- Validation: `npx tsc --noEmit` and `git diff --check` passed.

## Next design task

## 2026-09-27 - Vendor dark operational UI pass

- Redesigned the vendor tab shell and the operational overview, My Grounds, booking history, earnings, notifications, booking detail, reviews, and profile around the supplied vendor Figma exports.
- Preserved the vendor’s larger, high-contrast type, compact dark cards, restrained green action color, and fixed five-item navigation for easier day-to-day use.
- Earnings now visually groups live ledger activity with period and status filters, daily-revenue bars, and ground-performance bars.
- Booking detail now gives the player, time, ground, payment status, payout, and vendor action a clearer scan order.
- Reviews now use a dark feedback-card pattern with rating summary and an owner moderation entry point.
- Notifications now use Today/Earlier grouping, clear read state, contextual icons, and relative timestamps.
- Validation: `npx tsc --noEmit` passed after the vendor UI slices.

## Next design task

- Complete the vendor ground creation/edit and slot-management references, then run an Android/iOS visual and safe-area pass before declaring the vendor visual phase complete.

## 2026-10-22 - Interactive bottom sheets

- Replaced the static/manual-pan global dialogs and player Search filters with `@gorhom/bottom-sheet` v5 modals.
- Added real two-way dragging, bounded snap points, swipe-down dismissal, backdrop dismissal, coordinated scrolling, and interactive keyboard handling.
- Added the required root Gesture Handler and bottom-sheet providers. Mobile TypeScript and ESLint checks pass; Expo's online dependency check was unavailable because the local environment blocked its network request.

## 2026-10-22 - iOS transition background

- Removed the brief white flash around the iPhone home-indicator/bottom-bar area during route transitions by giving the native appearance, React Navigation theme, app root, safe-area root, and startup loader the same dark canvas color.
- Validation: mobile TypeScript and ESLint checks pass.

## 2026-10-22 - Vendor registration responsiveness

- Constrained all active vendor-verification fields, choices, headings, and document upload rows to the available mobile width, allowing long labels to wrap or shrink instead of pushing the screen horizontally.
- Prevented empty document previews from rendering with an undefined image source and bounded selected previews inside their upload row.
- Validation: mobile TypeScript and ESLint checks pass.
- Applied the parent iOS safe-area top inset directly to the full-screen verification modal so its header stays below the notch, clock, signal, and battery area in Expo Go.

## 2026-10-22 - Vendor navigation and transition audit

- Removed vendor transition flashes by retaining mounted tab routes with `navigate`, enforcing a dark native-stack content surface, and replacing the remaining white vendor booking loading/error and modal surfaces.
- Added the missing Notifications back action, normalized detail-screen back behavior, and extended bottom safe-area ownership to detail routes whose vendor tab bar is hidden.
- Hardened ground verification headers and uploads for safe areas, long text, and empty image selections. Mobile TypeScript, ESLint, and diff validation pass.
