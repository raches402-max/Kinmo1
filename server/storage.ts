// Reference: javascript_database blueprint
// Reference: javascript_log_in_with_replit blueprint
import {
  users, groups, members, activities, votingEvents, votes, preferenceSignals, itineraries, itineraryItems, rsvps, itineraryInvites, reminderLogs, autoScheduledEvents, frequencyFeedback, userProfiles, proposedTimeSlots, timeSlotVotes, groupCollections, categorySearchHistory,
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
  type ReminderLog, type InsertReminderLog,
  type AutoScheduledEvent, type InsertAutoScheduledEvent,
  type FrequencyFeedback, type InsertFrequencyFeedback,
  type UserProfile, type InsertUserProfile, type UpdateUserProfile,
  type ProposedTimeSlot, type InsertProposedTimeSlot,
  type TimeSlotVote, type InsertTimeSlotVote,
  type GroupCollection, type InsertGroupCollection, type UpdateGroupCollection,
  type CategorySearchHistory, type InsertCategorySearchHistory
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Groups
  createGroup(group: InsertGroup, userId: string, memberInputs: Array<{name: string, email: string}>): Promise<Group>;
  getGroup(id: string): Promise<Group | undefined>;
  getGroupByShareableLink(link: string): Promise<Group | undefined>;
  getUserGroups(userId: string): Promise<Array<Group & { members: Array<{ id: string; name: string | null; email: string | null }> }>>;
  getAllGroups(): Promise<Group[]>;
  updateGroup(id: string, updates: UpdateGroup): Promise<Group>;
  updateGroupStatus(id: string, status: string, error?: string): Promise<void>;
  addRejectedVenue(groupId: string, venueName: string): Promise<void>;

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
  getUserVotes(userId: string): Promise<Vote[]>;

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
  addItineraryItems(itineraryId: string, items: Array<{sourceType: 'activity' | 'voting_event', sourceId: string}>): Promise<ItineraryItem[]>;
  updateItineraryItemOrder(itineraryId: string, proposedOrder: string[]): Promise<void>;

  // RSVPs
  createRsvp(rsvp: InsertRsvp): Promise<Rsvp>;
  getItineraryRsvps(itineraryId: string): Promise<Rsvp[]>;
  updateRsvp(id: string, updates: Partial<InsertRsvp>): Promise<Rsvp>;
  deleteRsvp(id: string): Promise<void>;

  // Reminder Logs
  logReminder(log: InsertReminderLog): Promise<ReminderLog>;
  getReminderLogs(itineraryId: string): Promise<ReminderLog[]>;

  // Auto-scheduled Events
  createAutoScheduledEvent(event: InsertAutoScheduledEvent): Promise<AutoScheduledEvent>;
  getPendingAutoScheduledEvent(groupId: string): Promise<AutoScheduledEvent | undefined>;
  getAutoScheduledEvent(id: string): Promise<AutoScheduledEvent | undefined>;
  updateAutoScheduledEventStatus(id: string, status: string): Promise<AutoScheduledEvent>;
  getAutoScheduledEventsReadyForAutoSend(): Promise<AutoScheduledEvent[]>;

  // Frequency Feedback
  createFrequencyFeedback(feedback: InsertFrequencyFeedback): Promise<FrequencyFeedback>;
  getGroupFrequencyFeedback(groupId: string): Promise<FrequencyFeedback[]>;

  // User Profiles
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(userId: string, profile: InsertUserProfile): Promise<UserProfile>;

  // Proposed Time Slots
  createProposedTimeSlot(timeSlot: InsertProposedTimeSlot): Promise<ProposedTimeSlot>;
  createProposedTimeSlots(timeSlots: InsertProposedTimeSlot[]): Promise<ProposedTimeSlot[]>;
  getTimeSlot(timeSlotId: string): Promise<ProposedTimeSlot | undefined>;
  getItineraryTimeSlots(itineraryId: string): Promise<ProposedTimeSlot[]>;
  updateTimeSlotSelection(timeSlotId: string, isSelected: boolean): Promise<ProposedTimeSlot>;
  deleteTimeSlot(timeSlotId: string): Promise<void>;

  // Time Slot Votes
  voteForTimeSlot(vote: InsertTimeSlotVote): Promise<TimeSlotVote>;
  getTimeSlotVotes(timeSlotId: string): Promise<TimeSlotVote[]>;
  getUserTimeSlotVote(timeSlotId: string, userId?: string, memberId?: string): Promise<TimeSlotVote | undefined>;
  removeTimeSlotVote(timeSlotId: string, userId?: string, memberId?: string): Promise<void>;
  getItineraryTimeSlotVoteCounts(itineraryId: string): Promise<Array<{ 
    timeSlotId: string; 
    yesCount: number; 
    maybeCount: number; 
    noCount: number;
    yesVoters: string[];
    maybeVoters: string[];
    noVoters: string[];
  }>>;

  // Group Collections
  createGroupCollection(userId: string, collection: InsertGroupCollection): Promise<GroupCollection>;
  getUserGroupCollections(userId: string): Promise<GroupCollection[]>;
  updateGroupCollection(id: string, updates: UpdateGroupCollection): Promise<GroupCollection>;
  deleteGroupCollection(id: string): Promise<void>;
  reorderGroupCollections(collectionOrders: Array<{ id: string; orderIndex: number }>): Promise<void>;
  updateGroupCollectionAssignment(groupId: string, collectionId: string | null, orderIndex: number): Promise<void>;
  reorderGroupsInCollection(groupOrders: Array<{ id: string; orderIndex: number }>): Promise<void>;

  // Event Hosting
  toggleMemberHosting(memberId: string, openToHosting: boolean): Promise<Member>;
  volunteerToHost(itineraryId: string, memberId: string): Promise<Itinerary>;
  handOffHost(itineraryId: string, newHostMemberId: string): Promise<Itinerary>;
  getHostingAvailableMembers(groupId: string): Promise<Member[]>;

  // Category Search History
  saveCategorySearch(search: InsertCategorySearchHistory): Promise<CategorySearchHistory>;
  getRecentCategorySearches(groupId: string, limit?: number): Promise<CategorySearchHistory[]>;

  // Admin Stats
  getAdminStats(): Promise<{
    totalUsers: number;
    totalGroups: number;
    totalEvents: number;
    eventsHeld: number;
    activeGroups: number;
    repeatAttendanceRate: number;
    topCities: Array<{ city: string; eventCount: number }>;
    eventsPerWeek: Array<{ week: string; count: number }>;
    newVsReturning: { newAttendees: number; returningAttendees: number };
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First, delete any existing user with the same email but different ID
    // This handles the case where test users reuse the same email with different OIDC subs
    if (userData.email) {
      await db
        .delete(users)
        .where(
          and(
            eq(users.email, userData.email),
            sql`${users.id} != ${userData.id}`
          )
        );
    }
    
    // Now insert or update the user based on ID
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
        claimToken: randomBytes(16).toString('hex'), // Generate unique claim token for each member
        isOrganizer: index === 0, // First member is organizer
        invitationSent: false,
        hasJoined: false,
      }));

      await db.insert(members).values(membersData);
    }

    return group;
  }

  async getUserGroups(userId: string): Promise<Array<Group & { members: Array<{ id: string; name: string | null; email: string | null }> }>> {
    // Get groups where user is the organizer
    const organizedGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.userId, userId));

    // Get groups where user is a member
    const memberGroups = await db
      .selectDistinct()
      .from(groups)
      .innerJoin(members, eq(members.groupId, groups.id))
      .where(eq(members.userId, userId))
      .then(rows => rows.map(row => row.groups));

    // Combine and deduplicate by group ID
    const allGroups = [...organizedGroups, ...memberGroups];
    const uniqueGroups = Array.from(
      new Map(allGroups.map(g => [g.id, g])).values()
    );

    // Fetch members for each group (sanitized - only safe fields)
    const groupsWithMembers = await Promise.all(
      uniqueGroups.map(async (group) => {
        const groupMembers = await this.getGroupMembers(group.id);
        // Sanitize member data - only return safe fields for preview
        const sanitizedMembers = groupMembers.map(member => ({
          id: member.id,
          name: member.name,
          email: member.email,
          profileCompleted: member.userId === userId ? member.profileCompleted : undefined
        }));
        return {
          ...group,
          members: sanitizedMembers
        };
      })
    );

    return groupsWithMembers;
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

  async addRejectedVenue(groupId: string, venueName: string): Promise<void> {
    // Normalize venue name for consistent matching
    const normalized = venueName.trim().toLowerCase();
    
    // Atomic update: only append if not already present
    await db
      .update(groups)
      .set({
        rejectedVenues: sql`CASE 
          WHEN ${groups.rejectedVenues} IS NULL THEN ARRAY[${normalized}]::text[]
          WHEN NOT ${groups.rejectedVenues} @> ARRAY[${normalized}]::text[] THEN array_append(${groups.rejectedVenues}, ${normalized})
          ELSE ${groups.rejectedVenues}
        END`
      })
      .where(eq(groups.id, groupId));
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

  async getUserVotes(userId: string): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.userId, userId));
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
    const results = await db
      .insert(itineraries)
      .values({ ...insertItinerary, createdBy: userId })
      .returning() as Itinerary[];
    const itinerary = results[0];

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
      .where(and(
        eq(itineraries.groupId, groupId),
        eq(itineraries.isSaved, false)
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

  async addItineraryItems(itineraryId: string, items: Array<{sourceType: 'activity' | 'voting_event', sourceId: string}>): Promise<ItineraryItem[]> {
    const itemsToInsert: InsertItineraryItem[] = [];
    
    // Get current max order index
    const existingItems = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, itineraryId));
    
    const maxOrderIndex = existingItems.length > 0 
      ? Math.max(...existingItems.map(item => item.orderIndex || 0))
      : -1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
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
        itineraryId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        venueName,
        venueAddress,
        venueType,
        googlePlaceId,
        rating,
        photoUrl,
        orderIndex: maxOrderIndex + 1 + i,
      });
    }

    if (itemsToInsert.length > 0) {
      return await db.insert(itineraryItems).values(itemsToInsert).returning();
    }
    
    return [];
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

  async getProposedItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[], rsvps: Rsvp[], proposedTimeSlots?: any[] }>> {
    // Get all itineraries that have been sent (have invite records)
    const itinerariesWithInvites = await db
      .selectDistinct({ itineraryId: itineraryInvites.itineraryId })
      .from(itineraryInvites)
      .innerJoin(itineraries, eq(itineraries.id, itineraryInvites.itineraryId))
      .where(eq(itineraries.groupId, groupId));

    const itineraryIds = itinerariesWithInvites.map(i => i.itineraryId);

    if (itineraryIds.length === 0) {
      return [];
    }

    // Fetch the full itinerary data for those that have invites
    const foundItineraries = await db
      .select()
      .from(itineraries)
      .where(and(
        eq(itineraries.groupId, groupId),
        or(eq(itineraries.status, 'proposed'), eq(itineraries.status, 'scheduled')),
        inArray(itineraries.id, itineraryIds)
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

      // Get proposed time slots if any
      const timeSlots = await this.getItineraryTimeSlots(itinerary.id);
      
      // Get vote counts for all time slots
      const voteCounts = await this.getItineraryTimeSlotVoteCounts(itinerary.id);

      // Combine time slots with their vote counts
      const timeSlotsWithVotes = timeSlots.map((slot) => {
        const counts = voteCounts.find(vc => vc.timeSlotId === slot.id);
        return {
          ...slot,
          yesCount: counts?.yesCount || 0,
          maybeCount: counts?.maybeCount || 0,
          noCount: counts?.noCount || 0,
          yesVoters: counts?.yesVoters || [],
          maybeVoters: counts?.maybeVoters || [],
          noVoters: counts?.noVoters || [],
        };
      });

      result.push({ ...itinerary, items, rsvps: itineraryRsvps, proposedTimeSlots: timeSlotsWithVotes });
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

  // Auto-scheduled Events
  async createAutoScheduledEvent(event: InsertAutoScheduledEvent): Promise<AutoScheduledEvent> {
    const [autoEvent] = await db
      .insert(autoScheduledEvents)
      .values(event)
      .returning();
    return autoEvent;
  }

  async getPendingAutoScheduledEvent(groupId: string): Promise<AutoScheduledEvent | undefined> {
    const [event] = await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.groupId, groupId),
        eq(autoScheduledEvents.status, 'pending')
      ))
      .orderBy(desc(autoScheduledEvents.createdAt))
      .limit(1);
    return event;
  }

  async getAutoScheduledEvent(id: string): Promise<AutoScheduledEvent | undefined> {
    const [event] = await db
      .select()
      .from(autoScheduledEvents)
      .where(eq(autoScheduledEvents.id, id));
    return event;
  }

  async updateAutoScheduledEventStatus(id: string, status: string): Promise<AutoScheduledEvent> {
    const [event] = await db
      .update(autoScheduledEvents)
      .set({ status })
      .where(eq(autoScheduledEvents.id, id))
      .returning();
    return event;
  }

  async getAutoScheduledEventsReadyForAutoSend(): Promise<AutoScheduledEvent[]> {
    const now = new Date();
    return await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.status, 'pending'),
        sql`${autoScheduledEvents.autoSendAt} <= ${now}`
      ));
  }

  // Frequency Feedback
  async createFrequencyFeedback(feedback: InsertFrequencyFeedback): Promise<FrequencyFeedback> {
    const [created] = await db
      .insert(frequencyFeedback)
      .values(feedback)
      .returning();
    return created;
  }

  async getGroupFrequencyFeedback(groupId: string): Promise<FrequencyFeedback[]> {
    return await db
      .select()
      .from(frequencyFeedback)
      .where(eq(frequencyFeedback.groupId, groupId))
      .orderBy(desc(frequencyFeedback.createdAt));
  }

  // User Profiles
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return profile;
  }

  async upsertUserProfile(userId: string, profile: InsertUserProfile): Promise<UserProfile> {
    const [result] = await db
      .insert(userProfiles)
      .values({ ...profile, userId })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          ...profile,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // Proposed Time Slots
  async createProposedTimeSlot(timeSlot: InsertProposedTimeSlot): Promise<ProposedTimeSlot> {
    const [result] = await db.insert(proposedTimeSlots).values(timeSlot).returning();
    return result;
  }

  async createProposedTimeSlots(timeSlots: InsertProposedTimeSlot[]): Promise<ProposedTimeSlot[]> {
    if (timeSlots.length === 0) return [];
    const results = await db.insert(proposedTimeSlots).values(timeSlots).returning();
    return results;
  }

  async getTimeSlot(timeSlotId: string): Promise<ProposedTimeSlot | undefined> {
    const [result] = await db.select().from(proposedTimeSlots).where(eq(proposedTimeSlots.id, timeSlotId));
    return result;
  }

  async getItineraryTimeSlots(itineraryId: string): Promise<ProposedTimeSlot[]> {
    return await db.select().from(proposedTimeSlots).where(eq(proposedTimeSlots.itineraryId, itineraryId)).orderBy(proposedTimeSlots.proposedDateTime);
  }

  async updateTimeSlotSelection(timeSlotId: string, isSelected: boolean): Promise<ProposedTimeSlot> {
    const [result] = await db
      .update(proposedTimeSlots)
      .set({ isSelected })
      .where(eq(proposedTimeSlots.id, timeSlotId))
      .returning();
    return result;
  }

  async deleteTimeSlot(timeSlotId: string): Promise<void> {
    await db.delete(proposedTimeSlots).where(eq(proposedTimeSlots.id, timeSlotId));
  }

  // Time Slot Votes
  async voteForTimeSlot(vote: InsertTimeSlotVote): Promise<TimeSlotVote> {
    const existing = await this.getUserTimeSlotVote(vote.timeSlotId, vote.userId || undefined, vote.memberId || undefined);
    
    if (existing) {
      const [result] = await db
        .update(timeSlotVotes)
        .set({ ...vote, createdAt: new Date() })
        .where(eq(timeSlotVotes.id, existing.id))
        .returning();
      return result;
    }

    const [result] = await db.insert(timeSlotVotes).values(vote).returning();
    return result;
  }

  async getTimeSlotVotes(timeSlotId: string): Promise<TimeSlotVote[]> {
    return await db.select().from(timeSlotVotes).where(eq(timeSlotVotes.timeSlotId, timeSlotId));
  }

  async getUserTimeSlotVote(timeSlotId: string, userId?: string, memberId?: string): Promise<TimeSlotVote | undefined> {
    const conditions = [eq(timeSlotVotes.timeSlotId, timeSlotId)];
    
    if (userId) {
      conditions.push(eq(timeSlotVotes.userId, userId));
    } else if (memberId) {
      conditions.push(eq(timeSlotVotes.memberId, memberId));
    } else {
      return undefined;
    }

    const [vote] = await db.select().from(timeSlotVotes).where(and(...conditions));
    return vote;
  }

  async removeTimeSlotVote(timeSlotId: string, userId?: string, memberId?: string): Promise<void> {
    const conditions = [eq(timeSlotVotes.timeSlotId, timeSlotId)];
    
    if (userId) {
      conditions.push(eq(timeSlotVotes.userId, userId));
    } else if (memberId) {
      conditions.push(eq(timeSlotVotes.memberId, memberId));
    } else {
      return;
    }

    await db.delete(timeSlotVotes).where(and(...conditions));
  }

  async getItineraryTimeSlotVoteCounts(itineraryId: string): Promise<Array<{ 
    timeSlotId: string; 
    yesCount: number; 
    maybeCount: number; 
    noCount: number;
    yesVoters: string[];
    maybeVoters: string[];
    noVoters: string[];
  }>> {
    const result = await db
      .select({
        timeSlotId: timeSlotVotes.timeSlotId,
        yesCount: sql<number>`count(*) FILTER (WHERE ${timeSlotVotes.voteType} = 'yes')::int`,
        maybeCount: sql<number>`count(*) FILTER (WHERE ${timeSlotVotes.voteType} = 'maybe')::int`,
        noCount: sql<number>`count(*) FILTER (WHERE ${timeSlotVotes.voteType} = 'no')::int`,
        yesVoters: sql<string[]>`array_agg(DISTINCT COALESCE(${userProfiles.displayName}, concat_ws(' ', ${users.firstName}, ${users.lastName}), ${members.name}, ${users.email})) FILTER (WHERE ${timeSlotVotes.voteType} = 'yes')`,
        maybeVoters: sql<string[]>`array_agg(DISTINCT COALESCE(${userProfiles.displayName}, concat_ws(' ', ${users.firstName}, ${users.lastName}), ${members.name}, ${users.email})) FILTER (WHERE ${timeSlotVotes.voteType} = 'maybe')`,
        noVoters: sql<string[]>`array_agg(DISTINCT COALESCE(${userProfiles.displayName}, concat_ws(' ', ${users.firstName}, ${users.lastName}), ${members.name}, ${users.email})) FILTER (WHERE ${timeSlotVotes.voteType} = 'no')`,
      })
      .from(timeSlotVotes)
      .innerJoin(proposedTimeSlots, eq(timeSlotVotes.timeSlotId, proposedTimeSlots.id))
      .leftJoin(members, eq(timeSlotVotes.memberId, members.id))
      .leftJoin(userProfiles, eq(timeSlotVotes.userId, userProfiles.userId))
      .leftJoin(users, eq(timeSlotVotes.userId, users.id))
      .where(eq(proposedTimeSlots.itineraryId, itineraryId))
      .groupBy(timeSlotVotes.timeSlotId);
    
    // Clean up the voter arrays (remove null entries)
    return result.map(r => ({
      ...r,
      yesVoters: (r.yesVoters || []).filter(name => name && name.trim()),
      maybeVoters: (r.maybeVoters || []).filter(name => name && name.trim()),
      noVoters: (r.noVoters || []).filter(name => name && name.trim()),
    }));
  }

  // Group Collections
  async createGroupCollection(userId: string, collection: InsertGroupCollection): Promise<GroupCollection> {
    const [result] = await db.insert(groupCollections).values({
      ...collection,
      userId,
    }).returning();
    return result;
  }

  async getUserGroupCollections(userId: string): Promise<GroupCollection[]> {
    return await db
      .select()
      .from(groupCollections)
      .where(eq(groupCollections.userId, userId))
      .orderBy(groupCollections.orderIndex);
  }

  async updateGroupCollection(id: string, updates: UpdateGroupCollection): Promise<GroupCollection> {
    const [result] = await db
      .update(groupCollections)
      .set(updates)
      .where(eq(groupCollections.id, id))
      .returning();
    return result;
  }

  async deleteGroupCollection(id: string): Promise<void> {
    // When a collection is deleted, set all groups' collectionId to null
    await db
      .update(groups)
      .set({ collectionId: null })
      .where(eq(groups.collectionId, id));
    
    // Then delete the collection
    await db.delete(groupCollections).where(eq(groupCollections.id, id));
  }

  async reorderGroupCollections(collectionOrders: Array<{ id: string; orderIndex: number }>): Promise<void> {
    // Update each collection's order in a transaction-like manner
    for (const { id, orderIndex } of collectionOrders) {
      await db
        .update(groupCollections)
        .set({ orderIndex })
        .where(eq(groupCollections.id, id));
    }
  }

  async updateGroupCollectionAssignment(groupId: string, collectionId: string | null, orderIndex: number): Promise<void> {
    await db
      .update(groups)
      .set({ 
        collectionId, 
        orderIndex 
      })
      .where(eq(groups.id, groupId));
  }

  async reorderGroupsInCollection(groupOrders: Array<{ id: string; orderIndex: number }>): Promise<void> {
    // Update each group's order within its collection
    for (const { id, orderIndex } of groupOrders) {
      await db
        .update(groups)
        .set({ orderIndex })
        .where(eq(groups.id, id));
    }
  }

  // Event Hosting
  async toggleMemberHosting(memberId: string, openToHosting: boolean): Promise<Member> {
    const [result] = await db
      .update(members)
      .set({ openToHosting })
      .where(eq(members.id, memberId))
      .returning();
    return result;
  }

  async volunteerToHost(itineraryId: string, memberId: string): Promise<Itinerary> {
    const [result] = await db
      .update(itineraries)
      .set({ hostMemberId: memberId })
      .where(eq(itineraries.id, itineraryId))
      .returning();
    return result;
  }

  async handOffHost(itineraryId: string, newHostMemberId: string): Promise<Itinerary> {
    const [result] = await db
      .update(itineraries)
      .set({ hostMemberId: newHostMemberId })
      .where(eq(itineraries.id, itineraryId))
      .returning();
    return result;
  }

  async getHostingAvailableMembers(groupId: string): Promise<Member[]> {
    return await db
      .select()
      .from(members)
      .where(
        and(
          eq(members.groupId, groupId),
          eq(members.openToHosting, true)
        )
      );
  }

  // Category Search History
  async saveCategorySearch(search: InsertCategorySearchHistory): Promise<CategorySearchHistory> {
    const [result] = await db
      .insert(categorySearchHistory)
      .values(search)
      .returning();
    return result;
  }

  async getRecentCategorySearches(groupId: string, limit: number = 5): Promise<CategorySearchHistory[]> {
    return await db
      .select()
      .from(categorySearchHistory)
      .where(eq(categorySearchHistory.groupId, groupId))
      .orderBy(desc(categorySearchHistory.createdAt))
      .limit(limit);
  }

  async getAdminStats() {
    // Total users (authenticated + unclaimed members with unique emails)
    // Avoid double-counting: count members whose emails don't exist in users table
    const [authUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    const authUsersCount = Number(authUsersResult.count);

    const [unclaimedMemberEmailsResult] = await db
      .select({ count: sql<number>`count(DISTINCT ${members.email})` })
      .from(members)
      .where(
        and(
          sql`${members.email} IS NOT NULL`,
          sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.email} IS NOT NULL AND ${users.email} = ${members.email})`
        )
      );
    const unclaimedMemberEmails = Number(unclaimedMemberEmailsResult.count);
    
    const totalUsers = authUsersCount + unclaimedMemberEmails;

    // Total groups
    const [groupsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(groups);
    const totalGroups = Number(groupsResult.count);

    // Total events (all itineraries)
    const [eventsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(itineraries);
    const totalEvents = Number(eventsResult.count);

    // Events held (past events with confirmed dates)
    const [eventsHeldResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(itineraries)
      .where(
        and(
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`
        )
      );
    const eventsHeld = Number(eventsHeldResult.count);

    // Active groups (groups with events held in last 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const now = new Date();
    
    const [activeGroupsResult] = await db
      .select({ count: sql<number>`count(DISTINCT ${itineraries.groupId})` })
      .from(itineraries)
      .where(
        and(
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${sixtyDaysAgo.toISOString()}`,
          sql`${itineraries.eventDate} <= ${now.toISOString()}`
        )
      );
    const activeGroups = Number(activeGroupsResult.count);

    // Repeat attendance rate (% of users who attended 2+ events)
    // Count users with 2+ "yes" RSVPs
    const usersWithMultipleAttendances = await db
      .select({
        userId: rsvps.userId,
        memberId: rsvps.memberId,
        count: sql<number>`count(*)`
      })
      .from(rsvps)
      .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
      .where(
        and(
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`
        )
      )
      .groupBy(rsvps.userId, rsvps.memberId)
      .having(sql`count(*) >= 2`);

    const repeatAttenders = usersWithMultipleAttendances.length;
    
    // Total unique attendees (users or members with at least 1 "yes" RSVP to past event)
    const [totalAttendeesResult] = await db
      .select({ 
        count: sql<number>`count(DISTINCT COALESCE(${rsvps.userId}, ${rsvps.memberId}))` 
      })
      .from(rsvps)
      .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
      .where(
        and(
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`
        )
      );
    
    const totalAttendees = Number(totalAttendeesResult.count);
    const repeatAttendanceRate = totalAttendees > 0 ? (repeatAttenders / totalAttendees) * 100 : 0;

    // Top cities by event count (extract city from group location)
    const cityEvents = await db
      .select({
        location: groups.locationBase,
        eventCount: sql<number>`count(${itineraries.id})`
      })
      .from(groups)
      .leftJoin(itineraries, eq(groups.id, itineraries.groupId))
      .where(sql`${itineraries.eventDate} IS NOT NULL`)
      .groupBy(groups.locationBase)
      .orderBy(desc(sql`count(${itineraries.id})`))
      .limit(10);

    const topCities = cityEvents.map(row => ({
      city: row.location || 'Unknown',
      eventCount: Number(row.eventCount)
    }));

    // Events per week (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const weeklyEvents = await db
      .select({
        week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${itineraries.eventDate}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`
      })
      .from(itineraries)
      .where(
        and(
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${ninetyDaysAgo.toISOString()}`
        )
      )
      .groupBy(sql`DATE_TRUNC('week', ${itineraries.eventDate})`)
      .orderBy(sql`DATE_TRUNC('week', ${itineraries.eventDate})`);

    const eventsPerWeek = weeklyEvents.map(row => ({
      week: row.week,
      count: Number(row.count)
    }));

    // New vs returning attendees this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get all attendees this month
    const thisMonthAttendees = await db
      .select({
        userId: rsvps.userId,
        memberId: rsvps.memberId
      })
      .from(rsvps)
      .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
      .where(
        and(
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} >= ${startOfMonth.toISOString()}`
        )
      );

    // For each attendee, check if they had prior attendance
    let newAttendees = 0;
    let returningAttendees = 0;

    for (const attendee of thisMonthAttendees) {
      const priorAttendance = await db
        .select({ count: sql<number>`count(*)` })
        .from(rsvps)
        .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
        .where(
          and(
            eq(rsvps.response, 'yes'),
            sql`${itineraries.eventDate} < ${startOfMonth.toISOString()}`,
            attendee.userId 
              ? eq(rsvps.userId, attendee.userId)
              : eq(rsvps.memberId, attendee.memberId!)
          )
        );

      if (Number(priorAttendance[0].count) > 0) {
        returningAttendees++;
      } else {
        newAttendees++;
      }
    }

    return {
      totalUsers,
      totalGroups,
      totalEvents,
      eventsHeld,
      activeGroups,
      repeatAttendanceRate: Math.round(repeatAttendanceRate * 10) / 10, // Round to 1 decimal
      topCities,
      eventsPerWeek,
      newVsReturning: {
        newAttendees,
        returningAttendees
      }
    };
  }
}

export const storage = new DatabaseStorage();