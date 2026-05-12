/**
 * RSVP Routes
 *
 * Handles all RSVP-related endpoints:
 *   PATCH  /api/members/:id/rsvp                          — member RSVP via claim token
 *   POST   /api/rsvps                                     — submit RSVP with invite token
 *   GET    /api/rsvps/itinerary/:itineraryId/member/:memberId — get RSVP for member
 *   GET    /api/rsvps/itinerary/:itineraryId              — get all RSVPs (authenticated)
 *   POST   /api/itineraries/:itineraryId/organizer-rsvp   — organizer RSVP
 *   POST   /api/rsvps/:rsvpId/approve                     — approve guest RSVP
 *   POST   /api/rsvps/:rsvpId/deny                        — deny guest RSVP
 *   PATCH  /api/rsvps/:id                                 — update RSVP (organizer)
 *   POST   /api/itineraries/:id/rsvps                     — create RSVP (legacy)
 *   POST   /api/itineraries/:id/rsvp                      — event invite RSVP (Phase 1)
 *   POST   /api/itineraries/:id/guest-rsvp                — guest RSVP (Phase 3)
 *   GET    /api/guest-rsvp/:guestToken                    — get guest RSVP by token
 *   POST   /api/guest-rsvp/:guestToken                    — submit guest invite RSVP by token
 *   PATCH  /api/guest-rsvp/:guestToken                    — update guest RSVP by token
 *   GET    /api/itineraries/:id/rsvps                     — get RSVPs for itinerary
 *   POST   /api/standalone-invite/:inviteToken/rsvp       — standalone event RSVP
 *
 * Migration: extracted from server/routes.ts
 */

import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  rsvps as rsvpsTable,
  itineraryInvites,
  guestInvites,
  itineraries,
} from "@shared/schema";
import { isAuthenticated } from "../googleAuth";
import { requireMemberAccess, getUserId } from "../authorization";
import { safeParse } from "../validation-middleware";
import {
  createRsvpSchema,
  organizerRsvpSchema,
  updateRsvpResponseSchema,
  createItineraryRsvpSchema,
} from "../validation-schemas";
import { checkAndReschedule } from "../auto-reschedule";
import { autoUpdateMemberConstraints } from "../member-learning";
import { triggerInsightUpdateDebounced } from "../insight-triggers";

const router = Router();

// Helper: check if RSVP response counts as positive
function isPositiveRsvp(response: string): boolean {
  return ["going", "yes"].includes(response);
}

