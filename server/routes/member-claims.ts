/**
 * Member Claims Routes
 *
 * Member claim/link workflows: verify tokens, claim memberships, register guests,
 * link accounts, and get member events.
 *
 *   GET    /members/claim/verify/:claimToken  — verify claim token (public)
 *   POST   /members/claim                     — claim membership (authenticated)
 *   POST   /members/register-guest            — register as guest (public)
 *   POST   /members/link-account              — link account to member (authenticated)
 *   GET    /members/me/events                 — get member's events (auth or claim token)
 *
 * Migration: extracted from server/routes.ts
 */

import { Router } from "express";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId } from "../authorization";
import {
  members as membersTable,
  itineraryInvites,
  rsvps as rsvpsTable,
  itineraries,
  itineraryItems,
  groups as groupsTable,
} from "@shared/schema";

const router = Router();

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

function isTentativeRsvp(response: string | null | undefined): boolean {
  return normalizeRsvpResponse(response) === 'maybe';
}

router.get("/members/claim/verify/:claimToken", async (req, res) => {
  try {
    const { claimToken } = req.params;

    if (!claimToken) {
      return res.status(400).json({ message: "Claim token required" });
    }

    const members = await db
      .select({
        id: membersTable.id,
        name: membersTable.name,
        email: membersTable.email,
        userId: membersTable.userId,
        claimedAt: membersTable.claimedAt,
        groupId: membersTable.groupId,
      })
      .from(membersTable)
      .where(sql`claim_token = ${claimToken}`);

    if (members.length === 0) {
      return res.status(404).json({ message: "Invalid or expired claim token" });
    }

    const member = members[0];

    const group = await storage.getGroup(member.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const alreadyClaimed = !!member.userId && !!member.claimedAt;

    res.json({
      id: member.id,
      name: member.name,
      email: member.email,
      groupName: group.name,
      groupEmoji: group.emoji || "🎉",
      alreadyClaimed,
    });
  } catch (error: any) {
    console.error('[Verify Claim Token] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/members/claim", isAuthenticated, async (req: any, res) => {
  try {
    const { claimToken } = req.body;
    const userId = await getUserId(req);

    if (!claimToken) {
      return res.status(400).json({ message: "Claim token required" });
    }

    const members = await db
      .select()
      .from(membersTable)
      .where(sql`claim_token = ${claimToken}`);

    if (members.length === 0) {
      return res.status(404).json({ message: "Invalid claim token" });
    }

    const member = members[0];

    if (member.userId && member.userId !== userId) {
      return res.status(409).json({
        message: "This membership has already been claimed by another account"
      });
    }

    if (member.userId === userId) {
      return res.json({
        message: "Membership already claimed",
        member,
      });
    }

    const updatedMember = await storage.updateMember(member.id, {
      userId,
      claimedAt: new Date(),
      hasJoined: true,
    });

    res.json({
      message: "Membership claimed successfully",
      member: updatedMember,
    });
  } catch (error: any) {
    console.error('[Claim Membership] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/members/register-guest", async (req, res) => {
  try {
    const { claimToken, guestName } = req.body;

    if (!claimToken) {
      return res.status(400).json({ message: "Claim token required" });
    }

    if (!guestName || typeof guestName !== 'string' || guestName.trim().length < 1) {
      return res.status(400).json({ message: "Guest name required" });
    }

    const members = await db
      .select({
        id: membersTable.id,
        groupId: membersTable.groupId,
      })
      .from(membersTable)
      .where(sql`claim_token = ${claimToken}`);

    if (members.length === 0) {
      return res.status(404).json({ message: "Invalid or expired claim token" });
    }

    const member = members[0];

    const existingGuests = await db
      .select()
      .from(membersTable)
      .where(sql`group_id = ${member.groupId} AND is_guest = true AND LOWER(name) = LOWER(${guestName.trim()})`);

    if (existingGuests.length > 0) {
      return res.json({
        message: "Guest already registered",
        member: existingGuests[0],
      });
    }

    const [newGuestMember] = await db
      .insert(membersTable)
      .values({
        groupId: member.groupId,
        name: guestName.trim(),
        isGuest: true,
        hasJoined: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log(`[Register Guest] Created guest member ${newGuestMember.id} in group ${member.groupId}`);

    res.json({
      message: "Guest registered successfully",
      member: newGuestMember,
    });
  } catch (error: any) {
    console.error('[Register Guest] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/members/link-account", isAuthenticated, async (req: any, res) => {
  try {
    const { memberId } = req.body;
    const userId = await getUserId(req);

    if (!memberId) {
      return res.status(400).json({ message: "Member ID required" });
    }

    const member = await storage.getMember(memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.userId && member.userId !== userId) {
      return res.status(409).json({
        message: "This membership has already been claimed by another account"
      });
    }

    if (member.userId === userId) {
      return res.json({
        message: "Account already linked",
        member,
      });
    }

    const updatedMember = await storage.updateMember(member.id, {
      userId,
      claimedAt: new Date(),
      hasJoined: true,
    });

    console.log(`[Link Account] Successfully linked member ${member.name} (${memberId}) to user ${userId}`);

    res.json({
      message: "Account linked successfully",
      member: updatedMember,
    });
  } catch (error: any) {
    console.error('[Link Account] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/members/me/events", async (req: any, res) => {
  try {
    const { claimToken } = req.query;
    const userId = await getUserId(req);

    if (!userId && !claimToken) {
      return res.status(401).json({ message: "Authentication or claim token required" });
    }

    let memberIds: string[] = [];

    if (userId) {
      const userMembers = await db
        .select({ id: membersTable.id })
        .from(membersTable)
        .where(eq(membersTable.userId, userId));
      memberIds = userMembers.map(m => m.id);
    }

    if (claimToken && typeof claimToken === 'string') {
      const claimMembers = await db
        .select({ id: membersTable.id })
        .from(membersTable)
        .where(eq(membersTable.claimToken, claimToken));

      claimMembers.forEach(m => {
        if (!memberIds.includes(m.id)) {
          memberIds.push(m.id);
        }
      });
    }

    if (memberIds.length === 0) {
      return res.json({
        pending: [],
        upcoming: [],
        past: [],
      });
    }

    const invites = await db
      .select()
      .from(itineraryInvites)
      .where(sql`member_id IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`);

    const invitesByItinerary = new Map(invites.map(inv => [inv.itineraryId, inv]));

    const rsvps = await db
      .select()
      .from(rsvpsTable)
      .where(sql`member_id IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`);

    const rsvpsByItinerary = new Map(rsvps.map(rsvp => [rsvp.itineraryId, rsvp]));

    const itineraryIds = Array.from(invitesByItinerary.keys());

    if (itineraryIds.length === 0) {
      return res.json({
        pending: [],
        upcoming: [],
        past: [],
      });
    }

    const itinerariesData = await db
      .select()
      .from(itineraries)
      .where(sql`id IN (${sql.join(itineraryIds.map(id => sql`${id}`), sql`, `)})`);

    const allItems = await db
      .select()
      .from(itineraryItems)
      .where(sql`itinerary_id IN (${sql.join(itineraryIds.map(id => sql`${id}`), sql`, `)})`);

    const itemsByItinerary = new Map<string, any[]>();
    allItems.forEach(item => {
      if (!itemsByItinerary.has(item.itineraryId)) {
        itemsByItinerary.set(item.itineraryId, []);
      }
      itemsByItinerary.get(item.itineraryId)!.push(item);
    });

    const groupIds = Array.from(new Set(itinerariesData.map(it => it.groupId)));
    const groups = await db
      .select()
      .from(groupsTable)
      .where(sql`id IN (${sql.join(groupIds.map(id => sql`${id}`), sql`, `)})`);

    const groupsById = new Map(groups.map(g => [g.id, g]));

    const now = new Date();
    const pending: any[] = [];
    const upcoming: any[] = [];
    const past: any[] = [];

    itinerariesData.forEach(itinerary => {
      const invite = invitesByItinerary.get(itinerary.id);
      const rsvp = rsvpsByItinerary.get(itinerary.id);
      const group = itinerary.groupId ? groupsById.get(itinerary.groupId) : undefined;
      const items = itemsByItinerary.get(itinerary.id) || [];

      const eventData = {
        id: itinerary.id,
        name: itinerary.name,
        status: itinerary.status,
        eventDate: itinerary.eventDate,
        inviteToken: invite?.inviteToken,
        rsvpResponse: rsvp?.response || null,
        rsvpFeedback: rsvp?.rsvpFeedback || null,
        group: group ? {
          id: group.id,
          name: group.name,
          emoji: group.emoji,
        } : null,
        items: items.map(item => ({
          id: item.id,
          venueName: item.venueName,
          venueType: item.venueType,
          venueAddress: item.venueAddress,
          photoUrl: item.photoUrl,
          rating: item.rating,
          googlePlaceId: item.googlePlaceId,
          notes: item.notes,
          googleMapsUrl: item.googleMapsUrl,
          sourceType: item.sourceType,
          arrivalTime: item.arrivalTime,
          departureTime: item.departureTime,
          travelNotes: item.travelNotes,
        })),
      };

      if (!rsvp) {
        pending.push(eventData);
      } else if (itinerary.eventDate && new Date(itinerary.eventDate) < now) {
        past.push(eventData);
      } else if (isPositiveRsvp(rsvp.response) || isTentativeRsvp(rsvp.response)) {
        upcoming.push(eventData);
      } else {
        past.push(eventData);
      }
    });

    const sortByDate = (a: any, b: any) => {
      if (!a.eventDate && !b.eventDate) return 0;
      if (!a.eventDate) return 1;
      if (!b.eventDate) return -1;
      return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
    };

    pending.sort(sortByDate);
    upcoming.sort(sortByDate);
    past.sort(sortByDate);

    res.json({
      pending,
      upcoming,
      past,
    });
  } catch (error: any) {
    console.error('[Get Member Events] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
