# TurfBookPK Operations Runbook

This runbook applies to the Express API and its PostgreSQL database. It is intentionally provider-neutral so the same process works with a managed PostgreSQL service or a self-hosted instance.

## Logging and support

The API writes newline-delimited JSON logs to standard output. Every request has an `X-Request-Id` response header and the same `request_id` in its completion/error log. Ask a user for that ID when investigating a failed request.

The logger redacts values in sensitive fields and masks common bearer/JWT tokens, Expo push tokens, Pakistani phone numbers, CNICs, and Pakistani IBANs. Request bodies are not logged. Do not add raw request bodies, authorization headers, OTP values, Cloudinary credentials, private document URLs, or payment details to logs.

Use a vetted, access-controlled log platform for production collection. Configure alerts for:

- `/api/health` failure or elevated 5xx responses;
- elevated 4xx/5xx rates and p95 request latency;
- `worker_job_failed`, `notification_outbox_delivery_failed`, and elevated dead-letter queue counts;
- database connection failures and failed migration deployments.

Do not forward raw exceptions to an arbitrary webhook. If external error monitoring is added, use an approved provider, its server-side SDK, and the same redaction rules before enabling it.

## Time and dates

- Store instants in PostgreSQL and API records as UTC.
- Calculate booking holds, cancellation tiers, no-shows, and payment windows in UTC.
- Present dates/times in the mobile app using the user's Pakistan-local context (`Asia/Karachi` by default).
- Servers should run with UTC system time. `Asia/Karachi` is the product-facing display timezone and must not be inferred from a server's local clock.

## Database backup and restore

Take an encrypted PostgreSQL custom-format backup before every production migration and on a scheduled basis. Retain copies in a separate access-controlled location and periodically restore one into a non-production database.

Example backup (set `DATABASE_URL` in the shell; never paste production credentials into command history or source files):

```powershell
pg_dump --format=custom --no-owner --file turfbookpk-2026-10-06.dump $env:DATABASE_URL
```

Example restore to an empty non-production database:

```powershell
pg_restore --clean --if-exists --no-owner --dbname $env:RESTORE_DATABASE_URL turfbookpk-2026-10-06.dump
```

After restoring, run a health check and verify row counts for `users`, `grounds`, `slots`, `bookings`, `payments`, and `notifications`. Never test a restore against the live production database.

## Deployment and migrations

1. Confirm a fresh backup exists and can be located.
2. Run `npm run typecheck`, `npm test`, and `npm run build` in `Server/`.
3. Review the migration against a staging database first.
4. Deploy the API with the required production environment variables and run the reviewed migration.
5. Check `/api/health`, create/read a non-production test record where permitted, and inspect structured logs by request ID.
6. If a migration must be reversed, use a reviewed compensating migration. Do not use destructive rollback commands against production data.

## API, Redis, and worker

Run one or more API processes and at least one separate `npm run worker` process. Set the same `DATABASE_URL` and `REDIS_URL` in every process. Production refuses to start without Redis; set `TRUST_PROXY_HOPS` to the verified number of trusted reverse proxies, never to a guessed value. `/api/health` is liveness; `/api/ready` checks PostgreSQL and configured Redis. Apply migration `0028_notification_outbox` before starting the new worker.

The worker owns recurring payment-window updates, ended-booking completion, Clink expiry/ambiguity escalation, Expo push delivery/receipts, and recurring schedule-horizon extension. PostgreSQL advisory locks avoid duplicate scheduled scans across worker replicas. Notification inserts create outbox jobs transactionally; check `GET /api/admin/operations` for `push_outbox` counts and `GET /api/admin/operations/push-outbox/dead` for failed jobs. Admins can retry a dead job with `POST /api/admin/operations/push-outbox/:id/retry` and a required JSON `reason`; this writes an audit entry.

Push delivery is at-least-once, not exactly-once. If the worker crashes after Expo accepts a ticket but before the outbox row is marked sent, the push can repeat. A dead job is never retried automatically after six attempts. Do not run automatic deletion of old slots until a retention policy is approved.

## Privacy and access boundaries

- CNIC, business identifiers, and payout identifiers are fingerprinted/encrypted as implemented by the verification workflow; do not expose raw values in admin list views or logs.
- CNIC, business, authority, and payout documents use private media access. Public ground photos are the only media intended for public discovery.
- Admin actions must remain behind admin-role authorization and leave audit records.
- Vendors should receive only the player information required to operate a booking. Any future phone disclosure must have an explicit consent and masking rule.
- Retention periods, deletion/export handling, legal notices, and dispute evidence retention require a business/legal decision before public launch. Until approved, limit production access to authorized operators and avoid collecting optional data.

## Known deferred integrations

Real SMS, payment-provider refunds/payouts, and third-party error monitoring are not active. Do not represent mock payment status as a settled financial transaction. When a gateway is selected, document its webhook verification, reconciliation, refund, payout, retention, and incident procedures here before enabling live money movement.
