CREATE TABLE "slot_schedule_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ground_id" uuid NOT NULL REFERENCES "grounds"("id") ON DELETE CASCADE,
  "days" integer[] NOT NULL,
  "start_time" time NOT NULL,
  "end_time" time NOT NULL,
  "price" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "slots" ADD COLUMN "is_club_reserved" boolean DEFAULT false NOT NULL;
ALTER TABLE "slots" ADD COLUMN "reservation_note" text;
ALTER TABLE "slots" ADD COLUMN "schedule_template_id" uuid;
ALTER TABLE "slots" ADD CONSTRAINT "slots_schedule_template_id_slot_schedule_templates_id_fk" FOREIGN KEY ("schedule_template_id") REFERENCES "slot_schedule_templates"("id") ON DELETE SET NULL;
