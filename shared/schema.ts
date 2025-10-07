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
  complementaryPlaceName: text("complementary_place_name"), // For outdoor venues: nearby food place
  complementaryPlaceAddress: text("complementary_place_address"),
  complementaryPlaceId: text("complementary_place_id"), // Google Place ID
  complementaryPlacePhotoUrl: text("complementary_place_photo_url"),
  complementaryPlaceRating: text("complementary_place_rating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  groups: many(groups),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  user: one(users, {
    fields: [groups.userId],
    references: [users.id],
  }),
  members: many(members),
  activities: many(activities),
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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof members.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
