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
 *   POST   /api/user/delete
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, sql, and, or, gte, desc, isNull } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import { getUserId, userOwnsGroup, userIsMemberOfGroup } from "../authorization";
import { safeParse } from "../validation-middleware";
import { fail } from "../lib/responses";
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
  userProfiles,
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
    fail(res, 500, safeError(error));
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
      return fail(res, 400, "Invalid profile data", { errors: error.errors });
    }
    fail(res, 500, safeError(error));
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
    fail(res, 500, safeError(error));
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
    fail(res, 500, safeError(error));
  }
});

// Group-specific preference overrides
router.get("/user/preferences/groups/:groupId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    const hasAccess = await userOwnsGroup(userId, groupId) || await userIsMemberOfGroup(userId, groupId);
    if (!hasAccess) {
      return fail(res, 403, "Access denied");
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
      return fail(res, 403, "You don't have access to this group");
    }
    fail(res, 500, safeError(error));
  }
});

router.patch("/user/preferences/groups/:groupId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    const hasAccess = await userOwnsGroup(userId, groupId) || await userIsMemberOfGroup(userId, groupId);
    if (!hasAccess) {
      return fail(res, 403, "Access denied");
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
      return fail(res, 403, "You don't have access to this group");
    }
    fail(res, 500, safeError(error));
  }
});

// ─── contacts & backup ────────────────────────────────────────────────────────

router.get("/user/contacts", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const contacts = await storage.getUserContacts(userId);
    res.json(contacts);
  } catch (error: any) {
    fail(res, 500, safeError(error));
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
    fail(res, 500, safeError(error));
  }
});

// ─── collections ──────────────────────────────────────────────────────────────

router.get("/user/collections", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const collections = await storage.getUserGroupCollections(userId);
    res.json(collections);
  } catch (error: any) {
    fail(res, 500, safeError(error));
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
      return fail(res, 403, "You don't own all these collections");
    }

    await storage.reorderGroupCollections(collectionOrders);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Reorder Collections] Error:", error);
    fail(res, 500, safeError(error));
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
    fail(res, 500, safeError(error));
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
      return fail(res, 404, "Collection not found");
    }

    const updated = await storage.updateGroupCollection(id, { name });
    res.json(updated);
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

router.delete("/user/collections/:id", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = await getUserId(req);

    const collections = await storage.getUserGroupCollections(userId);
    const collection = collections.find((c: any) => c.id === id);
    if (!collection) {
      return fail(res, 404, "Collection not found");
    }

    await storage.deleteGroupCollection(id);
    res.json({ success: true });
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

// ─── dashboard ────────────────────────────────────────────────────────────────

router.get("/user/dashboard", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return fail(res, 404, "User not found");
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
    fail(res, 500, "Failed to fetch dashboard data");
  }
});

// ─── account deletion ─────────────────────────────────────────────────────────

// Anonymize-not-delete: we keep the users row as a tombstone (FK integrity for
// groups/memberships/RSVPs owned or referenced by this user) but wipe all PII.
// Hard-deleting cascades to other users' data via onDelete:"cascade", which is
// unacceptable. Precondition: user must not organize any active groups — they
// must delete those groups first (transfer-ownership is a separate v2 feature).
router.post("/user/delete", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);

    if (req.body?.confirmation !== "DELETE") {
      return res.status(400).json({
        success: false,
        error: "CONFIRMATION_REQUIRED",
        message: 'Send { "confirmation": "DELETE" } in the request body.',
      });
    }

    const activeOwnedGroups = await db
      .select({ id: groupsTable.id, name: groupsTable.name })
      .from(groupsTable)
      .where(and(eq(groupsTable.userId, userId), isNull(groupsTable.deletedAt)));

    if (activeOwnedGroups.length > 0) {
      return res.status(409).json({
        success: false,
        error: "ACTIVE_GROUPS_EXIST",
        groups: activeOwnedGroups,
        message: `You organize ${activeOwnedGroups.length} active group(s). Delete them first, then delete your account.`,
      });
    }

    const [existing] = await db.select().from(users).where(eq(users.id, userId));
    if (!existing) {
      return res.status(404).json({ success: false, error: "USER_NOT_FOUND" });
    }
    if (existing.deletedAt) {
      return res.status(410).json({ success: false, error: "ALREADY_DELETED" });
    }

    // Destroy sessions for this user BEFORE anonymizing email — connect-pg-simple
    // stores the email claim in the session JSON, so match by the still-current value.
    await db.execute(sql`
      DELETE FROM sessions
      WHERE sess->'passport'->'user'->'claims'->>'email' = ${existing.email}
    `);

    await db
      .update(users)
      .set({
        email: `deleted-${userId}@deleted.kinmo.local`,
        oidcSub: null,
        googleId: null,
        legacyOidcSubs: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await db.delete(userProfiles).where(eq(userProfiles.userId, userId));

    req.logout?.((err: any) => {
      if (err) console.error("[AccountDelete] logout error:", err);
      req.session?.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    });
  } catch (error: any) {
    console.error("[AccountDelete] Error:", error);
    res.status(500).json({ success: false, error: safeError(error) });
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
    fail(res, 500, safeError(error));
  }
});

export default router;
