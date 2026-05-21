/**
 * Standalone Events Routes
 *
 * One-off events not tied to a recurring group schedule.
 *
 *   GET    /api/standalone-events                        — list user's standalone events
 *   POST   /api/standalone-events                        — create standalone event
 *   GET    /api/standalone-events/:id                    — get standalone event
 *   PATCH  /api/standalone-events/:id                 — update standalone event
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
import { itineraryItems, standaloneEventInvitees } from "@shared/schema";
import { sendItineraryInvite } from "../email-service";
import { fail } from "../lib/responses";

const router = Router();

function formatStandaloneEventDate(date: Date, timezone: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatStandaloneEventTime(date: Date, timezone: string | null) {
  const resolvedTimezone = timezone || "America/Los_Angeles";
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTimezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);

  return time.replace("GMT-7", "PT").replace("GMT-8", "PT");
}

function buildBaseUrl(req: any) {
  return req.headers.origin || `${req.protocol}://${req.get("host")}` || "http://localhost:5000";
}

async function getStandaloneOrganizerName(userId: string) {
  const organizer = await storage.getUser(userId);
  const profile = await storage.getUserProfile(userId);

  return (
    profile?.displayName ||
    [organizer?.firstName, organizer?.lastName].filter(Boolean).join(" ") ||
    organizer?.firstName ||
    (organizer as any)?.username ||
    organizer?.email?.split("@")[0] ||
    "Your friend"
  );
}

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
    fail(res, 500, safeError(error));
  }
});

// Create a standalone event
router.post("/standalone-events", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { name, eventDate, status = "draft", timezone } = req.body;

    if (!name) {
      return fail(res, 400, "Event name is required");
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
    fail(res, 500, safeError(error));
  }
});

// Get a standalone event by ID
router.get("/standalone-events/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const event = await storage.getStandaloneEvent(req.params.id);

    if (!event) {
      return fail(res, 404, "Event not found");
    }

    // Only the organizer can view
    if (event.organizerId !== userId) {
      return fail(res, 403, "Not authorized to view this event");
    }

    res.json(event);
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

// Update a standalone event
router.patch("/standalone-events/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const event = await storage.getStandaloneEvent(req.params.id);

    if (!event) {
      return fail(res, 404, "Event not found");
    }

    if (event.organizerId !== userId) {
      return fail(res, 403, "Not authorized to update this event");
    }

    const { name, eventDate, status } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (eventDate !== undefined) updates.eventDate = eventDate ? new Date(eventDate) : null;
    if (status !== undefined) updates.status = status;

    const updated = await storage.updateStandaloneEvent(req.params.id, updates);
    res.json(updated);
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

// Delete a standalone event
router.delete("/standalone-events/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const event = await storage.getStandaloneEvent(req.params.id);

    if (!event) {
      return fail(res, 404, "Event not found");
    }

    if (event.organizerId !== userId) {
      return fail(res, 403, "Not authorized to delete this event");
    }

    await storage.deleteStandaloneEvent(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

// ==================== Standalone Event Invitees ====================

// Add invitees to a standalone event
router.post("/standalone-events/:id/invitees", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const event = await storage.getStandaloneEvent(req.params.id);

    if (!event) {
      return fail(res, 404, "Event not found");
    }

    if (event.organizerId !== userId) {
      return fail(res, 403, "Not authorized to add invitees to this event");
    }

    const { invitees } = req.body; // Array of { memberId, sourceGroupId, inviteeName, inviteeEmail, userId? }

    if (!Array.isArray(invitees) || invitees.length === 0) {
      return fail(res, 400, "Invitees array is required");
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
    fail(res, 500, safeError(error));
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
        return fail(res, 404, "Event not found");
      }

      if (event.organizerId !== userId) {
        return res
          .status(403)
          .json({ message: "Not authorized to remove invitees from this event" });
      }

      await storage.removeStandaloneEventInvitee(req.params.inviteeId);
      res.json({ success: true });
    } catch (error: any) {
      fail(res, 500, safeError(error));
    }
  }
);

// Send invites for a standalone event (mark as sent and optionally send emails)
router.post("/standalone-events/:id/send-invites", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const event = await storage.getStandaloneEvent(req.params.id);

    if (!event) {
      return fail(res, 404, "Event not found");
    }

    if (event.organizerId !== userId) {
      return fail(res, 403, "Not authorized to send invites for this event");
    }

    const sentAt = new Date();

    // Update the event status to 'scheduled' (sent)
    await storage.updateStandaloneEvent(req.params.id, {
      status: "scheduled",
      inviteSentAt: sentAt,
    });

    // Get invitees
    const invitees = await storage.getStandaloneEventInvitees(req.params.id);

    await db
      .update(standaloneEventInvitees)
      .set({ inviteSentAt: sentAt })
      .where(eq(standaloneEventInvitees.itineraryId, req.params.id));

    const inviteesWithEmail = invitees.filter((invitee) => invitee.inviteeEmail);
    const organizerName = await getStandaloneOrganizerName(userId);
    const baseUrl = buildBaseUrl(req);

    let emailSentCount = 0;
    let emailFailureCount = 0;

    for (const invitee of inviteesWithEmail) {
      try {
        const rsvpLink = `${baseUrl}/standalone-invite/${invitee.inviteToken}`;

        const emailResult = await sendItineraryInvite(
          {
            email: invitee.inviteeEmail!,
            name: invitee.inviteeName || "Friend",
          },
          {
            groupName: event.name || "Hangout",
            organizerName,
            eventDate: event.eventDate
              ? formatStandaloneEventDate(event.eventDate, event.timezone)
              : "Date TBD",
            eventTime: event.eventDate
              ? formatStandaloneEventTime(event.eventDate, event.timezone)
              : event.timezone || "Time TBD",
            venues: event.items.map((item) => ({
              name: item.venueName || "Venue",
              type: item.venueType || "Activity",
              address: item.venueAddress || undefined,
            })),
            rsvpDeadline: event.eventDate
              ? formatStandaloneEventDate(event.eventDate, event.timezone)
              : "whenever you can",
            rsvpLink,
          }
        );

        if (!emailResult.success) {
          throw new Error(emailResult.error || "Failed to send standalone invite email");
        }

        emailSentCount += 1;
      } catch (emailError) {
        emailFailureCount += 1;
        console.error(
          `[Standalone Event Send] Failed to send invite email to ${invitee.inviteeEmail}:`,
          emailError
        );
      }
    }

    console.log(
      `[Standalone Event Send] Processed ${invitees.length} invitees for event "${event.name}" (${emailSentCount} emails sent, ${emailFailureCount} failed)`
    );

    res.json({
      success: true,
      inviteeCount: invitees.length,
      emailedInviteeCount: emailSentCount,
      emailFailureCount,
      message:
        emailSentCount > 0
          ? `Invites sent to ${invitees.length} people (${emailSentCount} by email)`
          : `Invites sent to ${invitees.length} people`,
    });
  } catch (error: any) {
    console.error("[Standalone Event Send] Error:", error);
    fail(res, 500, safeError(error));
  }
});

// Public: Get event details by invite token (for invitee RSVP page)
router.get("/standalone-invite/:inviteToken", async (req, res) => {
  try {
    const result = await storage.getStandaloneEventByInviteToken(req.params.inviteToken);

    if (!result) {
      return fail(res, 404, "Invite not found");
    }

    const items = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, result.event.id))
      .orderBy(itineraryItems.orderIndex);

    const invitees = await storage.getStandaloneEventInvitees(result.event.id);

    res.json({
      invitee: {
        id: result.invitee.id,
        inviteeName: result.invitee.inviteeName,
        rsvpStatus: result.invitee.rsvpStatus,
        inviteToken: result.invitee.inviteToken,
      },
      event: {
        id: result.event.id,
        name: result.event.name,
        eventDate: result.event.eventDate,
        timezone: result.event.timezone,
      },
      items: items.map((item) => ({
        id: item.id,
        venueName: item.venueName,
        venueType: item.venueType,
        venueAddress: item.venueAddress,
        photoUrl: item.photoUrl,
        rating: item.rating,
        googlePlaceId: item.googlePlaceId,
        googleMapsUrl: item.googleMapsUrl,
        arrivalTime: item.arrivalTime,
        departureTime: item.departureTime,
        travelNotes: item.travelNotes,
        notes: item.notes,
      })),
      attendees: invitees.map((invitee) => ({
        name: invitee.inviteeName,
        response: invitee.rsvpStatus,
      })),
    });
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

export default router;
