-- Query indexes for discovery, booking lists, expiry jobs, and admin queues.
-- Run during a maintenance window: Drizzle migrations run in a transaction,
-- so CREATE INDEX CONCURRENTLY cannot be used here.
-- The original push-receipt migration shared 0014 with slot schedules and
-- was omitted from the Drizzle journal. Repair that missing table safely.
CREATE TABLE IF NOT EXISTS push_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  token text NOT NULL REFERENCES push_tokens(token) ON DELETE CASCADE,
  ticket_id text NOT NULL UNIQUE,
  checked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS slots_ground_date_start_idx ON slots (ground_id, date, start_time);
CREATE INDEX IF NOT EXISTS slots_available_ground_date_idx ON slots (ground_id, date, start_time) WHERE is_booked = false AND is_blocked = false;
CREATE INDEX IF NOT EXISTS slots_active_hold_expiry_idx ON slots (hold_expires_at) WHERE hold_booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_player_created_idx ON bookings (player_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS bookings_vendor_created_idx ON bookings (vendor_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS bookings_status_date_end_idx ON bookings (status, date, end_time);
CREATE INDEX IF NOT EXISTS bookings_order_idx ON bookings (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_recurring_pending_idx ON bookings (payment_window_opens_at, reservation_expires_at) WHERE is_recurring_reservation = true AND status = 'pending_payment';
CREATE INDEX IF NOT EXISTS grounds_vendor_title_idx ON grounds (vendor_id, title, id);
CREATE INDEX IF NOT EXISTS grounds_public_rating_idx ON grounds (rating DESC, title, id) WHERE is_active = true AND is_verified = true AND verification_status = 'approved';
CREATE INDEX IF NOT EXISTS grounds_public_price_idx ON grounds (price_per_hour, title, id) WHERE is_active = true AND is_verified = true AND verification_status = 'approved';
CREATE INDEX IF NOT EXISTS grounds_public_city_idx ON grounds (city) WHERE is_active = true AND is_verified = true AND verification_status = 'approved';
CREATE INDEX IF NOT EXISTS grounds_amenities_gin_idx ON grounds USING gin (amenities);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS payment_attempts_pending_expiry_idx ON payment_attempts (expires_at) WHERE provider = 'clink' AND provider_status = 'pending';
CREATE INDEX IF NOT EXISTS payment_attempts_player_created_idx ON payment_attempts (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_attempts_booking_idx ON payment_attempts (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_attempts_order_idx ON payment_attempts (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_attempts_review_idx ON payment_attempts (updated_at DESC) WHERE review_status = 'manual_review';
CREATE INDEX IF NOT EXISTS push_receipts_pending_idx ON push_receipts (created_at) WHERE checked_at IS NULL;
CREATE INDEX IF NOT EXISTS ledger_vendor_created_idx ON ledger_entries (vendor_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS reviews_ground_created_idx ON reviews (ground_id, created_at DESC) WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS review_reports_status_created_idx ON review_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS favorites_user_created_idx ON favorite_grounds (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS recently_viewed_user_date_idx ON recently_viewed_grounds (user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS blackout_ground_date_idx ON ground_blackout_dates (ground_id, date);
CREATE INDEX IF NOT EXISTS templates_ground_active_idx ON slot_schedule_templates (ground_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS vendor_verifications_status_idx ON vendor_verifications (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS ground_verifications_status_idx ON ground_verifications (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_logs (created_at DESC, id DESC);