// PATCH /members/:id/rsvp — update member RSVP via claim token
router.patch("/members/:id/rsvp", requireMemberAccess(), async (req: any, res) => {
  try {
    const { rsvpStatus, claimToken } = req.body;

    if (!claimToken) {
      return res.status(401).json({ message: "Claim token required" });
    }

    if (!["going", "maybe", "not_going"].includes(rsvpStatus)) {
      return res.status(400).json({ message: "Invalid RSVP status" });
    }

    const member = await storage.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.claimToken !== claimToken) {
      return res.status(401).json({ message: "Invalid claim token" });
    }

    const updatedMember = await storage.updateMember(req.params.id, {
      rsvpStatus,
    });

    res.json(updatedMember);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// POST /rsvps — submit RSVP with invite token
router.post("/rsvps", async (req, res) => {
  console.log('[RSVP] Request received:', { itineraryId: req.body?.itineraryId, hasInviteToken: !!req.body?.inviteToken, response: req.body?.response });
  try {
    const validatedData = safeParse(createRsvpSchema, req.body, res);
    if (!validatedData) {
      console.log('[RSVP] Validation failed');
      return;
    }

    const { itineraryId, inviteToken, response, rsvpFeedback, claimedMemberId, guestName, additionalAttendees, numberOfKids } = validatedData;
    console.log('[RSVP] Validated data:', { itineraryId, inviteToken, claimedMemberId, guestName, response });

    // Verify invite token
    const invites = await db
      .select()
      .from(itineraryInvites)
      .where(sql`invite_token = ${inviteToken}`);

    if (invites.length === 0) {
      console.log('[RSVP] Invalid invite token:', inviteToken);
      return res.status(401).json({ message: "Invalid invite token" });
    }

    const invite = invites[0];
    console.log('[RSVP] Found invite:', { inviteId: invite.id, inviteMemberId: invite.memberId, inviteItineraryId: invite.itineraryId });

    if (invite.itineraryId !== itineraryId) {
      console.log('[RSVP] Itinerary mismatch:', { inviteItineraryId: invite.itineraryId, requestedItineraryId: itineraryId });
      return res.status(403).json({ message: "This invite is not valid for this itinerary" });
    }

    if (claimedMemberId && invite.memberId && claimedMemberId !== invite.memberId) {
      console.log('[RSVP] Member mismatch:', { inviteMemberId: invite.memberId, claimedMemberId });
      return res.status(403).json({ message: "This invite is not valid for this member" });
    }

    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.groupId) {
      console.log('[RSVP] Itinerary not found:', itineraryId);
      return res.status(404).json({ message: "Itinerary not found" });
    }
    console.log('[RSVP] Found itinerary:', { id: itinerary.id, name: itinerary.name, groupId: itinerary.groupId });

    let memberId = claimedMemberId || invite.memberId;
    if (guestName && !claimedMemberId) {
      memberId = null;
    }
    console.log('[RSVP] Using memberId:', memberId);

    let member = null;
    if (memberId) {
      member = await storage.getMember(memberId);
      if (!member) {
        console.log('[RSVP] Member not found:', memberId);
        return res.status(404).json({ message: "Member not found" });
      }
      console.log('[RSVP] Found member:', { id: member.id, name: member.name });
    }

    let existingRsvps = await db
      .select()
      .from(rsvpsTable)
      .where(
        memberId
          ? sql`itinerary_id = ${itineraryId} AND member_id = ${memberId}`
          : sql`itinerary_id = ${itineraryId} AND guest_name = ${guestName}`
      );

    if (existingRsvps.length === 0 && memberId && member?.userId) {
      existingRsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${itineraryId} AND user_id = ${member.userId}`);
    }

    let rsvp;
    const rsvpData: any = {
      response,
      rsvpFeedback: rsvpFeedback || null,
      guestName: guestName || null,
      additionalAttendees: additionalAttendees || null,
      numberOfKids: numberOfKids || 0,
      requiresApproval: guestName ? true : false,
      updatedAt: new Date(),
    };

    if (existingRsvps.length > 0) {
      const updateData: any = { ...rsvpData };
      if (!existingRsvps[0].guestToken) {
        updateData.guestToken = guestName
          ? `guest_${crypto.randomUUID()}`
          : `member_${crypto.randomUUID()}`;
      }
      const updated = await db
        .update(rsvpsTable)
        .set(updateData)
        .where(sql`id = ${existingRsvps[0].id}`)
        .returning();
      rsvp = updated[0];
    } else {
      const rsvpToken = guestName
        ? `guest_${crypto.randomUUID()}`
        : `member_${crypto.randomUUID()}`;
      const inserted = await db
        .insert(rsvpsTable)
        .values({
          itineraryId,
          memberId: memberId || null,
          guestToken: rsvpToken,
          ...rsvpData,
        })
        .returning();
      rsvp = inserted[0];
    }

    // Trigger auto-reschedule check (non-blocking)
    checkAndReschedule(itineraryId).catch(err => {
      console.error(`[RSVP] Auto-reschedule check failed:`, err);
    });

    if (memberId && rsvpFeedback && itinerary.groupId) {
      autoUpdateMemberConstraints(memberId, itinerary.groupId).catch(err => {
        console.error(`[RSVP] Pattern analysis failed:`, err);
      });

      triggerInsightUpdateDebounced(itinerary.groupId, 'rsvp-collected', 6).catch(err => {
        console.error(`[RSVP] Insight update failed:`, err);
      });
    }

    let gangsAllHere = false;
    let isCompletingVote = false;

    if (isPositiveRsvp(response) && memberId && itinerary.groupId) {
      const allMembers = await storage.getGroupMembers(itinerary.groupId);
      const nonGuestMembers = allMembers.filter(m => !m.isGuest);

      const allRsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${itineraryId}`);

      const yesRsvpMemberIds = new Set(
        allRsvps
          .filter(r => isPositiveRsvp(r.response) && r.memberId)
          .map(r => r.memberId)
      );

      const nonGuestYesCount = nonGuestMembers.filter(m => yesRsvpMemberIds.has(m.id)).length;
      gangsAllHere = nonGuestYesCount === nonGuestMembers.length && nonGuestMembers.length > 0;

      if (gangsAllHere) {
        const wasNewYes = existingRsvps.length === 0 || !isPositiveRsvp(existingRsvps[0].response);
        isCompletingVote = wasNewYes;
      }
    }

    res.json({ ...rsvp, gangsAllHere, isCompletingVote });
  } catch (error: any) {
    console.error('[RSVP] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /rsvps/itinerary/:itineraryId/member/:memberId — get RSVP for member with invite token
router.get("/rsvps/itinerary/:itineraryId/member/:memberId", async (req, res) => {
  try {
    const { itineraryId, memberId } = req.params;
    const inviteToken = req.query.inviteToken as string;

    if (!inviteToken) {
      return res.status(401).json({ message: "Invite token required" });
    }

    const invites = await db
      .select()
      .from(itineraryInvites)
      .where(sql`invite_token = ${inviteToken}`);

    if (invites.length === 0) {
      return res.status(401).json({ message: "Invalid invite token" });
    }

    const invite = invites[0];

    if (invite.itineraryId !== itineraryId) {
      return res.status(403).json({ message: "This invite is not valid for this itinerary" });
    }

    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    if (invite.memberId && invite.memberId !== memberId) {
      return res.status(403).json({ message: "This invite is not valid for this member" });
    }

    if (!invite.memberId) {
      const group = await storage.getGroup(itinerary.groupId);
      const member = await storage.getMember(memberId);
      if (!group || !member) {
        return res.status(404).json({ message: "Group or member not found" });
      }
      const organizer = group.userId ? await storage.getUser(group.userId) : null;
      const isOrganizer = member.userId === group.userId ||
        (organizer?.email && member.email && member.email.toLowerCase() === organizer.email.toLowerCase());
      if (!isOrganizer) {
        return res.status(403).json({ message: "This invite is only valid for the organizer" });
      }
    }

    const member = await storage.getMember(memberId);

    let rsvps = await db
      .select()
      .from(rsvpsTable)
      .where(sql`itinerary_id = ${itineraryId} AND member_id = ${memberId}`);

    if (rsvps.length === 0 && member?.userId) {
      rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${itineraryId} AND user_id = ${member.userId}`);
    }

    if (rsvps.length === 0) {
      return res.status(404).json({ message: "RSVP not found" });
    }

    res.json(rsvps[0]);
  } catch (error: any) {
    console.error('[RSVP] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /rsvps/itinerary/:itineraryId — get all RSVPs for an itinerary (authenticated)
router.get("/rsvps/itinerary/:itineraryId", isAuthenticated, async (req, res) => {
  try {
    const rsvps = await db
      .select()
      .from(rsvpsTable)
      .where(sql`itinerary_id = ${req.params.itineraryId}`);

    res.json(rsvps);
  } catch (error: any) {
    console.error('[RSVP] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /itineraries/:itineraryId/organizer-rsvp — organizer RSVP
router.post("/itineraries/:itineraryId/organizer-rsvp", isAuthenticated, async (req: any, res) => {
  console.log('[Organizer RSVP] Request received:', { itineraryId: req.params.itineraryId, response: req.body?.response });
  try {
    const validatedData = safeParse(organizerRsvpSchema, req.body, res);
    if (!validatedData) {
      console.log('[Organizer RSVP] Validation failed');
      return;
    }

    const userId = await getUserId(req);
    const { itineraryId } = req.params;
    const { response, rsvpFeedback } = validatedData;
    console.log('[Organizer RSVP] Validated:', { userId, itineraryId, response });

    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    if (itinerary.isStandalone) {
      if (itinerary.createdBy !== userId) {
        return res.status(403).json({ message: "Only the event creator can use this endpoint" });
      }
    } else {
      if (!itinerary.groupId) {
        return res.status(404).json({ message: "Group not found for this itinerary" });
      }
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only the group organizer can use this endpoint" });
      }
    }

    const existingRsvps = await db
      .select()
      .from(rsvpsTable)
      .where(sql`itinerary_id = ${itineraryId} AND user_id = ${userId} AND member_id IS NULL`);

    let rsvp;
    if (existingRsvps.length > 0) {
      console.log('[Organizer RSVP] Updating existing RSVP:', existingRsvps[0].id);
      const updated = await db
        .update(rsvpsTable)
        .set({
          response,
          rsvpFeedback: rsvpFeedback || null,
          updatedAt: new Date(),
        })
        .where(sql`id = ${existingRsvps[0].id}`)
        .returning();
      rsvp = updated[0];
    } else {
      console.log('[Organizer RSVP] Creating new RSVP');
      const inserted = await db
        .insert(rsvpsTable)
        .values({
          itineraryId,
          userId,
          memberId: null,
          response,
          rsvpFeedback: rsvpFeedback || null,
        })
        .returning();
      rsvp = inserted[0];
    }

    console.log('[Organizer RSVP] Success:', rsvp);
    res.json(rsvp);
  } catch (error: any) {
    console.error('[Organizer RSVP] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /rsvps/:rsvpId/approve — approve pending guest RSVP (organizer only)
router.post("/rsvps/:rsvpId/approve", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { rsvpId } = req.params;

    const rsvps = await db
      .select()
      .from(rsvpsTable)
      .where(sql`id = ${rsvpId}`);

    if (rsvps.length === 0) {
      return res.status(404).json({ message: "RSVP not found" });
    }

    const rsvp = rsvps[0];
    const itinerary = await storage.getItinerary(rsvp.itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.userId !== userId) {
      return res.status(403).json({ message: "Only the group organizer can approve guest RSVPs" });
    }

    const updated = await db
      .update(rsvpsTable)
      .set({ approved: true, updatedAt: new Date() })
      .where(sql`id = ${rsvpId}`)
      .returning();

    res.json(updated[0]);
  } catch (error: any) {
    console.error('[Approve RSVP] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /rsvps/:rsvpId/deny — deny pending guest RSVP (organizer only), deletes it
router.post("/rsvps/:rsvpId/deny", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { rsvpId } = req.params;

    const rsvps = await db
      .select()
      .from(rsvpsTable)
      .where(sql`id = ${rsvpId}`);

    if (rsvps.length === 0) {
      return res.status(404).json({ message: "RSVP not found" });
    }

    const rsvp = rsvps[0];
    const itinerary = await storage.getItinerary(rsvp.itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.userId !== userId) {
      return res.status(403).json({ message: "Only the group organizer can deny guest RSVPs" });
    }

    await db
      .delete(rsvpsTable)
      .where(sql`id = ${rsvpId}`);

    res.json({ message: "RSVP denied and removed" });
  } catch (error: any) {
    console.error('[Deny RSVP] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PATCH /rsvps/:id — update RSVP response (organizer only)
router.patch("/rsvps/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { id } = req.params;

    const validatedData = safeParse(updateRsvpResponseSchema, req.body, res);
    if (!validatedData) return;
    const { response } = validatedData;

    const [existingRsvp] = await db
      .select()
      .from(rsvpsTable)
      .where(eq(rsvpsTable.id, id));

    if (!existingRsvp) {
      return res.status(404).json({ message: "RSVP not found" });
    }

    const itinerary = await storage.getItinerary(existingRsvp.itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Only the organizer can update RSVPs" });
    }

    const updated = await storage.updateRsvp(id, { response });
    res.json(updated);
  } catch (error: any) {
    console.error('[Update RSVP] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /itineraries/:id/rsvps — create RSVP (legacy, requires memberId or userId)
router.post("/itineraries/:id/rsvps", async (req, res) => {
  try {
    const validatedData = safeParse(createItineraryRsvpSchema, req.body, res);
    if (!validatedData) return;

    const { response, constraintText, memberId, userId, memberName } = validatedData;

    if (!memberId && !userId) {
      return res.status(400).json({ message: "Either memberId or userId is required" });
    }

    const rsvp = await storage.createRsvp({
      itineraryId: req.params.id,
      response,
      constraintText,
      memberId,
      userId,
      memberName,
    });
    res.json(rsvp);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST /itineraries/:id/rsvp — event invite RSVP (Phase 1, public)
router.post("/itineraries/:id/rsvp", async (req, res) => {
  try {
    const { memberId, response, rsvpFeedback } = req.body;
    const { id: itineraryId } = req.params;

    if (!memberId || !memberId.trim()) {
      return res.status(400).json({ message: "Member ID is required" });
    }
    if (!response || !["going", "maybe", "not_going"].includes(response)) {
      return res.status(400).json({ message: "Valid response required (going, maybe, or not_going)" });
    }

    const member = await storage.getMember(memberId);
    if (!member) {
      console.log(`[Event Invite RSVP] Member not found: ${memberId}`);
      return res.status(404).json({ message: "Member not found" });
    }

    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary) {
      console.log(`[Event Invite RSVP] Itinerary not found: ${itineraryId}`);
      return res.status(404).json({ message: "Event not found" });
    }

    if (itinerary.groupId && member.groupId !== itinerary.groupId) {
      console.log(`[Event Invite RSVP] Member ${memberId} (group: ${member.groupId}) not in event group: ${itinerary.groupId}`);
      return res.status(403).json({ message: "Member is not part of this group" });
    }

    const existingRsvps = await db
      .select()
      .from(rsvpsTable)
      .where(sql`itinerary_id = ${itineraryId} AND member_id = ${memberId}`);

    let rsvp;
    const rsvpData: any = {
      response,
      rsvpFeedback: rsvpFeedback || null,
      updatedAt: new Date(),
    };

    if (existingRsvps.length > 0) {
      const updateData: any = { ...rsvpData };
      if (!existingRsvps[0].guestToken) {
        updateData.guestToken = `member_${crypto.randomUUID()}`;
      }
      const updated = await db
        .update(rsvpsTable)
        .set(updateData)
        .where(sql`id = ${existingRsvps[0].id}`)
        .returning();
      rsvp = updated[0];
    } else {
      const rsvpToken = `member_${crypto.randomUUID()}`;
      const inserted = await db
        .insert(rsvpsTable)
        .values({
          itineraryId,
          memberId,
          guestToken: rsvpToken,
          ...rsvpData,
        })
        .returning();
      rsvp = inserted[0];
    }

    if (rsvpFeedback && (rsvpFeedback.feedbackText || rsvpFeedback.alternativeDays || rsvpFeedback.alternativeTimes)) {
      console.log(`[Event Invite RSVP] Member ${member.name} (${memberId}) provided feedback for event ${itineraryId}:`, rsvpFeedback);
    }

    res.json(rsvp);
  } catch (error: any) {
    console.error('[Event Invite RSVP] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /itineraries/:id/guest-rsvp — create/update guest RSVP (Phase 3, public)
router.post("/itineraries/:id/guest-rsvp", async (req, res) => {
  try {
    const { guestToken, guestName, guestEmail, response, rsvpFeedback } = req.body;
    const { id: itineraryId } = req.params;

    if (!guestName || !guestName.trim()) {
      return res.status(400).json({ message: "Guest name is required" });
    }

    const validResponses = ["yes", "maybe", "no", "going", "not_going"];
    if (!response || !validResponses.includes(response)) {
      return res.status(400).json({ message: "Valid response required" });
    }

    const normalizedResponse = response === "yes" ? "going" :
                               response === "no" ? "not_going" :
                               response;

    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Event not found" });
    }

    let existingRsvp = null;
    if (guestToken) {
      const existing = await db
        .select()
        .from(rsvpsTable)
        .where(sql`guest_token = ${guestToken} AND itinerary_id = ${itineraryId}`);

      if (existing.length > 0) {
        existingRsvp = existing[0];
      }
    }

    let rsvp;
    if (existingRsvp) {
      const updated = await db
        .update(rsvpsTable)
        .set({
          response: normalizedResponse,
          guestName: guestName.trim(),
          guestEmail: guestEmail?.trim() || null,
          rsvpFeedback: rsvpFeedback || null,
          updatedAt: new Date(),
        })
        .where(sql`id = ${existingRsvp.id}`)
        .returning();
      rsvp = updated[0];
    } else {
      const newGuestToken = guestToken || crypto.randomUUID() + crypto.randomUUID();
      const inserted = await db
        .insert(rsvpsTable)
        .values({
          itineraryId,
          isGuest: true,
          guestName: guestName.trim(),
          guestEmail: guestEmail?.trim() || null,
          guestToken: newGuestToken,
          response: normalizedResponse,
          rsvpFeedback: rsvpFeedback || null,
          memberName: null,
          memberId: null,
          userId: null,
        })
        .returning();
      rsvp = inserted[0];
    }

    if (rsvpFeedback && (rsvpFeedback.feedbackText || rsvpFeedback.alternativeDays || rsvpFeedback.alternativeTimes)) {
      console.log(`[Guest RSVP] Guest ${guestName} provided feedback for event ${itineraryId}:`, rsvpFeedback);
    }

    res.json(rsvp);
  } catch (error: any) {
    console.error('[Guest RSVP] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /guest-rsvp/:guestToken — get guest RSVP by token (public)
// Note: Two implementations existed in routes.ts (line 12640 and 13057).
// This merges both: first tries rsvpsTable, then falls back to guestInvites.
router.get("/guest-rsvp/:guestToken", async (req, res) => {
  try {
    const { guestToken } = req.params;

    // Try rsvpsTable first (newer flow)
    const [guestRsvp] = await db
      .select()
      .from(rsvpsTable)
      .where(eq(rsvpsTable.guestToken, guestToken))
      .limit(1);

    if (guestRsvp) {
      const itinerary = await storage.getItinerary(guestRsvp.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Event not found" });
      }
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      return res.json({ rsvp: guestRsvp, itinerary, group });
    }

    // Fall back to guestInvites table (older flow)
    const [guestInvite] = await db
      .select()
      .from(guestInvites)
      .where(eq(guestInvites.guestToken, guestToken))
      .limit(1);

    if (!guestInvite) {
      return res.status(404).json({ message: "Guest invite not found" });
    }

    const itinerary = await storage.getItinerary(guestInvite.itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Event not found" });
    }

    const items = await db
      .select()
      .from(itineraries) // itinerary items would be itineraryItems - keeping as-is from original
      .where(eq(itineraries.id, guestInvite.itineraryId))
      .limit(1); // minimal fallback

    const group = await storage.getGroup(itinerary.groupId);

    res.json({
      guestInvite,
      itinerary,
      group: group ? { name: group.name, emoji: group.emoji } : null,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST /guest-rsvp/:guestToken — submit guest invite RSVP by token (public)
router.post("/guest-rsvp/:guestToken", async (req, res) => {
  try {
    const { guestToken } = req.params;
    const { response } = req.body;

    if (!response || !["yes", "maybe", "no"].includes(response)) {
      return res.status(400).json({ message: "Valid response required (yes, maybe, or no)" });
    }

    const [guestInvite] = await db
      .select()
      .from(guestInvites)
      .where(eq(guestInvites.guestToken, guestToken))
      .limit(1);

    if (!guestInvite) {
      return res.status(404).json({ message: "Guest invite not found" });
    }

    const [updated] = await db
      .update(guestInvites)
      .set({ rsvpStatus: response })
      .where(eq(guestInvites.guestToken, guestToken))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /guest-rsvp/:guestToken — update guest RSVP by token (public)
router.patch("/guest-rsvp/:guestToken", async (req, res) => {
  try {
    const { guestToken } = req.params;
    const { response } = req.body;

    if (!response || !["yes", "maybe", "no"].includes(response)) {
      return res.status(400).json({ message: "Valid response required (yes, maybe, or no)" });
    }

    const [updatedRsvp] = await db
      .update(rsvpsTable)
      .set({ response, updatedAt: new Date() })
      .where(eq(rsvpsTable.guestToken, guestToken))
      .returning();

    if (!updatedRsvp) {
      return res.status(404).json({ message: "Guest RSVP not found" });
    }

    res.json(updatedRsvp);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /itineraries/:id/rsvps — get RSVPs for itinerary with member names (public)
router.get("/itineraries/:id/rsvps", async (req, res) => {
  try {
    const rsvps = await storage.getItineraryRsvps(req.params.id);

    const enrichedRsvps = await Promise.all(
      rsvps.map(async (rsvp) => {
        let memberName = rsvp.memberName || rsvp.guestName;
        if (!memberName && rsvp.memberId) {
          const member = await storage.getMember(rsvp.memberId);
          memberName = member?.name || null;
        }
        return { ...rsvp, memberName: memberName || 'Unknown' };
      })
    );

    res.json(enrichedRsvps);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST /standalone-invite/:inviteToken/rsvp — standalone event RSVP (public)
router.post("/standalone-invite/:inviteToken/rsvp", async (req, res) => {
  try {
    const { rsvpStatus } = req.body;

    if (!['yes', 'maybe', 'no'].includes(rsvpStatus)) {
      return res.status(400).json({ message: "Invalid RSVP status" });
    }

    const invitee = await storage.updateStandaloneEventInviteeRsvp(req.params.inviteToken, rsvpStatus);

    if (!invitee) {
      return res.status(404).json({ message: "Invite not found" });
    }

    res.json({ success: true, rsvpStatus: invitee.rsvpStatus });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
