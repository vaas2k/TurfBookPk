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

## 2026-11-01 - Payment screen emulator follow-up

- Improved the date and time contrast in the dark 1-Bill checkout summary after seeing the values on the Android emulator.
- Pending unpaid bookings now explain that refund terms apply after payment. The check-in code appears only for confirmed bookings.
- Mobile TypeScript and targeted ESLint checks pass.
## 2026-11-04 — Pitch selection screens

- Added a vendor pitch setup screen after ground creation, per-pitch program selection, and pitch filters in vendor slot management and player ground details. Booking lists now show the pitch name.
- Mobile TypeScript and lint checks passed; device layout checks remain.

## 2026-11-04 — iOS photos and form keyboard

- Ground creation and vendor profile image selection now open the system photo picker directly; the previous full-library permission gate prevented iOS users from selecting photos even though the picker itself works without that permission for images.
- Added keyboard avoidance and drag-to-dismiss behavior to ground creation, pitch setup, recurring schedule, ground verification, vendor verification, vendor profile editing, and player review forms.
- Mobile TypeScript and lint checks pass. Physical iPhone testing is still needed for photo selection/upload and keyboard movement on short screens.
## 2026-11-04 — Native time selection

- Replaced the fixed half-hour time grid with the platform-native time picker. iOS now shows the rotating hour/minute/AM-PM spinner, while Android shows its native clock selector.
- The shared control is used by ground operating hours, per-pitch schedule hours, and peak pricing hours. It supports exact minute selection and keeps next-day closing behavior.
- Mobile TypeScript, uncached ESLint, and Expo configuration checks pass. A custom development build must be rebuilt once to include the new native module; Expo Go already includes supported Expo native modules.
## 2026-11-04 — Full next-day slot choices

- Added Same day / Next day controls to ground operating hours and the per-pitch schedule wizard.
- The generated slot list now continues through the entire selected operating window and labels starts after midnight as `NEXT DAY`, including times later than the original opening time on the following day.
- When duration plus changeover does not divide the operating window exactly, the final generated slot is aligned to the closing time. For example, a 6 AM–1 AM venue with one-hour play and a 10-minute changeover ends with a 12 AM–1 AM slot and leaves the remaining slack as a longer idle gap before it.
- The schedule wizard now explains that confirming a later pitch close will extend the venue's saved closing time. This prevents older grounds saved as 6 AM–11 PM from failing when the vendor deliberately changes the reviewed schedule to 1 AM next day.
- Player slot selection, the vendor day summary, and `Manage this day` now sort relative to the venue opening clock. A 6 AM–1 AM operating day displays 6 AM first and the 12 AM–1 AM overnight slot last instead of sorting midnight first.
- Mobile TypeScript and uncached ESLint checks pass.

## 2026-11-04 — Easy ground pin capture

- Reworked the location section into three clearly numbered choices: paste a Maps Share link as the recommended primary action, capture the current location as the secondary action, and reveal manual coordinates only under Advanced.
- Added simple sharing instructions, progress/disabled states, a clear pin-ready confirmation, and a Check in Maps action. Raw coordinates stay out of the main vendor workflow.
- Mobile TypeScript and uncached ESLint checks pass; Google/Apple share links and device GPS still need a physical-device workflow check.

## 2026-11-04 — Vendor booking-history summary

- Removed the redundant total-bookings subtitle below the Booking History title.
- Added a date-aware summary card below the date controls showing bookings, active/cancelled counts, and expected vendor earnings for the selected day, week, or month.
- Added a clear empty-period state and enlarged date navigation touch targets. Mobile TypeScript and focused lint checks pass.

## 2026-11-04 — Simplified vendor earnings

- Turned the inactive header date label into the single working earnings-range control. It opens a clear bottom selector for All time, Last 7 days, or Last 30 days; the duplicate range row above Activity was removed.
- Reduced activity categories to All, Available, Payouts, and Refunds. Pending and reversed records remain visible under All without adding confusing vendor-facing filters.
- Reworked the money overview to explain booking income, available balance, pending earnings, and paid-out money in plain language. Mobile TypeScript and focused lint checks pass.

## 2026-11-04 — Compact vendor calendar management

- Replaced the large visible month grid with a compact selected-date card, previous/next-day controls, a quick Today action, and the native Android/iOS date picker for choosing any date.
- The selected date now immediately shows its slots as readable time-and-price rows with clear Available, Held, Booked, Club, or Unavailable status labels.
- Kept Manage this day, whole-day closure, pitch selection, and recurring-schedule actions intact. Mobile TypeScript and focused lint checks pass; native date-picker interaction still needs a physical-device check.

