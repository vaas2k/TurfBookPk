ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pitch_side integer;

UPDATE bookings AS booking
SET pitch_side = pitch.side
FROM pitches AS pitch
WHERE booking.pitch_id = pitch.id
  AND booking.pitch_side IS NULL;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_pitch_side_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_pitch_side_check
  CHECK (pitch_side IS NULL OR pitch_side > 0);
