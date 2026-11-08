ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_in_code_hash text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_in_code_attempts integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS manager_slot_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ground_id uuid NOT NULL REFERENCES grounds(id),
  slot_id uuid,
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manager_slot_actions_ground_created_idx ON manager_slot_actions (ground_id, created_at);
