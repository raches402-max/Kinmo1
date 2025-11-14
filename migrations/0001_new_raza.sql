ALTER TABLE "activities" ADD COLUMN "opening_hours" jsonb;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "business_status" text;--> statement-breakpoint
ALTER TABLE "curated_venues" ADD COLUMN "opening_hours" jsonb;--> statement-breakpoint
ALTER TABLE "curated_venues" ADD COLUMN "business_status" text;