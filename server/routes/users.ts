/**
 * User Profile, Preferences & Collections Routes
 *
 *   GET    /api/user/profile
 *   PATCH  /api/user/profile
 *   GET    /api/user/preferences
 *   PATCH  /api/user/preferences
 *   GET    /api/user/preferences/groups/:groupId
 *   PATCH  /api/user/preferences/groups/:groupId
 *   GET    /api/user/contacts
 *   GET    /api/user/groups/backup
 *   GET    /api/user/collections
 *   POST   /api/user/collections
 *   PATCH  /api/user/collections/reorder
 *   PATCH  /api/user/collections/:id
 *   DELETE /api/user/collections/:id
 *   GET    /api/user/dashboard
 *   GET    /api/user/hosting-requests
 *
 * Migration: extracted from server/routes.ts
 */

import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, sql, and, or, gte, desc, isNull } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import { getUserId, userOwnsGroup, userIsMemberOfGroup } from "../authorization";
import { safeParse } from "../validation-middleware";
import {
  updateUserPreferencesSchema,
  updateMemberGroupPreferencesSchema,
  createCollectionSchema,
  updateCollectionSchema,
  reorderCollectionsSchema,
} from "../validation-schemas";
import { updateUserProfileSchema } from "@shared/schema";
import {
  users,
  groups as groupsTable,
  members as membersTable,
  itineraries,
  itineraryItems,
  rsvps as rsvpsTable,
  hostAssignments,
} from "@shared/schema";

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

function normalizeRsvpResponse(response: string | null | undefined): 'yes' | 'maybe' | 'no' | null {
  if (!response) return null;
  const r = response.toLowerCase();
  if (r === 'yes' || r === 'going') return 'yes';
  if (r === 'maybe') return 'maybe';
  if (r === 'no' || r === 'not_going') return 'no';
  return null;
}

function isPositiveRsvp(response: string | null | undefined): boolean {
  return normalizeRsvpResponse(response) === 'yes';
}

// ─── profile ──────────────────────────────────────────────────────────────────

router.get("/user/profile", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const profile = await storage.getUserProfile(userId);
    res.json(profile || { displayName: '', bio: '', emailNotifications: true });
  } catch (error: any) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/user/profile", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const validatedData = updateUserProfileSchema.parse(req.body);
    const profile = await storage.upsertUserProfile(userId, validatedData);
    res.json(profile);
  } catch (error: any) {
    console.error("Error updating user profile:", error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// ─── preferences ──────────────────────────────────────────────────────────────

router.get("/user/preferences", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const profile = await storage.getUserProfile(userId);
    res.json({
      budgetMin: profile?.budgetMin || null,
      budgetMax: profile?.budgetMax || null,
      activityPreferences: profile?.activityPreferences || [],
      personalAvailability: profile?.personalAvailability || null,
      emailNotifications: profile?.emailNotifications ?? true,
    });
  } catch (error: any) {
    console.error("Error fetching user preferences:", error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/user/preferences", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const validatedData = safeParse(updateUserPreferencesSchema, req.body, res);
    if (!validatedData) return;

    const { budgetMin, budgetMax, activityPreferences, personalAvailability, emailNotifications } = validatedData;
    const updateData: any = {};
    if (budgetMin !== undefined) updateData.budgetMin = budgetMin;
    if (budgetMax !== undefined) updateData.budgetMax = budgetMax;
    if (activityPreferences !== undefined) updateData.activityPreferences = activityPreferences;
    if (personalAvailability !== undefined) updateData.personalAvailability = personalAvailability;
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;

    const profile = await storage.upsertUserProfile(userId, updateData);
    res.json({
      budgetMin: profile.budgetMin,
      budgetMax: profile.budgetMax,
      activityPreferences: profile.activityPreferences,
      personalAvailability: profile.personalAvailability,
      emailNotifications: profile.emailNotifications,
    });
  } catch (error: any) {
    console.error("Error updating user preferences:", error);
    res.status(500).json({ message: error.message });
  }
});

// Group-specific preference overrides
router.get("/user/preferences/groups/:groupId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    const hasAccess = await userOwnsGroup(userId, groupId) || await userIsMemberOfGroup(userId, groupId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    const preferences = await storage.getMemberGroupPreferences(userId, groupId);
    res.json(preferences || {
      budgetOverrideMin: null,
      budgetOverrideMax: null,
      categoryPreferencesOverride: null,
      availabilityOverride: null,
      meetingFrequencyOverride: null,
    });
  } catch (error: any) {
    console.error("Error fetching group preferences:", error);
    if (error.message === "Unauthorized") {
      return res.status(403).json({ message: "You don't have access to this group" });
    }
    res.status(500).json({ message: error.message });
  }
});

