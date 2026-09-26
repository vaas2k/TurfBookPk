ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "no_show_strikes" integer NOT NULL DEFAULT 0;
