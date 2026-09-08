CREATE TYPE "booking_status" AS ENUM ('pending_payment', 'confirmed', 'cancelled', 'expired', 'completed', 'no_show');
--> statement-breakpoint
CREATE TYPE "payment_status" AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'refund_pending', 'refunded');
--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "held_by" uuid;
--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "hold_booking_id" uuid;
--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "hold_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "idempotency_key" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "hold_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_reason" text;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "booking_status" USING (CASE WHEN "status" = 'cancelled' THEN 'cancelled' ELSE 'confirmed' END)::"booking_status";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending_payment';
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "payment_status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "payment_status" TYPE "payment_status" USING (CASE WHEN "payment_status" = 'refunded' THEN 'refunded' ELSE 'paid' END)::"payment_status";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "payment_status" SET DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_held_by_users_id_fk" FOREIGN KEY ("held_by") REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_hold_booking_id_bookings_id_fk" FOREIGN KEY ("hold_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_not_booked_and_blocked" CHECK (NOT ("is_booked" AND "is_blocked"));
--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_booking_fields_consistent" CHECK (("is_booked" AND "booked_by" IS NOT NULL AND "booking_id" IS NOT NULL) OR (NOT "is_booked" AND "booked_by" IS NULL AND "booking_id" IS NULL));
--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_hold_fields_consistent" CHECK (("hold_expires_at" IS NULL AND "held_by" IS NULL AND "hold_booking_id" IS NULL) OR ("hold_expires_at" IS NOT NULL AND "held_by" IS NOT NULL AND "hold_booking_id" IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_hold_not_booked_or_blocked" CHECK ("hold_expires_at" IS NULL OR (NOT "is_booked" AND NOT "is_blocked"));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_idempotency_key_unique" UNIQUE ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_one_active_booking_per_slot" ON "bookings" USING btree ("slot_id") WHERE "status" IN ('pending_payment', 'confirmed');
