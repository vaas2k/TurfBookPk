-- Run only against a disposable database after migration 0034.
-- Every row is rolled back after asserting the database exclusion rule.
BEGIN;

INSERT INTO users (phone, full_name) VALUES ('+923009999991', 'Turnaround Test');
INSERT INTO vendors (user_id, business_name, business_phone, business_city)
SELECT id, 'Turnaround Test', '+923009999992', 'Islamabad' FROM users WHERE phone = '+923009999991';
INSERT INTO grounds (vendor_id, title, location, city, address, price_per_hour)
SELECT id, 'Turnaround Test', 'Islamabad', 'Islamabad', 'Test', 1000 FROM vendors WHERE business_phone = '+923009999992';
INSERT INTO slots (ground_id, date, start_time, end_time, turnaround_minutes, price)
SELECT id, '2030-01-01', '13:00', '14:00', 10, 1000 FROM grounds WHERE title = 'Turnaround Test';

DO $$
BEGIN
  BEGIN
    INSERT INTO slots (ground_id, date, start_time, end_time, turnaround_minutes, price)
    SELECT id, '2030-01-01', '14:05', '15:05', 10, 1000 FROM grounds WHERE title = 'Turnaround Test';
    RAISE EXCEPTION 'A slot inside the changeover was accepted';
  EXCEPTION WHEN exclusion_violation THEN
    NULL;
  END;
END $$;

INSERT INTO slots (ground_id, date, start_time, end_time, turnaround_minutes, price)
SELECT id, '2030-01-01', '14:10', '15:10', 10, 1000 FROM grounds WHERE title = 'Turnaround Test';

DO $$
BEGIN
  IF (SELECT count(*) FROM slots WHERE date = '2030-01-01') <> 2 THEN
    RAISE EXCEPTION 'The exact-boundary slot was not accepted';
  END IF;
END $$;

ROLLBACK;
