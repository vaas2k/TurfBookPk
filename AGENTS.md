# TurfBookPK Agent Guide

## Project Overview

TurfBookPK is a React Native/Expo football-ground booking application with an Express API, PostgreSQL database, and a small internal Next.js admin panel.

The repository contains three applications:

- `PitchBook/`: Expo Router mobile application.
- `Server/`: Express API using Drizzle ORM and PostgreSQL.
- `Admin_Panel_TurfbookPK/`: internal Next.js operations console.

## Development Commands

Run commands from the relevant project directory.

### Mobile app

```bash
cd PitchBook
npm install
npx expo start -c
```

Other mobile commands:

```bash
npm run android
npm run ios
npm run web
npm run lint
npx tsc --noEmit
```

### Backend

```bash
cd Server
npm install
npm run dev
```

### Admin panel

```bash
cd Admin_Panel_TurfbookPK
cp .env.example .env.local
npm install
npm run dev
npm run typecheck
```

Set `NEXT_PUBLIC_API_URL` to the server's `/api` URL. The panel is intentionally internal: it uses OTP authentication and the server verifies that the authenticated user has the `admin` role before any admin API action.

Backend validation and database commands:

```bash
npm run typecheck
npm run build
npm run start
npm run db:generate
npm run db:migrate
```

## Local Environment

The backend expects `Server/.env` with a PostgreSQL connection and JWT settings. Local Docker PostgreSQL uses port `5432`.

