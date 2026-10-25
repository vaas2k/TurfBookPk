CREATE INDEX IF NOT EXISTS slots_template_latest_idx ON slots (schedule_template_id, date DESC) WHERE schedule_template_id IS NOT NULL;
