import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, index, numeric, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(), // Email is the stable identifier
  oidcSub: varchar("oidc_sub").unique(), // Current OAuth subject ID from Replit (can change!)
  googleId: varchar("google_id").unique(), // Google OAuth ID
  legacyOidcSubs: jsonb("legacy_oidc_subs"), // Array of previous OAuth subject IDs (for migration tracking)
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft-delete tombstone: set when user deletes their account. PII fields are nulled and email is replaced with a placeholder.
});

// User profiles table (extended user information + global preferences)
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"), // User's preferred display name
  bio: text("bio"), // Short bio or description
  emailNotifications: boolean("email_notifications").default(true).notNull(), // Whether to receive email notifications
  // Global preferences (used as fallback when member_group_preferences not set)
  budgetMin: integer("budget_min"), // Preferred minimum budget per person
  budgetMax: integer("budget_max"), // Preferred maximum budget per person
  activityPreferences: text("activity_preferences").array(), // Preferred activity categories (e.g., ["meal", "cafes"])
  personalAvailability: jsonb("personal_availability"), // Personal availability grid
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notifications table (in-app notification system)
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'event_invite' | 'rsvp_reminder' | 'event_update' | 'time_selected' | 'feedback_request' | 'venue_change'
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionUrl: text("action_url"), // URL to navigate to when notification is clicked
  actionLabel: text("action_label"), // Label for the action button (e.g., "RSVP Now", "View Event")
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: jsonb("metadata"), // Additional data: { eventId, groupId, itineraryId, etc. }
},
(table) => [
  index("idx_notifications_user_read").on(table.userId, table.read),
  index("idx_notifications_created").on(table.createdAt),
]);

