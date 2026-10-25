CREATE UNIQUE INDEX IF NOT EXISTS ground_blackout_dates_ground_date_unique_idx ON ground_blackout_dates (ground_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS slot_schedule_templates_ground_time_unique_idx ON slot_schedule_templates (ground_id, start_time, end_time);
