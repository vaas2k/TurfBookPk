CREATE TABLE "ground_blackout_dates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ground_id" uuid NOT NULL REFERENCES "grounds"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ground_blackout_dates_ground_date_unique" UNIQUE("ground_id", "date")
);
