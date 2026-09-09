CREATE TYPE "ledger_entry_type" AS ENUM ('booking_earning', 'refund', 'adjustment', 'payout');
--> statement-breakpoint
CREATE TYPE "ledger_entry_status" AS ENUM ('pending', 'posted', 'reversed');
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_fee" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_amount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id"),
  "player_id" uuid NOT NULL REFERENCES "users"("id"),
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id"),
  "provider" text NOT NULL,
  "provider_reference" text,
  "amount" integer NOT NULL,
  "status" "payment_status" DEFAULT 'pending' NOT NULL,
  "idempotency_key" text NOT NULL UNIQUE,
  "paid_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id"),
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id"),
  "payment_attempt_id" uuid REFERENCES "payment_attempts"("id"),
  "type" "ledger_entry_type" NOT NULL,
  "status" "ledger_entry_status" DEFAULT 'pending' NOT NULL,
  "amount" integer NOT NULL,
  "description" text NOT NULL,
  "idempotency_key" text NOT NULL UNIQUE,
  "posted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
