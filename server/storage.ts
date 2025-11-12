// Reference: javascript_database blueprint
// Reference: javascript_log_in_with_replit blueprint
import {
  users, groups, members, memberGroupPreferences, activities, votingEvents, votes, preferenceSignals, itineraries, itineraryItems, rsvps, itineraryInvites, reminderLogs, autoScheduledEvents, frequencyFeedback, venueVisitHistory, userProfiles, proposedTimeSlots, timeSlotVotes, groupCollections, categorySearchHistory, hostAssignments, groupBackups, databaseBackups, scrapedVenuesImport, curatedVenues, seenActivities,
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
  type VenueVisitHistory, type InsertVenueVisitHistory,
  type UserProfile, type InsertUserProfile, type UpdateUserProfile,
  type ProposedTimeSlot, type InsertProposedTimeSlot,
  type TimeSlotVote, type InsertTimeSlotVote,
  type GroupCollection, type InsertGroupCollection, type UpdateGroupCollection,
  type CategorySearchHistory, type InsertCategorySearchHistory,
  type HostAssignment, type InsertHostAssignment,
  type GroupBackup, type InsertGroupBackup,
  type DatabaseBackup, type InsertDatabaseBackup,
  type MemberGroupPreferences, type InsertMemberGroupPreferences
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, inArray, isNull, isNotNull } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Groups
  createGroup(group: InsertGroup, userId: string, memberInputs: Array<{name?: string, email?: string}>): Promise<Group>;
  getGroup(id: string): Promise<Group | undefined>;
  getGroupByShareableLink(link: string): Promise<Group | undefined>;
  getUserGroups(userId: string): Promise<Array<Group & { members: Array<{ id: string; name: string | null; email: string | null }> }>>;
  getAllGroups(): Promise<Group[]>;
  updateGroup(id: string, updates: UpdateGroup): Promise<Group>;
  softDeleteGroup(id: string): Promise<void>;
  hardDeleteGroup(id: string): Promise<void>;
  cleanupOrphanedVotingData(): Promise<{ votingEventsDeleted: number; votesDeleted: number }>;
  updateGroupStatus(id: string, status: string, error?: string): Promise<void>;
  addRejectedVenue(groupId: string, venueName: string): Promise<void>;

  // Members
  getGroupMembers(groupId: string): Promise<Member[]>;
  getMember(id: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(id: string, updates: UpdateMember): Promise<Member>;
  deleteMember(id: string): Promise<void>;
  markInvitationsSent(groupId: string): Promise<void>;

  // Member Group Preferences
  getMemberGroupPreferences(userId: string, groupId: string): Promise<MemberGroupPreferences | undefined>;
  upsertMemberGroupPreferences(userId: string, groupId: string, preferences: Partial<InsertMemberGroupPreferences>): Promise<MemberGroupPreferences>;

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

  // Venue Visit Tracking
  logVenueVisits(itineraryId: string, eventDate: Date): Promise<void>;
  getVenueVisitHistory(groupId: string): Promise<any[]>;

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
  getPendingAutoScheduledEvents(groupId: string): Promise<Array<AutoScheduledEvent & { itinerary?: Itinerary & { items: ItineraryItem[] } }>>;
  getAutoScheduledEvent(id: string): Promise<AutoScheduledEvent | undefined>;
  updateAutoScheduledEventStatus(id: string, status: string): Promise<AutoScheduledEvent>;
  getAutoScheduledEventsReadyForAutoSend(): Promise<AutoScheduledEvent[]>;
  hasExistingProposedEvents(groupId: string): Promise<boolean>;
  getUserUpcomingEventsWithTimeSlots(userId: string, startDate?: Date, endDate?: Date): Promise<Array<{
    groupId: string;
    groupName: string;
    eventDate: Date;
    timePeriod: 'morning' | 'afternoon' | 'evening';
  }>>;

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
  
  // Host Assignments (rotating host system)
  createHostAssignment(groupId: string, memberId: string, itineraryId?: string): Promise<any>;
  getPendingHostAssignment(groupId: string): Promise<any>;
  getMemberHostAssignments(memberId: string): Promise<any[]>;
  respondToHostAssignment(assignmentId: string, accepted: boolean, memberId: string): Promise<any>;
  getNextHostVolunteer(groupId: string, excludeMemberIds?: string[]): Promise<Member | null>;

  // Category Search History
  saveCategorySearch(search: InsertCategorySearchHistory): Promise<CategorySearchHistory>;
  getRecentCategorySearches(groupId: string, limit?: number): Promise<CategorySearchHistory[]>;

  // Database Backups
  createDatabaseBackup(backupType: string, createdBy?: string, notes?: string): Promise<any>;
  getAllDatabaseBackups(): Promise<any[]>;
  getDatabaseBackup(backupId: string): Promise<any | undefined>;
  restoreDatabaseBackup(backupId: string): Promise<void>;
  pruneDatabaseBackups(keepCount: number): Promise<void>;

  // Admin Stats
  getAdminStats(includeTestData?: boolean): Promise<{
    registeredUsers: number;
    invitedMembers: number;
    totalGroups: number;
    totalEvents: number;
    eventsHeld: number;
    activeGroups: number;
    repeatAttendanceRate: number;
    topCities: Array<{ city: string; eventCount: number }>;
    eventsPerWeek: Array<{ week: string; count: number }>;
    newVsReturning: { newAttendees: number; returningAttendees: number };
  }>;

  // Scraped Venues Import
  clearScrapedImport(): Promise<void>;
  insertScrapedVenues(venues: Array<any>): Promise<void>;
  getScrapedVenuesComparison(): Promise<{
    totalScraped: number;
    alreadyInDb: number;
    newVenues: number;
    matchedVenues: Array<{ scrapedName: string; dbName: string; googlePlaceId: string; source: string }>;
    newVenuesList: Array<{ name: string; address: string; category?: string; rating?: number; googlePlaceId?: string }>;
  }>;

  // Seen Activities
  markVenuesAsSeen(groupId: string, venues: Array<{venueName: string, googlePlaceId?: string, category: string}>): Promise<void>;
  getSeenVenues(groupId: string): Promise<Array<{venueName: string, googlePlaceId?: string, category: string}>>;

  // Curated Venues Management
  getAllCuratedVenues(): Promise<Array<{id: string; name: string; category: string; tags: string[] | null}>>;
  updateVenueCategory(id: string, category: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
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
  async createGroup(insertGroup: InsertGroup, userId: string, memberInputs: Array<{name?: string, email?: string}>): Promise<Group> {
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
        userId: index === 0 ? userId : null, // Set userId for organizer only
        invitationSent: false,
        hasJoined: false,
      }));

      await db.insert(members).values(membersData);
    }

    // Automatically backup after creation
    await this.createAutomaticBackup(group.id, userId, 'create');

    return group;
  }

  async getUserGroups(userId: string): Promise<Array<Group & { members: Array<{ id: string; name: string | null; email: string | null }> }>> {
    // RECONCILIATION STEP: Reclaim orphaned data where user memberships were nulled
    // This happens when user record was deleted/recreated during auth issues
    const user = await db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0]);
    if (user?.email) {
      // 1. Find and re-link orphaned organizer groups (where groups.userId is null)
      const orphanedGroups = await db
        .selectDistinct()
        .from(groups)
        .innerJoin(members, eq(members.groupId, groups.id))
        .where(and(
          isNull(groups.userId), // Group has no owner
          eq(members.isOrganizer, true), // Member is marked as organizer
          eq(members.email, user.email), // Email matches current user
          isNull(groups.deletedAt) // Not soft-deleted
        ))
        .then(rows => rows.map(row => row.groups));

      if (orphanedGroups.length > 0) {
        console.log(`[Reconciliation] Re-linking ${orphanedGroups.length} orphaned groups to user ${userId} (${user.email})`);
        await db
          .update(groups)
          .set({ userId })
          .where(inArray(groups.id, orphanedGroups.map(g => g.id)));
      }

      // 2. Find and re-link ALL orphaned member records (organizer AND regular members)
      const orphanedMembers = await db
        .select()
        .from(members)
        .where(and(
          isNull(members.userId), // Member has no linked user
          eq(members.email, user.email) // Email matches current user
        ));

      if (orphanedMembers.length > 0) {
        console.log(`[Reconciliation] Re-linking ${orphanedMembers.length} orphaned member records to user ${userId} (${user.email})`);
        await db
          .update(members)
          .set({ userId })
          .where(inArray(members.id, orphanedMembers.map(m => m.id)));
      }
    }

    // Get groups where user is the organizer (exclude soft-deleted)
    const organizedGroups = await db
      .select()
      .from(groups)
      .where(and(eq(groups.userId, userId), isNull(groups.deletedAt)));

    // Get groups where user is a member (exclude soft-deleted)
    const memberGroups = await db
      .selectDistinct()
      .from(groups)
      .innerJoin(members, eq(members.groupId, groups.id))
      .where(and(eq(members.userId, userId), isNull(groups.deletedAt)))
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
    const [group] = await db.select().from(groups).where(and(eq(groups.id, id), isNull(groups.deletedAt)));
    return group || undefined;
  }

  async getGroupByShareableLink(link: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(and(eq(groups.shareableLink, link), isNull(groups.deletedAt)));
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

    // Automatically backup after update (even if userId is null - orphaned groups still get backups)
    await this.createAutomaticBackup(group.id, group.userId, 'update');

    return group;
  }

  /**
   * Soft delete a group and clean up associated voting events
   * This prevents orphaned favorited venues from appearing in other groups
   */
  async softDeleteGroup(id: string): Promise<void> {
    // Create backup before deletion
    const group = await this.getGroup(id);
    if (group) {
      await this.createAutomaticBackup(group.id, group.userId, 'delete');
    }

    // Get all voting event IDs for this group before deletion
    const eventsToDelete = await db
      .select({ id: votingEvents.id })
      .from(votingEvents)
      .where(eq(votingEvents.groupId, id));

    const eventIds = eventsToDelete.map(e => e.id);

    // Delete orphaned votes first (before deleting the voting events they reference)
    if (eventIds.length > 0) {
      await db
        .delete(votes)
        .where(inArray(votes.eventId, eventIds));
    }

    // Hard delete associated voting events to prevent orphans
    await db
      .delete(votingEvents)
      .where(eq(votingEvents.groupId, id));

    // Soft delete the group
    await db
      .update(groups)
      .set({ deletedAt: sql`now()` })
      .where(eq(groups.id, id));

    console.log(`[Soft Delete] Group ${id} soft-deleted, ${eventIds.length} voting events and associated votes cleaned up`);
  }

  /**
   * Clean up orphaned voting data from deleted groups
   * Finds voting events that belong to soft-deleted groups and removes them along with associated votes
   */
  async cleanupOrphanedVotingData(): Promise<{ votingEventsDeleted: number; votesDeleted: number }> {
    // Find voting events that belong to deleted groups
    const orphanedEvents = await db
      .select({ id: votingEvents.id })
      .from(votingEvents)
      .leftJoin(groups, eq(votingEvents.groupId, groups.id))
      .where(or(
        isNull(groups.id), // group doesn't exist at all
        isNotNull(groups.deletedAt) // group is soft deleted
      ));

    const orphanedEventIds = orphanedEvents.map(e => e.id);

    let votesDeleted = 0;
    let votingEventsDeleted = 0;

    if (orphanedEventIds.length > 0) {
      // Delete orphaned votes first
      const deletedVotes = await db
        .delete(votes)
        .where(inArray(votes.eventId, orphanedEventIds))
        .returning();

      votesDeleted = deletedVotes.length;

      // Delete orphaned voting events
      const deletedEvents = await db
        .delete(votingEvents)
        .where(inArray(votingEvents.id, orphanedEventIds))
        .returning();

      votingEventsDeleted = deletedEvents.length;

      console.log(`[Cleanup] Removed ${votingEventsDeleted} orphaned voting events and ${votesDeleted} orphaned votes`);
    } else {
      console.log(`[Cleanup] No orphaned voting data found`);
    }

    // Also clean up votes that reference non-existent voting events
    const orphanedVotes = await db
      .select({ id: votes.id })
      .from(votes)
      .leftJoin(votingEvents, eq(votes.eventId, votingEvents.id))
      .where(isNull(votingEvents.id));

    if (orphanedVotes.length > 0) {
      const orphanedVoteIds = orphanedVotes.map(v => v.id);
      const additionalDeletedVotes = await db
        .delete(votes)
        .where(inArray(votes.id, orphanedVoteIds))
        .returning();

      votesDeleted += additionalDeletedVotes.length;
      console.log(`[Cleanup] Removed ${additionalDeletedVotes.length} additional votes referencing non-existent events`);
    }

    return { votingEventsDeleted, votesDeleted };
  }

  /**
   * Permanently delete a group and all associated data
   * Creates backup before deletion. CASCADE deletes will handle all related data.
   * WARNING: This is irreversible!
   */
  async hardDeleteGroup(id: string): Promise<void> {
    // Create backup before deletion
    const group = await this.getGroup(id);
    if (group) {
      await this.createAutomaticBackup(group.id, group.userId, 'hard_delete');
      console.log(`[Hard Delete] Created backup for group ${id}`);
    }

    // Hard delete the group - CASCADE deletes will automatically remove:
    // - members, activities, votingEvents, votes, itineraries, rsvps,
    // - itineraryItems, invites, preferenceSignals, seenActivities,
    // - categorySearchHistory, autoScheduledEvents, frequencyFeedback, etc.
    await db
      .delete(groups)
      .where(eq(groups.id, id));

    console.log(`[Hard Delete] Group ${id} permanently deleted with all associated data`);
  }

  // Automatic backup function - creates snapshot of group data
  async createAutomaticBackup(groupId: string, userId: string | null, trigger: string): Promise<void> {
    try {
      // Get complete group data
      const group = await this.getGroup(groupId);
      if (!group) return;
      
      const groupMembers = await this.getGroupMembers(groupId);
      
      // Create snapshot
      const snapshotData = {
        group,
        members: groupMembers,
        backedUpAt: new Date().toISOString(),
      };
      
      await db.insert(groupBackups).values({
        userId,
        groupId,
        snapshotData: snapshotData as any,
        backupTrigger: trigger,
      });
      
      // Keep only last 10 backups per group (use groupId only for orphaned groups)
      const whereClause = userId 
        ? and(eq(groupBackups.userId, userId), eq(groupBackups.groupId, groupId))
        : eq(groupBackups.groupId, groupId);
      
      const allBackups = await db
        .select()
        .from(groupBackups)
        .where(whereClause)
        .orderBy(desc(groupBackups.createdAt));
      
      if (allBackups.length > 10) {
        const toDelete = allBackups.slice(10);
        await db.delete(groupBackups).where(
          inArray(groupBackups.id, toDelete.map(b => b.id))
        );
      }
    } catch (error) {
      console.error(`Failed to create automatic backup for group ${groupId}:`, error);
      // Don't throw - backups shouldn't break main operations
    }
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

  // Member Group Preferences operations
  async getMemberGroupPreferences(userId: string, groupId: string): Promise<MemberGroupPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(memberGroupPreferences)
      .where(
        and(
          eq(memberGroupPreferences.userId, userId),
          eq(memberGroupPreferences.groupId, groupId)
        )
      );
    return preferences || undefined;
  }

  async upsertMemberGroupPreferences(
    userId: string,
    groupId: string,
    preferences: Partial<InsertMemberGroupPreferences>
  ): Promise<MemberGroupPreferences> {
    // First try to get existing preferences
    const existing = await this.getMemberGroupPreferences(userId, groupId);

    if (existing) {
      // Update existing preferences
      const [updated] = await db
        .update(memberGroupPreferences)
        .set({
          ...preferences,
          updatedAt: new Date(),
        })
        .where(eq(memberGroupPreferences.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new preferences
      const [created] = await db
        .insert(memberGroupPreferences)
        .values({
          userId,
          groupId,
          ...preferences,
        })
        .returning();
      return created;
    }
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
        city: votingEvents.city,
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
      .innerJoin(groups, eq(votingEvents.groupId, groups.id))
      .leftJoin(votes, eq(votingEvents.id, votes.eventId))
      .where(isNull(groups.deletedAt))
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
        city: votingEvents.city,
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
      .innerJoin(groups, eq(votingEvents.groupId, groups.id))
      .leftJoin(votes, eq(votingEvents.id, votes.eventId))
      .where(and(
        eq(votingEvents.groupId, groupId),
        isNull(groups.deletedAt)
      ))
      .groupBy(votingEvents.id)
      .orderBy(desc(sql`COUNT(CASE WHEN ${votes.voteType} = 'upvote' THEN 1 END) - COUNT(CASE WHEN ${votes.voteType} = 'downvote' THEN 1 END)`));

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

  async createItinerary(insertItinerary: InsertItinerary, userId: string, itemsData: Array<{sourceType: 'activity' | 'voting_event' | 'ad_hoc', sourceId: string, adHocData?: any}>): Promise<Itinerary> {
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
        let latitude = null;
        let longitude = null;
        let notes = null;
        let googleMapsUrl = null;
        let arrivalTime = null;
        let departureTime = null;
        let travelNotes = null;

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
        } else if (item.sourceType === 'voting_event') {
          const [votingEvent] = await db.select().from(votingEvents).where(eq(votingEvents.id, item.sourceId));
          if (votingEvent) {
            venueName = votingEvent.title;
            venueAddress = votingEvent.venueAddress || '';
            venueType = votingEvent.venueType || 'venue';
            googlePlaceId = votingEvent.googlePlaceId;
            rating = votingEvent.rating;
            photoUrl = votingEvent.photoUrl;
          }
        } else if (item.sourceType === 'ad_hoc' && item.adHocData) {
          // Handle ad-hoc venue
          venueName = item.adHocData.name;
          venueAddress = item.adHocData.address || '';
          venueType = 'venue';
          googlePlaceId = item.adHocData.googlePlaceId || null;
          notes = item.adHocData.notes || null;
          googleMapsUrl = item.adHocData.googleMapsUrl || null;
          arrivalTime = item.adHocData.arrivalTime || null;
          departureTime = item.adHocData.departureTime || null;
          travelNotes = item.adHocData.travelNotes || null;

          // Try to geocode if we have an address but no coordinates
          if (venueAddress) {
            try {
              const geocoded = await geocodeLocation(venueAddress);
              if (geocoded) {
                latitude = geocoded.lat.toString();
                longitude = geocoded.lng.toString();
              }
            } catch (error) {
              console.error('[Create Itinerary] Error geocoding ad-hoc venue:', error);
            }
          }
        }

        itemsToInsert.push({
          itineraryId: itinerary.id,
          sourceType: item.sourceType,
          sourceId: item.sourceType === 'ad_hoc' ? null : item.sourceId,
          venueName,
          venueAddress,
          venueType,
          googlePlaceId,
          rating,
          photoUrl,
          latitude,
          longitude,
          notes,
          googleMapsUrl,
          arrivalTime,
          departureTime,
          travelNotes,
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

  async addAdHocVenueToItinerary(
    itineraryId: string,
    venue: {
      venueName: string;
      venueAddress: string;
      venueType: string;
      googlePlaceId: string | null;
      latitude: string | null;
      longitude: string | null;
      notes: string | null;
      googleMapsUrl: string | null;
      arrivalTime: Date | null;
      departureTime: Date | null;
      travelNotes: string | null;
      rating: string | null;
      photoUrl: string | null;
    }
  ): Promise<ItineraryItem> {
    // Get current max order index
    const existingItems = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, itineraryId));

    const maxOrderIndex = existingItems.length > 0
      ? Math.max(...existingItems.map(item => item.orderIndex || 0))
      : -1;

    const [newItem] = await db.insert(itineraryItems).values({
      itineraryId,
      sourceType: 'ad_hoc',
      sourceId: null,
      venueName: venue.venueName,
      venueAddress: venue.venueAddress,
      venueType: venue.venueType,
      googlePlaceId: venue.googlePlaceId,
      latitude: venue.latitude,
      longitude: venue.longitude,
      notes: venue.notes,
      googleMapsUrl: venue.googleMapsUrl,
      arrivalTime: venue.arrivalTime,
      departureTime: venue.departureTime,
      travelNotes: venue.travelNotes,
      rating: venue.rating,
      photoUrl: venue.photoUrl,
      orderIndex: maxOrderIndex + 1,
    }).returning();

    return newItem;
  }

  async updateItineraryItem(
    itemId: string,
    updates: {
      venueName?: string;
      venueAddress?: string;
      notes?: string;
      googleMapsUrl?: string;
      arrivalTime?: Date | null;
      departureTime?: Date | null;
      travelNotes?: string;
    }
  ): Promise<ItineraryItem | undefined> {
    const [updatedItem] = await db
      .update(itineraryItems)
      .set(updates)
      .where(eq(itineraryItems.id, itemId))
      .returning();

    return updatedItem;
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

  async logVenueVisits(itineraryId: string, eventDate: Date): Promise<void> {
    const itinerary = await this.getItinerary(itineraryId);
    if (!itinerary) {
      console.log(`[Visit Tracking] Itinerary ${itineraryId} not found, skipping visit logging`);
      return;
    }

    const visits: InsertVenueVisitHistory[] = itinerary.items
      .filter(item => item.sourceType !== 'ad_hoc') // Only track actual activities/voting events
      .map(item => ({
        groupId: itinerary.groupId,
        activityId: item.sourceType === 'activity' ? item.sourceId : null,
        votingEventId: item.sourceType === 'voting_event' ? item.sourceId : null,
        venueName: item.venueName,
        venueType: item.venueType,
        visitedAt: eventDate,
        itineraryId,
      }));

    if (visits.length > 0) {
      await db.insert(venueVisitHistory).values(visits);
      console.log(`[Visit Tracking] Logged ${visits.length} venue visit(s) for itinerary ${itineraryId} on ${eventDate.toISOString()}`);
    } else {
      console.log(`[Visit Tracking] No trackable venues in itinerary ${itineraryId}`);
    }
  }

  async getVenueVisitHistory(groupId: string): Promise<any[]> {
    const visits = await db
      .select()
      .from(venueVisitHistory)
      .where(eq(venueVisitHistory.groupId, groupId))
      .orderBy(desc(venueVisitHistory.visitedAt));

    return visits;
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

  async getPendingAutoScheduledEvents(groupId: string): Promise<Array<AutoScheduledEvent & { itinerary?: Itinerary & { items: ItineraryItem[] } }>> {
    const events = await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.groupId, groupId),
        eq(autoScheduledEvents.status, 'pending')
      ))
      .orderBy(desc(autoScheduledEvents.createdAt));
    
    // Fetch itinerary data for each event
    const eventsWithItineraries = await Promise.all(
      events.map(async (event) => {
        if (!event.itineraryId) {
          return { ...event, itinerary: undefined };
        }
        
        const itinerary = await this.getItinerary(event.itineraryId);
        return { ...event, itinerary };
      })
    );
    
    return eventsWithItineraries;
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

  async hasExistingProposedEvents(groupId: string): Promise<boolean> {
    // Check for pending auto-scheduled events
    const pendingAutoEvents = await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.groupId, groupId),
        eq(autoScheduledEvents.status, 'pending')
      ))
      .limit(1);

    if (pendingAutoEvents.length > 0) {
      return true;
    }

    // Check for proposed or scheduled itineraries
    const proposedItineraries = await db
      .select()
      .from(itineraries)
      .where(and(
        eq(itineraries.groupId, groupId),
        or(
          eq(itineraries.status, 'proposed'),
          eq(itineraries.status, 'scheduled')
        )
      ))
      .limit(1);

    return proposedItineraries.length > 0;
  }

  async getUserUpcomingEventsWithTimeSlots(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{
    groupId: string;
    groupName: string;
    eventDate: Date;
    timePeriod: 'morning' | 'afternoon' | 'evening';
  }>> {
    const { inferTimePeriod } = await import('./availability-utils.js');
    const results: Array<{
      groupId: string;
      groupName: string;
      eventDate: Date;
      timePeriod: 'morning' | 'afternoon' | 'evening';
    }> = [];

    const now = startDate || new Date();
    const futureLimit = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days from now

    // Get all groups owned by this user
    const userGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.userId, userId));

    for (const group of userGroups) {
      // Get proposed/scheduled itineraries
      const itins = await db
        .select()
        .from(itineraries)
        .where(and(
          eq(itineraries.groupId, group.id),
          or(
            eq(itineraries.status, 'proposed'),
            eq(itineraries.status, 'scheduled')
          ),
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${now}`,
          sql`${itineraries.eventDate} <= ${futureLimit}`
        ));

      for (const itin of itins) {
        if (itin.eventDate) {
          const date = new Date(itin.eventDate);
          const timePeriod = inferTimePeriod(date.getHours());
          results.push({
            groupId: group.id,
            groupName: group.name,
            eventDate: date,
            timePeriod,
          });
        }
      }

      // Get pending auto-scheduled events
      const autoEvents = await db
        .select()
        .from(autoScheduledEvents)
        .where(and(
          eq(autoScheduledEvents.groupId, group.id),
          eq(autoScheduledEvents.status, 'pending'),
          sql`${autoScheduledEvents.proposedDate} IS NOT NULL`,
          sql`${autoScheduledEvents.proposedDate} >= ${now}`,
          sql`${autoScheduledEvents.proposedDate} <= ${futureLimit}`
        ));

      for (const autoEvent of autoEvents) {
        if (autoEvent.proposedDate) {
          const date = new Date(autoEvent.proposedDate);
          const timePeriod = inferTimePeriod(date.getHours());
          results.push({
            groupId: group.id,
            groupName: group.name,
            eventDate: date,
            timePeriod,
          });
        }
      }
    }

    // Sort by event date
    results.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

    return results;
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

  // Host Assignments (rotating host system)
  async createHostAssignment(groupId: string, memberId: string, itineraryId?: string): Promise<HostAssignment> {
    const [result] = await db
      .insert(hostAssignments)
      .values({
        groupId,
        memberId,
        itineraryId: itineraryId || null,
        status: 'pending'
      })
      .returning();
    return result;
  }

  async getPendingHostAssignment(groupId: string): Promise<HostAssignment | undefined> {
    const [result] = await db
      .select()
      .from(hostAssignments)
      .where(
        and(
          eq(hostAssignments.groupId, groupId),
          eq(hostAssignments.status, 'pending')
        )
      )
      .orderBy(desc(hostAssignments.askedAt))
      .limit(1);
    return result;
  }

  async getMemberHostAssignments(memberId: string): Promise<HostAssignment[]> {
    return await db
      .select()
      .from(hostAssignments)
      .where(eq(hostAssignments.memberId, memberId))
      .orderBy(desc(hostAssignments.askedAt));
  }

  async respondToHostAssignment(assignmentId: string, accepted: boolean, memberId: string): Promise<HostAssignment> {
    const [result] = await db
      .update(hostAssignments)
      .set({
        status: accepted ? 'accepted' : 'declined',
        respondedAt: new Date()
      })
      .where(
        and(
          eq(hostAssignments.id, assignmentId),
          eq(hostAssignments.memberId, memberId)
        )
      )
      .returning();

    // If accepted, update member's last_hosted_at timestamp
    if (accepted && result) {
      await db
        .update(members)
        .set({ lastHostedAt: new Date() })
        .where(eq(members.id, memberId));
    }

    return result;
  }

  async getNextHostVolunteer(groupId: string, excludeMemberIds: string[] = []): Promise<Member | null> {
    // Get all volunteers for this group, excluding specified members and organizers
    let whereConditions = [
      eq(members.groupId, groupId),
      eq(members.openToHosting, true),
      eq(members.isOrganizer, false)
    ];

    if (excludeMemberIds.length > 0) {
      whereConditions.push(sql`${members.id} NOT IN (${sql.join(excludeMemberIds.map(id => sql`${id}`), sql`, `)})`);
    }

    const volunteers = await db
      .select()
      .from(members)
      .where(and(...whereConditions))
      .orderBy(members.lastHostedAt); // null values come first (never hosted)

    // Return first volunteer (least recently hosted)
    return volunteers.length > 0 ? volunteers[0] : null;
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

  async getAdminStats(includeTestData: boolean = false) {
    // Helper to build test data filters
    const buildFilters = (includeGroups: boolean = false) => {
      const filters: any[] = [];
      
      if (!includeTestData) {
        // Add group test filter
        if (includeGroups) {
          filters.push(eq(groups.isTest, false));
        }
        // Add email domain filters
        filters.push(
          sql`${users.email} NOT LIKE '%@example.com'`,
          sql`${users.email} NOT LIKE '%@test.com'`
        );
      }
      
      return filters.length > 0 ? and(...filters) : undefined;
    };
    
    // Total users (authenticated + unclaimed members with unique emails)
    // Avoid double-counting: count members whose emails don't exist in users table
    // Exclude test emails (@example.com and @test.com) from counts unless includeTestData is true
    const userEmailFilter = !includeTestData
      ? and(
          sql`${users.email} NOT LIKE '%@example.com'`,
          sql`${users.email} NOT LIKE '%@test.com'`
        )
      : undefined;
    
    const [authUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(userEmailFilter);
    const authUsersCount = Number(authUsersResult.count);

    const memberEmailFilters: any[] = [
      sql`${members.email} IS NOT NULL`,
      sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.email} IS NOT NULL AND ${users.email} = ${members.email})`
    ];
    
    if (!includeTestData) {
      memberEmailFilters.push(
        sql`${members.email} NOT LIKE '%@example.com'`,
        sql`${members.email} NOT LIKE '%@test.com'`
      );
    }
    
    const [unclaimedMemberEmailsResult] = await db
      .select({ count: sql<number>`count(DISTINCT ${members.email})` })
      .from(members)
      .where(and(...memberEmailFilters));
    const unclaimedMemberEmails = Number(unclaimedMemberEmailsResult.count);

    // Total groups (exclude groups created by test users and test groups)
    const [groupsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(groups)
      .innerJoin(users, eq(groups.userId, users.id))
      .where(buildFilters(true));
    const totalGroups = Number(groupsResult.count);

    // Total events (all itineraries from non-test groups)
    const [eventsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(itineraries)
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(buildFilters(true));
    const totalEvents = Number(eventsResult.count);

    // Events held (past events with confirmed dates from non-test groups)
    const eventsHeldFilter = buildFilters(true);
    const eventsHeldConditions = eventsHeldFilter 
      ? and(
          eventsHeldFilter,
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`
        )
      : and(
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`
        );
    
    const [eventsHeldResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(itineraries)
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(eventsHeldConditions);
    const eventsHeld = Number(eventsHeldResult.count);

    // Active groups (non-test groups with events held in last 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const now = new Date();
    
    const activeGroupsFilter = buildFilters(true);
    const activeGroupsConditions = activeGroupsFilter
      ? and(
          activeGroupsFilter,
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${sixtyDaysAgo.toISOString()}`,
          sql`${itineraries.eventDate} <= ${now.toISOString()}`
        )
      : and(
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${sixtyDaysAgo.toISOString()}`,
          sql`${itineraries.eventDate} <= ${now.toISOString()}`
        );
    
    const [activeGroupsResult] = await db
      .select({ count: sql<number>`count(DISTINCT ${itineraries.groupId})` })
      .from(itineraries)
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(activeGroupsConditions);
    const activeGroups = Number(activeGroupsResult.count);

    // Repeat attendance rate (% of users who attended 2+ events from non-test groups)
    // Count users with 2+ "yes" RSVPs
    const repeatAttendanceFilter = buildFilters(true);
    const repeatAttendanceConditions = repeatAttendanceFilter
      ? and(
          repeatAttendanceFilter,
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`
        )
      : and(
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} < NOW()`
        );
    
    const usersWithMultipleAttendances = await db
      .select({
        userId: rsvps.userId,
        memberId: rsvps.memberId,
        count: sql<number>`count(*)`
      })
      .from(rsvps)
      .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(repeatAttendanceConditions)
      .groupBy(rsvps.userId, rsvps.memberId)
      .having(sql`count(*) >= 2`);

    const repeatAttenders = usersWithMultipleAttendances.length;
    
    // Total unique attendees (users or members with at least 1 "yes" RSVP to past event from non-test groups)
    const [totalAttendeesResult] = await db
      .select({ 
        count: sql<number>`count(DISTINCT COALESCE(${rsvps.userId}, ${rsvps.memberId}))` 
      })
      .from(rsvps)
      .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(repeatAttendanceConditions);
    
    const totalAttendees = Number(totalAttendeesResult.count);
    const repeatAttendanceRate = totalAttendees > 0 ? (repeatAttenders / totalAttendees) * 100 : 0;

    // Top cities by event count (from non-test groups)
    const topCitiesFilter = buildFilters(true);
    const topCitiesConditions = topCitiesFilter
      ? and(topCitiesFilter, sql`${itineraries.eventDate} IS NOT NULL`)
      : sql`${itineraries.eventDate} IS NOT NULL`;
    
    const cityEvents = await db
      .select({
        location: groups.locationBase,
        eventCount: sql<number>`count(${itineraries.id})`
      })
      .from(groups)
      .innerJoin(users, eq(groups.userId, users.id))
      .leftJoin(itineraries, eq(groups.id, itineraries.groupId))
      .where(topCitiesConditions)
      .groupBy(groups.locationBase)
      .orderBy(desc(sql`count(${itineraries.id})`))
      .limit(10);

    const topCities = cityEvents.map(row => ({
      city: row.location || 'Unknown',
      eventCount: Number(row.eventCount)
    }));

    // Events per week (last 90 days from non-test groups)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const weeklyEventsFilter = buildFilters(true);
    const weeklyEventsConditions = weeklyEventsFilter
      ? and(
          weeklyEventsFilter,
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${ninetyDaysAgo.toISOString()}`
        )
      : and(
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${ninetyDaysAgo.toISOString()}`
        );
    
    const weeklyEvents = await db
      .select({
        week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${itineraries.eventDate}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`
      })
      .from(itineraries)
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(weeklyEventsConditions)
      .groupBy(sql`DATE_TRUNC('week', ${itineraries.eventDate})`)
      .orderBy(sql`DATE_TRUNC('week', ${itineraries.eventDate})`);

    const eventsPerWeek = weeklyEvents.map(row => ({
      week: row.week,
      count: Number(row.count)
    }));

    // New vs returning attendees this month (from non-test groups)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get all attendees this month from non-test groups
    const thisMonthAttendeesFilter = buildFilters(true);
    const thisMonthAttendeesConditions = thisMonthAttendeesFilter
      ? and(
          thisMonthAttendeesFilter,
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} >= ${startOfMonth.toISOString()}`
        )
      : and(
          eq(rsvps.response, 'yes'),
          sql`${itineraries.eventDate} >= ${startOfMonth.toISOString()}`
        );
    
    const thisMonthAttendees = await db
      .select({
        userId: rsvps.userId,
        memberId: rsvps.memberId
      })
      .from(rsvps)
      .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
      .innerJoin(groups, eq(itineraries.groupId, groups.id))
      .innerJoin(users, eq(groups.userId, users.id))
      .where(thisMonthAttendeesConditions);

    // For each attendee, check if they had prior attendance at non-test group events
    let newAttendees = 0;
    let returningAttendees = 0;

    for (const attendee of thisMonthAttendees) {
      const priorAttendanceFilter = buildFilters(true);
      const priorAttendanceConditions = priorAttendanceFilter
        ? and(
            priorAttendanceFilter,
            eq(rsvps.response, 'yes'),
            sql`${itineraries.eventDate} < ${startOfMonth.toISOString()}`,
            attendee.userId 
              ? eq(rsvps.userId, attendee.userId)
              : eq(rsvps.memberId, attendee.memberId!)
          )
        : and(
            eq(rsvps.response, 'yes'),
            sql`${itineraries.eventDate} < ${startOfMonth.toISOString()}`,
            attendee.userId 
              ? eq(rsvps.userId, attendee.userId)
              : eq(rsvps.memberId, attendee.memberId!)
          );
      
      const priorAttendance = await db
        .select({ count: sql<number>`count(*)` })
        .from(rsvps)
        .innerJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
        .innerJoin(groups, eq(itineraries.groupId, groups.id))
        .innerJoin(users, eq(groups.userId, users.id))
        .where(priorAttendanceConditions);

      if (Number(priorAttendance[0].count) > 0) {
        returningAttendees++;
      } else {
        newAttendees++;
      }
    }

    return {
      registeredUsers: authUsersCount,
      invitedMembers: unclaimedMemberEmails,
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

  async getTestAccounts() {
    const testUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(users)
      .where(
        or(
          sql`${users.email} LIKE '%@example.com'`,
          sql`${users.email} LIKE '%@test.com'`
        )
      )
      .orderBy(users.email)
      .limit(50);

    return testUsers;
  }

  // Database Backup Operations
  async createDatabaseBackup(backupType: string, createdBy?: string, notes?: string): Promise<any> {
    try {
      console.log(`[BACKUP] Starting ${backupType} backup...`);
      
      // Export all critical tables
      const allGroups = await db.select().from(groups);
      const allMembers = await db.select().from(members);
      const allActivities = await db.select().from(activities);
      const allItineraries = await db.select().from(itineraries);
      const allItineraryItems = await db.select().from(itineraryItems);
      const allRsvps = await db.select().from(rsvps);
      const allVotingEvents = await db.select().from(votingEvents);
      const allVotes = await db.select().from(votes);
      const allProposedTimeSlots = await db.select().from(proposedTimeSlots);
      const allTimeSlotVotes = await db.select().from(timeSlotVotes);
      const allGroupCollections = await db.select().from(groupCollections);
      const allAutoScheduledEvents = await db.select().from(autoScheduledEvents);
      const allHostAssignments = await db.select().from(hostAssignments);
      
      const snapshotData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        tables: {
          groups: allGroups,
          members: allMembers,
          activities: allActivities,
          itineraries: allItineraries,
          itineraryItems: allItineraryItems,
          rsvps: allRsvps,
          votingEvents: allVotingEvents,
          votes: allVotes,
          proposedTimeSlots: allProposedTimeSlots,
          timeSlotVotes: allTimeSlotVotes,
          groupCollections: allGroupCollections,
          autoScheduledEvents: allAutoScheduledEvents,
          hostAssignments: allHostAssignments,
        },
        counts: {
          groups: allGroups.length,
          members: allMembers.length,
          activities: allActivities.length,
          itineraries: allItineraries.length,
          events: allItineraries.filter(i => i.status === 'proposed' || i.status === 'finalized').length,
        }
      };
      
      const [backup] = await db.insert(databaseBackups).values({
        snapshotData: snapshotData as any,
        backupType,
        createdBy,
        notes,
      }).returning();
      
      console.log(`[BACKUP] Created backup ${backup.id} with ${allGroups.length} groups, ${allMembers.length} members, ${allActivities.length} activities`);
      
      return backup;
    } catch (error) {
      console.error('[BACKUP] Failed to create backup:', error);
      throw error;
    }
  }

  async getAllDatabaseBackups(): Promise<any[]> {
    const backups = await db
      .select()
      .from(databaseBackups)
      .orderBy(desc(databaseBackups.createdAt))
      .limit(100);
    
    return backups;
  }

  async getDatabaseBackup(backupId: string): Promise<any | undefined> {
    const [backup] = await db
      .select()
      .from(databaseBackups)
      .where(eq(databaseBackups.id, backupId));
    
    return backup;
  }

  async restoreDatabaseBackup(backupId: string): Promise<void> {
    try {
      console.log(`[RESTORE] Starting restore from backup ${backupId}...`);
      
      const backup = await this.getDatabaseBackup(backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }
      
      const snapshot = backup.snapshotData as any;
      
      // Delete all existing data (in reverse order of foreign key dependencies)
      await db.delete(timeSlotVotes);
      await db.delete(proposedTimeSlots);
      await db.delete(votes);
      await db.delete(votingEvents);
      await db.delete(rsvps);
      await db.delete(itineraryItems);
      await db.delete(itineraries);
      await db.delete(activities);
      await db.delete(members);
      await db.delete(hostAssignments);
      await db.delete(autoScheduledEvents);
      await db.delete(groupCollections);
      await db.delete(groups);
      
      console.log('[RESTORE] Cleared all existing data');
      
      // Restore data (in order of dependencies)
      if (snapshot.tables.groupCollections?.length > 0) {
        await db.insert(groupCollections).values(snapshot.tables.groupCollections);
        console.log(`[RESTORE] Restored ${snapshot.tables.groupCollections.length} group collections`);
      }
      
      if (snapshot.tables.groups?.length > 0) {
        await db.insert(groups).values(snapshot.tables.groups);
        console.log(`[RESTORE] Restored ${snapshot.tables.groups.length} groups`);
      }
      
      if (snapshot.tables.members?.length > 0) {
        await db.insert(members).values(snapshot.tables.members);
        console.log(`[RESTORE] Restored ${snapshot.tables.members.length} members`);
      }
      
      if (snapshot.tables.activities?.length > 0) {
        await db.insert(activities).values(snapshot.tables.activities);
        console.log(`[RESTORE] Restored ${snapshot.tables.activities.length} activities`);
      }
      
      if (snapshot.tables.votingEvents?.length > 0) {
        await db.insert(votingEvents).values(snapshot.tables.votingEvents);
        console.log(`[RESTORE] Restored ${snapshot.tables.votingEvents.length} voting events`);
      }
      
      if (snapshot.tables.votes?.length > 0) {
        await db.insert(votes).values(snapshot.tables.votes);
        console.log(`[RESTORE] Restored ${snapshot.tables.votes.length} votes`);
      }
      
      if (snapshot.tables.itineraries?.length > 0) {
        await db.insert(itineraries).values(snapshot.tables.itineraries);
        console.log(`[RESTORE] Restored ${snapshot.tables.itineraries.length} itineraries`);
      }
      
      if (snapshot.tables.itineraryItems?.length > 0) {
        await db.insert(itineraryItems).values(snapshot.tables.itineraryItems);
        console.log(`[RESTORE] Restored ${snapshot.tables.itineraryItems.length} itinerary items`);
      }
      
      if (snapshot.tables.rsvps?.length > 0) {
        await db.insert(rsvps).values(snapshot.tables.rsvps);
        console.log(`[RESTORE] Restored ${snapshot.tables.rsvps.length} RSVPs`);
      }
      
      if (snapshot.tables.proposedTimeSlots?.length > 0) {
        await db.insert(proposedTimeSlots).values(snapshot.tables.proposedTimeSlots);
        console.log(`[RESTORE] Restored ${snapshot.tables.proposedTimeSlots.length} proposed time slots`);
      }
      
      if (snapshot.tables.timeSlotVotes?.length > 0) {
        await db.insert(timeSlotVotes).values(snapshot.tables.timeSlotVotes);
        console.log(`[RESTORE] Restored ${snapshot.tables.timeSlotVotes.length} time slot votes`);
      }
      
      if (snapshot.tables.autoScheduledEvents?.length > 0) {
        await db.insert(autoScheduledEvents).values(snapshot.tables.autoScheduledEvents);
        console.log(`[RESTORE] Restored ${snapshot.tables.autoScheduledEvents.length} auto scheduled events`);
      }
      
      if (snapshot.tables.hostAssignments?.length > 0) {
        await db.insert(hostAssignments).values(snapshot.tables.hostAssignments);
        console.log(`[RESTORE] Restored ${snapshot.tables.hostAssignments.length} host assignments`);
      }
      
      console.log(`[RESTORE] Successfully restored database from backup ${backupId}`);
    } catch (error) {
      console.error('[RESTORE] Failed to restore backup:', error);
      throw error;
    }
  }

  async pruneDatabaseBackups(keepCount: number): Promise<void> {
    const allBackups = await db
      .select({ id: databaseBackups.id })
      .from(databaseBackups)
      .orderBy(desc(databaseBackups.createdAt));
    
    if (allBackups.length > keepCount) {
      const toDelete = allBackups.slice(keepCount);
      await db.delete(databaseBackups).where(
        inArray(databaseBackups.id, toDelete.map(b => b.id))
      );
      console.log(`[BACKUP] Pruned ${toDelete.length} old backups, keeping ${keepCount} most recent`);
    }
  }

  async clearScrapedImport(): Promise<void> {
    await db.delete(scrapedVenuesImport);
    console.log('[Scraped Import] Cleared all scraped venues');
  }

  async insertScrapedVenues(venues: Array<any>): Promise<void> {
    // Log first venue to understand structure
    if (venues.length > 0) {
      console.log('[Scraped Import] Sample venue structure:', JSON.stringify(venues[0], null, 2));
    }

    const inserts = venues.map((v, idx) => {
      const name = v.name || v.venueName || v.title || v.businessName || `Venue ${idx + 1}`;
      
      // Build address from separate fields or use single field
      let address = v.address || v.venueAddress || v.location;
      if (!address && (v.street || v.city || v.state)) {
        const parts = [v.street, v.city, v.state].filter(Boolean);
        address = parts.join(', ');
      }
      if (!address) address = 'Unknown address';
      
      // Extract Google Place ID from URL if not directly available
      let googlePlaceId = v.googlePlaceId || v.placeId || v.place_id;
      if (!googlePlaceId && v.url) {
        const match = v.url.match(/query_place_id=([^&]+)/);
        if (match) googlePlaceId = match[1];
      }
      
      return {
        name,
        address,
        categoryName: v.category || v.categoryName || null,
        totalScore: (v.rating || v.totalScore)?.toString() || null,
        reviewsCount: v.reviewCount || v.reviewsCount || null,
        googlePlaceId: googlePlaceId || null,
        rawData: v
      };
    });

    await db.insert(scrapedVenuesImport).values(inserts);
    console.log(`[Scraped Import] Inserted ${inserts.length} scraped venues`);
  }

  async getScrapedVenuesComparison(): Promise<{
    totalScraped: number;
    alreadyInDb: number;
    newVenues: number;
    matchedVenues: Array<{ scrapedName: string; dbName: string; googlePlaceId: string; source: string }>;
    newVenuesList: Array<{ name: string; address: string; category?: string; rating?: number; googlePlaceId?: string }>;
  }> {
    const scraped = await db.select().from(scrapedVenuesImport);
    const curatedAll = await db.select().from(curatedVenues);

    const curatedByPlaceId = new Map();
    curatedAll.forEach(v => {
      if (v.googlePlaceId) {
        curatedByPlaceId.set(v.googlePlaceId, v);
      }
    });

    const matched: Array<{ scrapedName: string; dbName: string; googlePlaceId: string; source: string }> = [];
    const newVenuesList: Array<{ name: string; address: string; category?: string; rating?: number; googlePlaceId?: string }> = [];

    scraped.forEach(s => {
      if (s.googlePlaceId && curatedByPlaceId.has(s.googlePlaceId)) {
        const dbVenue = curatedByPlaceId.get(s.googlePlaceId);
        matched.push({
          scrapedName: s.name,
          dbName: dbVenue.name,
          googlePlaceId: s.googlePlaceId,
          source: dbVenue.source
        });
      } else {
        newVenuesList.push({
          name: s.name,
          address: s.address,
          category: s.categoryName || undefined,
          rating: s.totalScore ? parseFloat(s.totalScore) : undefined,
          googlePlaceId: s.googlePlaceId || undefined
        });
      }
    });

    return {
      totalScraped: scraped.length,
      alreadyInDb: matched.length,
      newVenues: newVenuesList.length,
      matchedVenues: matched,
      newVenuesList
    };
  }

  async importScrapedVenues(venues: Array<{ name: string; address: string; category?: string; rating?: number; googlePlaceId?: string }>): Promise<number> {
    // Fetch real coordinates for each venue using Google Places API
    const { getPlaceDetails } = await import('./google-places');
    
    const enrichedVenues = [];
    let failedCount = 0;

    for (const v of venues) {
      if (!v.googlePlaceId) {
        console.log(`[Scraped Import] Skipping venue without Place ID: ${v.name}`);
        failedCount++;
        continue;
      }

      try {
        const placeDetails = await getPlaceDetails(v.googlePlaceId);
        
        if (!placeDetails || !placeDetails.location) {
          console.log(`[Scraped Import] Failed to get coordinates for: ${v.name} (${v.googlePlaceId})`);
          failedCount++;
          continue;
        }

        // Map priceLevel string to numeric value
        let priceLevelNum: number | null = null;
        if (placeDetails.priceLevel) {
          const priceLevelMap: Record<string, number> = {
            'Free': 0,
            '$': 1,
            '$$': 2,
            '$$$': 3,
            '$$$$': 4,
          };
          priceLevelNum = priceLevelMap[placeDetails.priceLevel] ?? null;
        }

        enrichedVenues.push({
          name: v.name,
          address: v.address,
          latitude: placeDetails.location.lat.toString(),
          longitude: placeDetails.location.lng.toString(),
          region: 'SF Bay Area',
          category: v.category || 'Other',
          tags: v.category ? [v.category] : [],
          rating: v.rating?.toString() || placeDetails.rating || null,
          reviewCount: placeDetails.reviewCount || null,
          priceLevel: priceLevelNum,
          photoUrl: placeDetails.photoUrl || null,
          googlePlaceId: v.googlePlaceId,
          source: 'api_scrape' as const,
        });
      } catch (error) {
        console.error(`[Scraped Import] Error fetching details for ${v.name}:`, error);
        failedCount++;
      }
    }

    if (enrichedVenues.length === 0) {
      console.log(`[Scraped Import] No venues could be imported (${failedCount} failed)`);
      return 0;
    }

    await db.insert(curatedVenues).values(enrichedVenues);
    console.log(`[Scraped Import] Successfully imported ${enrichedVenues.length} venues with real coordinates (${failedCount} failed)`);
    return enrichedVenues.length;
  }

  // Seen Activities
  async markVenuesAsSeen(groupId: string, venues: Array<{venueName: string, googlePlaceId?: string, category: string}>): Promise<void> {
    if (venues.length === 0) return;

    const values = venues.map(v => ({
      groupId,
      venueName: v.venueName,
      googlePlaceId: v.googlePlaceId || null,
      category: v.category
    }));

    await db.insert(seenActivities).values(values).onConflictDoNothing();
  }

  async getSeenVenues(groupId: string): Promise<Array<{venueName: string, googlePlaceId?: string, category: string}>> {
    const seen = await db
      .select({
        venueName: seenActivities.venueName,
        googlePlaceId: seenActivities.googlePlaceId,
        category: seenActivities.category
      })
      .from(seenActivities)
      .where(eq(seenActivities.groupId, groupId));

    return seen.map(s => ({
      venueName: s.venueName,
      googlePlaceId: s.googlePlaceId || undefined,
      category: s.category
    }));
  }

  // Curated Venues Management
  async getAllCuratedVenues(): Promise<Array<{id: string; name: string; category: string; tags: string[] | null}>> {
    const venues = await db
      .select({
        id: curatedVenues.id,
        name: curatedVenues.name,
        category: curatedVenues.category,
        tags: curatedVenues.tags
      })
      .from(curatedVenues)
      .where(eq(curatedVenues.isActive, true));

    return venues;
  }

  async updateVenueCategory(id: string, category: string): Promise<void> {
    await db
      .update(curatedVenues)
      .set({ category })
      .where(eq(curatedVenues.id, id));
  }
}

export const storage = new DatabaseStorage();