## 2026-11-04 — Inline slot actions

- Removed the extra Manage this day navigation step from the calendar workflow.
- Added Block/Unblock, Reserve/Release, and Remove directly beneath every editable slot for the selected date. Booked slots and payment holds stay protected and explain why actions are unavailable.
- Existing confirmation, API updates, refresh behavior, and whole-day closure remain in place. Mobile TypeScript and focused lint checks pass.
# 2026-11-05 — Professional admin operations redesign

- Replaced the admin panel's mixed legacy styling with one authoritative professional operations theme.
- Changed the admin typeface to Manrope and standardized typography, spacing, focus states, buttons, forms, status badges, cards, tables, navigation, dialogs, and responsive behavior.
- Improved the visual hierarchy and readability of refunds, disputes, vendor balances, payouts, verification queues, reporting, and dashboard surfaces without changing their workflows.
- Verified the admin production build and all admin, server, and mobile TypeScript checks.

# 2026-11-05 — Complete live admin analytics dashboard

- Expanded the admin dashboard into a period-aware live operations view with 7, 30, and 90-day filters.
- Added GMV and platform-revenue trends, previous-period comparisons, lifetime totals, booking/payment status funnels, refund exposure, vendor payouts, dispute holds, today slot utilization, city demand, top grounds, verification/moderation queues, and recent booking/refund/payout activity.
- Linked every operational summary to the relevant detailed admin workspace.
- Added responsive dashboard layouts and clear loading, empty, positive, negative, and attention states.
- Verified admin/server TypeScript, the admin production build, and all 73 backend tests.

# 2026-11-05 — Platform versus vendor finance views

- Added a protected TurfBookPK earnings workspace with 7, 30, and 90-day filters.
- Separated customer GMV, TurfBookPK gross commission, platform-funded refunds, TurfBookPK net earnings, vendor allocation, pending vendor balances, and completed vendor payouts.
- Added a daily platform-versus-vendor earnings comparison and booking-level split records for traceability.
- Added “TurfBookPK earnings” to the admin navigation and retained vendor payouts as a separate operational workflow.
- Verified the finance API against local database records, admin/server TypeScript, and the admin production build.

## 2026-11-05 — Dialog and admin attention fixes

- Increased shared dialog bottom-sheet snap points and made long or multi-action dialogs open at the larger height, keeping final-review actions above device navigation areas while retaining drag gestures.
- Reordered the live admin dashboard so Requires Attention appears immediately below the header, ahead of analytics.
- Standardized admin payment-state wording and colours for paid, pending, expired, failed, unknown, refund, and manual-review states.

## 2026-11-07 — Ground discovery and booking-card cleanup

- Removed repeated changeover wording from every player slot card; the explanation remains in booking/payment context where it is only shown once.
- Simplified pitch choices to show the pitch name first and a clear `7v7`, `9v9`, or `11v11` type underneath, including a small Combined label when relevant.
- Restored search results to image-first ground cards with the venue cover photo across the top, followed by rating, availability, price, and action details.
- Expanded owner-proof guidance with practical examples including a recent utility bill, ownership deed, allotment letter, property-tax document, society letter, or another document connecting the vendor to the ground.
- Added compact live attention counters to relevant admin sidebar destinations.
- Matched search-result image rendering to the proven home-card implementation so cover photos and the fallback image display reliably.
- Removed the obsolete tall minimum height from player slot cards, eliminating the empty area left after the changeover label was removed.
- Removed the hardcoded `5-a-side` booking-confirmation value and now display the booked pitch's real size, with a neutral fallback for legacy data.
- Standardized visible pitch-size wording across player and vendor screens to `7 a-side`, `9 a-side`, `11 a-side`, and the equivalent label for other sizes.
- Restored visible native back-arrow icons on both player and vendor edit-profile screens.
- Refined player profile cards with clear action icons and location context, and rebuilt the vendor profile header around its real cover, logo, active state, and better-organized controls.
- Added a dedicated vendor Help & Tutorials skeleton with categorized future lessons for verification, grounds, pitches, schedules, bookings, earnings, disputes, and support; tutorial actions currently show explicit coming-soon placeholders.
- Verified the mobile TypeScript build, Expo lint, and diff formatting.
