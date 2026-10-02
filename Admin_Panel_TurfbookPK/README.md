# TurfBookPK Admin Panel

Small internal Next.js console for marketplace operations. It uses the existing Express admin API; it does not duplicate booking or verification logic.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `SERVER_API_URL` to the server API (for example `http://localhost:5000/api`). The panel keeps the access token in an HttpOnly, same-site cookie and proxies admin calls server-side; do not use a browser-exposed API token variable.

## First administrator

After the user has authenticated once with OTP, set that specific database user's `users.role` to `admin` through a controlled deployment/admin procedure. Do not expose a public self-service role upgrade.

The current initial scope covers dashboard counts, vendor/ground verification, review-report moderation, audit-backed account suspension, and read-only transaction records. Payments, payouts, and reporting dashboards remain intentionally out of scope until their underlying gateway data exists.
