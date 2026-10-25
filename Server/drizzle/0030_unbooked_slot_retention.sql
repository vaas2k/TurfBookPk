CREATE INDEX IF NOT EXISTS slots_unbooked_cleanup_idx ON slots (date, id)
  WHERE is_booked = false AND is_blocked = false AND is_club_reserved = false
    AND booking_id IS NULL AND booked_by IS NULL
    AND hold_booking_id IS NULL AND held_by IS NULL AND hold_expires_at IS NULL;
CREATE INDEX IF NOT EXISTS bookings_slot_id_all_idx ON bookings (slot_id);
