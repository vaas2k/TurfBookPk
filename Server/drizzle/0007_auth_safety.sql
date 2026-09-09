ALTER TABLE "otp_challenges" ADD COLUMN "request_count" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD COLUMN "request_window_started_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD COLUMN "last_sent_at" timestamp with time zone DEFAULT now() NOT NULL;
