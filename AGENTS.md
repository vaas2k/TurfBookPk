# TurfBookPK Agent Guide

## Project Overview

TurfBookPK is a React Native/Expo football-ground booking application with a separate Express API and PostgreSQL database.

The repository contains two applications:

- `PitchBook/`: Expo Router mobile application.
- `Server/`: Express API using Drizzle ORM and PostgreSQL.

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
- Image selection: Expo ImagePicker. R2/cloud storage upload is not implemented yet.

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
- `/api/bookings`: mocked-payment booking creation, player/vendor lists, cancellation, notifications.
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
10. Cancellation releases the slot and marks the booking refunded.
11. Booking notifications are stored for both player and vendor.
12. Players can view persisted notifications and add a booking to their calendar.

## Database Tables

The active backend schema currently includes:

- `users`
- `otp_challenges`
- `refresh_sessions`
- `vendors`
- `grounds`
- `slots`
- `bookings`
- `notifications`

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
- Cloudflare R2 image upload is not implemented; image picker URIs/mock URLs are currently stored as strings.
- Reviews, map rendering, wallet/earnings, and advanced admin verification are not implemented.
- Notifications are persisted and displayed in-app, but push notifications and scheduled local reminders are not fully implemented.
- The mobile project still has pre-existing TypeScript issues in OTP refs, Expo StatusBar props, web CSS module typing, and global CSS typing.

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
