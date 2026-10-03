CREATE TABLE IF NOT EXISTS "ground_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ground_id" uuid NOT NULL UNIQUE REFERENCES "grounds"("id") ON DELETE cascade,
  "status" text DEFAULT 'draft' NOT NULL,
  "authority_status" text DEFAULT 'draft' NOT NULL,
  "authority_reason" text,
  "relationship" text,
  "document_expiry_date" date,
  "submitted_at" timestamp with time zone,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "ground_verification_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "verification_id" uuid NOT NULL REFERENCES "ground_verifications"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "storage_key" text NOT NULL UNIQUE,
  "content_type" text NOT NULL,
  "original_filename" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
