/**
 * Group Join / Share Link Routes
 *
 * Routes:
 *   GET  /api/groups/by-link/:shareableLink        — fetch group by shareable link (public)
 *   GET  /api/groups/join-preview/:shareableLink   — social proof preview before joining (public)
 *   POST /api/groups/:id/join                      — join a group (invite token or shareable link)
 *
 * MIGRATED FROM: server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { fail } from "../lib/responses";
import {
  members as membersTable,
  users,
  userProfiles,
  votingEvents as votingEventsTable,
} from "@shared/schema";
import { safeParse } from "../validation-middleware";
import { joinGroupSchema } from "../validation-schemas";

const router = Router();

const publicEndpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: build member list including the organizer as a virtual member entry
async function getGroupMembersWithOrganizer(groupId: string, organizerUserId: string) {
  const [organizerInfo] = await db
    .select({
      displayName: userProfiles.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, organizerUserId));

  const organizerName =
    organizerInfo?.displayName ||
    (organizerInfo?.firstName && organizerInfo?.lastName
      ? `${organizerInfo.firstName} ${organizerInfo.lastName}`
      : organizerInfo?.firstName || organizerInfo?.email?.split("@")[0] || "Organizer");

  const members = await storage.getGroupMembers(groupId);

  const hasOrganizerMember = members.some((m) => m.userId === organizerUserId);

  if (!hasOrganizerMember) {
    const virtualOrganizer = {
      id: `organizer-${organizerUserId}`,
      groupId,
      name: organizerName,
      email: organizerInfo?.email || null,
      userId: organizerUserId,
      hasJoined: true,
      isGuest: false,
      rsvpStatus: null,
      claimToken: null,
      memberLocation: null,
      memberBudgetMin: null,
      memberBudgetMax: null,
      memberAvailability: null,
      activityPreferences: null,
      personalAvailability: null,
      homeBaseLocation: null,
      homeBaseLatitude: null,
      homeBaseLongitude: null,
      profileCompleted: true,
      memberConstraints: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return [...members, virtualOrganizer as any];
  }

  return members;
}

// ── Get group by shareable link ────────────────────────────────────────────

router.get("/groups/by-link/:shareableLink", publicEndpointLimiter, async (req, res) => {
  try {
    const group = await storage.getGroupByShareableLink(req.params.shareableLink);
    if (!group) {
      return fail(res, 404, "Group not found");
    }

    if (!group.inviteLinkOpen) {
      return res.status(403).json({
        message: "This invite link is no longer active",
        linkClosed: true,
      });
    }

    const safeGroup = {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      locationBase: group.locationBase,
      budgetMin: group.budgetMin,
      budgetMax: group.budgetMax,
      meetingFrequency: group.meetingFrequency,
      generalAvailability: group.generalAvailability,
      activityCategories: group.activityCategories,
      shareableLink: group.shareableLink,
      inviteLinkOpen: group.inviteLinkOpen,
    };

    res.json(safeGroup);
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

// ── Get join preview (social proof) ───────────────────────────────────────

router.get("/groups/join-preview/:shareableLink", publicEndpointLimiter, async (req, res) => {
  try {
    const group = await storage.getGroupByShareableLink(req.params.shareableLink);
    if (!group) {
      return fail(res, 404, "Group not found");
    }

    if (!group.inviteLinkOpen) {
      return res.status(403).json({
        message: "This invite link is no longer active",
        linkClosed: true,
      });
    }

    const allMembers = group.userId
      ? await getGroupMembersWithOrganizer(group.id, group.userId)
      : await storage.getGroupMembers(group.id);

    const totalMembers = allMembers.length;
    const joinedMembers = allMembers.filter((m) => m.userId !== null);
    const joinedCount = joinedMembers.length;
    const joinedPercentage = totalMembers > 0 ? (joinedCount / totalMembers) * 100 : 0;

    const showSocialProof = joinedPercentage >= 50 && joinedCount >= 2;
    let socialProofNames: string[] = [];
    if (showSocialProof) {
      socialProofNames = joinedMembers.slice(0, 3).map((m) => m.name);
    }

    const allItineraries = await storage.getGroupItineraries(group.id);
    const now = new Date();
    const upcomingEvents = allItineraries
      .filter((i) => i.eventDate && new Date(i.eventDate) >= now)
      .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())
      .slice(0, 1);
    const upcomingEvent =
      upcomingEvents.length > 0
        ? {
            eventDate: upcomingEvents[0].eventDate,
          }
        : null;

    const votingEventsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(votingEventsTable)
      .where(eq(votingEventsTable.groupId, group.id))
      .then((rows) => rows[0]?.count || 0);

    res.json({
      group: {
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        locationBase: group.locationBase,
      },
      memberStats: {
        total: totalMembers,
        joined: joinedCount,
        percentage: Math.round(joinedPercentage),
      },
      socialProof: showSocialProof
        ? {
            names: socialProofNames,
            remainingCount: joinedCount - socialProofNames.length,
          }
        : null,
      upcomingEvent,
      venuesBeingConsidered: Number(votingEventsCount),
    });
  } catch (error: any) {
    console.error("[JoinPreview] Error:", error);
    fail(res, 500, safeError(error));
  }
});

// ── Join a group ───────────────────────────────────────────────────────────

router.post("/groups/:id/join", async (req, res) => {
  try {
    const validatedData = safeParse(joinGroupSchema, req.body, res);
    if (!validatedData) return;

    const { name, email, inviteToken, shareableLink } = validatedData;

    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return fail(res, 404, "Group not found");
    }

    if (!group.inviteLinkOpen && shareableLink) {
      return res.status(403).json({
        message: "This invite link is no longer active",
        linkClosed: true,
      });
    }

    let existingMember: any = null;

    if (inviteToken) {
      const [memberByToken] = await db
        .select()
        .from(membersTable)
        .where(sql`claim_token = ${inviteToken}`);

      if (!memberByToken || memberByToken.groupId !== req.params.id) {
        return fail(res, 403, "Invalid invite token");
      }
      existingMember = memberByToken;
    } else if (shareableLink) {
      if (group.shareableLink !== shareableLink) {
        return fail(res, 403, "Invalid invite link");
      }
      if (!name || !name.trim()) {
        return fail(res, 400, "Name is required to join");
      }
      const newMember = await storage.createMember({
        groupId: req.params.id,
        name: name.trim(),
        email: email || null,
        hasJoined: true,
        isGuest: true,
      });
      return res.json(newMember);
    } else {
      return fail(res, 403, "Invite token or email required to join");
    }

    if (existingMember) {
      const updatedMember = await storage.updateMember(existingMember.id, {
        name: name || existingMember.name,
        hasJoined: true,
      });
      return res.json(updatedMember);
    }

    return fail(res, 403, "Unable to join group");
  } catch (error: any) {
    fail(res, 400, error.message);
  }
});

export default router;
