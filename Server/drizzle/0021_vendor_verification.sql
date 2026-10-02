CREATE TABLE IF NOT EXISTS "vendor_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vendor_id" uuid NOT NULL UNIQUE REFERENCES "vendors"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'draft',
  "identity_status" text NOT NULL DEFAULT 'draft', "identity_reason" text,
  "cnic_hash" text UNIQUE, "cnic_last_four" text,
  "business_status" text NOT NULL DEFAULT 'draft', "business_reason" text,
  "business_type" text, "business_number_hash" text, "business_number_last_four" text,
  "registrant_relationship" text NOT NULL DEFAULT 'owner_director',
  "payout_status" text NOT NULL DEFAULT 'draft', "payout_reason" text,
  "payout_bank_name" text, "payout_account_title" text, "payout_account_ciphertext" text,
  "submitted_at" timestamp with time zone, "reviewed_at" timestamp with time zone,
  "reviewed_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "vendor_verification_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "verification_id" uuid NOT NULL REFERENCES "vendor_verifications"("id") ON DELETE CASCADE,
  "type" text NOT NULL, "storage_key" text NOT NULL UNIQUE, "content_type" text NOT NULL,
  "original_filename" text, "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
