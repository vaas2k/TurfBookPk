ALTER TABLE financial_disputes
  ADD COLUMN IF NOT EXISTS player_evidence_keys text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vendor_response text,
  ADD COLUMN IF NOT EXISTS vendor_evidence_keys text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vendor_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_appeal text,
  ADD COLUMN IF NOT EXISTS appealed_at timestamptz;
