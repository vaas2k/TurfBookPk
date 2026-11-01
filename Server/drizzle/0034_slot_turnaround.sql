ALTER TABLE grounds ADD COLUMN turnaround_minutes integer NOT NULL DEFAULT 10;
--> statement-breakpoint
ALTER TABLE slots ADD COLUMN turnaround_minutes integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE slot_schedule_templates ADD COLUMN turnaround_minutes integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN turnaround_minutes integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN actual_start_at timestamptz;
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN start_delay_reason text;
--> statement-breakpoint
ALTER TABLE grounds ADD CONSTRAINT grounds_turnaround_minutes_valid CHECK (turnaround_minutes IN (5, 10, 15));
--> statement-breakpoint
ALTER TABLE slots ADD CONSTRAINT slots_turnaround_minutes_valid CHECK (turnaround_minutes IN (0, 5, 10, 15));
--> statement-breakpoint
ALTER TABLE slot_schedule_templates ADD CONSTRAINT templates_turnaround_minutes_valid CHECK (turnaround_minutes IN (0, 5, 10, 15));
--> statement-breakpoint
ALTER TABLE bookings ADD CONSTRAINT bookings_turnaround_minutes_valid CHECK (turnaround_minutes IN (0, 5, 10, 15));
--> statement-breakpoint
ALTER TABLE slots DROP CONSTRAINT slots_no_overlapping_times;
--> statement-breakpoint
ALTER TABLE slots ADD CONSTRAINT slots_no_overlapping_times EXCLUDE USING gist (
  ground_id WITH =,
  tsrange(date + start_time, date + end_time + turnaround_minutes * interval '1 minute', '[)') WITH &&
);
