ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_suspended" boolean NOT NULL DEFAULT false;

ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "verification_status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "verification_reason" text;
UPDATE "vendors" SET "verification_status" = 'approved' WHERE "verification_status" = 'pending';

ALTER TABLE "grounds" ADD COLUMN IF NOT EXISTS "verification_status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "grounds" ADD COLUMN IF NOT EXISTS "verification_reason" text;
UPDATE "grounds" SET "verification_status" = 'approved' WHERE "verification_status" = 'pending';

ALTER TABLE "review_reports" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'open';
ALTER TABLE "review_reports" ADD COLUMN IF NOT EXISTS "resolution_reason" text;
ALTER TABLE "review_reports" ADD COLUMN IF NOT EXISTS "resolved_by" uuid REFERENCES "users"("id");
ALTER TABLE "review_reports" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" uuid NOT NULL REFERENCES "users"("id"),
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid NOT NULL,
  "reason" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "admin_audit_logs_target_idx" ON "admin_audit_logs" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_at_idx" ON "admin_audit_logs" ("created_at");