router.patch("/user/preferences/groups/:groupId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    const hasAccess = await userOwnsGroup(userId, groupId) || await userIsMemberOfGroup(userId, groupId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    const validatedData = safeParse(updateMemberGroupPreferencesSchema, req.body, res);
    if (!validatedData) return;

    const {
      budgetOverrideMin,
      budgetOverrideMax,
      categoryPreferencesOverride,
      availabilityOverride,
      meetingFrequencyOverride,
    } = validatedData;

    const updateData: any = {};
    if (budgetOverrideMin !== undefined) updateData.budgetOverrideMin = budgetOverrideMin;
    if (budgetOverrideMax !== undefined) updateData.budgetOverrideMax = budgetOverrideMax;
    if (categoryPreferencesOverride !== undefined) updateData.categoryPreferencesOverride = categoryPreferencesOverride;
    if (availabilityOverride !== undefined) updateData.availabilityOverride = availabilityOverride;
    if (meetingFrequencyOverride !== undefined) updateData.meetingFrequencyOverride = meetingFrequencyOverride;

    const preferences = await storage.upsertMemberGroupPreferences(userId, groupId, updateData);
    res.json(preferences);
  } catch (error: any) {
    console.error("Error updating group preferences:", error);
    if (error.message === "Unauthorized") {
      return res.status(403).json({ message: "You don't have access to this group" });
    }
    res.status(500).json({ message: error.message });
  }
});

// ─── contacts & backup ────────────────────────────────────────────────────────

