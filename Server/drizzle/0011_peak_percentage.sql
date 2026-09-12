ALTER TABLE "grounds" RENAME COLUMN "peak_price" TO "peak_percentage";
--> statement-breakpoint
UPDATE "grounds" SET "peak_percentage" = NULL, "peak_windows" = '[]'::jsonb WHERE "peak_percentage" IS NOT NULL;
