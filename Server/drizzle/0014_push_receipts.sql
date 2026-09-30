CREATE TABLE "push_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL REFERENCES "push_tokens"("token") ON DELETE CASCADE,
  "ticket_id" text NOT NULL,
  "checked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "push_receipts_ticket_id_unique" UNIQUE("ticket_id")
);
