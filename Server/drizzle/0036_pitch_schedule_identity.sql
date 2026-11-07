DROP INDEX IF EXISTS slot_schedule_templates_ground_time_unique_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX slot_schedule_templates_pitch_time_unique_idx
  ON slot_schedule_templates (pitch_id, start_time, end_time);
