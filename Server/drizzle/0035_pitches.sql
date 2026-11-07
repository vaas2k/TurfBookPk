CREATE TABLE pitches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ground_id uuid NOT NULL REFERENCES grounds(id) ON DELETE CASCADE,
  name text NOT NULL,
  side integer NOT NULL CHECK (side IN (5, 6, 7, 8, 9, 11)),
  kind text NOT NULL DEFAULT 'independent' CHECK (kind IN ('independent', 'combined')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE pitch_components (
  pitch_id uuid NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  component_pitch_id uuid NOT NULL REFERENCES pitches(id) ON DELETE RESTRICT,
  PRIMARY KEY (pitch_id, component_pitch_id),
  CHECK (pitch_id <> component_pitch_id)
);
--> statement-breakpoint
INSERT INTO pitches (id, ground_id, name, side)
SELECT gen_random_uuid(), id, 'Pitch 1', CASE
  WHEN pitch_type ~ '11' THEN 11 WHEN pitch_type ~ '9' THEN 9
  WHEN pitch_type ~ '8' THEN 8 WHEN pitch_type ~ '6' THEN 6 WHEN pitch_type ~ '5' THEN 5 ELSE 7 END
FROM grounds;
--> statement-breakpoint
ALTER TABLE slots ADD COLUMN pitch_id uuid REFERENCES pitches(id);
--> statement-breakpoint
ALTER TABLE slot_schedule_templates ADD COLUMN pitch_id uuid REFERENCES pitches(id);
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN pitch_id uuid REFERENCES pitches(id);
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN pitch_name text;
--> statement-breakpoint
UPDATE slots s SET pitch_id = p.id FROM pitches p WHERE p.ground_id = s.ground_id;
--> statement-breakpoint
UPDATE slot_schedule_templates t SET pitch_id = p.id FROM pitches p WHERE p.ground_id = t.ground_id;
--> statement-breakpoint
UPDATE bookings b SET pitch_id = p.id FROM pitches p WHERE p.ground_id = b.ground_id;
--> statement-breakpoint
UPDATE bookings b SET pitch_name = p.name FROM pitches p WHERE p.id = b.pitch_id;
--> statement-breakpoint
ALTER TABLE slots ALTER COLUMN pitch_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE slot_schedule_templates ALTER COLUMN pitch_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE bookings ALTER COLUMN pitch_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE bookings ALTER COLUMN pitch_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE slots ADD COLUMN end_date date;
--> statement-breakpoint
UPDATE slots SET end_date = date;
--> statement-breakpoint
ALTER TABLE slots ALTER COLUMN end_date SET NOT NULL;
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN end_date date;
--> statement-breakpoint
UPDATE bookings SET end_date = date;
--> statement-breakpoint
ALTER TABLE bookings ALTER COLUMN end_date SET NOT NULL;
--> statement-breakpoint
ALTER TABLE slot_schedule_templates ADD COLUMN start_day_offset integer NOT NULL DEFAULT 0 CHECK (start_day_offset IN (0,1));
--> statement-breakpoint
ALTER TABLE slot_schedule_templates ADD COLUMN end_day_offset integer NOT NULL DEFAULT 0 CHECK (end_day_offset IN (0,1));
--> statement-breakpoint
ALTER TABLE slots DROP CONSTRAINT slots_valid_time_range;
--> statement-breakpoint
ALTER TABLE slots ADD CONSTRAINT slots_valid_time_range CHECK (date + start_time < end_date + end_time);
--> statement-breakpoint
ALTER TABLE slots DROP CONSTRAINT slots_no_overlapping_times;
--> statement-breakpoint
ALTER TABLE slots ADD CONSTRAINT slots_no_overlapping_times EXCLUDE USING gist (
  pitch_id WITH =,
  tsrange(date + start_time, end_date + end_time + turnaround_minutes * interval '1 minute', '[)') WITH &&
);
--> statement-breakpoint
CREATE INDEX slots_pitch_date_idx ON slots (pitch_id, date);
--> statement-breakpoint
CREATE INDEX templates_pitch_active_idx ON slot_schedule_templates (pitch_id, is_active);
--> statement-breakpoint
CREATE FUNCTION create_default_pitch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO pitches (ground_id, name, side) VALUES (NEW.id, 'Pitch 1',
    CASE WHEN NEW.pitch_type ~ '11' THEN 11 WHEN NEW.pitch_type ~ '9' THEN 9
      WHEN NEW.pitch_type ~ '8' THEN 8 WHEN NEW.pitch_type ~ '6' THEN 6 WHEN NEW.pitch_type ~ '5' THEN 5 ELSE 7 END);
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER grounds_default_pitch AFTER INSERT ON grounds FOR EACH ROW EXECUTE FUNCTION create_default_pitch();
--> statement-breakpoint
CREATE FUNCTION fill_pitch_slot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pitch_id IS NULL THEN
    SELECT id INTO NEW.pitch_id FROM pitches WHERE ground_id = NEW.ground_id AND kind = 'independent' ORDER BY created_at, id LIMIT 1;
  END IF;
  IF NEW.end_date IS NULL THEN NEW.end_date := NEW.date; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER slots_pitch_default BEFORE INSERT ON slots FOR EACH ROW EXECUTE FUNCTION fill_pitch_slot();
--> statement-breakpoint
CREATE FUNCTION fill_booking_pitch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pitch_id IS NULL THEN SELECT pitch_id INTO NEW.pitch_id FROM slots WHERE id = NEW.slot_id; END IF;
  IF NEW.pitch_name IS NULL THEN SELECT name INTO NEW.pitch_name FROM pitches WHERE id = NEW.pitch_id; END IF;
  IF NEW.end_date IS NULL THEN SELECT end_date INTO NEW.end_date FROM slots WHERE id = NEW.slot_id; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER bookings_pitch_default BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION fill_booking_pitch();
--> statement-breakpoint
CREATE FUNCTION fill_template_pitch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pitch_id IS NULL THEN
    SELECT id INTO NEW.pitch_id FROM pitches WHERE ground_id = NEW.ground_id AND kind = 'independent' ORDER BY created_at, id LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER templates_pitch_default BEFORE INSERT ON slot_schedule_templates FOR EACH ROW EXECUTE FUNCTION fill_template_pitch();
--> statement-breakpoint
CREATE FUNCTION validate_pitch_component() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE combined pitches%ROWTYPE; component pitches%ROWTYPE;
BEGIN
  SELECT * INTO combined FROM pitches WHERE id = NEW.pitch_id;
  SELECT * INTO component FROM pitches WHERE id = NEW.component_pitch_id;
  IF combined.kind <> 'combined' OR combined.side NOT IN (9,11) OR component.kind <> 'independent'
     OR component.side <> 7 OR combined.ground_id <> component.ground_id THEN
    RAISE EXCEPTION 'Combined pitches must use two independent 7-side pitches in the same ground';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER pitch_component_valid BEFORE INSERT OR UPDATE ON pitch_components FOR EACH ROW EXECUTE FUNCTION validate_pitch_component();
--> statement-breakpoint
CREATE TABLE pitch_occupancies (
  slot_id uuid NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  resource_pitch_id uuid NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  during tsrange NOT NULL,
  expires_at timestamptz,
  PRIMARY KEY (slot_id, resource_pitch_id),
  CONSTRAINT pitch_resource_no_overlap EXCLUDE USING gist (resource_pitch_id WITH =, during WITH &&)
);
--> statement-breakpoint
CREATE FUNCTION sync_pitch_occupancy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE resource uuid; span tsrange; resource_count integer;
BEGIN
  DELETE FROM pitch_occupancies WHERE slot_id = NEW.id;
  IF NOT (NEW.is_booked OR NEW.is_blocked OR NEW.is_club_reserved OR (NEW.held_by IS NOT NULL AND NEW.hold_expires_at > now())) THEN
    RETURN NEW;
  END IF;
  span := tsrange(NEW.date + NEW.start_time,
    NEW.end_date + NEW.end_time + NEW.turnaround_minutes * interval '1 minute', '[)');
  SELECT count(*) INTO resource_count FROM pitch_components WHERE pitch_id = NEW.pitch_id;
  IF (SELECT kind FROM pitches WHERE id = NEW.pitch_id) = 'combined' AND resource_count <> 2 THEN
    RAISE EXCEPTION 'Combined pitch requires exactly two source pitches';
  END IF;
  FOR resource IN
    SELECT component_pitch_id FROM pitch_components WHERE pitch_id = NEW.pitch_id
    UNION ALL
    SELECT NEW.pitch_id WHERE resource_count = 0
  LOOP
    DELETE FROM pitch_occupancies WHERE resource_pitch_id = resource AND expires_at <= now();
    INSERT INTO pitch_occupancies (slot_id, resource_pitch_id, during, expires_at)
    VALUES (NEW.id, resource, span,
      CASE WHEN NEW.is_booked OR NEW.is_blocked OR NEW.is_club_reserved THEN NULL ELSE NEW.hold_expires_at END);
  END LOOP;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER slots_sync_pitch_occupancy AFTER INSERT OR UPDATE ON slots FOR EACH ROW EXECUTE FUNCTION sync_pitch_occupancy();
--> statement-breakpoint
INSERT INTO pitch_occupancies (slot_id, resource_pitch_id, during, expires_at)
SELECT s.id, s.pitch_id,
  tsrange(s.date + s.start_time, s.end_date + s.end_time + s.turnaround_minutes * interval '1 minute', '[)'),
  CASE WHEN s.is_booked OR s.is_blocked OR s.is_club_reserved THEN NULL ELSE s.hold_expires_at END
FROM slots s
WHERE s.is_booked OR s.is_blocked OR s.is_club_reserved OR (s.held_by IS NOT NULL AND s.hold_expires_at > now());
--> statement-breakpoint
CREATE TRIGGER pitches_catalog_revision_change AFTER INSERT OR UPDATE OR DELETE ON pitches
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_ground_catalog_revision();
