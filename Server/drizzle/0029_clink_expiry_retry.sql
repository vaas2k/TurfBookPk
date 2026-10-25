ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS expiry_retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS expiry_next_attempt_at timestamptz;
CREATE INDEX IF NOT EXISTS payment_attempts_expiry_retry_idx
  ON payment_attempts (expiry_next_attempt_at, expires_at)
  WHERE provider = 'clink' AND provider_status = 'pending';
