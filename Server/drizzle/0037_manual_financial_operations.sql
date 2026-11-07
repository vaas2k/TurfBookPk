CREATE TABLE refund_bank_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), player_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bank_name text NOT NULL, account_title text NOT NULL, account_ciphertext text NOT NULL, account_fingerprint text NOT NULL,
  account_last_four text NOT NULL, belongs_to_player boolean NOT NULL DEFAULT true, alternate_owner_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE refund_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id), player_id uuid NOT NULL REFERENCES users(id), vendor_id uuid NOT NULL REFERENCES vendors(id),
  status text NOT NULL DEFAULT 'awaiting_bank_details', responsibility text NOT NULL DEFAULT 'policy', calculated_amount integer NOT NULL CHECK (calculated_amount > 0), approved_amount integer,
  vendor_funded_amount integer NOT NULL DEFAULT 0, platform_funded_amount integer NOT NULL DEFAULT 0,
  bank_name text, account_title text, account_ciphertext text, account_last_four text, transfer_reference text, receipt_storage_key text,
  failure_reason text, admin_notes text, approved_by uuid REFERENCES users(id), completed_by uuid REFERENCES users(id), approved_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE vendor_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vendor_id uuid NOT NULL REFERENCES vendors(id), status text NOT NULL DEFAULT 'draft', amount integer NOT NULL CHECK (amount > 0), reason text,
  bank_name text NOT NULL, account_title text NOT NULL, account_last_four text NOT NULL, transfer_reference text, receipt_storage_key text, failure_reason text,
  prepared_by uuid NOT NULL REFERENCES users(id), completed_by uuid REFERENCES users(id), completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE vendor_payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payout_id uuid NOT NULL REFERENCES vendor_payouts(id) ON DELETE CASCADE,
  ledger_entry_id uuid NOT NULL UNIQUE REFERENCES ledger_entries(id), amount integer NOT NULL CHECK (amount > 0), created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE financial_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES bookings(id), player_id uuid NOT NULL REFERENCES users(id), vendor_id uuid NOT NULL REFERENCES vendors(id),
  status text NOT NULL DEFAULT 'open', category text NOT NULL, description text NOT NULL, responsibility text, resolution text,
  refund_amount integer NOT NULL DEFAULT 0, vendor_hold_amount integer NOT NULL DEFAULT 0, resolved_by uuid REFERENCES users(id), resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX refund_cases_status_created_idx ON refund_cases(status, created_at DESC);
CREATE INDEX refund_cases_vendor_idx ON refund_cases(vendor_id, created_at DESC);
CREATE INDEX vendor_payouts_status_created_idx ON vendor_payouts(status, created_at DESC);
CREATE INDEX vendor_payouts_vendor_idx ON vendor_payouts(vendor_id, created_at DESC);
CREATE INDEX vendor_payout_items_payout_idx ON vendor_payout_items(payout_id);
CREATE INDEX financial_disputes_status_created_idx ON financial_disputes(status, created_at DESC);
CREATE UNIQUE INDEX financial_disputes_open_booking_idx ON financial_disputes(booking_id) WHERE status NOT IN ('resolved', 'rejected', 'cancelled');
