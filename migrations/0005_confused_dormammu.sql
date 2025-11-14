CREATE TABLE "confidence_predictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"auto_event_id" varchar,
	"swipe_session_id" varchar,
	"predicted_confidence" integer NOT NULL,
	"predicted_factors" jsonb NOT NULL,
	"factor_weights" jsonb NOT NULL,
	"actual_consensus" integer,
	"validation_source" text,
	"prediction_error" integer,
	"was_accurate" boolean,
	"predicted_at" timestamp DEFAULT now() NOT NULL,
	"validated_at" timestamp,
	"used_for_calibration" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_confidence_weights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"venue_quality_weight" real DEFAULT 0.25 NOT NULL,
	"time_consensus_weight" real DEFAULT 0.25 NOT NULL,
	"group_engagement_weight" real DEFAULT 0.2 NOT NULL,
	"pattern_match_weight" real DEFAULT 0.2 NOT NULL,
	"swipe_consensus_weight" real DEFAULT 0.1 NOT NULL,
	"calibration_count" integer DEFAULT 0 NOT NULL,
	"last_calibration_at" timestamp,
	"total_predictions" integer DEFAULT 0 NOT NULL,
	"mean_absolute_error" real,
	"accuracy_rate" real,
	"auto_calibration_enabled" boolean DEFAULT true NOT NULL,
	"manual_override_at" timestamp,
	"manual_override_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_confidence_weights_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
CREATE TABLE "swipe_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"session_type" text NOT NULL,
	"is_blocking" boolean DEFAULT false NOT NULL,
	"auto_event_id" varchar,
	"triggered_by" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"target_swipe_count" integer DEFAULT 5 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"member_count" integer NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"total_swipes" integer DEFAULT 0 NOT NULL,
	"consensus_results" jsonb,
	"average_consensus" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "confidence_predictions" ADD CONSTRAINT "confidence_predictions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confidence_predictions" ADD CONSTRAINT "confidence_predictions_auto_event_id_auto_scheduled_events_id_fk" FOREIGN KEY ("auto_event_id") REFERENCES "public"."auto_scheduled_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confidence_predictions" ADD CONSTRAINT "confidence_predictions_swipe_session_id_swipe_sessions_id_fk" FOREIGN KEY ("swipe_session_id") REFERENCES "public"."swipe_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_confidence_weights" ADD CONSTRAINT "group_confidence_weights_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe_sessions" ADD CONSTRAINT "swipe_sessions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe_sessions" ADD CONSTRAINT "swipe_sessions_auto_event_id_auto_scheduled_events_id_fk" FOREIGN KEY ("auto_event_id") REFERENCES "public"."auto_scheduled_events"("id") ON DELETE cascade ON UPDATE no action;