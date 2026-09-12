CREATE TYPE "booking_order_status" AS ENUM ('pending_payment', 'confirmed', 'cancelled', 'expired');
--> statement-breakpoint
CREATE TABLE "booking_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_number" text NOT NULL UNIQUE,
  "player_id" uuid NOT NULL REFERENCES "users"("id"),
  "total_amount" integer NOT NULL,
  "platform_fee" integer DEFAULT 0 NOT NULL,
  "status" "booking_order_status" DEFAULT 'pending_payment' NOT NULL,
  "payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
  "idempotency_key" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "order_id" uuid REFERENCES "booking_orders"("id");
--> statement-breakpoint
ALTER TABLE "payment_attempts" ALTER COLUMN "booking_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "order_id" uuid REFERENCES "booking_orders"("id");
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempt_target" CHECK (("booking_id" IS NOT NULL) <> ("order_id" IS NOT NULL));
