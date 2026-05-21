import { db } from "../db";
import {
  databaseBackups,
  groups,
  members,
  activities,
  itineraries,
  itineraryItems,
  rsvps,
  votingEvents,
  votes,
  proposedTimeSlots,
  timeSlotVotes,
  groupCollections,
  autoScheduledEvents,
  hostAssignments,
} from "@shared/schema";
import { eq, desc, inArray } from "drizzle-orm";

export const backupsStorage = {
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
  },

  async getAllDatabaseBackups(): Promise<any[]> {
    const backups = await db
      .select()
      .from(databaseBackups)
      .orderBy(desc(databaseBackups.createdAt))
      .limit(100);

    return backups;
  },

  async getDatabaseBackup(backupId: string): Promise<any | undefined> {
    const [backup] = await db
      .select()
      .from(databaseBackups)
      .where(eq(databaseBackups.id, backupId));

    return backup;
  },

  async restoreDatabaseBackup(backupId: string): Promise<void> {
    try {
      console.log(`[RESTORE] Starting restore from backup ${backupId}...`);

      const backup = await backupsStorage.getDatabaseBackup(backupId);
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
  },

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
  },
};
