-- Keep authenticated metrics reads bounded as payment history grows.
CREATE INDEX IF NOT EXISTS payment_attempts_pending_metric_idx ON payment_attempts (id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS payment_attempts_expiry_retry_metric_idx ON payment_attempts (id) WHERE provider_status = 'pending' AND expiry_retry_count > 0;