router.get("/user/contacts", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const contacts = await storage.getUserContacts(userId);
    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/user/groups/backup", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const groups = await storage.getUserGroups(userId);

    const backup = {
      exportedAt: new Date().toISOString(),
      userId,
      groupCount: groups.length,
      groups,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="kinmo-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(backup);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ─── collections ──────────────────────────────────────────────────────────────

router.get("/user/collections", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const collections = await storage.getUserGroupCollections(userId);
    res.json(collections);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// IMPORTANT: reorder must come before /:id to avoid route conflict
router.patch("/user/collections/reorder", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const validatedData = safeParse(reorderCollectionsSchema, req.body, res);
    if (!validatedData) return;

    const { collectionOrders } = validatedData;
    const userCollections = await storage.getUserGroupCollections(userId);
    const userCollectionIds = new Set(userCollections.map((c: any) => c.id));
    const allOwned = collectionOrders.every((order: any) => userCollectionIds.has(order.id));

    if (!allOwned) {
      return res.status(403).json({ message: "You don't own all these collections" });
    }

    await storage.reorderGroupCollections(collectionOrders);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Reorder Collections] Error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/user/collections", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const validatedData = safeParse(createCollectionSchema, req.body, res);
    if (!validatedData) return;

    const { name, orderIndex } = validatedData;
    const collection = await storage.createGroupCollection(userId, { name, orderIndex });
    res.json(collection);
  } catch (error: any) {
    console.error("[Create Collection] Error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/user/collections/:id", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = await getUserId(req);
    const validatedData = safeParse(updateCollectionSchema, req.body, res);
    if (!validatedData) return;

    const { name } = validatedData;
    const collections = await storage.getUserGroupCollections(userId);
    const collection = collections.find((c: any) => c.id === id);
    if (!collection) {
      return res.status(404).json({ message: "Collection not found" });
    }

    const updated = await storage.updateGroupCollection(id, { name });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/user/collections/:id", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = await getUserId(req);

    const collections = await storage.getUserGroupCollections(userId);
    const collection = collections.find((c: any) => c.id === id);
    if (!collection) {
      return res.status(404).json({ message: "Collection not found" });
    }

    await storage.deleteGroupCollection(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ─── dashboard ────────────────────────────────────────────────────────────────

router.get("/user/dashboard", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const memberGroups = await db
      .select({
        groupId: membersTable.groupId,
        memberId: membersTable.id,
        memberSince: membersTable.createdAt,
        isOrganizer: membersTable.isOrganizer,
      })
      .from(membersTable)
      .where(eq(membersTable.userId, userId));

    const ownedGroups = await db
      .select({
        id: groupsTable.id,
        name: groupsTable.name,
        emoji: groupsTable.emoji,
        locationBase: groupsTable.locationBase,
        createdAt: groupsTable.createdAt,
      })
      .from(groupsTable)
      .where(eq(groupsTable.userId, userId));

    const allGroupIds = new Set([
      ...memberGroups.map(m => m.groupId),
      ...ownedGroups.map(g => g.id),
    ]);

    const groupResults = await Promise.allSettled(
      Array.from(allGroupIds).map(async (groupId) => {
        const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
        if (!group || group.deletedAt) return null;

        const memberRecord = memberGroups.find(m => m.groupId === groupId);
        const isOwner = group.userId === userId;

        const memberCount = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(membersTable)
          .where(eq(membersTable.groupId, groupId));

        const upcomingEventsCount = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(itineraries)
          .where(
            and(
              eq(itineraries.groupId, groupId),
              or(eq(itineraries.status, 'proposed'), eq(itineraries.status, 'scheduled')),
              gte(itineraries.eventDate, new Date())
            )
          );

        return {
          id: group.id,
          name: group.name,
          emoji: group.emoji,
          locationBase: group.locationBase,
          memberSince: memberRecord?.memberSince || group.createdAt,
          isOrganizer: isOwner || (memberRecord?.isOrganizer || false),
          isOwner,
          memberCount: memberCount[0]?.count || 0,
          upcomingEvents: upcomingEventsCount[0]?.count || 0,
        };
      })
    );

    const groups = groupResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    const failedGroups = groupResults.filter(r => r.status === 'rejected');
    if (failedGroups.length > 0) {
      console.error(`[Dashboard] ${failedGroups.length}/${allGroupIds.size} group fetches failed`);
    }

    const validGroups = groups.filter(g => g !== null);

    const allItineraries = await db
      .select({
        id: itineraries.id,
        groupId: itineraries.groupId,
        name: itineraries.name,
        status: itineraries.status,
        eventDate: itineraries.eventDate,
        createdAt: itineraries.createdAt,
      })
      .from(itineraries)
      .where(
        and(
          sql`group_id IN (${sql.join(Array.from(allGroupIds), sql`, `)})`,
          or(
            eq(itineraries.status, 'proposed'),
            eq(itineraries.status, 'scheduled'),
            eq(itineraries.status, 'completed')
          )
        )
      )
      .orderBy(desc(itineraries.eventDate));

    const allRsvps = await db
      .select()
      .from(rsvpsTable)
      .where(
        or(
          eq(rsvpsTable.userId, userId),
          sql`member_id IN (SELECT id FROM members WHERE user_id = ${userId})`
        )
      );

    const now = new Date();
    const upcomingEvents = [];
    const pastEvents = [];
    let totalInvited = 0;
    let totalAttended = 0;
    let totalResponded = 0;

    for (const itinerary of allItineraries) {
      const group = validGroups.find(g => g.id === itinerary.groupId);
      if (!group) continue;

      const rsvp = allRsvps.find(r => r.itineraryId === itinerary.id);
      const isPast = itinerary.eventDate && itinerary.eventDate < now;

      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itinerary.id))
        .orderBy(itineraryItems.orderIndex)
        .limit(3);

      const eventData = {
        id: itinerary.id,
        name: itinerary.name,
        groupId: itinerary.groupId,
        groupName: group.name,
        groupEmoji: group.emoji,
        status: itinerary.status,
        eventDate: itinerary.eventDate,
        rsvpStatus: rsvp?.response || null,
        isOrganizer: group.isOrganizer,
        attended: isPositiveRsvp(rsvp?.response),
        venues: items.map((item: any) => ({ name: item.venueName, type: item.venueType })),
      };

      totalInvited++;
      if (rsvp?.response) totalResponded++;
      if (isPositiveRsvp(rsvp?.response)) totalAttended++;

      if (isPast) {
        pastEvents.push(eventData);
      } else {
        upcomingEvents.push(eventData);
      }
    }

    const stats = {
      totalGroups: validGroups.length,
      totalEventsInvited: totalInvited,
      totalEventsAttended: totalAttended,
      attendanceRate: totalInvited > 0 ? Math.round((totalAttended / totalInvited) * 100) : 0,
      rsvpResponseRate: totalInvited > 0 ? Math.round((totalResponded / totalInvited) * 100) : 0,
    };

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      },
      groups: validGroups,
      upcomingEvents: upcomingEvents.slice(0, 10),
      pastEvents: pastEvents.slice(0, 10),
      stats,
    });
  } catch (error) {
    console.error("Error fetching member dashboard:", error);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

// ─── hosting requests ─────────────────────────────────────────────────────────

router.get("/user/hosting-requests", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);

    const userMembers = await db
      .select({ id: membersTable.id })
      .from(membersTable)
      .where(eq(membersTable.userId, userId));

    if (userMembers.length === 0) {
      return res.json([]);
    }

    const memberIds = userMembers.map(m => m.id);

    const assignments = await db
      .select({
        id: hostAssignments.id,
        itineraryId: hostAssignments.itineraryId,
        itineraryName: itineraries.name,
        eventDate: itineraries.eventDate,
        groupId: itineraries.groupId,
        groupName: groupsTable.name,
        groupEmoji: groupsTable.emoji,
      })
      .from(hostAssignments)
      .leftJoin(itineraries, eq(hostAssignments.itineraryId, itineraries.id))
      .leftJoin(groupsTable, eq(itineraries.groupId, groupsTable.id))
      .where(sql`${hostAssignments.memberId} IN ${memberIds} AND ${hostAssignments.status} = 'pending'`);

    res.json(assignments);
  } catch (error: any) {
    console.error('[Hosting Requests] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
