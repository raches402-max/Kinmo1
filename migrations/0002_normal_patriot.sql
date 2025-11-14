CREATE TABLE "itinerary_option_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_id" varchar NOT NULL,
	"auto_event_id" varchar NOT NULL,
	"member_id" varchar,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_options" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auto_event_id" varchar NOT NULL,
	"option_number" integer NOT NULL,
	"venues" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auto_scheduled_events" ADD COLUMN "allow_member_voting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_scheduled_events" ADD COLUMN "selected_option_id" varchar;--> statement-breakpoint
ALTER TABLE "itinerary_option_votes" ADD CONSTRAINT "itinerary_option_votes_option_id_itinerary_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."itinerary_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_option_votes" ADD CONSTRAINT "itinerary_option_votes_auto_event_id_auto_scheduled_events_id_fk" FOREIGN KEY ("auto_event_id") REFERENCES "public"."auto_scheduled_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_option_votes" ADD CONSTRAINT "itinerary_option_votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_option_votes" ADD CONSTRAINT "itinerary_option_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_options" ADD CONSTRAINT "itinerary_options_auto_event_id_auto_scheduled_events_id_fk" FOREIGN KEY ("auto_event_id") REFERENCES "public"."auto_scheduled_events"("id") ON DELETE cascade ON UPDATE no action;