CREATE TABLE IF NOT EXISTS ground_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  ground_id uuid NOT NULL REFERENCES grounds(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ground_managers_vendor_ground_phone_idx ON ground_managers (vendor_id, ground_id, phone);
CREATE INDEX IF NOT EXISTS ground_managers_phone_active_idx ON ground_managers (phone, ground_id) WHERE revoked_at IS NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_by uuid REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_in_token_hash text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_in_token_expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_check_in_token_hash_idx ON bookings (check_in_token_hash) WHERE check_in_token_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  ground_id uuid NOT NULL REFERENCES grounds(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attendance_events_booking_created_idx ON attendance_events (booking_id, created_at);
