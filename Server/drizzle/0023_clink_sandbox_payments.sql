ALTER TABLE "payment_attempts" ADD COLUMN "consumer_number" text;
ALTER TABLE "payment_attempts" ADD COLUMN "applicant_reference" text;
ALTER TABLE "payment_attempts" ADD COLUMN "provider_status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "payment_attempts" ADD COLUMN "provider_due_date" date;
ALTER TABLE "payment_attempts" ADD COLUMN "expires_at" timestamp with time zone;
ALTER TABLE "payment_attempts" ADD COLUMN "gateway_paid_at" timestamp with time zone;
ALTER TABLE "payment_attempts" ADD COLUMN "acknowledged_at" timestamp with time zone;
ALTER TABLE "payment_attempts" ADD COLUMN "service_charge" integer;
ALTER TABLE "payment_attempts" ADD COLUMN "final_payable_amount" integer;
ALTER TABLE "payment_attempts" ADD COLUMN "review_status" text DEFAULT 'none' NOT NULL;
ALTER TABLE "payment_attempts" ADD COLUMN "provider_error" text;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_consumer_number_unique" UNIQUE("consumer_number");
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_applicant_reference_unique" UNIQUE("applicant_reference");
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_provider_reference_unique" UNIQUE("provider_reference");

CREATE TABLE "payment_billing_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "full_name" text NOT NULL,
  "cnic_ciphertext" text NOT NULL,
  "cnic_hash" text NOT NULL UNIQUE,
  "cnic_last_four" text NOT NULL,
  "billing_address_ciphertext" text NOT NULL,
  "email" text NOT NULL,
  "phone" text NOT NULL,
  "consented_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "payment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_attempt_id" uuid REFERENCES "payment_attempts"("id") ON DELETE SET NULL,
  "provider" text NOT NULL,
  "event_type" text NOT NULL,
  "event_key" text NOT NULL UNIQUE,
  "provider_reference" text,
  "payload_hash" text NOT NULL,
  "processing_result" text NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone
);
