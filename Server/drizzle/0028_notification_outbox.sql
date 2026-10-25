CREATE TABLE IF NOT EXISTS notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL UNIQUE REFERENCES notifications(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_outbox_due_idx ON notification_outbox (available_at, id) WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION enqueue_notification_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO notification_outbox (notification_id) VALUES (NEW.id) ON CONFLICT (notification_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notifications_push_outbox_trigger ON notifications;
CREATE TRIGGER notifications_push_outbox_trigger AFTER INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION enqueue_notification_push();
