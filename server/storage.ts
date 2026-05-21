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
import { usersStorage } from "./storage/users";
import { itinerariesStorage } from "./storage/itineraries";
import { groupsStorage } from "./storage/groups";

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
  // User operations — extracted to ./storage/users.ts (W4 Slice 3)
  getUser = usersStorage.getUser;
  getUserByEmail = usersStorage.getUserByEmail;
  upsertUser = usersStorage.upsertUser;

  // Groups — extracted to ./storage/groups.ts (W4 Slice 3)
  createGroup = groupsStorage.createGroup;
  getUserGroups = groupsStorage.getUserGroups;
  getUserContacts = groupsStorage.getUserContacts;
  getAllGroups = groupsStorage.getAllGroups;
  getGroup = groupsStorage.getGroup;
  getGroupByShareableLink = groupsStorage.getGroupByShareableLink;
  updateGroupStatus = groupsStorage.updateGroupStatus;
  addRejectedVenue = groupsStorage.addRejectedVenue;
  updateGroup = groupsStorage.updateGroup;
  softDeleteGroup = groupsStorage.softDeleteGroup;
  cleanupOrphanedVotingData = groupsStorage.cleanupOrphanedVotingData;
  hardDeleteGroup = groupsStorage.hardDeleteGroup;
  createAutomaticBackup = groupsStorage.createAutomaticBackup;

  // Members — extracted to ./storage/members.ts (W4 Slice 3)
  getGroupMembers = membersStorage.getGroupMembers;
  createMember = membersStorage.createMember;
  markInvitationsSent = membersStorage.markInvitationsSent;
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

  // Activities — extracted to ./storage/activities.ts (W4 Slice 3)
  getGroupActivities = activitiesStorage.getGroupActivities;
  getAllGroupActivities = activitiesStorage.getAllGroupActivities;
  archiveGroupActivities = activitiesStorage.archiveGroupActivities;
  deleteAllGroupActivities = activitiesStorage.deleteAllGroupActivities;
  deleteActivity = activitiesStorage.deleteActivity;
  getActivity = activitiesStorage.getActivity;
  createActivity = activitiesStorage.createActivity;
  createActivities = activitiesStorage.createActivities;
  updateActivityFeedback = activitiesStorage.updateActivityFeedback;

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

  // Itineraries — extracted to ./storage/itineraries.ts (W4 Slice 3)
  createItinerary = itinerariesStorage.createItinerary;
  getGroupItineraries = itinerariesStorage.getGroupItineraries;
  getItinerary = itinerariesStorage.getItinerary;
  updateItinerary = itinerariesStorage.updateItinerary;
  deleteItinerary = itinerariesStorage.deleteItinerary;
  getItineraryItemById = itinerariesStorage.getItineraryItemById;
  deleteItineraryItem = itinerariesStorage.deleteItineraryItem;
  addItineraryItems = itinerariesStorage.addItineraryItems;
  addAdHocVenueToItinerary = itinerariesStorage.addAdHocVenueToItinerary;
  updateItineraryItem = itinerariesStorage.updateItineraryItem;
  updateItineraryItemOrder = itinerariesStorage.updateItineraryItemOrder;
  getSavedItineraries = itinerariesStorage.getSavedItineraries;
  getProposedItineraries = itinerariesStorage.getProposedItineraries;

  // Venue Visit Tracking — extracted to ./storage/venue-visit-tracking.ts (W4 Slice 3)
  logVenueVisits = venueVisitTrackingStorage.logVenueVisits;
  getVenueVisitHistory = venueVisitTrackingStorage.getVenueVisitHistory;
  getHighlyRatedVenues = venueVisitTrackingStorage.getHighlyRatedVenues;

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