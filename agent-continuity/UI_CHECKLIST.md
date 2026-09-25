# TurfBookPK UI Redesign Checklist

> Design work only. Track implementation/business-rule work in `CURRENT_CHECKLIST.md` and `TASK_JOURNAL.md`. Track design decisions and visual validation in `UI_TASK_JOURNAL.md`.

This checklist covers visual and interaction-design work only. Existing APIs, navigation behavior, business rules, and data flows must remain unchanged unless a UI requirement exposes a real usability defect.

## Design brief

- [x] Player experience: Figma-led dark football interface by default (`#12130F` canvas, `#1A1C16` panels, `#3EAF4C` action green).
- [ ] Player theme: provide a persistent light/dark preference from profile or settings after the Figma dark baseline is implemented.
- [ ] Vendor experience: simple, highly legible, low-density interface for older and less technical users.
- [x] Brand direction: football green as the primary accent with restrained semantic status colours and warm-white text.
- [ ] Motion: subtle transitions and state changes; no distracting animation in vendor workflows.
- [ ] Platforms: validate both iOS and Android phones, including small screens and safe areas.
- [ ] Imagery: retain useful existing assets and add carefully selected imagery where it materially improves discovery or ground presentation.
- [ ] Accessibility: preserve or improve labels, contrast, text scaling, focus order, and minimum touch targets.

## Phase 1 - Player visual system

- [x] Build an isolated player UI test screen with local sample content before changing production screens.
- [x] Prototype and approve the Figma-based player foundations: dark canvas/panels, green pills, Big Shoulders Display headlines, Space Grotesk UI type, cards, chips, fields, alerts, dialogs, and light-mode contrast.
- [x] Add a temporary Player Profile entry point for opening the visual preview.
- [ ] Audit current player screens, reusable components, spacing, typography, colors, and icon usage.
- [x] Define a reviewable design-token direction for dark/light player surfaces, green actions, semantic status colours, spacing, radii, and readable fallbacks in the Design Lab.
- [x] Choose and load Figma fonts: Big Shoulders Display for display headings and Space Grotesk for UI/body copy.
- [ ] Build shared glass surfaces, buttons, inputs, badges, headers, tabs, empty states, loading states, and error states.
- [ ] Establish consistent pressed, disabled, selected, focused, and destructive states.
- [ ] Keep glass effects performant and provide a readable fallback where blur is unavailable.

## Phase 2 - Player navigation and core screens

Implementation order (do not alter backend contracts while redesigning):

1. Splash, phone input, OTP, and profile setup
2. Player home and bottom navigation
3. Search/discovery and filters
4. Ground detail, slot selection, and booking review
5. Booking confirmation, booking list, and booking detail
6. Notifications, profile, and profile editing

- [ ] Polish player home and ground discovery.
- [ ] Polish ground detail, slot selection, pricing breakdown, and booking confirmation presentation.
- [ ] Polish player bookings, booking details, cancellation preview, and status sections.
- [ ] Polish notifications, unread states, deep-link entry, and refresh states.
- [x] Add persistent theme preference placement to player profile.
- [ ] Apply the light-theme token set consistently across all player screens.
- [ ] Polish calendar/reminder feedback and all relevant modal/dialog surfaces.
- [ ] Verify headers and back controls remain consistent on pushed and deep-linked screens.

## Phase 3 - Player responsive and accessibility pass

- [ ] Check small Android phones, larger Android phones, and iPhones for clipping and overlap.
- [ ] Check safe-area and home-indicator spacing.
- [ ] Check dynamic text sizing and keyboard avoidance.
- [ ] Check contrast in both themes and for all status colors.
- [ ] Check screen-reader labels, focus order, and 44px minimum touch targets.
- [ ] Check long lists, loading, empty, offline, retry, and error presentation.
- [ ] Verify imagery has suitable loading, failure, crop, and accessibility behavior.
- [ ] Verify theme preference persists across app restarts and does not alter API behavior.

## Phase 4 - Vendor information architecture and visual simplification

- [ ] Audit vendor journeys from the perspective of a first-time, less technical user.
- [ ] Keep primary navigation limited to clear destinations with plain-language labels and familiar icons.
- [ ] Make the main action obvious on each vendor screen.
- [ ] Use larger text, stronger contrast, generous touch targets, and restrained decoration.
- [ ] Reduce simultaneous choices and group related management actions clearly.
- [ ] Use plain-language labels for bookings, earnings, slots, availability, and cancellations.
- [ ] Preserve confirmation dialogs and explain player-visible consequences for destructive actions.
- [ ] Avoid glass-heavy surfaces where they reduce readability or make scanning harder.

## Phase 5 - Vendor screen polish

Implementation order (prioritise simplicity over player-style decoration):

1. Vendor bottom navigation and overview
2. Grounds and add/edit ground
3. Daily slot manager, recurring schedule, blackout dates
4. Bookings and booking detail actions
5. Earnings and notifications
6. Vendor profile

- [ ] Polish vendor overview with clear operational summaries and next actions.
- [ ] Polish grounds list, add/edit ground, activation, and deactivation states.
- [ ] Polish slot calendar/grid, date navigation, availability, closures, and policy guidance.
- [ ] Polish vendor bookings, booking details, completion, no-show, cancellation, and refund states.
- [ ] Polish earnings with clear balances, activity descriptions, dates, and status badges.
- [ ] Polish vendor notifications and profile/edit-profile flows.
- [ ] Ensure every pushed vendor screen has a consistent back path and visible header.

## Validation and completion

- [ ] Run mobile TypeScript validation after each focused UI slice.
- [ ] Run lint and `git diff --check` after each completed phase.
- [ ] Verify player flows visually in dark and light themes on iOS and Android.
- [ ] Verify vendor flows visually on iOS and Android with increased text size.
- [ ] Capture screenshots for representative home, discovery, detail, booking, notification, vendor overview, slots, and earnings screens.
- [ ] Confirm no API contracts, store behavior, booking rules, or payment behavior changed.
- [ ] Update `TASK_JOURNAL.md` with completed UI work, validation results, and the next remaining checklist item.
