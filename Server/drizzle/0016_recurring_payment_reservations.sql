ALTER TABLE "bookings" ADD COLUMN "is_recurring_reservation" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_window_opens_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reservation_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_window_notified_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "bookings_recurring_reservation_window_idx" ON "bookings" USING btree ("is_recurring_reservation", "status", "payment_window_opens_at", "reservation_expires_at");
