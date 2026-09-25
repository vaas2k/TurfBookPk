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

- Use the approved test UI to redesign the auth entry flow first: splash, phone input, OTP verification, and profile setup.
- Keep the existing functional auth flow and route behavior unchanged.
