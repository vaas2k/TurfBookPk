-- Bounded background deletion and metrics lookups. Apply during a maintenance window.
CREATE INDEX IF NOT EXISTS otp_challenges_expiry_idx ON otp_challenges (expires_at);
CREATE INDEX IF NOT EXISTS refresh_sessions_expiry_idx ON refresh_sessions (expires_at);
CREATE INDEX IF NOT EXISTS refresh_sessions_revoked_idx ON refresh_sessions (revoked_at) WHERE revoked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS push_receipts_checked_idx ON push_receipts (checked_at) WHERE checked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_outbox_sent_idx ON notification_outbox (sent_at) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS notification_outbox_dead_idx ON notification_outbox (id) WHERE status = 'dead';
