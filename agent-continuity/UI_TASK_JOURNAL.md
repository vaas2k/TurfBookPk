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
