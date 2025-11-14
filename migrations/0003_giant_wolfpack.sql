ALTER TABLE "auto_scheduled_events" ADD COLUMN "confidence_score" integer;--> statement-breakpoint
ALTER TABLE "auto_scheduled_events" ADD COLUMN "confidence_factors" jsonb;--> statement-breakpoint
ALTER TABLE "auto_scheduled_events" ADD COLUMN "requires_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_scheduled_events" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "automation_level" text DEFAULT 'smart' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "confidence_threshold" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "automation_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "automation_paused_until" timestamp;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "automation_pause_events_remaining" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "review_every_nth_event" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "event_count_since_last_review" integer DEFAULT 0 NOT NULL;