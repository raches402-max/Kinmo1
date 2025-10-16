// Reference: javascript_database blueprint
// Reference: javascript_log_in_with_replit blueprint
import {
  users, groups, members, activities, votingEvents, votes, preferenceSignals, itineraries, itineraryItems, rsvps, reminderLogs,
  type User, type UpsertUser,
  type Group, type InsertGroup, type UpdateGroup,
  type Member, type InsertMember, type UpdateMember,
  type Activity, type InsertActivity,
  type VotingEvent, type InsertVotingEvent, type UpdateVotingEvent,
  type Vote, type InsertVote,
  type PreferenceSignal, type InsertPreferenceSignal,
  type Itinerary, type InsertItinerary, type UpdateItinerary,
  type ItineraryItem, type InsertItineraryItem,
  type Rsvp, type InsertRsvp,
  type ReminderLog, type InsertReminderLog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Groups
  createGroup(group: InsertGroup, userId: string, memberInputs: Array<{name: string, email: string}>): Promise<Group>;
  getGroup(id: string): Promise<Group | undefined>;
  getGroupByShareableLink(link: string): Promise<Group | undefined>;
  getUserGroups(userId: string): Promise<Group[]>;
  getAllGroups(): Promise<Group[]>;
  updateGroup(id: string, updates: UpdateGroup): Promise<Group>;
  updateGroupStatus(id: string, status: string, error?: string): Promise<void>;

  // Members
  getGroupMembers(groupId: string): Promise<Member[]>;
  getMember(id: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(id: string, updates: UpdateMember): Promise<Member>;
  deleteMember(id: string): Promise<void>;
  markInvitationsSent(groupId: string): Promise<void>;

  // Activities
  getGroupActivities(groupId: string): Promise<Activity[]>;
  getAllGroupActivities(groupId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  createActivities(activities: InsertActivity[]): Promise<Activity[]>;
  updateActivityFeedback(activityId: string, feedback: string): Promise<Activity>;
  archiveGroupActivities(groupId: string): Promise<void>;
  deleteAllGroupActivities(groupId: string): Promise<void>;

  // Voting Events
  createVotingEvent(event: InsertVotingEvent, userId: string): Promise<VotingEvent>;
  getVotingEvents(): Promise<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>>;
  getGroupVotingEvents(groupId: string): Promise<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>>;
  getVotingEvent(id: string): Promise<VotingEvent | undefined>;
  updateVotingEvent(id: string, updates: UpdateVotingEvent): Promise<VotingEvent>;
  deleteVotingEvent(id: string): Promise<void>;

  // Votes
  castVote(eventId: string, userId: string, voteType: 'upvote' | 'downvote'): Promise<Vote>;
  removeVote(eventId: string, userId: string): Promise<void>;
  getEventVotes(eventId: string): Promise<Vote[]>;
  getUserVote(eventId: string, userId: string): Promise<Vote | undefined>;

  // Preference Signals
  createPreferenceSignal(signal: InsertPreferenceSignal): Promise<PreferenceSignal>;
  getGroupPreferenceSignals(groupId: string): Promise<PreferenceSignal[]>;

  // Itineraries
  createItinerary(itinerary: InsertItinerary, userId: string, items: Array<{sourceType: 'activity' | 'voting_event', sourceId: string}>): Promise<Itinerary>;
  getGroupItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[] }>>;
  getSavedItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[] }>>;
  getProposedItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[], rsvps: Rsvp[] }>>;
  getItinerary(id: string): Promise<(Itinerary & { items: ItineraryItem[] }) | undefined>;
  updateItinerary(id: string, updates: UpdateItinerary): Promise<Itinerary>;
  deleteItinerary(id: string): Promise<void>;
  getItineraryItemById(itemId: string): Promise<any>;
  deleteItineraryItem(itemId: string): Promise<void>;

  // RSVPs
  createRsvp(rsvp: InsertRsvp): Promise<Rsvp>;
  getItineraryRsvps(itineraryId: string): Promise<Rsvp[]>;
  updateRsvp(id: string, updates: Partial<InsertRsvp>): Promise<Rsvp>;
  deleteRsvp(id: string): Promise<void>;

  // Reminder Logs
  logReminder(log: InsertReminderLog): Promise<ReminderLog>;
  getReminderLogs(itineraryId: string): Promise<ReminderLog[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Group operations
  async createGroup(insertGroup: InsertGroup, userId: string, memberInputs: Array<{name: string, email: string}>): Promise<Group> {
    // Generate unique shareable link
    const shareableLink = randomBytes(16).toString('hex');

    const [group] = await db
      .insert(groups)
      .values({ ...insertGroup, userId, shareableLink })
      .returning();

    // Create members if provided
    if (memberInputs.length > 0) {
      const membersData = memberInputs.map((m, index) => ({
        groupId: group.id,
        name: m.name || null,
        email: m.email || null,
        isOrganizer: index === 0, // First member is organizer
        invitationSent: false,
        hasJoined: false,
      }));

      await db.insert(members).values(membersData);
    }

    return group;
  }

  async getUserGroups(userId: string): Promise<Group[]> {
    return await db.select().from(groups).where(eq(groups.userId, userId));
  }

  async getAllGroups(): Promise<Group[]> {
    return await db.select().from(groups);
  }

  async getGroup(id: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group || undefined;
  }

  async getGroupByShareableLink(link: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.shareableLink, link));
    return group || undefined;
  }

  async getGroupMembers(groupId: string): Promise<Member[]> {
    return await db.select().from(members).where(eq(members.groupId, groupId));
  }

  async createMember(insertMember: InsertMember): Promise<Member> {
    const [member] = await db
      .insert(members)
      .values(insertMember)
      .returning();
    return member;
  }

  async getGroupActivities(groupId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(
      and(
        eq(activities.groupId, groupId),
        sql`${activities.archivedAt} IS NULL`
      )
    ).orderBy(activities.createdAt);
  }

  async getAllGroupActivities(groupId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(
      eq(activities.groupId, groupId)
    ).orderBy(activities.createdAt);
  }

  async archiveGroupActivities(groupId: string): Promise<void> {
    await db
      .update(activities)
      .set({ archivedAt: new Date() })
      .where(eq(activities.groupId, groupId));
  }

  async deleteAllGroupActivities(groupId: string): Promise<void> {
    await db
      .delete(activities)
      .where(eq(activities.groupId, groupId));
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db
      .insert(activities)
      .values(insertActivity)
      .returning();
    return activity;
  }

  async createActivities(insertActivities: InsertActivity[]): Promise<Activity[]> {
    if (insertActivities.length === 0) return [];

    return await db
      .insert(activities)
      .values(insertActivities)
      .returning();
  }

  async updateGroupStatus(id: string, status: string, error?: string): Promise<void> {
    await db
      .update(groups)
      .set({
        activityGenerationStatus: status,
        activityGenerationError: error || null
      })
      .where(eq(groups.id, id));
  }

  async markInvitationsSent(groupId: string): Promise<void> {
    await db
      .update(members)
      .set({ invitationSent: true })
      .where(eq(members.groupId, groupId));
  }

  async updateActivityFeedback(activityId: string, feedback: string): Promise<Activity> {
    const [activity] = await db
      .update(activities)
      .set({ feedback })
      .where(eq(activities.id, activityId))
      .returning();
    return activity;
  }

  async updateGroup(id: string, updates: UpdateGroup): Promise<Group> {
    const [group] = await db
      .update(groups)
      .set(updates)
      .where(eq(groups.id, id))
      .returning();
    return group;
  }

  async getMember(id: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.id, id));
    return member || undefined;
  }

  async updateMember(id: string, updates: UpdateMember): Promise<Member> {
    const [member] = await db
      .update(members)
      .set(updates)
      .where(eq(members.id, id))
      .returning();
    return member;
  }

  async deleteMember(id: string): Promise<void> {
    // First check if the member is an organizer
    const member = await this.getMember(id);
    if (member?.isOrganizer) {
      throw new Error("Cannot delete organizer member");
    }

    await db
      .delete(members)
      .where(eq(members.id, id));
  }

  // Voting Events operations
  async createVotingEvent(insertEvent: InsertVotingEvent, userId: string): Promise<VotingEvent> {
    const [event] = await db
      .insert(votingEvents)
      .values({ ...insertEvent, createdBy: userId })
      .returning();
    return event;
  }

  async getVotingEvents(): Promise<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>> {
    const events = await db
      .select({
        id: votingEvents.id,
        groupId: votingEvents.groupId,
        title: votingEvents.title,
        description: votingEvents.description,
        venueAddress: votingEvents.venueAddress,
        venueType: votingEvents.venueType,
        googlePlaceId: votingEvents.googlePlaceId,
        latitude: votingEvents.latitude,
        longitude: votingEvents.longitude,
        rating: votingEvents.rating,
        reviewCount: votingEvents.reviewCount,
        priceLevel: votingEvents.priceLevel,
        photoUrl: votingEvents.photoUrl,
        aiReasoning: votingEvents.aiReasoning,
        priceEstimate: votingEvents.priceEstimate,
        timeConstraints: votingEvents.timeConstraints,
        complementaryPlaceName: votingEvents.complementaryPlaceName,
        complementaryPlaceAddress: votingEvents.complementaryPlaceAddress,
        complementaryPlaceId: votingEvents.complementaryPlaceId,
        complementaryPlacePhotoUrl: votingEvents.complementaryPlacePhotoUrl,
        complementaryPlaceRating: votingEvents.complementaryPlaceRating,
        complementaryPlaceName2: votingEvents.complementaryPlaceName2,
        complementaryPlaceAddress2: votingEvents.complementaryPlaceAddress2,
        complementaryPlaceId2: votingEvents.complementaryPlaceId2,
        complementaryPlacePhotoUrl2: votingEvents.complementaryPlacePhotoUrl2,
        complementaryPlaceRating2: votingEvents.complementaryPlaceRating2,
        createdBy: votingEvents.createdBy,
        createdAt: votingEvents.createdAt,
        upvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END)`.as('upvotes'),
        downvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('downvotes'),
        netVotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('netVotes'),
      })
      .from(votingEvents)
      .leftJoin(votes, eq(votingEvents.id, votes.eventId))
      .groupBy(votingEvents.id)
      .orderBy(desc(sql`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`))
      .limit(10);

    return events;
  }

  async getGroupVotingEvents(groupId: string): Promise<Array<VotingEvent & { upvotes: number; downvotes: number; netVotes: number }>> {
    const events = await db
      .select({
        id: votingEvents.id,
        groupId: votingEvents.groupId,
        title: votingEvents.title,
        description: votingEvents.description,
        venueAddress: votingEvents.venueAddress,
        venueType: votingEvents.venueType,
        googlePlaceId: votingEvents.googlePlaceId,
        latitude: votingEvents.latitude,
        longitude: votingEvents.longitude,
        rating: votingEvents.rating,
        reviewCount: votingEvents.reviewCount,
        priceLevel: votingEvents.priceLevel,
        photoUrl: votingEvents.photoUrl,
        aiReasoning: votingEvents.aiReasoning,
        priceEstimate: votingEvents.priceEstimate,
        timeConstraints: votingEvents.timeConstraints,
        complementaryPlaceName: votingEvents.complementaryPlaceName,
        complementaryPlaceAddress: votingEvents.complementaryPlaceAddress,
        complementaryPlaceId: votingEvents.complementaryPlaceId,
        complementaryPlacePhotoUrl: votingEvents.complementaryPlacePhotoUrl,
        complementaryPlaceRating: votingEvents.complementaryPlaceRating,
        complementaryPlaceName2: votingEvents.complementaryPlaceName2,
        complementaryPlaceAddress2: votingEvents.complementaryPlaceAddress2,
        complementaryPlaceId2: votingEvents.complementaryPlaceId2,
        complementaryPlacePhotoUrl2: votingEvents.complementaryPlacePhotoUrl2,
        complementaryPlaceRating2: votingEvents.complementaryPlaceRating2,
        createdBy: votingEvents.createdBy,
        createdAt: votingEvents.createdAt,
        upvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END)`.as('upvotes'),
        downvotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('downvotes'),
        netVotes: sql<number>`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`.as('netVotes'),
      })
      .from(votingEvents)
      .leftJoin(votes, eq(votingEvents.id, votes.eventId))
      .where(eq(votingEvents.groupId, groupId))
      .groupBy(votingEvents.id)
      .orderBy(desc(sql`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`))
      .limit(10);

    return events;
  }

  async getVotingEvent(id: string): Promise<VotingEvent | undefined> {
    const [event] = await db.select().from(votingEvents).where(eq(votingEvents.id, id));
    return event || undefined;
  }

  async updateVotingEvent(id: string, updates: UpdateVotingEvent): Promise<VotingEvent> {
    const [event] = await db
      .update(votingEvents)
      .set(updates)
      .where(eq(votingEvents.id, id))
      .returning();
    return event;
  }

  async deleteVotingEvent(id: string): Promise<void> {
    await db.delete(votingEvents).where(eq(votingEvents.id, id));
  }

  // Votes operations
  async castVote(eventId: string, userId: string, voteType: 'upvote' | 'downvote'): Promise<Vote> {
    const existingVote = await this.getUserVote(eventId, userId);

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        return existingVote;
      }
      const [vote] = await db
        .update(votes)
        .set({ voteType })
        .where(and(eq(votes.eventId, eventId), eq(votes.userId, userId)))
        .returning();
      return vote;
    }

    const [vote] = await db
      .insert(votes)
      .values({ eventId, userId, voteType })
      .returning();
    return vote;
  }

  async removeVote(eventId: string, userId: string): Promise<void> {
    await db
      .delete(votes)
      .where(and(eq(votes.eventId, eventId), eq(votes.userId, userId)));
  }

  async getEventVotes(eventId: string): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.eventId, eventId));
  }

  async getUserVote(eventId: string, userId: string): Promise<Vote | undefined> {
    const [vote] = await db
      .select()
      .from(votes)
      .where(and(eq(votes.eventId, eventId), eq(votes.userId, userId)));
    return vote || undefined;
  }

  async createPreferenceSignal(signal: InsertPreferenceSignal): Promise<PreferenceSignal> {
    const [preferenceSignal] = await db
      .insert(preferenceSignals)
      .values(signal)
      .returning();
    return preferenceSignal;
  }

  async getGroupPreferenceSignals(groupId: string): Promise<PreferenceSignal[]> {
    return await db
      .select()
      .from(preferenceSignals)
      .where(eq(preferenceSignals.groupId, groupId))
      .orderBy(desc(preferenceSignals.createdAt));
  }

  async createItinerary(insertItinerary: InsertItinerary, userId: string, itemsData: Array<{sourceType: 'activity' | 'voting_event', sourceId: string}>): Promise<Itinerary> {
    const [itinerary] = await db
      .insert(itineraries)
      .values({ ...insertItinerary, createdBy: userId })
      .returning();

    // Create itinerary items with venue data
    if (itemsData.length > 0) {
      const itemsToInsert: InsertItineraryItem[] = [];

      for (let i = 0; i < itemsData.length; i++) {
        const item = itemsData[i];
        let venueName = '';
        let venueAddress = '';
        let venueType = '';
        let googlePlaceId = null;
        let rating = null;
        let photoUrl = null;

        if (item.sourceType === 'activity') {
          const [activity] = await db.select().from(activities).where(eq(activities.id, item.sourceId));
          if (activity) {
            venueName = activity.venueName;
            venueAddress = activity.venueAddress || '';
            venueType = activity.venueType;
            googlePlaceId = activity.googlePlaceId;
            rating = activity.rating;
            photoUrl = activity.photoUrl;
          }
        } else {
          const [votingEvent] = await db.select().from(votingEvents).where(eq(votingEvents.id, item.sourceId));
          if (votingEvent) {
            venueName = votingEvent.title;
            venueAddress = votingEvent.venueAddress || '';
            venueType = votingEvent.venueType || 'venue';
            googlePlaceId = votingEvent.googlePlaceId;
            rating = votingEvent.rating;
            photoUrl = votingEvent.photoUrl;
          }
        }

        itemsToInsert.push({
          itineraryId: itinerary.id,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          venueName,
          venueAddress,
          venueType,
          googlePlaceId,
          rating,
          photoUrl,
          orderIndex: i,
        });
      }

      await db.insert(itineraryItems).values(itemsToInsert);
    }

    return itinerary;
  }

  async getGroupItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[] }>> {
    const foundItineraries = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.groupId, groupId))
      .orderBy(desc(itineraries.createdAt));

    const result = [];
    for (const itinerary of foundItineraries) {
      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itinerary.id))
        .orderBy(itineraryItems.orderIndex);
      result.push({ ...itinerary, items });
    }
    return result;
  }

  async getItinerary(id: string): Promise<(Itinerary & { items: ItineraryItem[] }) | undefined> {
    const [itinerary] = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.id, id));

    if (!itinerary) return undefined;

    const items = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, id))
      .orderBy(itineraryItems.orderIndex);

    return { ...itinerary, items };
  }

  async updateItinerary(id: string, updates: UpdateItinerary): Promise<Itinerary> {
    const [itinerary] = await db
      .update(itineraries)
      .set(updates)
      .where(eq(itineraries.id, id))
      .returning();
    return itinerary;
  }

  async deleteItinerary(id: string): Promise<void> {
    await db.delete(itineraries).where(eq(itineraries.id, id));
  }

  async getItineraryItemById(itemId: string): Promise<any> {
    const [item] = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.id, itemId));
    return item;
  }

  async deleteItineraryItem(itemId: string): Promise<void> {
    await db
      .delete(itineraryItems)
      .where(eq(itineraryItems.id, itemId));
  }

  async updateItineraryItemOrder(itineraryId: string, proposedOrder: string[]): Promise<void> {
    // Update order indices based on the proposed order
    // Ensure we only update items that belong to this specific itinerary
    for (let i = 0; i < proposedOrder.length; i++) {
      await db
        .update(itineraryItems)
        .set({ orderIndex: i })
        .where(
          and(
            eq(itineraryItems.id, proposedOrder[i]),
            eq(itineraryItems.itineraryId, itineraryId)
          )
        );
    }
  }

  async getSavedItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[] }>> {
    const foundItineraries = await db
      .select()
      .from(itineraries)
      .where(and(
        eq(itineraries.groupId, groupId),
        eq(itineraries.isSaved, true)
      ))
      .orderBy(desc(itineraries.createdAt));

    const result = [];
    for (const itinerary of foundItineraries) {
      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itinerary.id))
        .orderBy(itineraryItems.orderIndex);
      result.push({ ...itinerary, items });
    }
    return result;
  }

  async getProposedItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[], rsvps: Rsvp[] }>> {
    const foundItineraries = await db
      .select()
      .from(itineraries)
      .where(and(
        eq(itineraries.groupId, groupId),
        or(eq(itineraries.status, 'proposed'), eq(itineraries.status, 'scheduled'))
      ))
      .orderBy(desc(itineraries.createdAt));

    const result = [];
    for (const itinerary of foundItineraries) {
      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itinerary.id))
        .orderBy(itineraryItems.orderIndex);
      
      const itineraryRsvps = await db
        .select()
        .from(rsvps)
        .where(eq(rsvps.itineraryId, itinerary.id))
        .orderBy(desc(rsvps.createdAt));

      result.push({ ...itinerary, items, rsvps: itineraryRsvps });
    }
    return result;
  }

  async createRsvp(rsvp: InsertRsvp): Promise<Rsvp> {
    const [createdRsvp] = await db
      .insert(rsvps)
      .values(rsvp)
      .returning();
    return createdRsvp;
  }

  async getItineraryRsvps(itineraryId: string): Promise<Rsvp[]> {
    return await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.itineraryId, itineraryId))
      .orderBy(desc(rsvps.createdAt));
  }

  async updateRsvp(id: string, updates: Partial<InsertRsvp>): Promise<Rsvp> {
    const [rsvp] = await db
      .update(rsvps)
      .set(updates)
      .where(eq(rsvps.id, id))
      .returning();
    return rsvp;
  }

  async deleteRsvp(id: string): Promise<void> {
    await db.delete(rsvps).where(eq(rsvps.id, id));
  }

  // Reminder Logs
  async logReminder(log: InsertReminderLog): Promise<ReminderLog> {
    const [reminderLog] = await db
      .insert(reminderLogs)
      .values(log)
      .returning();
    return reminderLog;
  }

  async getReminderLogs(itineraryId: string): Promise<ReminderLog[]> {
    return await db
      .select()
      .from(reminderLogs)
      .where(eq(reminderLogs.itineraryId, itineraryId))
      .orderBy(desc(reminderLogs.sentAt));
  }
}

export const storage = new DatabaseStorage();