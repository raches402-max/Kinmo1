CREATE TABLE "activity_swipes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"activity_id" varchar,
	"voting_event_id" varchar,
	"user_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"swipe_direction" text NOT NULL,
	"swipe_session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "swipe_consensus" integer;--> statement-breakpoint
ALTER TABLE "voting_events" ADD COLUMN "swipe_consensus" integer;--> statement-breakpoint
ALTER TABLE "activity_swipes" ADD CONSTRAINT "activity_swipes_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_swipes" ADD CONSTRAINT "activity_swipes_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_swipes" ADD CONSTRAINT "activity_swipes_voting_event_id_voting_events_id_fk" FOREIGN KEY ("voting_event_id") REFERENCES "public"."voting_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_swipes" ADD CONSTRAINT "activity_swipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_swipes" ADD CONSTRAINT "activity_swipes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;