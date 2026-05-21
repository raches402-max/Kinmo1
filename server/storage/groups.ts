import { db } from "../db";
import {
  groups,
  users,
  members,
  votingEvents,
  votes,
  groupBackups,
  standaloneEventInvitees,
  type Group,
  type InsertGroup,
  type UpdateGroup,
} from "@shared/schema";
import { eq, and, or, inArray, isNull, isNotNull, desc, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { membersStorage } from "./members";

export const groupsStorage = {
  async createGroup(
    insertGroup: InsertGroup,
    userId: string,
    memberInputs: Array<{ name?: string; email?: string }>
  ): Promise<Group> {
    const shareableLink = randomBytes(16).toString('hex');

    const [group] = await db
      .insert(groups)
      .values({ ...insertGroup, userId, shareableLink })
      .returning();

    const organizer = await db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0]);

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
      hasJoined: true,
    };

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

    await groupsStorage.createAutomaticBackup(group.id, userId, 'create');

    return group;
  },

  async getUserGroups(userId: string): Promise<Array<Group & { members: Array<{ id: string; name: string | null; email: string | null }> }>> {
    // RECONCILIATION STEP: Reclaim orphaned data where user memberships were nulled
    const user = await db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0]);
    if (user?.email) {
      const orphanedGroups = await db
        .selectDistinct()
        .from(groups)
        .innerJoin(members, eq(members.groupId, groups.id))
        .where(and(
          isNull(groups.userId),
          eq(members.isOrganizer, true),
          eq(members.email, user.email),
          isNull(groups.deletedAt)
        ))
        .then(rows => rows.map(row => row.groups));

      if (orphanedGroups.length > 0) {
        console.log(`[Reconciliation] Re-linking ${orphanedGroups.length} orphaned groups to user ${userId} (${user.email})`);
        await db
          .update(groups)
          .set({ userId })
          .where(inArray(groups.id, orphanedGroups.map(g => g.id)));
      }

      const tier1Members = await db
        .select()
        .from(members)
        .where(and(
          isNull(members.userId),
          eq(members.email, user.email),
          or(
            eq(members.invitationSent, true),
            eq(members.isGuest, true)
          )
        ));

      if (tier1Members.length > 0) {
        console.log(`[Auto-Link] Linking ${tier1Members.length} Tier 1 member records to user ${userId} (${user.email})`);
        await db
          .update(members)
          .set({ userId, hasJoined: true, isGuest: false, claimedAt: new Date() })
          .where(inArray(members.id, tier1Members.map(m => m.id)));
      }

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

    const organizedGroups = await db
      .select()
      .from(groups)
      .where(and(eq(groups.userId, userId), isNull(groups.deletedAt)));

    const memberGroups = await db
      .selectDistinct()
      .from(groups)
      .innerJoin(members, eq(members.groupId, groups.id))
      .where(and(eq(members.userId, userId), isNull(groups.deletedAt)))
      .then(rows => rows.map(row => row.groups));

    const allGroups = [...organizedGroups, ...memberGroups];
    const uniqueGroups = Array.from(
      new Map(allGroups.map(g => [g.id, g])).values()
    );

    const groupsWithMembers = await Promise.all(
      uniqueGroups.map(async (group) => {
        const groupMembers = await membersStorage.getGroupMembers(group.id);
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
  },

  async getUserContacts(userId: string): Promise<Array<{
    id: string;
    name: string;
    email: string | null;
    userId: string | null;
    memberId: string;
    sourceGroupId: string;
    sourceGroupName: string;
    sourceGroupEmoji: string | null;
  }>> {
    const userGroups = await groupsStorage.getUserGroups(userId);

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
      const groupMembers = await membersStorage.getGroupMembers(group.id);
      for (const member of groupMembers) {
        if (member.userId === userId) continue;

        allContacts.push({
          id: member.id,
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

    const contactsByEmail = new Map<string, typeof allContacts[0]>();
    const contactsWithoutEmail: typeof allContacts = [];

    for (const contact of allContacts) {
      if (contact.email) {
        const existing = contactsByEmail.get(contact.email.toLowerCase());
        if (!existing || (contact.userId && !existing.userId)) {
          contactsByEmail.set(contact.email.toLowerCase(), contact);
        }
      } else {
        contactsWithoutEmail.push(contact);
      }
    }

    return [...contactsByEmail.values(), ...contactsWithoutEmail];
  },

  async getAllGroups(): Promise<Group[]> {
    return await db.select().from(groups).where(isNull(groups.deletedAt));
  },

  async getGroup(id: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(and(eq(groups.id, id), isNull(groups.deletedAt)));
    return group || undefined;
  },

  async getGroupByShareableLink(link: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(and(eq(groups.shareableLink, link), isNull(groups.deletedAt)));
    return group || undefined;
  },

  async updateGroupStatus(id: string, status: string, error?: string): Promise<void> {
    await db
      .update(groups)
      .set({
        activityGenerationStatus: status,
        activityGenerationError: error || null
      })
      .where(eq(groups.id, id));
  },

  async addRejectedVenue(groupId: string, venueName: string): Promise<void> {
    const normalized = venueName.trim().toLowerCase();

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
  },

  async updateGroup(id: string, updates: UpdateGroup): Promise<Group> {
    const [group] = await db
      .update(groups)
      .set(updates)
      .where(eq(groups.id, id))
      .returning();

    await groupsStorage.createAutomaticBackup(group.id, group.userId, 'update');

    return group;
  },

  /**
   * Soft delete a group and clean up associated voting events
   * This prevents orphaned favorited venues from appearing in other groups
   */
  async softDeleteGroup(id: string): Promise<void> {
    const group = await groupsStorage.getGroup(id);
    if (group) {
      await groupsStorage.createAutomaticBackup(group.id, group.userId, 'delete');
    }

    const eventsToDelete = await db
      .select({ id: votingEvents.id })
      .from(votingEvents)
      .where(eq(votingEvents.groupId, id));

    const eventIds = eventsToDelete.map(e => e.id);

    if (eventIds.length > 0) {
      await db
        .delete(votes)
        .where(inArray(votes.eventId, eventIds));
    }

    await db
      .delete(votingEvents)
      .where(eq(votingEvents.groupId, id));

    await db
      .update(groups)
      .set({ deletedAt: sql`now()` })
      .where(eq(groups.id, id));

    console.log(`[Soft Delete] Group ${id} soft-deleted, ${eventIds.length} voting events and associated votes cleaned up`);
  },

  /**
   * Clean up orphaned voting data from deleted groups
   */
  async cleanupOrphanedVotingData(): Promise<{ votingEventsDeleted: number; votesDeleted: number }> {
    const orphanedEvents = await db
      .select({ id: votingEvents.id })
      .from(votingEvents)
      .leftJoin(groups, eq(votingEvents.groupId, groups.id))
      .where(or(
        isNull(groups.id),
        isNotNull(groups.deletedAt)
      ));

    const orphanedEventIds = orphanedEvents.map(e => e.id);

    let votesDeleted = 0;
    let votingEventsDeleted = 0;

    if (orphanedEventIds.length > 0) {
      const deletedVotes = await db
        .delete(votes)
        .where(inArray(votes.eventId, orphanedEventIds))
        .returning();

      votesDeleted = deletedVotes.length;

      const deletedEvents = await db
        .delete(votingEvents)
        .where(inArray(votingEvents.id, orphanedEventIds))
        .returning();

      votingEventsDeleted = deletedEvents.length;

      console.log(`[Cleanup] Removed ${votingEventsDeleted} orphaned voting events and ${votesDeleted} orphaned votes`);
    } else {
      console.log(`[Cleanup] No orphaned voting data found`);
    }

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
  },

  /**
   * Permanently delete a group and all associated data
   * WARNING: This is irreversible!
   */
  async hardDeleteGroup(id: string): Promise<void> {
    const group = await groupsStorage.getGroup(id);
    if (group) {
      await groupsStorage.createAutomaticBackup(group.id, group.userId, 'hard_delete');
      console.log(`[Hard Delete] Created backup for group ${id}`);
    }

    await db
      .delete(groups)
      .where(eq(groups.id, id));

    console.log(`[Hard Delete] Group ${id} permanently deleted with all associated data`);
  },

  async createAutomaticBackup(groupId: string, userId: string | null, trigger: string): Promise<void> {
    try {
      const group = await groupsStorage.getGroup(groupId);
      if (!group) return;

      const groupMembers = await membersStorage.getGroupMembers(groupId);

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
    }
  },
};
