ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancellation_policy" text NOT NULL DEFAULT 'standard';
UPDATE "bookings" SET "cancellation_policy" = 'standard' WHERE "cancellation_policy" IS NULL;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancellation_policy_check" CHECK ("cancellation_policy" IN ('lenient', 'standard', 'strict'));
