/**
 * Standalone Events Routes
 *
 * One-off events not tied to a recurring group schedule.
 *
 *   GET    /api/standalone-events                        — list user's standalone events
 *   POST   /api/standalone-events                        — create standalone event
 *   GET    /api/standalone-events/:id                    — get standalone event
 *   PATCH  /api/standalone-events/:id                    — update standalone event
 *   DELETE /api/standalone-events/:id                    — delete standalone event
 *   POST   /api/standalone-events/:id/invitees           — add invitees
 *   DELETE /api/standalone-events/:id/invitees/:inviteeId — remove invitee
 *   POST   /api/standalone-events/:id/send-invites       — send invites
 *   GET    /api/standalone-invite/:inviteToken           — public: get event details by invite token
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId } from "../authorization";
import { itineraryItems } from "@shared/schema";

const router = Router();

// ==================== Standalone Events ====================

// Get user's standalone events (with items and invitees for dashboard display)
router.get("/standalone-events", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);

    // Get events where user is organizer
    const organizerEvents = await storage.getUserStandaloneEvents(userId);

    // Get events where user was invited AND responded (RSVP'd)
    const invitedEvents = await storage.getStandaloneEventsUserRespondedTo(userId);

    // Merge and dedupe (organizer events take priority)
    const seenIds = new Set(organizerEvents.map((e) => e.id));
    const events = [...organizerEvents];
    for (const event of invitedEvents) {
      if (!seenIds.has(event.id)) {
        events.push(event);
        seenIds.add(event.id);
      }
    }

    // Fetch items and invitees for each event
    const eventsWithDetails = await Promise.all(
      events.map(async (event) => {
        const items = await db
          .select()
          .from(itineraryItems)
          .where(eq(itineraryItems.itineraryId, event.id))
          .orderBy(itineraryItems.orderIndex);

        const invitees = await storage.getStandaloneEventInvitees(event.id);

        return {
          ...event,
          items: items.map((item) => ({
            id: item.id,
            venueName: item.venueName,
            venueType: item.venueType,
            venueAddress: item.venueAddress,
            photoUrl: item.photoUrl,
            rating: item.rating,
            googlePlaceId: item.googlePlaceId,
          })),
          invitees,
        };
      })
    );

    res.json(eventsWithDetails);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Create a standalone event
router.post("/standalone-events", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { name, eventDate, status = "draft", timezone } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Event name is required" });
    }

    const event = await storage.createStandaloneEvent(
      {
        name,
        eventDate: eventDate ? new Date(eventDate) : null,
        status,
        proposedOrder: [],
        timezone: timezone || null, // IANA timezone (e.g., "America/Los_Angeles")
      },
      userId
    );

    res.json(event);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Get a standalone event by ID
router.get("/standalone-events/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const event = await storage.getStandaloneEvent(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Only the organizer can view
    if (event.organizerId !== userId) {
      return res.status(403).json({ message: "Not authorized to view this event" });
    }

    res.json(event);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Update a standalone event
router.patch("/standalone-events/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const event = await storage.getStandaloneEvent(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ message: "Not authorized to update this event" });
    }

    const { name, eventDate, status } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (eventDate !== undefined) updates.eventDate = eventDate ? new Date(eventDate) : null;
    if (status !== undefined) updates.status = status;

    const updated = await storage.updateStandaloneEvent(req.params.id, updates);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Delete a standalone event
router.delete("/standalone-events/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const event = await storage.getStandaloneEvent(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this event" });
    }

    await storage.deleteStandaloneEvent(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// ==================== Standalone Event Invitees ====================

// Add invitees to a standalone event
router.post("/standalone-events/:id/invitees", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const event = await storage.getStandaloneEvent(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ message: "Not authorized to add invitees to this event" });
    }

    const { invitees } = req.body; // Array of { memberId, sourceGroupId, inviteeName, inviteeEmail, userId? }

    if (!Array.isArray(invitees) || invitees.length === 0) {
      return res.status(400).json({ message: "Invitees array is required" });
    }

    const added = [];
    for (const inv of invitees) {
      const invitee = await storage.addStandaloneEventInvitee({
        itineraryId: req.params.id,
        memberId: inv.memberId || null,
        userId: inv.userId || null,
        sourceGroupId: inv.sourceGroupId || null,
        inviteeName: inv.inviteeName || inv.name || "Guest",
        inviteeEmail: inv.inviteeEmail || inv.email || null,
      });
      added.push(invitee);
    }

    res.json(added);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Remove an invitee from a standalone event
router.delete(
  "/standalone-events/:id/invitees/:inviteeId",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const event = await storage.getStandaloneEvent(req.params.id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (event.organizerId !== userId) {
        return res
          .status(403)
          .json({ message: "Not authorized to remove invitees from this event" });
      }

      await storage.removeStandaloneEventInvitee(req.params.inviteeId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: safeError(error) });
    }
  }
);

// Send invites for a standalone event (mark as sent and optionally send emails)
router.post("/standalone-events/:id/send-invites", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const event = await storage.getStandaloneEvent(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.organizerId !== userId) {
      return res.status(403).json({ message: "Not authorized to send invites for this event" });
    }

    // Update the event status to 'scheduled' (sent)
    await storage.updateStandaloneEvent(req.params.id, {
      status: "scheduled",
      inviteSentAt: new Date(),
    });

    // Get invitees
    const invitees = await storage.getStandaloneEventInvitees(req.params.id);

    // TODO: Send actual email notifications to invitees with email addresses
    console.log(
      `[Standalone Event Send] Sent invites to ${invitees.length} invitees for event "${event.name}"`
    );

    res.json({
      success: true,
      inviteeCount: invitees.length,
      message: `Invites sent to ${invitees.length} people`,
    });
  } catch (error: any) {
    console.error("[Standalone Event Send] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Public: Get event details by invite token (for invitee RSVP page)
router.get("/standalone-invite/:inviteToken", async (req, res) => {
  try {
    const result = await storage.getStandaloneEventByInviteToken(req.params.inviteToken);

    if (!result) {
      return res.status(404).json({ message: "Invite not found" });
    }

    // Return limited info for public view
    res.json({
      eventName: result.event.name,
      eventDate: result.event.eventDate,
      inviteeName: result.invitee.inviteeName,
      rsvpStatus: result.invitee.rsvpStatus,
    });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

export default router;
