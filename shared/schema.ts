import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, index, numeric } from "drizzle-orm/pg-core";
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
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User profiles table (extended user information)
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"), // User's preferred display name
  bio: text("bio"), // Short bio or description
  emailNotifications: boolean("email_notifications").default(true).notNull(), // Whether to receive email notifications
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  searchRadius: integer("search_radius").default(2).notNull(), // Search radius in miles (2, 10, 30, 50)
  
  // High-level category filters (control which types of suggestions AI generates)
  mealEnabled: boolean("meal_enabled").default(true).notNull(), // Restaurants, brunch spots, food markets, potlucks
  cafeEnabled: boolean("cafe_enabled").default(true).notNull(), // Cafes, coffee shops
  drinksEnabled: boolean("drinks_enabled").default(true).notNull(), // Wine bars, cocktail bars, breweries
  dessertEnabled: boolean("dessert_enabled").default(true).notNull(), // Dessert shops, ice cream, bakeries
  experiencesEnabled: boolean("experiences_enabled").default(true).notNull(), // Concerts, museums, outdoor activities, games, etc.
  shareableLink: text("shareable_link").notNull().unique(),
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
});

// Activities table (AI-generated suggestions)
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  aiSuggestedName: text("ai_suggested_name"), // What AI originally suggested (e.g., "Italian Restaurant") before Google enrichment
  venueName: text("venue_name").notNull(),
  venueAddress: text("venue_address").notNull(),
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
  archivedAt: timestamp("archived_at"), // Soft-delete for regeneration
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// YAS THIS voting events table
export const votingEvents = pgTable("voting_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  venueAddress: text("venue_address"),
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
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Votes table to track upvotes/downvotes
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

// Itineraries table - validated combinations of venues for an evening
export const itineraries = pgTable("itineraries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  name: text("name"), // Optional name for saved itineraries (e.g., "SF Waterfront Day")
  status: text("status").notNull().default("draft"), // draft, saved, proposed, scheduled, rejected
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
  
  // Event hosting
  hostMemberId: varchar("host_member_id").references(() => members.id, { onDelete: "set null" }), // Member who volunteered to host this event (null = organizer or AI-hosted)
  
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Itinerary items - individual venues in an itinerary
export const itineraryItems = pgTable("itinerary_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itineraryId: varchar("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // 'activity' or 'voting_event'
  sourceId: varchar("source_id").notNull(), // ID from activities or votingEvents table
  venueName: text("venue_name").notNull(),
  venueAddress: text("venue_address"),
  venueType: text("venue_type").notNull(),
  googlePlaceId: text("google_place_id"),
  rating: text("rating"),
  photoUrl: text("photo_url"),
  orderIndex: integer("order_index").notNull(), // Position in itinerary sequence
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
});

// Itinerary invites - ties invite tokens to specific itinerary+member pairs for secure RSVPs
export const itineraryInvites = pgTable("itinerary_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itineraryId: varchar("itinerary_id").notNull().references(() => itineraries.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").references(() => members.id, { onDelete: "cascade" }), // Optional - null for organizer invites when group has no members
  inviteToken: varchar("invite_token").notNull().unique(), // Unique token for this specific invite
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  status: text("status").default("pending").notNull(), // 'pending', 'approved', 'rejected', 'auto_sent'
  autoSendAt: timestamp("auto_send_at").notNull(), // When to auto-send if no organizer action (3 days before target)
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
});

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

// Google Place Photos API cache - cache downloaded photos for 30 days
export const photosCache = pgTable("photos_cache", {
  photoReference: text("photo_reference").primaryKey(), // Google photo reference ID
  imageData: text("image_data").notNull(), // Base64 encoded image data
  contentType: text("content_type").notNull().default("image/jpeg"), // MIME type
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 30 days from createdAt
});

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

export const reminderLogsRelations = relations(reminderLogs, ({ one }) => ({
  itinerary: one(itineraries, {
    fields: [reminderLogs.itineraryId],
    references: [itineraries.id],
  }),
}));

export const autoScheduledEventsRelations = relations(autoScheduledEvents, ({ one }) => ({
  group: one(groups, {
    fields: [autoScheduledEvents.groupId],
    references: [groups.id],
  }),
  itinerary: one(itineraries, {
    fields: [autoScheduledEvents.itineraryId],
    references: [itineraries.id],
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

export const insertMemberSchema = createInsertSchema(members).omit({
  id: true,
  createdAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertVotingEventSchema = createInsertSchema(votingEvents).omit({
  id: true,
  createdBy: true,
  createdAt: true,
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
});

export const insertRsvpSchema = createInsertSchema(rsvps).omit({
  id: true,
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

export const insertHostAssignmentSchema = createInsertSchema(hostAssignments).omit({
  id: true,
  createdAt: true,
  askedAt: true,
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

export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof members.$inferSelect;
export type UpdateMember = z.infer<typeof updateMemberSchema>;

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

export type InsertReminderLog = z.infer<typeof insertReminderLogSchema>;
export type ReminderLog = typeof reminderLogs.$inferSelect;

export type InsertAutoScheduledEvent = z.infer<typeof insertAutoScheduledEventSchema>;
export type AutoScheduledEvent = typeof autoScheduledEvents.$inferSelect;

export type InsertFrequencyFeedback = z.infer<typeof insertFrequencyFeedbackSchema>;
export type FrequencyFeedback = typeof frequencyFeedback.$inferSelect;

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

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

export type InsertHostAssignment = z.infer<typeof insertHostAssignmentSchema>;
export type HostAssignment = typeof hostAssignments.$inferSelect;
