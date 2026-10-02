# TurfBookPK Mobile Guide

- Use Expo SDK 57-compatible APIs and routes under `src/app/`.
- Phone OTP is the only active login path. Do not re-enable Google/Apple login without verified backend token handling.
- Use `src/lib/api/` modules instead of direct `fetch` in screens.
- Preserve SafeAreaView, keyboard handling, 44px targets, accessibility labels, and deep-link-safe navigation.
- Remote push requires an EAS development/release build; Expo Go must bypass remote registration.
- Never commit `.env`, `google-services.json`, service-account JSON, or other credentials.
- Validate with `npx tsc --noEmit`, relevant lint, and `git diff --check`.
