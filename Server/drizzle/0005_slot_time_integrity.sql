CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_valid_time_range" CHECK ("start_time" < "end_time");
--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_no_overlapping_times" EXCLUDE USING gist (
  "ground_id" WITH =,
  "date" WITH =,
  tsrange("date" + "start_time", "date" + "end_time", '[)') WITH &&
);