// Group collections table (organize groups into custom collections)
export const groupCollections = pgTable("group_collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  orderIndex: integer("order_index").notNull().default(0), // Display order of collections
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Groups table
export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // CRITICAL: Nullable to prevent group deletion when user is recreated during auth issues
  collectionId: varchar("collection_id").references(() => groupCollections.id, { onDelete: "set null" }), // Optional: group can be in a collection
  orderIndex: integer("order_index").notNull().default(0), // Display order within collection (or uncategorized)
  name: text("name").notNull(),
  emoji: text("emoji").default("🎉"), // Group emoji icon
  locationBase: text("location_base").notNull(),
  latitude: text("latitude"), // Geocoded latitude from locationBase
  longitude: text("longitude"), // Geocoded longitude from locationBase
  timezone: text("timezone"), // IANA timezone identifier (e.g., "America/New_York", "Europe/London")
  budgetMin: integer("budget_min").notNull(),
  budgetMax: integer("budget_max").notNull(),
  meetingFrequency: text("meeting_frequency").notNull(), // weekly, biweekly, monthly
  availability: jsonb("availability").notNull(), // Grid: {day: {morning: bool, afternoon: bool, evening: bool}}
  generalAvailability: text("general_availability"), // Simple text: "Weekday evenings", "Weekends", "Friday/Saturday nights"
  closenessLevel: integer("closeness_level").notNull(), // 1-5 scale
  noveltyPreference: integer("novelty_preference").notNull(), // 1-5 scale (1=familiar, 5=new)
  activityCategories: text("activity_categories").array(), // Selected activity types (e.g., ["wine-bars", "karaoke", "concerts"])
  pastPreferences: text("past_preferences"), // comma-separated or text description
  additionalInstructions: text("additional_instructions"), // Custom AI instructions from user
  schedulingPreferences: text("scheduling_preferences"), // Custom AI instructions for event timing (e.g., "Always start dinner at 6pm")
  searchRadius: integer("search_radius").default(2).notNull(), // Search radius in miles (2, 10, 30, 50)
  
  // High-level category filters (control which types of suggestions AI generates)
  mealEnabled: boolean("meal_enabled").default(true).notNull(), // Restaurants, brunch spots, food markets, potlucks
  cafeEnabled: boolean("cafe_enabled").default(true).notNull(), // Cafes, coffee shops
  drinksEnabled: boolean("drinks_enabled").default(true).notNull(), // Wine bars, cocktail bars, breweries
  dessertEnabled: boolean("dessert_enabled").default(true).notNull(), // Dessert shops, ice cream, bakeries
  experiencesEnabled: boolean("experiences_enabled").default(true).notNull(), // Concerts, museums, outdoor activities, games, etc.
  shareableLink: text("shareable_link").notNull().unique(),
  inviteLinkOpen: boolean("invite_link_open").default(true).notNull(), // Whether the group invite link accepts new claims/guests
  activityGenerationStatus: text("activity_generation_status").default("pending").notNull(), // pending, generating, completed, failed
  activityGenerationError: text("activity_generation_error"),
  preferenceInsights: jsonb("preference_insights"), // AI-analyzed preference patterns: [{pattern: "...", icon: "...", description: "..."}]
  lastInsightsUpdate: timestamp("last_insights_update"), // When insights were last generated
  feedbackCount: integer("feedback_count").default(0).notNull(), // Track feedback actions to trigger insight regeneration
  rejectedVenues: text("rejected_venues").array(), // Venues that Google Places couldn't find (blacklist to avoid re-suggesting)
  
  // AI Automation fields
  autoActivitiesEnabled: boolean("auto_activities_enabled").default(false).notNull(), // Enable AI auto-generation of activities
  autoItineraryEnabled: boolean("auto_itinerary_enabled").default(false).notNull(), // Enable AI auto-creation of itineraries
  autoScheduleEnabled: boolean("auto_schedule_enabled").default(false).notNull(), // Enable AI auto-scheduling
  lastEventDate: timestamp("last_event_date"), // Date of most recent finalized event
  nextEventDueDate: timestamp("next_event_due_date"), // When next event should happen (calculated from frequency)
  lastActivitiesUpdate: timestamp("last_activities_update"), // When activities were last auto-generated
  lastItineraryUpdate: timestamp("last_itinerary_update"), // When itinerary was last auto-created

  // Automation control fields
  automationLevel: text("automation_level").default("smart").notNull(), // 'suggest_only', 'smart', 'full_auto'
  confidenceThreshold: integer("confidence_threshold").default(80).notNull(), // Minimum confidence (0-100) to auto-send (hidden from UI)
  automationPaused: boolean("automation_paused").default(false).notNull(), // Whether automation is temporarily paused
  automationPausedUntil: timestamp("automation_paused_until"), // Resume automation after this date
  automationPauseEventsRemaining: integer("automation_pause_events_remaining"), // Resume after this many events (countdown)
  reviewEveryNthEvent: integer("review_every_nth_event"), // Require manual review every N events (quality sampling)
  eventCountSinceLastReview: integer("event_count_since_last_review").default(0).notNull(), // Counter for review sampling

  // Future event pipeline configuration
  targetFutureEvents: integer("target_future_events"), // Number of future events to maintain in pipeline (null = use smart default based on cadence)
  allowEarlyRsvp: boolean("allow_early_rsvp").default(true).notNull(), // Whether members can RSVP to approved events before they are fully scheduled

  // Event defaults
  defaultQuorumThreshold: integer("default_quorum_threshold").default(50).notNull(), // Default quorum percentage for new events (0-100)

  // Member permissions
  membersCanCreateEvents: boolean("members_can_create_events").default(true).notNull(), // Whether members (non-organizers) can create events and discover venues

  // Visual customization
  accentColor: varchar("accent_color", { length: 7 }), // Hex color code for group visual identity (e.g., "#60A5FA")

  // Availability pulse settings
  availabilityPulseLeadDays: integer("availability_pulse_lead_days").default(7), // Days before event to send availability pulse (null = use cadence-based default)

  deletedAt: timestamp("deleted_at"), // Soft delete: when group was deleted (null = active)
  isTest: boolean("is_test").default(false).notNull(), // Mark test/development groups to exclude from analytics

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Group backups table (automatic snapshots for data recovery)
export const groupBackups = pgTable("group_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // CRITICAL: Nullable to preserve backups even if user is recreated
  groupId: varchar("group_id").notNull(), // Original group ID (may be deleted)
  snapshotData: jsonb("snapshot_data").notNull(), // Complete group data including members
  backupTrigger: text("backup_trigger").notNull(), // "create", "update", "delete", "scheduled"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Group members table
export const members = pgTable("members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // Link member to logged-in user account (optional)
  name: text("name"),
  email: text("email"),
  availability: text("availability"),
  preferences: text("preferences"),
  isOrganizer: boolean("is_organizer").default(false).notNull(),
  isGuest: boolean("is_guest").default(false).notNull(), // Self-registered guests (not original group members)
  invitationSent: boolean("invitation_sent").default(false).notNull(),
  hasJoined: boolean("has_joined").default(false).notNull(),
  
  // RSVP and preference fields for invite flow
  rsvpStatus: text("rsvp_status"), // going, maybe, not_going, null (no response)
  memberLocation: text("member_location"), // Member's location for aggregation
  memberBudgetMin: integer("member_budget_min"), // Member's min budget preference
  memberBudgetMax: integer("member_budget_max"), // Member's max budget preference
  memberAvailability: jsonb("member_availability"), // Dates that work for this member: ["2025-01-15", "2025-01-16"]
  claimToken: text("claim_token").unique(), // Session token for claiming identity without login
  claimedAt: timestamp("claimed_at"), // When member claimed their account and linked to userId
  
  // Smart preference learning from RSVP follow-ups
  memberConstraints: jsonb("member_constraints"), // {scheduleConflicts: ["Thursdays"], budgetConcern: true, distanceConcern: true, notes: "..."}
  
  // Event hosting
  openToHosting: boolean("open_to_hosting").default(false).notNull(), // Whether this member is willing to host events
  lastHostedAt: timestamp("last_hosted_at"), // Last time this member hosted an event (for fair rotation)
  
  // Optional member profile fields
  homeBaseLocation: text("home_base_location"), // Member's home base (e.g., "San Francisco, CA")
  homeBaseLatitude: numeric("home_base_latitude"), // Geocoded latitude
  homeBaseLongitude: numeric("home_base_longitude"), // Geocoded longitude
  activityPreferences: jsonb("activity_preferences"), // Array of preferred activity categories: ["restaurants", "museums", "concerts"]
  personalAvailability: jsonb("personal_availability"), // Personal availability grid: {Monday: {morning: true, afternoon: false, evening: true}, ...}
  profileCompleted: boolean("profile_completed").default(false).notNull(), // Whether member has completed optional profile setup
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("members_user_id_idx").on(table.userId),
]);

// Member favorite venues table (venues members have marked as favorites)
export const memberFavoriteVenues = pgTable("member_favorite_venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  venuePlaceId: text("venue_place_id").notNull(), // Google Place ID
  venueName: text("venue_name").notNull(),
  venueAddress: text("venue_address"),
  venuePhotoUrl: text("venue_photo_url"),
  category: text("category"), // meal, cafes, drinks, dessert, experiences
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// Member group preferences table (per-group preference overrides)
export const memberGroupPreferences = pgTable("member_group_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  
  // Optional overrides (null means use global profile or group defaults)
  budgetOverrideMin: integer("budget_override_min"), // Override min budget for this specific group
  budgetOverrideMax: integer("budget_override_max"), // Override max budget for this specific group
  categoryPreferencesOverride: jsonb("category_preferences_override"), // Array of enabled categories: ["meal", "drinks", "cafes"]
  availabilityOverride: jsonb("availability_override"), // Availability grid override: {Monday: {morning: true, ...}, ...}
  meetingFrequencyOverride: text("meeting_frequency_override"), // Override meeting frequency: e.g., "1x week", "2x month"
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Activities table (AI-generated suggestions)
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  aiSuggestedName: text("ai_suggested_name"), // What AI originally suggested (e.g., "Italian Restaurant") before Google enrichment
  venueName: text("venue_name").notNull(),
  venueAddress: text("venue_address").notNull(),
  city: text("city"), // City name extracted from address or Google Places
  venueType: text("venue_type").notNull(), // restaurant, museum, park, etc.
  description: text("description").notNull(),
  googlePlaceId: text("google_place_id"),
  latitude: text("latitude"), // Google Places coordinates
  longitude: text("longitude"), // Google Places coordinates
  rating: text("rating"),
  reviewCount: integer("review_count"), // Number of Google reviews (user_ratings_total)
  priceLevel: text("price_level"),
  photoUrl: text("photo_url"),
  aiReasoning: text("ai_reasoning"), // Why AI suggested this
  suggestedDate: timestamp("suggested_date"),
  suggestedTime: text("suggested_time"),
  priceEstimate: text("price_estimate"), // For events: "$25-50 per person", "Free", etc.
  timeConstraints: text("time_constraints"), // For events: "Only on Friday afternoons", "Weekends only", etc.
  feedback: text("feedback"), // love, more, less, null
  complementaryPlaceName: text("complementary_place_name"), // For outdoor venues/events: nearby food place
  complementaryPlaceAddress: text("complementary_place_address"),
  complementaryPlaceId: text("complementary_place_id"), // Google Place ID
  complementaryPlacePhotoUrl: text("complementary_place_photo_url"),
  complementaryPlaceRating: text("complementary_place_rating"),
  complementaryPlaceName2: text("complementary_place_name_2"), // Second food option
  complementaryPlaceAddress2: text("complementary_place_address_2"),
  complementaryPlaceId2: text("complementary_place_id_2"),
  complementaryPlacePhotoUrl2: text("complementary_place_photo_url_2"),
  complementaryPlaceRating2: text("complementary_place_rating_2"),
  googleReview: text("google_review"), // Short positive review from Google Places (80-100 chars)
  timeCategory: text("time_category"), // quick (<90min), standard (1-3hrs), large (4+ hrs)
  category: text("category"), // AI-categorized: meal, cafes, drinks, dessert, experiences
  openingHours: jsonb("opening_hours"), // Google Places opening hours (periods, weekday_text)
  businessStatus: text("business_status"), // OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY
  swipeConsensus: integer("swipe_consensus"), // 0-100% approval rate from group swipes
  archivedAt: timestamp("archived_at"), // Soft-delete for regeneration
  trustState: text("trust_state").notNull().default("unknown"), // verified | needs_review | unknown
  verifiedAt: timestamp("verified_at"),
  trustSource: text("trust_source"), // google_search | ai_suggestion | url_paste | manual | validation_pass
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Voting events table (for favorites/activity swipes)
export const votingEvents = pgTable("voting_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  venueAddress: text("venue_address"),
  city: text("city"), // City name extracted from address or Google Places
  venueType: text("venue_type"),
  googlePlaceId: text("google_place_id"),
  latitude: text("latitude"), // Google Places coordinates
  longitude: text("longitude"), // Google Places coordinates
  rating: text("rating"),
  reviewCount: integer("review_count"), // Number of Google reviews (user_ratings_total)
  priceLevel: text("price_level"),
  photoUrl: text("photo_url"),
  aiReasoning: text("ai_reasoning"),
  priceEstimate: text("price_estimate"),
  timeConstraints: text("time_constraints"),
  complementaryPlaceName: text("complementary_place_name"),
  complementaryPlaceAddress: text("complementary_place_address"),
  complementaryPlaceId: text("complementary_place_id"),
  complementaryPlacePhotoUrl: text("complementary_place_photo_url"),
  complementaryPlaceRating: text("complementary_place_rating"),
  complementaryPlaceName2: text("complementary_place_name_2"),
  complementaryPlaceAddress2: text("complementary_place_address_2"),
  complementaryPlaceId2: text("complementary_place_id_2"),
  complementaryPlacePhotoUrl2: text("complementary_place_photo_url_2"),
  complementaryPlaceRating2: text("complementary_place_rating_2"),
  swipeConsensus: integer("swipe_consensus"), // 0-100% approval rate from group swipes
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  trustState: text("trust_state").notNull().default("unknown"), // verified | needs_review | unknown
  verifiedAt: timestamp("verified_at"),
  trustSource: text("trust_source"), // google_search | ai_suggestion | url_paste | manual | validation_pass
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Votes table to track upvotes/downvotes
// Unique (user_id, event_id) — see migrations/0014_add_vote_unique_constraints.sql
export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => votingEvents.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  voteType: text("vote_type").notNull(), // 'upvote' or 'downvote'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Preference signals table to track swipe feedback
export const preferenceSignals = pgTable("preference_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  conceptType: text("concept_type").notNull(), // e.g., "karaoke", "breweries", "outdoor-activities"
  conceptDescription: text("concept_description").notNull(), // e.g., "Karaoke Night at Local Bar"
  feedback: text("feedback").notNull(), // 'like' or 'pass'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Activity swipes table - democratic curation through group swiping
export const activitySwipes = pgTable("activity_swipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  activityId: varchar("activity_id").references(() => activities.id, { onDelete: "cascade" }), // null if swiping on voting event
  votingEventId: varchar("voting_event_id").references(() => votingEvents.id, { onDelete: "cascade" }), // null if swiping on activity
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  swipeDirection: text("swipe_direction").notNull(), // 'right' (approve) or 'left' (reject)
  swipeSessionId: varchar("swipe_session_id"), // Group swipes together (e.g., all swipes from one batch)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Swipe sessions table - tracks group swipe sessions for async preference gathering
export const swipeSessions = pgTable("swipe_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),

  // Session type and purpose
  sessionType: text("session_type").notNull(), // 'itinerary_validation', 'activity_curation', 'favorites_triage', 'discovery', 'weekly_digest'
  isBlocking: boolean("is_blocking").default(false).notNull(), // If true, event creation waits for results (default: async)

  // Related entities
  autoEventId: varchar("auto_event_id").references(() => autoScheduledEvents.id, { onDelete: "cascade" }), // If validating auto-scheduled event
  triggeredBy: text("triggered_by").notNull(), // 'auto_scheduler', 'ai_generation', 'manual', 'weekly_job', 'post_event'

  // Session state
  status: text("status").default("active").notNull(), // 'active', 'completed', 'expired'
  targetSwipeCount: integer("target_swipe_count").default(5).notNull(), // How many items to swipe through
  expiresAt: timestamp("expires_at").notNull(), // When session expires (typically 48hrs from creation)

  // Participation tracking
  memberCount: integer("member_count").notNull(), // Total members in group at session creation
  participantCount: integer("participant_count").default(0).notNull(), // How many members have participated
  totalSwipes: integer("total_swipes").default(0).notNull(), // Total swipe actions recorded

  // Results metadata (calculated when session completes)
  consensusResults: jsonb("consensus_results"), // { venueId: { approval: 0.75, totalSwipes: 12 }, ... }
  averageConsensus: integer("average_consensus"), // 0-100, average approval across all items

  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"), // When session was marked complete or expired
});

// Itineraries table - validated combinations of venues for an evening
export const itineraries = pgTable("itineraries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").references(() => groups.id, { onDelete: "cascade" }), // Nullable for standalone events
  isStandalone: boolean("is_standalone").default(false).notNull(), // True for events not tied to a group
  timezone: text("timezone"), // IANA timezone for standalone events (e.g., "America/Los_Angeles")
  organizerId: varchar("organizer_id").references(() => users.id, { onDelete: "cascade" }), // Event owner (for standalone events)
  name: text("name"), // Optional name for saved itineraries (e.g., "SF Waterfront Day")
  note: text("note"), // Optional note or description for the event
  status: text("status").notNull().default("draft"), // draft, saved, proposed, scheduled, completed, rejected, cancelled
  isSaved: boolean("is_saved").default(false).notNull(), // Is this a saved template for reuse
  isPrimary: boolean("is_primary").default(false).notNull(), // Is this the primary proposed plan
  backupForItineraryId: varchar("backup_for_itinerary_id"), // If this is a backup plan (self-reference handled separately)
  aiValidationNotes: text("ai_validation_notes"), // AI insights about flow, timing, proximity
  timingRecommendations: text("timing_recommendations"), // Organizer notes about when this itinerary works best (e.g., "Best for Saturday brunch", "Sunday when there's a Monday holiday")
  proposedOrder: jsonb("proposed_order").notNull(), // Array of item IDs in suggested sequence
  
  // Automated scheduling fields
  eventDate: timestamp("event_date"), // The actual scheduled date/time for the event
  inviteSentAt: timestamp("invite_sent_at"), // When invites were sent
  rsvpDeadline: timestamp("rsvp_deadline"), // When RSVPs must be in by
  autoScheduleConfig: jsonb("auto_schedule_config"), // AI-suggested schedule config: {inviteAdvanceDays: 7, rsvpWindowDays: 3, reminders: [{type: "gentle_nudge", daysBeforeDeadline: 2}, ...]}
  rescheduleAttempts: integer("reschedule_attempts").default(0).notNull(), // Track how many times AI has tried to reschedule (max 2)
  quorumCheckinSentAt: timestamp("quorum_checkin_sent_at"), // When the "still want to meet?" check-in was sent to respondents
  quorumCheckinResponses: jsonb("quorum_checkin_responses"), // { [memberId]: 'keep' | 'reschedule' }
  
  // Event hosting
  hostMemberId: varchar("host_member_id").references(() => members.id, { onDelete: "set null" }), // Member who volunteered to host this event (null = organizer or AI-hosted)
  
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Itinerary items - individual venues in an itinerary
export const itineraryItems = pgTable("itinerary_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itineraryId: varchar("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // 'activity', 'voting_event', or 'ad_hoc'
  sourceId: varchar("source_id"), // ID from activities or votingEvents table (null for ad_hoc)
  venueName: text("venue_name").notNull(),
  venueAddress: text("venue_address"),
  venueType: text("venue_type").notNull(),
  googlePlaceId: text("google_place_id"),
  rating: text("rating"),
  photoUrl: text("photo_url"),
  latitude: text("latitude"), // For ad-hoc venues with geocoded addresses
  longitude: text("longitude"), // For ad-hoc venues with geocoded addresses
  notes: text("notes"), // Optional custom notes for ad-hoc venues
  googleMapsUrl: text("google_maps_url"), // Original Google Maps URL if provided
  arrivalTime: timestamp("arrival_time"), // Optional time to arrive at this location
  departureTime: timestamp("departure_time"), // Optional time to leave this location
  travelNotes: text("travel_notes"), // Optional travel instructions (e.g., "Uber from previous location")
  orderIndex: integer("order_index").notNull(), // Position in itinerary sequence
  trustState: text("trust_state").notNull().default("unknown"), // verified | needs_review | unknown
  verifiedAt: timestamp("verified_at"),
  trustSource: text("trust_source"), // google_search | ai_suggestion | url_paste | manual | validation_pass
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// RSVPs table - member responses to proposed itineraries
export const rsvps = pgTable("rsvps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itineraryId: varchar("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").references(() => members.id, { onDelete: "cascade" }), // Optional, for group members
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Optional, for authenticated users
  memberName: text("member_name"), // Name if not a registered member
  isGuest: boolean("is_guest").default(false).notNull(), // Whether this is a guest RSVP (invited after event is planned)
  guestName: text("guest_name"), // Name for non-member guest RSVPs
  guestEmail: text("guest_email"), // Email for guest RSVPs (optional contact info)
  guestToken: varchar("guest_token").unique(), // Unique token for guest RSVP links
  response: text("response").notNull(), // 'yes', 'maybe', 'no'
  constraintText: text("constraint_text"), // If response is conditional, what's the constraint (e.g., "only if it's in Oakland")
  rsvpFeedback: jsonb("rsvp_feedback"), // Structured feedback for maybe/no: {budgetConcern, timeConcern, locationConcern, activityTypeConcern, otherConcern, notes}
  postEventFeedback: jsonb("post_event_feedback"), // Post-event survey: {venueRating: 1-5, frequencyPreference: 'too_frequent'|'just_right'|'not_frequent_enough', wouldDoAgain: 'yes'|'no'|'maybe', improvementNotes: "..."}
  requiresApproval: boolean("requires_approval").default(false).notNull(), // Whether this RSVP needs organizer approval (guest RSVPs)
  approved: boolean("approved").default(false).notNull(), // Whether organizer approved this guest RSVP
  additionalAttendees: jsonb("additional_attendees"), // Array of additional people: [{type: 'member'|'guest', memberId?: string, name: string}]
  numberOfKids: integer("number_of_kids").default(0), // Optional: number of kids attending
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // Track when RSVP was last updated
}, (table) => [
  index("rsvps_user_id_idx").on(table.userId),
]);

// Itinerary invites - ties invite tokens to specific itinerary+member pairs for secure RSVPs
export const itineraryInvites = pgTable("itinerary_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itineraryId: varchar("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").references(() => members.id, { onDelete: "cascade" }), // Optional - null for organizer invites when group has no members
  inviteToken: varchar("invite_token").notNull().unique(), // Unique token for this specific invite
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Guest invites - allow event organizers to invite non-member guests via shareable links
export const guestInvites = pgTable("guest_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itineraryId: varchar("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  guestName: text("guest_name").notNull(), // Name of the guest (no email required)
  guestToken: varchar("guest_token").notNull().unique(), // Unique token for shareable link
  rsvpStatus: text("rsvp_status"), // 'yes', 'maybe', 'no' - null if not yet responded
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Standalone event invitees - cross-group invitees for standalone events
export const standaloneEventInvitees = pgTable("standalone_event_invitees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itineraryId: varchar("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),

  // Person being invited - can be linked to existing user/member or just contact info
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // If they have an account
  memberId: varchar("member_id").references(() => members.id, { onDelete: "cascade" }), // Source member record

  // Which group this contact came from (for context)
  sourceGroupId: varchar("source_group_id").references(() => groups.id, { onDelete: "set null" }),

  // Cached contact info (denormalized for display even if source member is deleted)
  inviteeName: text("invitee_name").notNull(),
  inviteeEmail: text("invitee_email"),

  // Invite mechanics
  inviteToken: varchar("invite_token").notNull().unique(),
  inviteSentAt: timestamp("invite_sent_at"),
  rsvpStatus: text("rsvp_status"), // 'yes', 'maybe', 'no' - null if not yet responded

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Seen activities - track which venues have been shown to avoid repetition
export const seenActivities = pgTable("seen_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  venueName: text("venue_name").notNull(),
  googlePlaceId: text("google_place_id"), // Optional Google Place ID
  category: text("category").notNull(), // meal, cafes, drinks, dessert, experiences
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
});

// Reminder logs - track automated reminder emails sent
export const reminderLogs = pgTable("reminder_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itineraryId: varchar("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  reminderType: text("reminder_type").notNull(), // 'initial_invite', 'gentle_nudge', 'final_call', 'day_before'
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  recipientEmail: text("recipient_email").notNull(),
  emailStatus: text("email_status").notNull(), // 'sent', 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Auto-scheduled events - AI-generated pending events awaiting organizer approval
export const autoScheduledEvents = pgTable("auto_scheduled_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  itineraryId: varchar("itinerary_id").references(() => itineraries.id, { onDelete: "cascade" }), // Links to proposed itinerary
  proposedDate: timestamp("proposed_date").notNull(), // AI-suggested event date/time
  status: text("status").default("pending_approval").notNull(), // 'pending_approval', 'auto_approved', 'approved', 'rejected', 'auto_sent', 'scheduled'
  autoSendAt: timestamp("auto_send_at").notNull(), // When to auto-send if no organizer action (7 days before target for RSVP lead time)
  allowMemberVoting: boolean("allow_member_voting").default(false).notNull(), // Whether members can vote on itinerary options
  selectedOptionId: varchar("selected_option_id"), // Which itinerary option was selected (references itineraryOptions.id)

  // Confidence and review fields
  confidenceScore: integer("confidence_score"), // 0-100 confidence score (calculated but not shown to users)
  confidenceFactors: jsonb("confidence_factors"), // Detailed breakdown for debugging: {venueQuality: 85, timeConsensus: 75, ...}
  requiresReview: boolean("requires_review").default(false).notNull(), // True if below threshold or sampling triggered
  reviewReason: text("review_reason"), // 'low_confidence' | 'scheduled_review' | 'new_venue_type' | 'automation_paused'

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Rejected event dates - track dates the user explicitly doesn't want events on
export const rejectedEventDates = pgTable("rejected_event_dates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  rejectedDate: timestamp("rejected_date").notNull(), // The date to skip (stored as timestamp for consistency)
  reason: text("reason").default("user_deleted").notNull(), // 'user_deleted', 'skipped', 'manual'
  sourceType: text("source_type"), // 'itinerary', 'auto_event', 'virtual' - what was deleted
  sourceId: varchar("source_id"), // ID of the deleted item (if applicable)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Itinerary options - multiple itinerary options generated for auto-scheduled events
export const itineraryOptions = pgTable("itinerary_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  autoEventId: varchar("auto_event_id").notNull().references(() => autoScheduledEvents.id, { onDelete: "cascade" }),
  optionNumber: integer("option_number").notNull(), // 1, 2, or 3
  venues: jsonb("venues").notNull(), // Array of {sourceType: 'activity'|'voting_event', sourceId: string, venueName: string, badges: string[]}
  description: text("description"), // Optional AI-generated description of this option
  nearbySuggestions: jsonb("nearby_suggestions"), // Optional array of nearby complementary venues
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Itinerary option votes - member votes on itinerary options
// Partial uniques on (user_id, auto_event_id) and (member_id, auto_event_id) —
// see migrations/0014_add_vote_unique_constraints.sql
export const itineraryOptionVotes = pgTable("itinerary_option_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  optionId: varchar("option_id").notNull().references(() => itineraryOptions.id, { onDelete: "cascade" }),
  autoEventId: varchar("auto_event_id").notNull().references(() => autoScheduledEvents.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").references(() => members.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Confidence predictions - track predicted vs actual consensus for calibration
export const confidencePredictions = pgTable("confidence_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  autoEventId: varchar("auto_event_id").references(() => autoScheduledEvents.id, { onDelete: "cascade" }),
  swipeSessionId: varchar("swipe_session_id").references(() => swipeSessions.id, { onDelete: "cascade" }),

  // Prediction data (made at event/session creation)
  predictedConfidence: integer("predicted_confidence").notNull(), // 0-100 predicted confidence score
  predictedFactors: jsonb("predicted_factors").notNull(), // {venueQuality: 85, timeConsensus: 75, groupEngagement: 90, patternMatch: 70, swipeConsensus: null}
  factorWeights: jsonb("factor_weights").notNull(), // {venueQuality: 0.25, timeConsensus: 0.25, groupEngagement: 0.20, patternMatch: 0.20, swipeConsensus: 0.10}

  // Actual results (filled when swipe session completes or event happens)
  actualConsensus: integer("actual_consensus"), // 0-100 actual member approval from swipes or RSVPs
  validationSource: text("validation_source"), // 'swipe_session' | 'rsvp_rate' | 'attendance_rate'

  // Calibration metrics
  predictionError: integer("prediction_error"), // Absolute difference: |predicted - actual|
  wasAccurate: boolean("was_accurate"), // True if error <= 15 (within acceptable margin)

  // Metadata
  predictedAt: timestamp("predicted_at").defaultNow().notNull(),
  validatedAt: timestamp("validated_at"), // When actual consensus was recorded
  usedForCalibration: boolean("used_for_calibration").default(false).notNull(), // True if this data point was used in weight optimization
});

// Group confidence weights - calibrated factor weights per group (for self-adjusting algorithm)
export const groupConfidenceWeights = pgTable("group_confidence_weights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }).unique(),

  // Current factor weights (sum to 1.0)
  venueQualityWeight: real("venue_quality_weight").default(0.25).notNull(), // Default: 25%
  timeConsensusWeight: real("time_consensus_weight").default(0.25).notNull(), // Default: 25%
  groupEngagementWeight: real("group_engagement_weight").default(0.20).notNull(), // Default: 20%
  patternMatchWeight: real("pattern_match_weight").default(0.20).notNull(), // Default: 20%
  swipeConsensusWeight: real("swipe_consensus_weight").default(0.10).notNull(), // Default: 10%

  // Calibration metadata
  calibrationCount: integer("calibration_count").default(0).notNull(), // How many times weights have been optimized
  lastCalibrationAt: timestamp("last_calibration_at"), // When last calibration ran
  totalPredictions: integer("total_predictions").default(0).notNull(), // Total predictions made with these weights
  meanAbsoluteError: real("mean_absolute_error"), // Current MAE across all predictions
  accuracyRate: real("accuracy_rate"), // % of predictions within 15 points (0.0-1.0)

  // Manual override controls
  autoCalibrationEnabled: boolean("auto_calibration_enabled").default(true).notNull(), // Allow automatic weight adjustments
  manualOverrideAt: timestamp("manual_override_at"), // When organizer last manually set weights
  manualOverrideReason: text("manual_override_reason"), // Why organizer disabled auto-calibration

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Frequency feedback - track member preferences for meeting frequency
export const frequencyFeedback = pgTable("frequency_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").references(() => members.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  feedback: text("feedback").notNull(), // 'more_often', 'just_right', 'less_often'
  itineraryId: varchar("itinerary_id").references(() => itineraries.id, { onDelete: "cascade" }), // Which event prompted this feedback
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Venue visit history - track all venue visits for rotation and analytics
export const venueVisitHistory = pgTable("venue_visit_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  activityId: varchar("activity_id").references(() => activities.id, { onDelete: "set null" }), // Null if activity was deleted
  votingEventId: varchar("voting_event_id").references(() => votingEvents.id, { onDelete: "set null" }), // Null if voting event was deleted
  venueName: text("venue_name").notNull(), // Denormalized for deleted venues
  venueType: text("venue_type").notNull(), // Denormalized for deleted venues
  visitedAt: timestamp("visited_at").notNull(), // When the event actually occurred
  itineraryId: varchar("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Proposed time slots - multiple date/time options for an event
export const proposedTimeSlots = pgTable("proposed_time_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itineraryId: varchar("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  proposedDateTime: timestamp("proposed_date_time").notNull(), // The proposed date and time
  label: text("label"), // Optional label (e.g., "Friday Evening", "Saturday Afternoon")
  isSelected: boolean("is_selected").default(false).notNull(), // Whether this time was chosen as final
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Time slot votes - track which members/users vote for which time slots
// Partial uniques on (user_id, time_slot_id) and (member_id, time_slot_id) —
// see migrations/0014_add_vote_unique_constraints.sql. memberName-only rows
// (both ids null) are not constrained at the DB layer.
export const timeSlotVotes = pgTable("time_slot_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timeSlotId: varchar("time_slot_id").notNull().references(() => proposedTimeSlots.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").references(() => members.id, { onDelete: "cascade" }), // Optional, for group members
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Optional, for authenticated users (including organizer)
  memberName: text("member_name"), // Name if not a registered member
  voteType: text("vote_type").notNull().default("yes"), // yes, maybe, no
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Category search history - cache recent category searches to avoid re-fetching
export const categorySearchHistory = pgTable("category_search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // 'meal', 'cafe', 'drinks', 'dessert', 'experiences'
  searchLocation: text("search_location").notNull(), // Location string used for search
  searchRadius: integer("search_radius").notNull(), // Radius in miles
  results: jsonb("results").notNull(), // Array of venue results with all enriched data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Google Places API cache - cache Place Details for 30 days
export const placesCache = pgTable("places_cache", {
  placeId: text("place_id").primaryKey(), // Google Places ID
  placeData: jsonb("place_data").notNull(), // Full place details response
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 30 days from createdAt
}, (table) => [
  index("places_cache_expires_at_idx").on(table.expiresAt),
]);

// Google Places API search cache - cache Text Search results for 24 hours
export const searchCache = pgTable("search_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  searchQuery: text("search_query").notNull(), // Full search query string
  searchLocation: text("search_location").notNull(), // Location string
  searchRadius: integer("search_radius").notNull(), // Radius in miles
  searchResults: jsonb("search_results").notNull(), // Array of place IDs returned
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 24 hours from createdAt
}, (table) => [
  index("idx_search_query_location").on(table.searchQuery, table.searchLocation, table.searchRadius),
  index("search_cache_expires_at_idx").on(table.expiresAt),
]);

// Google Geocoding API cache - cache geocoding results for 30 days
export const geocodingCache = pgTable("geocoding_cache", {
  location: text("location").primaryKey(), // Location string used as key
  latitude: numeric("latitude").notNull(), // Geocoded latitude
  longitude: numeric("longitude").notNull(), // Geocoded longitude
  formattedAddress: text("formatted_address").notNull(), // Google's formatted address
  timezone: text("timezone"), // IANA timezone identifier (optional)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 30 days from createdAt
});

// Curated venues - pre-vetted, high-quality venues for cache-first generation
// Owner manually seeds and maintains this list for guaranteed quality
export const curatedVenues = pgTable("curated_venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Venue name
  address: text("address").notNull(), // Full address
  latitude: numeric("latitude").notNull(), // Latitude for distance calculations
  longitude: numeric("longitude").notNull(), // Longitude for distance calculations
  category: text("category").notNull(), // meal, cafes, drinks, dessert, experiences
  rating: numeric("rating"), // Google rating (1.0-5.0)
  reviewCount: integer("review_count"), // Number of reviews
  priceLevel: integer("price_level"), // 1-4 ($, $$, $$$, $$$$)
  photoUrl: text("photo_url"), // Primary photo URL
  googlePlaceId: text("google_place_id").unique(), // For future refreshes from Google API
  description: text("description"), // Vibe/description of the venue
  tags: text("tags").array(), // ["outdoor seating", "date night", "groups", "family friendly"]
  region: text("region").notNull().default('bay_area'), // Geographic region (bay_area, nyc, etc.)
  isActive: boolean("is_active").default(true).notNull(), // Soft delete flag
  source: text("source").notNull().default('manual'), // manual, user_suggested, api_scrape
  suggestedBy: varchar("suggested_by").references(() => users.id, { onDelete: "set null" }), // User who suggested this venue (if applicable)
  openingHours: jsonb("opening_hours"), // Google Places opening hours (periods, weekday_text)
  businessStatus: text("business_status"), // OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastRefreshed: timestamp("last_refreshed"), // Last time data was refreshed from Google API
}, (table) => [
  index("idx_curated_region_category").on(table.region, table.category, table.isActive),
  index("idx_curated_location").on(table.latitude, table.longitude),
]);

// Deleted venues archive - track venues removed during cleanup for review
export const deletedVenues = pgTable("deleted_venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  venueData: jsonb("venue_data").notNull(), // Complete original venue data from curated_venues
  deletionReason: text("deletion_reason").notNull(), // Why the venue was removed (AI reasoning or manual reason)
  deletedBy: varchar("deleted_by").references(() => users.id, { onDelete: "set null" }), // Admin who triggered cleanup
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
}, (table) => [
  index("idx_deleted_venues_date").on(table.deletedAt),
]);

// Scraped venues import - temporary table for comparing scraped data with existing database
export const scrapedVenuesImport = pgTable("scraped_venues_import", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Venue name
  address: text("address").notNull(), // Full address
  categoryName: text("category_name"), // Original category from scrape
  totalScore: numeric("total_score"), // Rating from scrape
  reviewsCount: integer("reviews_count"), // Number of reviews
  googlePlaceId: text("google_place_id"), // Google Place ID if available
  rawData: jsonb("raw_data"), // Complete original JSON for reference
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Google Place Photos API cache - cache downloaded photos for 30 days
export const photosCache = pgTable("photos_cache", {
  photoReference: text("photo_reference").primaryKey(), // Google photo reference ID
  placeId: text("place_id"), // Google place ID for fallback lookups when photo IDs change
  imageData: text("image_data").notNull(), // Base64 encoded image data
  contentType: text("content_type").notNull().default("image/jpeg"), // MIME type
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 30 days from createdAt
});

// AI Categorization cache - cache venue categorizations to reduce OpenAI API calls
// Stores results from categorizeVenue() function to avoid re-categorizing the same venues
export const aiCategorizationCache = pgTable("ai_categorization_cache", {
  cacheKey: text("cache_key").primaryKey(), // "{venueName}::{venueType}" (lowercase)
  category: text("category").notNull(), // 'meal', 'cafes', 'drinks', 'dessert', 'experiences'
  venueName: text("venue_name").notNull(), // Original venue name (for reference)
  venueType: text("venue_type").notNull(), // Original venue type (for reference)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 7 days from createdAt (shorter than Places cache since categorizations may change)
}, (table) => [
  index("idx_ai_categorization_expires").on(table.expiresAt),
]);

// API Call Logs - track all external API calls for monitoring and cost analysis
export const apiCallLogs = pgTable("api_call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  service: text("service").notNull(), // 'google_places', 'google_maps', 'openai', etc.
  method: text("method").notNull(), // 'textSearch', 'placeDetails', 'geocoding', 'chat', etc.
  cacheStatus: text("cache_status").notNull(), // 'hit', 'miss', 'write'
  status: text("status").notNull(), // 'success', 'error'
  responseTimeMs: integer("response_time_ms"), // Response time in milliseconds
  costEstimate: numeric("cost_estimate", { precision: 10, scale: 6 }), // Estimated cost in USD
  errorMessage: text("error_message"), // Error details if status is 'error'
  parameters: jsonb("parameters"), // Request parameters (e.g., query, location, placeId)
  metadata: jsonb("metadata"), // Additional data (e.g., result count, API key used)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("api_call_logs_service_idx").on(table.service),
  index("api_call_logs_created_at_idx").on(table.createdAt),
  index("api_call_logs_cache_status_idx").on(table.cacheStatus),
]);

// User saved places - personal favorites not tied to any group
export const userSavedPlaces = pgTable("user_saved_places", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  googlePlaceId: text("google_place_id").notNull(), // Google Place ID for refreshing data
  name: text("name").notNull(), // Venue name
  address: text("address"), // Full address
  latitude: numeric("latitude"), // For distance calculations
  longitude: numeric("longitude"), // For distance calculations
  category: text("category"), // meal, cafes, drinks, dessert, experiences
  rating: numeric("rating"), // Google rating (1.0-5.0)
  priceLevel: integer("price_level"), // 1-4 ($, $$, $$$, $$$$)
  photoUrl: text("photo_url"), // Primary photo URL
  notes: text("notes"), // Personal notes about the place
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_user_saved_places_user").on(table.userId),
  index("idx_user_saved_places_category").on(table.userId, table.category),
]);

// Group saved places - favorites shared within a group with attribution
export const groupSavedPlaces = pgTable("group_saved_places", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  addedByUserId: varchar("added_by_user_id").references(() => users.id, { onDelete: "set null" }), // Who added it
  addedByName: text("added_by_name"), // Cached name in case user is deleted
  googlePlaceId: text("google_place_id").notNull(), // Google Place ID for refreshing data
  name: text("name").notNull(), // Venue name
  address: text("address"), // Full address
  latitude: numeric("latitude"), // For distance calculations
  longitude: numeric("longitude"), // For distance calculations
  category: text("category"), // meal, cafes, drinks, dessert, experiences
  rating: numeric("rating"), // Google rating (1.0-5.0)
  priceLevel: integer("price_level"), // 1-4 ($, $$, $$$, $$$$)
  photoUrl: text("photo_url"), // Primary photo URL
  notes: text("notes"), // Notes about the place
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_group_saved_places_group").on(table.groupId),
  index("idx_group_saved_places_category").on(table.groupId, table.category),
]);

// Host assignments - track rotating host requests and responses
export const hostAssignments = pgTable("host_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  itineraryId: varchar("itinerary_id").references(() => itineraries.id, { onDelete: "cascade" }), // Optional - may be null if creating event from scratch
  memberId: varchar("member_id").notNull().references(() => members.id, { onDelete: "cascade" }), // Member being asked to host
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'declined'
  askedAt: timestamp("asked_at").defaultNow().notNull(), // When the hosting request was sent
  respondedAt: timestamp("responded_at"), // When member accepted/declined
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Availability pulses - proactive availability collection before AI picks event dates
export const availabilityPulses = pgTable("availability_pulses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),

  // Window configuration (3-week calendar view anchored around target date)
  startDate: timestamp("start_date").notNull(), // Start of availability window (few days before target)
  endDate: timestamp("end_date").notNull(), // End of availability window (~2.5 weeks after target)
  targetEventDate: timestamp("target_event_date"), // Approximate event date we're planning around

  // Tracking
  status: text("status").default("active").notNull(), // 'active', 'completed', 'expired', 'cancelled'
  memberCount: integer("member_count").notNull(), // Total members at creation
  responseCount: integer("response_count").default(0).notNull(), // How many have responded

  // Notification tracking
  emailSentAt: timestamp("email_sent_at"), // When pulse notification was sent
  reminderSentAt: timestamp("reminder_sent_at"), // Optional gentle nudge

  // Lifecycle
  expiresAt: timestamp("expires_at").notNull(), // When pulse is no longer accepting responses
  completedAt: timestamp("completed_at"), // When pulse was used by scheduler or manually closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pulses_group_status").on(table.groupId, table.status),
  index("idx_pulses_expires").on(table.expiresAt),
]);

// Availability pulse responses - member-submitted date-specific availability
export const availabilityPulseResponses = pgTable("availability_pulse_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pulseId: varchar("pulse_id").notNull().references(() => availabilityPulses.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // If member is linked to user account

  // Date-specific availability (JSONB structure)
  // Format: { "2025-01-15": { morning: true, afternoon: false, evening: true }, "2025-01-16": {...}, ... }
  availability: jsonb("availability").notNull(),

  // Optional notes
  notes: text("notes"), // "Out of town Jan 20-22", "Work party on Thursday", etc.

  // Access control
  responseToken: varchar("response_token").unique(), // For email link access without login

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pulse_responses_pulse").on(table.pulseId),
  index("idx_pulse_responses_member").on(table.memberId),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  groups: many(groups),
  votingEvents: many(votingEvents),
  votes: many(votes),
  itineraries: many(itineraries),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  user: one(users, {
    fields: [groups.userId],
    references: [users.id],
  }),
  members: many(members),
  activities: many(activities),
  votingEvents: many(votingEvents),
  preferenceSignals: many(preferenceSignals),
  itineraries: many(itineraries),
}));

export const membersRelations = relations(members, ({ one }) => ({
  group: one(groups, {
    fields: [members.groupId],
    references: [groups.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  group: one(groups, {
    fields: [activities.groupId],
    references: [groups.id],
  }),
}));

export const votingEventsRelations = relations(votingEvents, ({ one, many }) => ({
  group: one(groups, {
    fields: [votingEvents.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [votingEvents.createdBy],
    references: [users.id],
  }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  event: one(votingEvents, {
    fields: [votes.eventId],
    references: [votingEvents.id],
  }),
  user: one(users, {
    fields: [votes.userId],
    references: [users.id],
  }),
}));

export const preferenceSignalsRelations = relations(preferenceSignals, ({ one }) => ({
  group: one(groups, {
    fields: [preferenceSignals.groupId],
    references: [groups.id],
  }),
}));

export const itinerariesRelations = relations(itineraries, ({ one, many }) => ({
  group: one(groups, {
    fields: [itineraries.groupId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [itineraries.createdBy],
    references: [users.id],
  }),
  items: many(itineraryItems),
  rsvps: many(rsvps),
  invites: many(itineraryInvites),
  guestInvites: many(guestInvites),
  reminderLogs: many(reminderLogs),
  proposedTimeSlots: many(proposedTimeSlots),
  backupFor: one(itineraries, {
    fields: [itineraries.backupForItineraryId],
    references: [itineraries.id],
  }),
}));

export const itineraryItemsRelations = relations(itineraryItems, ({ one }) => ({
  itinerary: one(itineraries, {
    fields: [itineraryItems.itineraryId],
    references: [itineraries.id],
  }),
}));

export const rsvpsRelations = relations(rsvps, ({ one }) => ({
  itinerary: one(itineraries, {
    fields: [rsvps.itineraryId],
    references: [itineraries.id],
  }),
  member: one(members, {
    fields: [rsvps.memberId],
    references: [members.id],
  }),
  user: one(users, {
    fields: [rsvps.userId],
    references: [users.id],
  }),
}));

export const itineraryInvitesRelations = relations(itineraryInvites, ({ one }) => ({
  itinerary: one(itineraries, {
    fields: [itineraryInvites.itineraryId],
    references: [itineraries.id],
  }),
  member: one(members, {
    fields: [itineraryInvites.memberId],
    references: [members.id],
  }),
}));

export const guestInvitesRelations = relations(guestInvites, ({ one }) => ({
  itinerary: one(itineraries, {
    fields: [guestInvites.itineraryId],
    references: [itineraries.id],
  }),
  creator: one(users, {
    fields: [guestInvites.createdBy],
    references: [users.id],
  }),
}));

export const reminderLogsRelations = relations(reminderLogs, ({ one }) => ({
  itinerary: one(itineraries, {
    fields: [reminderLogs.itineraryId],
    references: [itineraries.id],
  }),
}));

export const autoScheduledEventsRelations = relations(autoScheduledEvents, ({ one, many }) => ({
  group: one(groups, {
    fields: [autoScheduledEvents.groupId],
    references: [groups.id],
  }),
  itinerary: one(itineraries, {
    fields: [autoScheduledEvents.itineraryId],
    references: [itineraries.id],
  }),
  options: many(itineraryOptions),
  votes: many(itineraryOptionVotes),
}));

export const itineraryOptionsRelations = relations(itineraryOptions, ({ one, many }) => ({
  autoEvent: one(autoScheduledEvents, {
    fields: [itineraryOptions.autoEventId],
    references: [autoScheduledEvents.id],
  }),
  votes: many(itineraryOptionVotes),
}));

export const itineraryOptionVotesRelations = relations(itineraryOptionVotes, ({ one }) => ({
  option: one(itineraryOptions, {
    fields: [itineraryOptionVotes.optionId],
    references: [itineraryOptions.id],
  }),
  autoEvent: one(autoScheduledEvents, {
    fields: [itineraryOptionVotes.autoEventId],
    references: [autoScheduledEvents.id],
  }),
  member: one(members, {
    fields: [itineraryOptionVotes.memberId],
    references: [members.id],
  }),
  user: one(users, {
    fields: [itineraryOptionVotes.userId],
    references: [users.id],
  }),
}));

export const frequencyFeedbackRelations = relations(frequencyFeedback, ({ one }) => ({
  group: one(groups, {
    fields: [frequencyFeedback.groupId],
    references: [groups.id],
  }),
  member: one(members, {
    fields: [frequencyFeedback.memberId],
    references: [members.id],
  }),
  user: one(users, {
    fields: [frequencyFeedback.userId],
    references: [users.id],
  }),
  itinerary: one(itineraries, {
    fields: [frequencyFeedback.itineraryId],
    references: [itineraries.id],
  }),
}));

export const proposedTimeSlotsRelations = relations(proposedTimeSlots, ({ one, many }) => ({
  itinerary: one(itineraries, {
    fields: [proposedTimeSlots.itineraryId],
    references: [itineraries.id],
  }),
  votes: many(timeSlotVotes),
}));

export const timeSlotVotesRelations = relations(timeSlotVotes, ({ one }) => ({
  timeSlot: one(proposedTimeSlots, {
    fields: [timeSlotVotes.timeSlotId],
    references: [proposedTimeSlots.id],
  }),
  member: one(members, {
    fields: [timeSlotVotes.memberId],
    references: [members.id],
  }),
  user: one(users, {
    fields: [timeSlotVotes.userId],
    references: [users.id],
  }),
}));

export const availabilityPulsesRelations = relations(availabilityPulses, ({ one, many }) => ({
  group: one(groups, {
    fields: [availabilityPulses.groupId],
    references: [groups.id],
  }),
  responses: many(availabilityPulseResponses),
}));

export const availabilityPulseResponsesRelations = relations(availabilityPulseResponses, ({ one }) => ({
  pulse: one(availabilityPulses, {
    fields: [availabilityPulseResponses.pulseId],
    references: [availabilityPulses.id],
  }),
  member: one(members, {
    fields: [availabilityPulseResponses.memberId],
    references: [members.id],
  }),
  user: one(users, {
    fields: [availabilityPulseResponses.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  userId: true,
  createdAt: true,
  shareableLink: true,
  activityGenerationStatus: true,
  activityGenerationError: true,
}).extend({
  searchRadius: z.number().refine(val => [2, 10, 30, 50].includes(val), {
    message: "Search radius must be 2, 10, 30, or 50 miles"
  }).default(2),
});

export const insertGroupBackupSchema = createInsertSchema(groupBackups).omit({
  id: true,
  createdAt: true,
});

export const insertMemberSchema = createInsertSchema(members).omit({
  id: true,
  createdAt: true,
});

export const insertMemberGroupPreferencesSchema = createInsertSchema(memberGroupPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
  trustState: true,
  verifiedAt: true,
  trustSource: true,
});

export const insertVotingEventSchema = createInsertSchema(votingEvents).omit({
  id: true,
  createdBy: true,
  createdAt: true,
  trustState: true,
  verifiedAt: true,
  trustSource: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

export const insertPreferenceSignalSchema = createInsertSchema(preferenceSignals).omit({
  id: true,
  createdAt: true,
});

export const insertItinerarySchema = createInsertSchema(itineraries).omit({
  id: true,
  createdBy: true,
  createdAt: true,
});

export const insertItineraryItemSchema = createInsertSchema(itineraryItems).omit({
  id: true,
  createdAt: true,
  trustState: true,
  verifiedAt: true,
  trustSource: true,
});

export const insertRsvpSchema = createInsertSchema(rsvps).omit({
  id: true,
  createdAt: true,
});

export const insertGuestInviteSchema = createInsertSchema(guestInvites).omit({
  id: true,
  guestToken: true,
  createdBy: true,
  createdAt: true,
});

export const insertStandaloneEventInviteeSchema = createInsertSchema(standaloneEventInvitees).omit({
  id: true,
  inviteToken: true,
  createdAt: true,
});

export const insertReminderLogSchema = createInsertSchema(reminderLogs).omit({
  id: true,
  sentAt: true,
  createdAt: true,
});

export const insertAutoScheduledEventSchema = createInsertSchema(autoScheduledEvents).omit({
  id: true,
  createdAt: true,
});

export const insertFrequencyFeedbackSchema = createInsertSchema(frequencyFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertGroupCollectionSchema = createInsertSchema(groupCollections).omit({
  id: true,
  createdAt: true,
});

export const insertProposedTimeSlotSchema = createInsertSchema(proposedTimeSlots).omit({
  id: true,
  createdAt: true,
});

export const insertTimeSlotVoteSchema = createInsertSchema(timeSlotVotes).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySearchHistorySchema = createInsertSchema(categorySearchHistory).omit({
  id: true,
  createdAt: true,
});

export const insertPlacesCacheSchema = createInsertSchema(placesCache).omit({
  createdAt: true,
});

export const insertSearchCacheSchema = createInsertSchema(searchCache).omit({
  id: true,
  createdAt: true,
});

export const insertAiCategorizationCacheSchema = createInsertSchema(aiCategorizationCache).omit({
  createdAt: true,
});

export const insertHostAssignmentSchema = createInsertSchema(hostAssignments).omit({
  id: true,
  createdAt: true,
  askedAt: true,
});

export const insertAvailabilityPulseSchema = createInsertSchema(availabilityPulses).omit({
  id: true,
  createdAt: true,
  responseCount: true,
});

export const insertAvailabilityPulseResponseSchema = createInsertSchema(availabilityPulseResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCuratedVenueSchema = createInsertSchema(curatedVenues).omit({
  id: true,
  createdAt: true,
});

export const insertApiCallLogSchema = createInsertSchema(apiCallLogs).omit({
  id: true,
  createdAt: true,
});

// Update schemas (partial versions for PATCH operations)
export const updateGroupSchema = insertGroupSchema.partial().refine(
  (data) => {
    // If searchRadius is provided, validate it
    if (data.searchRadius !== undefined) {
      return [2, 10, 30, 50].includes(data.searchRadius);
    }
    return true;
  },
  {
    message: "Search radius must be 2, 10, 30, or 50 miles when provided",
    path: ["searchRadius"],
  }
);
export const updateMemberSchema = insertMemberSchema.partial();
export const updateVotingEventSchema = insertVotingEventSchema.partial();
export const updateItinerarySchema = insertItinerarySchema.partial();
export const updateUserProfileSchema = insertUserProfileSchema.partial();
export const updateGroupCollectionSchema = insertGroupCollectionSchema.partial();

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;
export type UpdateGroup = z.infer<typeof updateGroupSchema>;

export type InsertGroupBackup = z.infer<typeof insertGroupBackupSchema>;
export type GroupBackup = typeof groupBackups.$inferSelect;

export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof members.$inferSelect;
export type UpdateMember = z.infer<typeof updateMemberSchema>;

export type InsertMemberGroupPreferences = z.infer<typeof insertMemberGroupPreferencesSchema>;
export type MemberGroupPreferences = typeof memberGroupPreferences.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export type InsertVotingEvent = z.infer<typeof insertVotingEventSchema>;
export type VotingEvent = typeof votingEvents.$inferSelect;
export type UpdateVotingEvent = z.infer<typeof updateVotingEventSchema>;

export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;

export type InsertPreferenceSignal = z.infer<typeof insertPreferenceSignalSchema>;
export type PreferenceSignal = typeof preferenceSignals.$inferSelect;

export type InsertItinerary = z.infer<typeof insertItinerarySchema>;
export type Itinerary = typeof itineraries.$inferSelect;
export type UpdateItinerary = z.infer<typeof updateItinerarySchema>;

export type InsertItineraryItem = z.infer<typeof insertItineraryItemSchema>;
export type ItineraryItem = typeof itineraryItems.$inferSelect;

export type InsertRsvp = z.infer<typeof insertRsvpSchema>;
export type Rsvp = typeof rsvps.$inferSelect;

export type InsertGuestInvite = z.infer<typeof insertGuestInviteSchema>;
export type GuestInvite = typeof guestInvites.$inferSelect;

export type InsertStandaloneEventInvitee = z.infer<typeof insertStandaloneEventInviteeSchema>;
export type StandaloneEventInvitee = typeof standaloneEventInvitees.$inferSelect;

export type InsertReminderLog = z.infer<typeof insertReminderLogSchema>;
export type ReminderLog = typeof reminderLogs.$inferSelect;

export type InsertAutoScheduledEvent = z.infer<typeof insertAutoScheduledEventSchema>;
export type AutoScheduledEvent = typeof autoScheduledEvents.$inferSelect;

export type InsertFrequencyFeedback = z.infer<typeof insertFrequencyFeedbackSchema>;
export type FrequencyFeedback = typeof frequencyFeedback.$inferSelect;

export type InsertVenueVisitHistory = typeof venueVisitHistory.$inferInsert;
export type VenueVisitHistory = typeof venueVisitHistory.$inferSelect;

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertGroupCollection = z.infer<typeof insertGroupCollectionSchema>;
export type GroupCollection = typeof groupCollections.$inferSelect;
export type UpdateGroupCollection = z.infer<typeof updateGroupCollectionSchema>;

export type InsertProposedTimeSlot = z.infer<typeof insertProposedTimeSlotSchema>;
export type ProposedTimeSlot = typeof proposedTimeSlots.$inferSelect;

export type InsertTimeSlotVote = z.infer<typeof insertTimeSlotVoteSchema>;
export type TimeSlotVote = typeof timeSlotVotes.$inferSelect;

export type InsertCategorySearchHistory = z.infer<typeof insertCategorySearchHistorySchema>;
export type CategorySearchHistory = typeof categorySearchHistory.$inferSelect;

export type InsertPlacesCache = z.infer<typeof insertPlacesCacheSchema>;
export type PlacesCache = typeof placesCache.$inferSelect;

export type InsertSearchCache = z.infer<typeof insertSearchCacheSchema>;
export type SearchCache = typeof searchCache.$inferSelect;

export type InsertAiCategorizationCache = z.infer<typeof insertAiCategorizationCacheSchema>;
export type AiCategorizationCache = typeof aiCategorizationCache.$inferSelect;

export type InsertHostAssignment = z.infer<typeof insertHostAssignmentSchema>;
export type HostAssignment = typeof hostAssignments.$inferSelect;

export type InsertAvailabilityPulse = z.infer<typeof insertAvailabilityPulseSchema>;
export type AvailabilityPulse = typeof availabilityPulses.$inferSelect;

export type InsertAvailabilityPulseResponse = z.infer<typeof insertAvailabilityPulseResponseSchema>;
export type AvailabilityPulseResponse = typeof availabilityPulseResponses.$inferSelect;

// Date-specific availability format for pulse responses
export type DateSpecificAvailability = Record<string, {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
}>;

export const insertUserSavedPlaceSchema = createInsertSchema(userSavedPlaces).omit({
  id: true,
  createdAt: true,
});

export type InsertUserSavedPlace = z.infer<typeof insertUserSavedPlaceSchema>;
export type UserSavedPlace = typeof userSavedPlaces.$inferSelect;

export const insertGroupSavedPlaceSchema = createInsertSchema(groupSavedPlaces).omit({
  id: true,
  createdAt: true,
});

export type InsertGroupSavedPlace = z.infer<typeof insertGroupSavedPlaceSchema>;
export type GroupSavedPlace = typeof groupSavedPlaces.$inferSelect;

export type MemberFavoriteVenue = typeof memberFavoriteVenues.$inferSelect;
export type InsertMemberFavoriteVenue = typeof memberFavoriteVenues.$inferInsert;

export type InsertCuratedVenue = z.infer<typeof insertCuratedVenueSchema>;
export type CuratedVenue = typeof curatedVenues.$inferSelect;

export type InsertApiCallLog = z.infer<typeof insertApiCallLogSchema>;
export type ApiCallLog = typeof apiCallLogs.$inferSelect;

// Queue event metadata table (tracks regeneration counts for auto-schedule queue events)
export const queueEventMetadata = pgTable("queue_event_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull(), // The queue event ID (e.g., "queue-2025-11-30T...")
  regenerationCount: integer("regeneration_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertQueueEventMetadataSchema = createInsertSchema(queueEventMetadata).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQueueEventMetadata = z.infer<typeof insertQueueEventMetadataSchema>;
export type QueueEventMetadata = typeof queueEventMetadata.$inferSelect;

// Database backups table (complete snapshots for disaster recovery)
export const databaseBackups = pgTable("database_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotData: jsonb("snapshot_data").notNull(), // Complete database snapshot
  backupType: text("backup_type").notNull(), // "manual", "daily_auto", "pre_migration"
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }), // Who created the backup (null for automatic)
  notes: text("notes"), // Optional notes about this backup
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDatabaseBackupSchema = createInsertSchema(databaseBackups).omit({
  id: true,
  createdAt: true,
});

export type InsertDatabaseBackup = z.infer<typeof insertDatabaseBackupSchema>;
export type DatabaseBackup = typeof databaseBackups.$inferSelect;

// Planning Insights table (proactive AI observations and suggestions)
export const planningInsights = pgTable("planning_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").references(() => members.id, { onDelete: "cascade" }), // Nullable - some insights are group-wide

  // Insight classification
  insightType: text("insight_type").notNull(), // 'location_fairness' | 'venue_gap' | 'date_clustering' | 'member_inclusion' | 'cadence_health'
  severity: text("severity").notNull().default("info"), // 'info' | 'suggestion' | 'action_needed'
  audienceType: text("audience_type").notNull().default("organizer"), // 'organizer' | 'member' | 'all'

  // Structured data from analyzer. Display content (title, message,
  // action URL, action label) is rendered from insight_type + metadata at
  // read time — see server/planning-agent/message-generator.ts.
  metadata: jsonb("metadata"), // Analyzer-specific data (e.g., {locationCounts: {...}, suggestedArea: "Oakland"})

  // Action tracking
  actionType: text("action_type"), // 'suggest_venue' | 'create_draft' | 'send_nudge' | 'adjust_cadence' | null
  actionTaken: text("action_taken").default("none"), // 'none' | 'suggested' | 'auto_acted' | 'user_acted'
  actionDetails: jsonb("action_details"), // What was done (e.g., {venueId: "...", eventCreated: true})

  // Lifecycle
  dismissedAt: timestamp("dismissed_at"), // User dismissed this insight
  dismissedBy: varchar("dismissed_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at"), // Auto-expire old insights

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(table) => [
  index("idx_planning_insights_group").on(table.groupId),
  index("idx_planning_insights_member").on(table.memberId),
  index("idx_planning_insights_type").on(table.insightType),
  index("idx_planning_insights_active").on(table.groupId, table.dismissedAt, table.expiresAt),
]);

export const insertPlanningInsightSchema = createInsertSchema(planningInsights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlanningInsight = z.infer<typeof insertPlanningInsightSchema>;
export type PlanningInsight = typeof planningInsights.$inferSelect;