Example:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgres://turfbookpk:turfbookpk@localhost:5432/turfbookpk
JWT_ACCESS_SECRET=development-access-secret-change-me
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_DAYS=30
OTP_TTL_MINUTES=5
AUTH_OTP_FIXED_CODE=123456
```

The mobile app expects `PitchBook/.env`:

```env
EXPO_PUBLIC_API_URL=http://<computer-lan-ip>:5000/api
```

Use the computer's LAN IP for a physical device. Do not use `localhost` on a phone because it points to the phone itself.

Never commit either `.env` file.

## Architecture

### Mobile

- Routing: Expo Router under `PitchBook/src/app/`.
- State: Zustand stores under `PitchBook/src/store/`.
- API transport: Axios in `PitchBook/src/lib/api/client.ts`.
- Auth tokens: access token in memory; refresh token in SecureStore when available, otherwise AsyncStorage.
- Styling: NativeWind/Tailwind classes.
- Image selection: Expo ImagePicker plus a provider-neutral signed-upload API. Cloudinary is the active adapter; R2/S3 can replace it without changing screens.

Important mobile API modules:

- `src/lib/api/auth.ts`: OTP, refresh, profile, logout.
- `src/lib/api/vendors.ts`: vendor profiles, grounds, slots, public ground reads.
- `src/lib/api/bookings.ts`: player/vendor bookings and cancellation.
- `src/lib/api/notifications.ts`: booking notifications.

### Backend

- Entry point: `Server/src/server.ts`.
- Routes: `Server/src/router/`.
- Controllers: `Server/src/controllers/`.
- Database schema: `Server/src/database/schema.ts`.
- Drizzle client: `Server/src/database/client.ts`.
- Auth services: `Server/src/services/`.

Current API groups:

- `/api/auth`: OTP authentication, refresh, logout, profile read/update.
- `/api/vendors`: vendor registration and vendor profile.
- `/api/grounds`: public ground reads and vendor ground/slot management.
- `/api/bookings`: atomic bookings/orders, holds, recurring-payment windows, mock-payment confirmation, cancellation/refunds, no-shows, and player/vendor lists.
- `/api/notifications`: in-app notifications, read state, Expo push-token registration, and paginated history.
- `/api/reviews`: completed-booking reviews, reports, and vendor moderation.
- `/api/media`: authenticated signed-upload targets and owner-scoped media deletion.
- `/api/engagement`: favorites and recently viewed grounds.
- `/api/health`: health check.

## Current Implemented Workflow

1. User requests an OTP with a Pakistani phone number.
2. Development mode uses `AUTH_OTP_FIXED_CODE` and logs the code.
3. OTP verification creates or loads a user and returns access/refresh tokens.
4. Vendors can register and create, edit, activate/deactivate, and delete grounds.
5. Vendors can create, block, unblock, and remove flexible dated slots.
6. Players see vendor-created grounds and real slot availability.
7. Players can select a slot and confirm a mocked booking.
8. Booking creation atomically claims the slot to prevent double booking.
9. Player and vendor booking lists are loaded from PostgreSQL.
10. Cancellation uses the policy snapshot locked at booking and releases slots safely.
11. Booking notifications are stored for both player and vendor, with remote Expo delivery in native builds.
12. Players can view persisted notifications, add bookings to their calendar, save favorites, and revisit recent grounds.
13. Vendors can configure peak day/time windows, a percentage uplift, selectable pitch sizes/amenities, recurring schedules, and blackout dates.
14. Future recurring slots remain reserved until their payment window opens; a separate mock payment then confirms them.

## Database Tables

The active backend schema currently includes:

- `users`
- `otp_challenges`
- `refresh_sessions`
- `vendors`
- `vendor_verifications` and `vendor_verification_documents`
- `grounds`
- `slots`
- `bookings`
- `notifications`
- `payments`
- `earnings_ledger`
- `push_tokens` and `push_receipts`
- `reviews`, `review_reports`, `favorites`, and `recently_viewed_grounds`

Drizzle migrations are stored in `Server/drizzle/`. Run migrations against the configured database before starting API testing.

## Engineering Guidelines

- Keep mobile and backend contracts aligned using snake_case API fields.
- Validate all coordinates, prices, dates, and times at the backend boundary.
- Do not trust client-side slot availability; booking must be checked transactionally on the server.
- Vendors may only manage grounds and slots they own.
- Booked slots must not be edited or deleted directly.
- Keep user-facing errors meaningful and use the existing toast pattern for mobile feedback.
- Prefer Axios API modules over direct `fetch` calls from screens.
- Preserve existing route names and response shapes unless a migration is intentional.
- Do not reintroduce Supabase runtime dependencies; the active app uses the custom backend.
- Do not commit local environment files, generated secrets, or test data.

## Known Limitations

- Real SMS delivery is not implemented; development OTP is fixed/configured.
- Payment gateway integration is not implemented; booking confirmation is mocked.
- Image storage uses a provider-neutral signed-upload API with a Cloudinary adapter. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on the server; R2/S3 can replace the adapter later without changing feature screens.
- Real SMS delivery, payment-gateway webhooks/refunds/payouts, and map rendering remain deferred. Vendor KYC and separate per-ground authority verification are implemented; a ground must be approved before it can be public or booked.
- Android Expo push delivery is implemented and manually tested in a development build. iOS APNs/EAS setup and real-device verification remain.
- Phone OTP is the sole active account sign-in method. Google Sign-In and Sign in with Apple are optional future work.
- The custom Express/PostgreSQL backend is authoritative; stale Supabase config remains to be removed from Expo config.

## Documentation and continuity

- Functional backlog and outcomes: `agent-continuity/CURRENT_CHECKLIST.md` and `agent-continuity/TASK_JOURNAL.md`.
- UI-only backlog and outcomes: `agent-continuity/UI_CHECKLIST.md` and `agent-continuity/UI_TASK_JOURNAL.md`.
- Do not mix functional work with the UI journal. Update the relevant journal after meaningful changes.

## Testing Checklist

For booking-related changes, verify:

1. Vendor ground creation returns `201`.
2. Slot creation returns `201`.
3. Public ground detail includes current slots.
4. First booking returns `201` and marks the slot booked.
5. A second booking attempt returns `409`.
6. Player and vendor booking lists include the booking.
7. Cancellation releases the slot.
8. Notifications are created for both users.

Use temporary test phone numbers and remove test data afterward.
