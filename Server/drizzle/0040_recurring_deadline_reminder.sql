ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_deadline_reminder_notified_at timestamptz;
