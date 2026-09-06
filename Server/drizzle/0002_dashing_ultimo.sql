ALTER TABLE "users" ALTER COLUMN "full_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'player';--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "rating" SET DATA TYPE numeric(3, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_foot" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_position" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "skill_level" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "total_withdrawn" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");--> statement-breakpoint
DROP TYPE "public"."user_role";