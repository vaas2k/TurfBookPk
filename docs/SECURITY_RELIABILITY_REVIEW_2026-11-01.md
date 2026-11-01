# Security and mobile reliability review — 2026-11-01

## Completed checks

- Server tests: 61/61 passed, including payment concurrency, duplicate callbacks, late payments, session rotation, suspended accounts, role/ownership checks, rate limits, callback size limits, upload MIME/size/ownership rules, log redaction, and retention.
- Mobile: TypeScript and ESLint passed. Checkout now rejects same-frame duplicate taps. Payment polling pauses in the background, resumes immediately on foreground, deduplicates overlapping refreshes, and preserves the last known state with an offline retry banner.
- Dependencies: server production audit has zero findings. Mobile production audit has no critical/high findings; the remaining 12 moderate findings are inside the Expo SDK 58 toolchain and npm's proposed fix is an incompatible downgrade to SDK 51. Admin critical findings were removed by updating Next 15.5.0 to 15.5.28; one high transitive PostCSS finding remains and requires a planned Next 16 migration.
- Deployment: the production server image builds successfully, contains zero production audit findings, and now runs as the unprivileged `node` user. `/api/test` is unavailable in production. Database, Redis, and metrics are not publicly bound by the rehearsal configuration.
- Secret review: no tracked `.env`, credential directory, service-account key, private key, or Firebase Admin key was found.

## Manual device checks still required

1. Open a pending payment, disable network, press refresh, and verify the existing reference stays visible with an offline warning.
2. Restore network and verify Retry updates the state without opening a duplicate request.
3. Rapidly press Generate reference and verify only one pending booking/payment attempt is created.
4. Background the app for at least 30 seconds, then return and verify status refreshes immediately and the countdown catches up.
5. Expire a 15-minute hold through the worker and verify the reference becomes expired, the slot releases, and a late acknowledgment enters manual review without booking the slot.
6. Revoke/expire the session and verify one refresh occurs; if refresh is invalid, the app returns to authentication without retaining protected data.

Real Clink-origin authentication, a real bank payment, refunds, settlement, and iOS push remain external/provider tests.
