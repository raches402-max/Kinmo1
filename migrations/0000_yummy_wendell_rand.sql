CREATE TABLE "activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"ai_suggested_name" text,
	"venue_name" text NOT NULL,
	"venue_address" text NOT NULL,
	"city" text,
	"venue_type" text NOT NULL,
	"description" text NOT NULL,
	"google_place_id" text,
	"latitude" text,
	"longitude" text,
	"rating" text,
	"review_count" integer,
	"price_level" text,
	"photo_url" text,
	"ai_reasoning" text,
	"suggested_date" timestamp,
	"suggested_time" text,
	"price_estimate" text,
	"time_constraints" text,
	"feedback" text,
	"complementary_place_name" text,
	"complementary_place_address" text,
	"complementary_place_id" text,
	"complementary_place_photo_url" text,
	"complementary_place_rating" text,
	"complementary_place_name_2" text,
	"complementary_place_address_2" text,
	"complementary_place_id_2" text,
	"complementary_place_photo_url_2" text,
	"complementary_place_rating_2" text,
	"google_review" text,
	"time_category" text,
	"category" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_call_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" text NOT NULL,
	"method" text NOT NULL,
	"cache_status" text NOT NULL,
	"status" text NOT NULL,
	"response_time_ms" integer,
	"cost_estimate" numeric(10, 6),
	"error_message" text,
	"parameters" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_scheduled_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"itinerary_id" varchar,
	"proposed_date" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"auto_send_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_search_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"category" text NOT NULL,
	"search_location" text NOT NULL,
	"search_radius" integer NOT NULL,
	"results" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curated_venues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"latitude" numeric NOT NULL,
	"longitude" numeric NOT NULL,
	"category" text NOT NULL,
	"rating" numeric,
	"review_count" integer,
	"price_level" integer,
	"photo_url" text,
	"google_place_id" text,
	"description" text,
	"tags" text[],
	"region" text DEFAULT 'bay_area' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"suggested_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_refreshed" timestamp,
	CONSTRAINT "curated_venues_google_place_id_unique" UNIQUE("google_place_id")
);
--> statement-breakpoint
CREATE TABLE "database_backups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"backup_type" text NOT NULL,
	"created_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deleted_venues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_data" jsonb NOT NULL,
	"deletion_reason" text NOT NULL,
	"deleted_by" varchar,
	"deleted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frequency_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"member_id" varchar,
	"user_id" varchar,
	"feedback" text NOT NULL,
	"itinerary_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geocoding_cache" (
	"location" text PRIMARY KEY NOT NULL,
	"latitude" numeric NOT NULL,
	"longitude" numeric NOT NULL,
	"formatted_address" text NOT NULL,
	"timezone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_backups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"group_id" varchar NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"backup_trigger" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_collections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"collection_id" varchar,
	"order_index" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🎉',
	"location_base" text NOT NULL,
	"latitude" text,
	"longitude" text,
	"timezone" text,
	"budget_min" integer NOT NULL,
	"budget_max" integer NOT NULL,
	"meeting_frequency" text NOT NULL,
	"availability" jsonb NOT NULL,
	"general_availability" text,
	"closeness_level" integer NOT NULL,
	"novelty_preference" integer NOT NULL,
	"activity_categories" text[],
	"past_preferences" text,
	"additional_instructions" text,
	"search_radius" integer DEFAULT 2 NOT NULL,
	"meal_enabled" boolean DEFAULT true NOT NULL,
	"cafe_enabled" boolean DEFAULT true NOT NULL,
	"drinks_enabled" boolean DEFAULT true NOT NULL,
	"dessert_enabled" boolean DEFAULT true NOT NULL,
	"experiences_enabled" boolean DEFAULT true NOT NULL,
	"shareable_link" text NOT NULL,
	"activity_generation_status" text DEFAULT 'pending' NOT NULL,
	"activity_generation_error" text,
	"preference_insights" jsonb,
	"last_insights_update" timestamp,
	"feedback_count" integer DEFAULT 0 NOT NULL,
	"rejected_venues" text[],
	"auto_activities_enabled" boolean DEFAULT false NOT NULL,
	"auto_itinerary_enabled" boolean DEFAULT false NOT NULL,
	"auto_schedule_enabled" boolean DEFAULT false NOT NULL,
	"last_event_date" timestamp,
	"next_event_due_date" timestamp,
	"last_activities_update" timestamp,
	"last_itinerary_update" timestamp,
	"deleted_at" timestamp,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "groups_shareable_link_unique" UNIQUE("shareable_link")
);
--> statement-breakpoint
CREATE TABLE "guest_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itinerary_id" varchar NOT NULL,
	"guest_name" text NOT NULL,
	"guest_token" varchar NOT NULL,
	"rsvp_status" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guest_invites_guest_token_unique" UNIQUE("guest_token")
);
--> statement-breakpoint
CREATE TABLE "host_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"itinerary_id" varchar,
	"member_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"asked_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itineraries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"name" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_saved" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"backup_for_itinerary_id" varchar,
	"ai_validation_notes" text,
	"timing_recommendations" text,
	"proposed_order" jsonb NOT NULL,
	"event_date" timestamp,
	"invite_sent_at" timestamp,
	"rsvp_deadline" timestamp,
	"auto_schedule_config" jsonb,
	"reschedule_attempts" integer DEFAULT 0 NOT NULL,
	"host_member_id" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itinerary_id" varchar NOT NULL,
	"member_id" varchar,
	"invite_token" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "itinerary_invites_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "itinerary_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itinerary_id" varchar NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar,
	"venue_name" text NOT NULL,
	"venue_address" text,
	"venue_type" text NOT NULL,
	"google_place_id" text,
	"rating" text,
	"photo_url" text,
	"latitude" text,
	"longitude" text,
	"notes" text,
	"google_maps_url" text,
	"arrival_time" timestamp,
	"departure_time" timestamp,
	"travel_notes" text,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_group_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"group_id" varchar NOT NULL,
	"budget_override_min" integer,
	"budget_override_max" integer,
	"category_preferences_override" jsonb,
	"availability_override" jsonb,
	"meeting_frequency_override" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"user_id" varchar,
	"name" text,
	"email" text,
	"availability" text,
	"preferences" text,
	"is_organizer" boolean DEFAULT false NOT NULL,
	"invitation_sent" boolean DEFAULT false NOT NULL,
	"has_joined" boolean DEFAULT false NOT NULL,
	"rsvp_status" text,
	"member_location" text,
	"member_budget_min" integer,
	"member_budget_max" integer,
	"member_availability" jsonb,
	"claim_token" text,
	"claimed_at" timestamp,
	"member_constraints" jsonb,
	"open_to_hosting" boolean DEFAULT false NOT NULL,
	"last_hosted_at" timestamp,
	"home_base_location" text,
	"home_base_latitude" numeric,
	"home_base_longitude" numeric,
	"activity_preferences" jsonb,
	"personal_availability" jsonb,
	"profile_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "members_claim_token_unique" UNIQUE("claim_token")
);
--> statement-breakpoint
CREATE TABLE "photos_cache" (
	"photo_reference" text PRIMARY KEY NOT NULL,
	"image_data" text NOT NULL,
	"content_type" text DEFAULT 'image/jpeg' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places_cache" (
	"place_id" text PRIMARY KEY NOT NULL,
	"place_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preference_signals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"concept_type" text NOT NULL,
	"concept_description" text NOT NULL,
	"feedback" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposed_time_slots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itinerary_id" varchar NOT NULL,
	"proposed_date_time" timestamp NOT NULL,
	"label" text,
	"is_selected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itinerary_id" varchar NOT NULL,
	"reminder_type" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"recipient_email" text NOT NULL,
	"email_status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itinerary_id" varchar NOT NULL,
	"member_id" varchar,
	"user_id" varchar,
	"member_name" text,
	"is_guest" boolean DEFAULT false NOT NULL,
	"guest_name" text,
	"guest_email" text,
	"guest_token" varchar,
	"response" text NOT NULL,
	"constraint_text" text,
	"rsvp_feedback" jsonb,
	"post_event_feedback" jsonb,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"additional_attendees" jsonb,
	"number_of_kids" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rsvps_guest_token_unique" UNIQUE("guest_token")
);
--> statement-breakpoint
CREATE TABLE "scraped_venues_import" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"category_name" text,
	"total_score" numeric,
	"reviews_count" integer,
	"google_place_id" text,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_query" text NOT NULL,
	"search_location" text NOT NULL,
	"search_radius" integer NOT NULL,
	"search_results" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seen_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"venue_name" text NOT NULL,
	"google_place_id" text,
	"category" text NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_slot_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time_slot_id" varchar NOT NULL,
	"member_id" varchar,
	"user_id" varchar,
	"member_name" text,
	"vote_type" text DEFAULT 'yes' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"display_name" text,
	"bio" text,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"budget" integer,
	"activity_preferences" text[],
	"personal_availability" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "venue_visit_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"activity_id" varchar,
	"voting_event_id" varchar,
	"venue_name" text NOT NULL,
	"venue_type" text NOT NULL,
	"visited_at" timestamp NOT NULL,
	"itinerary_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"vote_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voting_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"venue_address" text,
	"city" text,
	"venue_type" text,
	"google_place_id" text,
	"latitude" text,
	"longitude" text,
	"rating" text,
	"review_count" integer,
	"price_level" text,
	"photo_url" text,
	"ai_reasoning" text,
	"price_estimate" text,
	"time_constraints" text,
	"complementary_place_name" text,
	"complementary_place_address" text,
	"complementary_place_id" text,
	"complementary_place_photo_url" text,
	"complementary_place_rating" text,
	"complementary_place_name_2" text,
	"complementary_place_address_2" text,
	"complementary_place_id_2" text,
	"complementary_place_photo_url_2" text,
	"complementary_place_rating_2" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_scheduled_events" ADD CONSTRAINT "auto_scheduled_events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_scheduled_events" ADD CONSTRAINT "auto_scheduled_events_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_search_history" ADD CONSTRAINT "category_search_history_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curated_venues" ADD CONSTRAINT "curated_venues_suggested_by_users_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_backups" ADD CONSTRAINT "database_backups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deleted_venues" ADD CONSTRAINT "deleted_venues_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frequency_feedback" ADD CONSTRAINT "frequency_feedback_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frequency_feedback" ADD CONSTRAINT "frequency_feedback_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frequency_feedback" ADD CONSTRAINT "frequency_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frequency_feedback" ADD CONSTRAINT "frequency_feedback_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_backups" ADD CONSTRAINT "group_backups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_collections" ADD CONSTRAINT "group_collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_collection_id_group_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."group_collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_invites" ADD CONSTRAINT "guest_invites_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_invites" ADD CONSTRAINT "guest_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_assignments" ADD CONSTRAINT "host_assignments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_assignments" ADD CONSTRAINT "host_assignments_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_assignments" ADD CONSTRAINT "host_assignments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_host_member_id_members_id_fk" FOREIGN KEY ("host_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_invites" ADD CONSTRAINT "itinerary_invites_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_invites" ADD CONSTRAINT "itinerary_invites_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_group_preferences" ADD CONSTRAINT "member_group_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_group_preferences" ADD CONSTRAINT "member_group_preferences_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_signals" ADD CONSTRAINT "preference_signals_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_time_slots" ADD CONSTRAINT "proposed_time_slots_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seen_activities" ADD CONSTRAINT "seen_activities_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slot_votes" ADD CONSTRAINT "time_slot_votes_time_slot_id_proposed_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."proposed_time_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slot_votes" ADD CONSTRAINT "time_slot_votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slot_votes" ADD CONSTRAINT "time_slot_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_visit_history" ADD CONSTRAINT "venue_visit_history_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_visit_history" ADD CONSTRAINT "venue_visit_history_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_visit_history" ADD CONSTRAINT "venue_visit_history_voting_event_id_voting_events_id_fk" FOREIGN KEY ("voting_event_id") REFERENCES "public"."voting_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_visit_history" ADD CONSTRAINT "venue_visit_history_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_event_id_voting_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."voting_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_events" ADD CONSTRAINT "voting_events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_events" ADD CONSTRAINT "voting_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_call_logs_service_idx" ON "api_call_logs" USING btree ("service");--> statement-breakpoint
CREATE INDEX "api_call_logs_created_at_idx" ON "api_call_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_call_logs_cache_status_idx" ON "api_call_logs" USING btree ("cache_status");--> statement-breakpoint
CREATE INDEX "idx_curated_region_category" ON "curated_venues" USING btree ("region","category","is_active");--> statement-breakpoint
CREATE INDEX "idx_curated_location" ON "curated_venues" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "idx_deleted_venues_date" ON "deleted_venues" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_search_query_location" ON "search_cache" USING btree ("search_query","search_location","search_radius");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");