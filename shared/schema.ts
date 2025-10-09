import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
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

// Groups table
export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  locationBase: text("location_base").notNull(),
  budgetMin: integer("budget_min").notNull(),
  budgetMax: integer("budget_max").notNull(),
  meetingFrequency: text("meeting_frequency").notNull(), // weekly, biweekly, monthly
  availability: jsonb("availability").notNull(), // Grid: {day: {morning: bool, afternoon: bool, evening: bool}}
  closenessLevel: integer("closeness_level").notNull(), // 1-5 scale
  noveltyPreference: integer("novelty_preference").notNull(), // 1-5 scale (1=familiar, 5=new)
  activityCategories: text("activity_categories").array(), // Selected activity types (e.g., ["wine-bars", "karaoke", "concerts"])
  pastPreferences: text("past_preferences"), // comma-separated or text description
  additionalInstructions: text("additional_instructions"), // Custom AI instructions from user
  shareableLink: text("shareable_link").notNull().unique(),
  activityGenerationStatus: text("activity_generation_status").default("pending").notNull(), // pending, generating, completed, failed
  activityGenerationError: text("activity_generation_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Group members table
export const members = pgTable("members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email"),
  availability: text("availability"),
  preferences: text("preferences"),
  isOrganizer: boolean("is_organizer").default(false).notNull(),
  invitationSent: boolean("invitation_sent").default(false).notNull(),
  hasJoined: boolean("has_joined").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  rating: text("rating"),
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
  rating: text("rating"),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  groups: many(groups),
  votingEvents: many(votingEvents),
  votes: many(votes),
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

// Insert schemas
export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  userId: true,
  createdAt: true,
  shareableLink: true,
  activityGenerationStatus: true,
  activityGenerationError: true,
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

// Update schemas (partial versions for PATCH operations)
export const updateGroupSchema = insertGroupSchema.partial();
export const updateMemberSchema = insertMemberSchema.partial();
export const updateVotingEventSchema = insertVotingEventSchema.partial();

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
