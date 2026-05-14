/**
 * Members CRUD Routes
 *
 * Basic member lifecycle for groups.
 *
 * Routes:
 *   GET    /api/groups/:id/members              — list members of a group (public)
 *   GET    /api/members/:id                     — get member by ID (public)
 *   PATCH  /api/members/:id                     — update member (auth required)
 *   DELETE /api/members/:id                     — delete member (group owner only)
 *   DELETE /api/groups/:groupId/members/:memberId — self-remove from group (auth required)
 *
 * MIGRATED FROM: server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId } from "../authorization";
import { updateMemberSchema } from "@shared/schema";
import {
  members as membersTable,
  users,
  userProfiles,
} from "@shared/schema";

const router = Router();

// Rate limiter for public endpoints (mirrors the one in routes.ts)
const publicEndpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
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
      : organizerInfo?.firstName ||
        organizerInfo?.email?.split("@")[0] ||
        "Organizer");
  const organizerEmail = organizerInfo?.email || null;

  const regularMembers = await db
    .select({
      id: membersTable.id,
      name: membersTable.name,
      email: membersTable.email,
      openToHosting: membersTable.openToHosting,
      userId: membersTable.userId,
      isGuest: membersTable.isGuest,
    })
    .from(membersTable)
    .where(eq(membersTable.groupId, groupId));

  const organizerMemberRecord = regularMembers.find(
    (m) =>
      m.userId === organizerUserId ||
      (organizerEmail &&
        m.email &&
        m.email.toLowerCase() === organizerEmail.toLowerCase())
  );

  const filteredMembers = regularMembers.filter(
    (m) =>
      m.userId !== organizerUserId &&
      !(
        organizerEmail &&
        m.email &&
        m.email.toLowerCase() === organizerEmail.toLowerCase()
      )
  );

  const organizerEntry: any = {
    id: organizerMemberRecord?.id || `organizer-${organizerUserId}`,
    name: organizerMemberRecord?.name || organizerName,
    email: organizerEmail,
    openToHosting: organizerMemberRecord?.openToHosting || false,
    userId: organizerUserId,
    isGuest: false,
    isOrganizer: true,
    hasJoined: true,
    rsvpStatus: "attending",
  };

  return [organizerEntry, ...filteredMembers];
}

// ── GET /api/groups/:id/members ──────────────────────────────────────────────
// List all members of a group (public endpoint with rate limit)
router.get("/groups/:id/members", publicEndpointLimiter, async (req, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const allMembers = group.userId
      ? await getGroupMembersWithOrganizer(req.params.id, group.userId)
      : await storage.getGroupMembers(req.params.id);

    // Filter sensitive fields for public access
    const safeMembers = allMembers.map((m: any) => ({
      id: m.id,
      name: m.name,
      isOrganizer: m.isOrganizer || false,
      isGuest: m.isGuest || false,
      rsvpStatus: m.rsvpStatus,
      hasJoined: m.hasJoined,
      openToHosting: m.openToHosting || false,
      // Obfuscate actual userId but indicate claimed status
      userId: m.userId ? "claimed" : null,
    }));

    res.json(safeMembers);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// ── GET /api/members/:id ─────────────────────────────────────────────────────
// Get a single member (public endpoint — sensitive fields gated by auth)
router.get("/members/:id", publicEndpointLimiter, async (req: any, res) => {
  try {
    const member = await storage.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    let authenticatedUserId: string | null = null;
    try {
      authenticatedUserId = await getUserId(req);
    } catch {
      // Not authenticated — public access only
    }

    const safeMember: any = {
      id: member.id,
      name: member.name,
      groupId: member.groupId,
      isOrganizer: member.isOrganizer,
      openToHosting: member.openToHosting,
      hasJoined: member.hasJoined,
    };

    if (authenticatedUserId) {
      safeMember.userId = member.userId;
      safeMember.homeBaseLocation = member.homeBaseLocation;
      safeMember.homeBaseLatitude = member.homeBaseLatitude;
      safeMember.homeBaseLongitude = member.homeBaseLongitude;
      safeMember.activityPreferences = member.activityPreferences;
      safeMember.personalAvailability = member.personalAvailability;
      safeMember.profileCompleted = member.profileCompleted;
    }

    res.json(safeMember);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// ── PATCH /api/members/:id ───────────────────────────────────────────────────
// Update member — group owner OR the member themselves
router.patch("/members/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);

    const member = await storage.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const group = await storage.getGroup(member.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isGroupOwner = group.userId === userId;
    const isMemberOwner = member.userId === userId;

    if (!isGroupOwner && !isMemberOwner) {
      return res.status(403).json({ message: "Not authorized to update this member" });
    }

    const validatedUpdates = updateMemberSchema.parse(req.body);
    const updatedMember = await storage.updateMember(req.params.id, validatedUpdates);
    res.json(updatedMember);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// ── DELETE /api/members/:id ──────────────────────────────────────────────────
// Delete a member — group owner only
router.delete("/members/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const member = await storage.getMember(req.params.id);

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const group = await storage.getGroup(member.groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Forbidden: You don't have access to this member" });
    }

    await storage.deleteMember(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    const status = error.message.includes("Cannot delete organizer") ? 400 : 500;
    res.status(status).json({ message: error.message });
  }
});

// ── DELETE /api/groups/:groupId/members/:memberId ────────────────────────────
// Self-remove from a group (member leaves voluntarily)
router.delete("/groups/:groupId/members/:memberId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId, memberId } = req.params;

    const member = await storage.getMember(memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.userId !== userId || member.groupId !== groupId) {
      return res.status(403).json({ message: "Not authorized to remove this member" });
    }

    if (member.isOrganizer) {
      return res.status(400).json({
        message: "Organizers cannot leave the group. Delete the group instead.",
      });
    }

    await storage.deleteMember(memberId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

export default router;
