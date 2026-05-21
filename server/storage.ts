// Reference: javascript_database blueprint
// Reference: javascript_log_in_with_replit blueprint
import {
  users, groups, members, memberGroupPreferences, activities, votingEvents, votes, preferenceSignals, itineraries, itineraryItems, rsvps, itineraryInvites, reminderLogs, autoScheduledEvents, itineraryOptions, frequencyFeedback, venueVisitHistory, userProfiles, proposedTimeSlots, timeSlotVotes, groupCollections, categorySearchHistory, hostAssignments, groupBackups, databaseBackups, scrapedVenuesImport, curatedVenues, seenActivities, memberFavoriteVenues, userSavedPlaces, groupSavedPlaces, standaloneEventInvitees, availabilityPulses, availabilityPulseResponses,
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
  type MemberGroupPreferences, type InsertMemberGroupPreferences,
  type MemberFavoriteVenue, type InsertMemberFavoriteVenue,
  type UserSavedPlace, type InsertUserSavedPlace,
  type GroupSavedPlace, type InsertGroupSavedPlace,
  type StandaloneEventInvitee, type InsertStandaloneEventInvitee,
  type AvailabilityPulse, type InsertAvailabilityPulse,
  type AvailabilityPulseResponse, type InsertAvailabilityPulseResponse,
  type DateSpecificAvailability
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, inArray, isNull, isNotNull, gt, gte, asc, lt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { geocodeLocation } from "./google-places";
import {
  trustFieldsForSource,
  dirtyingTrustFields,
  ACTIVITY_DIRTYING_FIELDS,
  VOTING_EVENT_DIRTYING_FIELDS,
  ITINERARY_ITEM_DIRTYING_FIELDS,
  type TrustSource,
} from "./trust-state";
import { remindersStorage } from "./storage/reminders";
import { frequencyFeedbackStorage } from "./storage/frequency-feedback";
import { userProfilesStorage } from "./storage/user-profiles";
import { categorySearchHistoryStorage } from "./storage/category-search-history";
import { timeSlotsStorage } from "./storage/time-slots";
import { backupsStorage } from "./storage/backups";
import { groupCollectionsStorage } from "./storage/group-collections";
import { hostingStorage } from "./storage/hosting";
import { seenActivitiesStorage } from "./storage/seen-activities";
import { curatedVenuesStorage } from "./storage/curated-venues";
import { savedPlacesStorage } from "./storage/saved-places";
import { availabilityStorage } from "./storage/availability";
import { standaloneEventsStorage } from "./storage/standalone-events";
import { autoScheduledEventsStorage } from "./storage/auto-scheduled-events";
import { adminStatsStorage } from "./storage/admin-stats";
import { scrapedVenuesImportStorage } from "./storage/scraped-venues-import";
import { rsvpsStorage } from "./storage/rsvps";
import { preferenceSignalsStorage } from "./storage/preference-signals";
import { venueVisitTrackingStorage } from "./storage/venue-visit-tracking";
import { memberGroupPreferencesStorage } from "./storage/member-group-preferences";
import { votingEventsStorage } from "./storage/voting-events";
import { activitiesStorage } from "./storage/activities";
import { membersStorage } from "./storage/members";

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
  getGroupMemberByUserId(groupId: string, userId: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(id: string, updates: UpdateMember): Promise<Member>;
  deleteMember(id: string): Promise<void>;
  markInvitationsSent(groupId: string): Promise<void>;

  // Member Group Preferences
  getMemberGroupPreferences(userId: string, groupId: string): Promise<MemberGroupPreferences | undefined>;
  upsertMemberGroupPreferences(userId: string, groupId: string, preferences: Partial<InsertMemberGroupPreferences>): Promise<MemberGroupPreferences>;
  getGroupMembersAvailability(groupId: string): Promise<Array<{
    memberId: string;
    memberName: string;
    userId: string | null;
    availability: Record<string, { morning: boolean; afternoon: boolean; evening: boolean }> | null;
  }>>;
  getGroupMembersBudgets(groupId: string): Promise<Array<{
    memberId: string;
    memberName: string;
    userId: string | null;
    budgetMin: number;
    budgetMax: number;
  }>>;

  // Activities
  getGroupActivities(groupId: string): Promise<Activity[]>;
  getAllGroupActivities(groupId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  createActivities(activities: InsertActivity[]): Promise<Activity[]>;
  updateActivityFeedback(activityId: string, feedback: string): Promise<Activity>;
  archiveGroupActivities(groupId: string): Promise<void>;
  deleteAllGroupActivities(groupId: string): Promise<void>;
  deleteActivity(activityId: string): Promise<void>;
  getActivity(activityId: string): Promise<Activity | undefined>;

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
  getGroupItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[]; rsvpCount: { yes: number; maybe: number; no: number; pending: number } }>>;
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
  updateAutoScheduledEvent(id: string, updates: Partial<InsertAutoScheduledEvent>): Promise<AutoScheduledEvent>;
  getAutoScheduledEventsReadyForAutoSend(): Promise<AutoScheduledEvent[]>;
  hasExistingProposedEvents(groupId: string): Promise<boolean>;
  countFutureEvents(groupId: string): Promise<number>;
  skipAutoScheduledEvent(eventId: string): Promise<{ groupId: string }>;
  deleteAutoScheduledEvent(eventId: string): Promise<{ groupId: string }>;
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
  createGroupCollection(userId: string, collection: Omit<InsertGroupCollection, 'userId'>): Promise<GroupCollection>;
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
    // CRITICAL FIX: Use email as the stable identifier, NOT the OAuth sub
    // This prevents data loss when Replit OAuth provides different subject IDs across sessions

    if (!userData.email) {
      throw new Error("Email is required for upsertUser");
    }

    // Step 1: Check if user exists by email (stable identifier)
    const existingUser = await this.getUserByEmail(userData.email);

    if (existingUser) {
      // User exists - UPDATE existing record instead of deleting
      console.log(`[Auth] Updating existing user: ${userData.email}`);

      // Check if OAuth sub changed
      const newOidcSub = (userData as any).oidcSub || userData.id;
      const oldOidcSub = existingUser.oidcSub;

      let legacyOidcSubs = existingUser.legacyOidcSubs as string[] || [];

      if (oldOidcSub && newOidcSub !== oldOidcSub) {
        // OAuth sub changed - track the old one
        console.log(`[Auth] OAuth sub changed for ${userData.email}: ${oldOidcSub} → ${newOidcSub}`);

        if (!legacyOidcSubs.includes(oldOidcSub)) {
          legacyOidcSubs = [...legacyOidcSubs, oldOidcSub];
        }
      }

      // Update the existing user record
      const updateData: any = {
        firstName: userData.firstName || existingUser.firstName,
        lastName: userData.lastName || existingUser.lastName,
        profileImageUrl: userData.profileImageUrl || existingUser.profileImageUrl,
        oidcSub: newOidcSub,
        legacyOidcSubs: legacyOidcSubs.length > 0 ? legacyOidcSubs as any : null,
        updatedAt: new Date(),
      };

      // Handle Google ID if provided
      if ((userData as any).googleId) {
        updateData.googleId = (userData as any).googleId;
      }

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, existingUser.id))
        .returning();

      return updatedUser;
    } else {
      // New user - create with stable ID
      console.log(`[Auth] Creating new user: ${userData.email}`);

      const newOidcSub = (userData as any).oidcSub || userData.id;

      const insertData: any = {
        id: userData.id, // Keep the stable ID
        email: userData.email,
        oidcSub: newOidcSub,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        legacyOidcSubs: null,
      };

      // Handle Google ID if provided
      if ((userData as any).googleId) {
        insertData.googleId = (userData as any).googleId;
      }

      const [newUser] = await db
        .insert(users)
        .values(insertData)
        .returning();

      return newUser;
    }
  }

  // Group operations
  async createGroup(insertGroup: InsertGroup, userId: string, memberInputs: Array<{name?: string, email?: string}>): Promise<Group> {
    // Generate unique shareable link
    const shareableLink = randomBytes(16).toString('hex');

    const [group] = await db
      .insert(groups)
      .values({ ...insertGroup, userId, shareableLink })
      .returning();

    // Get organizer's user info
    const organizer = await db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0]);

    // Always add the organizer as a member first
    const organizerMember = {
      groupId: group.id,
      name: organizer?.firstName && organizer?.lastName
        ? `${organizer.firstName} ${organizer.lastName}`.trim()
        : organizer?.firstName || organizer?.email?.split('@')[0] || 'Organizer',
      email: organizer?.email || null,
      claimToken: randomBytes(16).toString('hex'),
      isOrganizer: true,
      userId: userId,
      invitationSent: false,
      hasJoined: true, // Organizer is already "joined"
    };

    // Create additional members if provided (skip any that match organizer's email)
    const additionalMembers = memberInputs
      .filter(m => !organizer?.email || m.email?.toLowerCase() !== organizer.email.toLowerCase())
      .map((m) => ({
        groupId: group.id,
        name: m.name || null,
        email: m.email || null,
        claimToken: randomBytes(16).toString('hex'),
        isOrganizer: false,
        userId: null,
        invitationSent: false,
        hasJoined: false,
      }));

    await db.insert(members).values([organizerMember, ...additionalMembers]);

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

      // 2. Auto-link Tier 1 members: email match + (invitation was sent OR joined as guest via shareable link)
      // These are explicit invites or self-joins, so we auto-claim without user confirmation
      const tier1Members = await db
        .select()
        .from(members)
        .where(and(
          isNull(members.userId),
          eq(members.email, user.email),
          or(
            eq(members.invitationSent, true), // Explicitly invited via email
            eq(members.isGuest, true) // Joined as guest via shareable link (gave consent by joining)
          )
        ));

      if (tier1Members.length > 0) {
        console.log(`[Auto-Link] Linking ${tier1Members.length} Tier 1 member records to user ${userId} (${user.email})`);
        await db
          .update(members)
          .set({ userId, hasJoined: true, isGuest: false, claimedAt: new Date() })
          .where(inArray(members.id, tier1Members.map(m => m.id)));
      }

      // 3. Auto-link standalone event invitees by email
      const standaloneInvitees = await db
        .select()
        .from(standaloneEventInvitees)
        .where(and(
          isNull(standaloneEventInvitees.userId),
          eq(standaloneEventInvitees.inviteeEmail, user.email)
        ));

      if (standaloneInvitees.length > 0) {
        console.log(`[Auto-Link] Linking ${standaloneInvitees.length} standalone event invitees to user ${userId} (${user.email})`);
        await db
          .update(standaloneEventInvitees)
          .set({ userId })
          .where(inArray(standaloneEventInvitees.id, standaloneInvitees.map(i => i.id)));
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
          userId: member.userId,
          isOrganizer: member.isOrganizer,
          isGuest: member.isGuest,
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

  // Get all contacts across all groups the user belongs to (for standalone event invites)
  async getUserContacts(userId: string): Promise<Array<{
    id: string; // Composite key: memberId
    name: string;
    email: string | null;
    userId: string | null;
    memberId: string;
    sourceGroupId: string;
    sourceGroupName: string;
    sourceGroupEmoji: string | null;
  }>> {
    // Get all groups user belongs to
    const userGroups = await this.getUserGroups(userId);

    // Collect all members from all groups
    const allContacts: Array<{
      id: string;
      name: string;
      email: string | null;
      userId: string | null;
      memberId: string;
      sourceGroupId: string;
      sourceGroupName: string;
      sourceGroupEmoji: string | null;
    }> = [];

    for (const group of userGroups) {
      const groupMembers = await this.getGroupMembers(group.id);
      for (const member of groupMembers) {
        // Skip the current user themselves
        if (member.userId === userId) continue;

        allContacts.push({
          id: member.id, // Use memberId as unique identifier
          name: member.name || member.email?.split('@')[0] || 'Unknown',
          email: member.email,
          userId: member.userId,
          memberId: member.id,
          sourceGroupId: group.id,
          sourceGroupName: group.name,
          sourceGroupEmoji: group.emoji,
        });
      }
    }

    // Deduplicate by email (prioritize contacts with userId set)
    const contactsByEmail = new Map<string, typeof allContacts[0]>();
    const contactsWithoutEmail: typeof allContacts = [];

    for (const contact of allContacts) {
      if (contact.email) {
        const existing = contactsByEmail.get(contact.email.toLowerCase());
        // Keep the one with userId, or the first one if neither has userId
        if (!existing || (contact.userId && !existing.userId)) {
          contactsByEmail.set(contact.email.toLowerCase(), contact);
        }
      } else {
        // Contacts without email can't be deduplicated
        contactsWithoutEmail.push(contact);
      }
    }

    return [...contactsByEmail.values(), ...contactsWithoutEmail];
  }

  async getAllGroups(): Promise<Group[]> {
    return await db.select().from(groups).where(isNull(groups.deletedAt));
  }

  async getGroup(id: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(and(eq(groups.id, id), isNull(groups.deletedAt)));
    return group || undefined;
  }

  async getGroupByShareableLink(link: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(and(eq(groups.shareableLink, link), isNull(groups.deletedAt)));
    return group || undefined;
  }

  // Members — extracted to ./storage/members.ts (W4 Slice 3)
  getGroupMembers = membersStorage.getGroupMembers;
  createMember = membersStorage.createMember;

  // Activities — extracted to ./storage/activities.ts (W4 Slice 3)
  getGroupActivities = activitiesStorage.getGroupActivities;
  getAllGroupActivities = activitiesStorage.getAllGroupActivities;
  archiveGroupActivities = activitiesStorage.archiveGroupActivities;
  deleteAllGroupActivities = activitiesStorage.deleteAllGroupActivities;
  deleteActivity = activitiesStorage.deleteActivity;
  getActivity = activitiesStorage.getActivity;
  createActivity = activitiesStorage.createActivity;
  createActivities = activitiesStorage.createActivities;

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

  markInvitationsSent = membersStorage.markInvitationsSent;

  updateActivityFeedback = activitiesStorage.updateActivityFeedback;

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

  getMember = membersStorage.getMember;
  getGroupMemberByUserId = membersStorage.getGroupMemberByUserId;
  updateMember = membersStorage.updateMember;
  deleteMember = membersStorage.deleteMember;

  // Member rollups (availability/budgets effective values)
  getGroupMembersAvailability = membersStorage.getGroupMembersAvailability;
  getGroupMembersBudgets = membersStorage.getGroupMembersBudgets;

  // Member Group Preferences operations
  getMemberGroupPreferences = memberGroupPreferencesStorage.getMemberGroupPreferences;
  upsertMemberGroupPreferences = memberGroupPreferencesStorage.upsertMemberGroupPreferences;

  // Voting Events + Votes — extracted to ./storage/voting-events.ts (W4 Slice 3)
  createVotingEvent = votingEventsStorage.createVotingEvent;
  getVotingEvents = votingEventsStorage.getVotingEvents;
  getGroupVotingEvents = votingEventsStorage.getGroupVotingEvents;
  getVotingEvent = votingEventsStorage.getVotingEvent;
  updateVotingEvent = votingEventsStorage.updateVotingEvent;
  deleteVotingEvent = votingEventsStorage.deleteVotingEvent;
  castVote = votingEventsStorage.castVote;
  removeVote = votingEventsStorage.removeVote;
  getEventVotes = votingEventsStorage.getEventVotes;
  getUserVote = votingEventsStorage.getUserVote;
  getUserVotes = votingEventsStorage.getUserVotes;

  // Preference Signals — extracted to ./storage/preference-signals.ts (W4 Slice 3)
  createPreferenceSignal = preferenceSignalsStorage.createPreferenceSignal;
  getGroupPreferenceSignals = preferenceSignalsStorage.getGroupPreferenceSignals;

  async createItinerary(insertItinerary: InsertItinerary, userId: string, itemsData: Array<{sourceType: 'activity' | 'voting_event' | 'ad_hoc' | 'google_place', sourceId: string, adHocData?: any}>): Promise<Itinerary> {
    // Validation: proposed itineraries must have an eventDate
    if (insertItinerary.status === 'proposed' && !insertItinerary.eventDate) {
      throw new Error('Cannot create proposed itinerary without eventDate. Proposed itineraries must have a scheduled date.');
    }

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
        } else if ((item.sourceType === 'ad_hoc' || item.sourceType === 'google_place') && item.adHocData) {
          // Handle ad-hoc venue or Google Place venue (both use adHocData)
          venueName = item.adHocData.name;
          venueAddress = item.adHocData.address || '';
          venueType = item.adHocData.type || 'venue';
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
                latitude = geocoded.latitude.toString();
                longitude = geocoded.longitude.toString();
              }
            } catch (error) {
              console.error('[Create Itinerary] Error geocoding venue:', error);
            }
          }
        }

        itemsToInsert.push({
          itineraryId: itinerary.id,
          sourceType: item.sourceType,
          sourceId: (item.sourceType === 'ad_hoc' || item.sourceType === 'google_place') ? null : item.sourceId,
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

  async getGroupItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[]; rsvpCount: { yes: number; maybe: number; no: number; pending: number } }>> {
    const foundItineraries = await db
      .select()
      .from(itineraries)
      .where(and(
        eq(itineraries.groupId, groupId),
        eq(itineraries.isSaved, false)
      ))
      .orderBy(desc(itineraries.createdAt));

    const itineraryIds = foundItineraries.map(i => i.id);
    const rsvpCountByItinerary = new Map<string, { yes: number; maybe: number; no: number; pending: number }>();
    if (itineraryIds.length > 0) {
      const rsvpRows = await db
        .select({ itineraryId: rsvps.itineraryId, response: rsvps.response })
        .from(rsvps)
        .where(inArray(rsvps.itineraryId, itineraryIds));
      for (const row of rsvpRows) {
        const counts = rsvpCountByItinerary.get(row.itineraryId)
          ?? { yes: 0, maybe: 0, no: 0, pending: 0 };
        const r = (row.response || "").toLowerCase();
        if (r === "yes" || r === "going") counts.yes++;
        else if (r === "maybe" || r === "tentative") counts.maybe++;
        else if (r === "no" || r === "not_going") counts.no++;
        rsvpCountByItinerary.set(row.itineraryId, counts);
      }
    }

    const result = [];
    for (const itinerary of foundItineraries) {
      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itinerary.id))
        .orderBy(itineraryItems.orderIndex);
      const rsvpCount = rsvpCountByItinerary.get(itinerary.id)
        ?? { yes: 0, maybe: 0, no: 0, pending: 0 };
      result.push({ ...itinerary, items, rsvpCount });
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
      // Inherit trust from the source row — if the activity/voting_event was verified,
      // the itinerary item we copy from it is also verified.
      let sourceTrustState: 'verified' | 'needs_review' = 'needs_review';

      if (item.sourceType === 'activity') {
        const [activity] = await db.select().from(activities).where(eq(activities.id, item.sourceId));
        if (activity) {
          venueName = activity.venueName;
          venueAddress = activity.venueAddress || '';
          venueType = activity.venueType;
          googlePlaceId = activity.googlePlaceId;
          rating = activity.rating;
          photoUrl = activity.photoUrl;
          sourceTrustState = activity.trustState === 'verified' ? 'verified' : 'needs_review';
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
          sourceTrustState = votingEvent.trustState === 'verified' ? 'verified' : 'needs_review';
        }
      }

      // Generate Google Maps URL
      let googleMapsUrl = null;
      if (googlePlaceId) {
        googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${googlePlaceId}`;
      } else if (venueName && venueAddress) {
        const query = encodeURIComponent(`${venueName}, ${venueAddress}`);
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      }

      const trust = trustFieldsForSource(sourceTrustState === 'verified' ? 'inherited' : 'ai_suggestion');

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
        googleMapsUrl,
        orderIndex: maxOrderIndex + 1 + i,
        ...trust,
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
    },
    trustSource: TrustSource = "manual"
  ): Promise<ItineraryItem> {
    // Data integrity checks
    if (venue.googlePlaceId && !venue.googlePlaceId.startsWith('ChIJ')) {
      console.warn('[Storage] WARNING: Non-standard Place ID format detected:', {
        venueName: venue.venueName,
        placeId: venue.googlePlaceId
      });
    }

    if (!venue.venueAddress && !venue.latitude) {
      console.warn('[Storage] WARNING: Venue has neither address nor coordinates:', {
        venueName: venue.venueName,
        placeId: venue.googlePlaceId
      });
    }

    // Get current max order index
    const existingItems = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, itineraryId));

    const maxOrderIndex = existingItems.length > 0
      ? Math.max(...existingItems.map(item => item.orderIndex || 0))
      : -1;

    const trust = trustFieldsForSource(trustSource);

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
      ...trust,
    }).returning();

    return newItem;
  }

  async updateItineraryItem(
    itemId: string,
    updates: {
      venueName?: string;
      venueAddress?: string;
      venueType?: string;
      notes?: string;
      googleMapsUrl?: string;
      googlePlaceId?: string;
      latitude?: string;
      longitude?: string;
      rating?: string;
      photoUrl?: string;
      arrivalTime?: Date | null;
      departureTime?: Date | null;
      travelNotes?: string;
    }
  ): Promise<ItineraryItem | undefined> {
    const dirty = dirtyingTrustFields(updates as Record<string, unknown>, ITINERARY_ITEM_DIRTYING_FIELDS);
    const [updatedItem] = await db
      .update(itineraryItems)
      .set({ ...updates, ...(dirty ?? {}) })
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

  // Venue Visit Tracking — extracted to ./storage/venue-visit-tracking.ts (W4 Slice 3)
  logVenueVisits = venueVisitTrackingStorage.logVenueVisits;
  getVenueVisitHistory = venueVisitTrackingStorage.getVenueVisitHistory;
  getHighlyRatedVenues = venueVisitTrackingStorage.getHighlyRatedVenues;

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

  // RSVPs — extracted to ./storage/rsvps.ts (W4 Slice 3)
  createRsvp = rsvpsStorage.createRsvp;
  getItineraryRsvps = rsvpsStorage.getItineraryRsvps;
  updateRsvp = rsvpsStorage.updateRsvp;
  deleteRsvp = rsvpsStorage.deleteRsvp;

  // Reminder Logs — extracted to ./storage/reminders.ts (W4 Slice 3)
  logReminder = remindersStorage.logReminder;
  getReminderLogs = remindersStorage.getReminderLogs;

  // Auto-scheduled Events — extracted to ./storage/auto-scheduled-events.ts (W4 Slice 3)
  createAutoScheduledEvent = autoScheduledEventsStorage.createAutoScheduledEvent;
  getPendingAutoScheduledEvent = autoScheduledEventsStorage.getPendingAutoScheduledEvent;
  getPendingAutoScheduledEvents = autoScheduledEventsStorage.getPendingAutoScheduledEvents;
  getAutoScheduledEvent = autoScheduledEventsStorage.getAutoScheduledEvent;
  updateAutoScheduledEventStatus = autoScheduledEventsStorage.updateAutoScheduledEventStatus;
  updateAutoScheduledEvent = autoScheduledEventsStorage.updateAutoScheduledEvent;
  getAutoScheduledEventsReadyForAutoSend = autoScheduledEventsStorage.getAutoScheduledEventsReadyForAutoSend;
  hasExistingProposedEvents = autoScheduledEventsStorage.hasExistingProposedEvents;
  countFutureEvents = autoScheduledEventsStorage.countFutureEvents;
  deletePendingAutoEvents = autoScheduledEventsStorage.deletePendingAutoEvents;
  skipAutoScheduledEvent = autoScheduledEventsStorage.skipAutoScheduledEvent;
  deleteAutoScheduledEvent = autoScheduledEventsStorage.deleteAutoScheduledEvent;
  getAutoScheduledEventsTimeline = autoScheduledEventsStorage.getAutoScheduledEventsTimeline;
  getUserUpcomingEventsWithTimeSlots = autoScheduledEventsStorage.getUserUpcomingEventsWithTimeSlots;

  // Frequency Feedback — extracted to ./storage/frequency-feedback.ts (W4 Slice 3)
  createFrequencyFeedback = frequencyFeedbackStorage.createFrequencyFeedback;
  getGroupFrequencyFeedback = frequencyFeedbackStorage.getGroupFrequencyFeedback;

  // User Profiles — extracted to ./storage/user-profiles.ts (W4 Slice 3)
  getUserProfile = userProfilesStorage.getUserProfile;
  upsertUserProfile = userProfilesStorage.upsertUserProfile;

  // Proposed Time Slots + Time Slot Votes — extracted to ./storage/time-slots.ts (W4 Slice 3)
  createProposedTimeSlot = timeSlotsStorage.createProposedTimeSlot;
  createProposedTimeSlots = timeSlotsStorage.createProposedTimeSlots;
  getTimeSlot = timeSlotsStorage.getTimeSlot;
  getItineraryTimeSlots = timeSlotsStorage.getItineraryTimeSlots;
  updateTimeSlotSelection = timeSlotsStorage.updateTimeSlotSelection;
  deleteTimeSlot = timeSlotsStorage.deleteTimeSlot;
  voteForTimeSlot = timeSlotsStorage.voteForTimeSlot;
  getTimeSlotVotes = timeSlotsStorage.getTimeSlotVotes;
  getUserTimeSlotVote = timeSlotsStorage.getUserTimeSlotVote;
  removeTimeSlotVote = timeSlotsStorage.removeTimeSlotVote;
  getItineraryTimeSlotVoteCounts = timeSlotsStorage.getItineraryTimeSlotVoteCounts;

  // Group Collections — extracted to ./storage/group-collections.ts (W4 Slice 3)
  createGroupCollection = groupCollectionsStorage.createGroupCollection;
  getUserGroupCollections = groupCollectionsStorage.getUserGroupCollections;
  updateGroupCollection = groupCollectionsStorage.updateGroupCollection;
  deleteGroupCollection = groupCollectionsStorage.deleteGroupCollection;
  reorderGroupCollections = groupCollectionsStorage.reorderGroupCollections;
  updateGroupCollectionAssignment = groupCollectionsStorage.updateGroupCollectionAssignment;
  reorderGroupsInCollection = groupCollectionsStorage.reorderGroupsInCollection;

  // Event Hosting + Host Assignments — extracted to ./storage/hosting.ts (W4 Slice 3)
  toggleMemberHosting = hostingStorage.toggleMemberHosting;
  volunteerToHost = hostingStorage.volunteerToHost;
  handOffHost = hostingStorage.handOffHost;
  getHostingAvailableMembers = hostingStorage.getHostingAvailableMembers;
  createHostAssignment = hostingStorage.createHostAssignment;
  getPendingHostAssignment = hostingStorage.getPendingHostAssignment;
  getMemberHostAssignments = hostingStorage.getMemberHostAssignments;
  respondToHostAssignment = hostingStorage.respondToHostAssignment;
  getNextHostVolunteer = hostingStorage.getNextHostVolunteer;

  // Category Search History — extracted to ./storage/category-search-history.ts (W4 Slice 3)
  saveCategorySearch = categorySearchHistoryStorage.saveCategorySearch;
  getRecentCategorySearches = categorySearchHistoryStorage.getRecentCategorySearches;

  // Admin Stats — extracted to ./storage/admin-stats.ts (W4 Slice 3)
  getAdminStats = adminStatsStorage.getAdminStats;
  getTestAccounts = adminStatsStorage.getTestAccounts;

  // Database Backup Operations — extracted to ./storage/backups.ts (W4 Slice 3)
  createDatabaseBackup = backupsStorage.createDatabaseBackup;
  getAllDatabaseBackups = backupsStorage.getAllDatabaseBackups;
  getDatabaseBackup = backupsStorage.getDatabaseBackup;
  restoreDatabaseBackup = backupsStorage.restoreDatabaseBackup;
  pruneDatabaseBackups = backupsStorage.pruneDatabaseBackups;

  // Scraped Venues Import — extracted to ./storage/scraped-venues-import.ts (W4 Slice 3)
  clearScrapedImport = scrapedVenuesImportStorage.clearScrapedImport;
  insertScrapedVenues = scrapedVenuesImportStorage.insertScrapedVenues;
  getScrapedVenuesComparison = scrapedVenuesImportStorage.getScrapedVenuesComparison;
  importScrapedVenues = scrapedVenuesImportStorage.importScrapedVenues;

  // Seen Activities — extracted to ./storage/seen-activities.ts (W4 Slice 3)
  markVenuesAsSeen = seenActivitiesStorage.markVenuesAsSeen;
  getSeenVenues = seenActivitiesStorage.getSeenVenues;

  // Curated Venues Management — extracted to ./storage/curated-venues.ts (W4 Slice 3)
  getAllCuratedVenues = curatedVenuesStorage.getAllCuratedVenues;
  updateVenueCategory = curatedVenuesStorage.updateVenueCategory;

  // Member/User/Group Saved Places — extracted to ./storage/saved-places.ts (W4 Slice 3)
  getMemberFavoriteVenues = savedPlacesStorage.getMemberFavoriteVenues;
  getUserAllFavoriteVenues = savedPlacesStorage.getUserAllFavoriteVenues;
  addMemberFavoriteVenue = savedPlacesStorage.addMemberFavoriteVenue;
  removeMemberFavoriteVenue = savedPlacesStorage.removeMemberFavoriteVenue;
  isFavoriteVenue = savedPlacesStorage.isFavoriteVenue;
  getUserSavedPlaces = savedPlacesStorage.getUserSavedPlaces;
  addUserSavedPlace = savedPlacesStorage.addUserSavedPlace;
  removeUserSavedPlace = savedPlacesStorage.removeUserSavedPlace;
  isUserSavedPlace = savedPlacesStorage.isUserSavedPlace;
  getGroupSavedPlaces = savedPlacesStorage.getGroupSavedPlaces;
  addGroupSavedPlace = savedPlacesStorage.addGroupSavedPlace;
  removeGroupSavedPlace = savedPlacesStorage.removeGroupSavedPlace;
  isGroupSavedPlace = savedPlacesStorage.isGroupSavedPlace;

  // Availability Pulses + Responses — extracted to ./storage/availability.ts (W4 Slice 3)
  createAvailabilityPulse = availabilityStorage.createAvailabilityPulse;
  getAvailabilityPulse = availabilityStorage.getAvailabilityPulse;
  getActivePulseForGroup = availabilityStorage.getActivePulseForGroup;
  getActivePulseWithResponses = availabilityStorage.getActivePulseWithResponses;
  updatePulseStatus = availabilityStorage.updatePulseStatus;
  updatePulseEmailSentAt = availabilityStorage.updatePulseEmailSentAt;
  updatePulseReminderSentAt = availabilityStorage.updatePulseReminderSentAt;
  incrementPulseResponseCount = availabilityStorage.incrementPulseResponseCount;
  expireOldPulses = availabilityStorage.expireOldPulses;
  createPulseResponse = availabilityStorage.createPulseResponse;
  updatePulseResponse = availabilityStorage.updatePulseResponse;
  getPulseResponse = availabilityStorage.getPulseResponse;
  getPulseResponseByToken = availabilityStorage.getPulseResponseByToken;
  getPulseResponses = availabilityStorage.getPulseResponses;
  getAggregatedPulseAvailability = availabilityStorage.getAggregatedPulseAvailability;
  getPulseResponseWithDetails = availabilityStorage.getPulseResponseWithDetails;
  getOrCreatePulseResponseForMember = availabilityStorage.getOrCreatePulseResponseForMember;

  // Standalone Events + Invitees — extracted to ./storage/standalone-events.ts (W4 Slice 3)
  createStandaloneEvent = standaloneEventsStorage.createStandaloneEvent;
  getUserStandaloneEvents = standaloneEventsStorage.getUserStandaloneEvents;
  getStandaloneEventsUserRespondedTo = standaloneEventsStorage.getStandaloneEventsUserRespondedTo;
  getStandaloneEvent = standaloneEventsStorage.getStandaloneEvent;
  updateStandaloneEvent = standaloneEventsStorage.updateStandaloneEvent;
  deleteStandaloneEvent = standaloneEventsStorage.deleteStandaloneEvent;
  addStandaloneEventInvitee = standaloneEventsStorage.addStandaloneEventInvitee;
  getStandaloneEventInvitees = standaloneEventsStorage.getStandaloneEventInvitees;
  removeStandaloneEventInvitee = standaloneEventsStorage.removeStandaloneEventInvitee;
  updateStandaloneEventInviteeRsvp = standaloneEventsStorage.updateStandaloneEventInviteeRsvp;
  getStandaloneEventByInviteToken = standaloneEventsStorage.getStandaloneEventByInviteToken;
}

export const storage = new DatabaseStorage();