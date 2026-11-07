ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS match_start_notified_at timestamptz;
