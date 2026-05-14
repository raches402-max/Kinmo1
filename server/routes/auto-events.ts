/**
 * Auto-Events Routes
 *
 * Management of auto-scheduled events (pending events awaiting organizer approval).
 *
 *   POST   /api/auto-events/:id/approve                — approve auto-event & send to group
 *   POST   /api/auto-events/:id/skip                   — skip event (reject + create replacement)
 *   DELETE /api/auto-events/:id                        — delete auto-scheduled event
 *   GET    /api/auto-events/:eventId/options            — get itinerary options for event
 *   POST   /api/auto-events/:eventId/vote               — vote for an option (members)
 *   POST   /api/auto-events/:eventId/select-option      — organizer selects an option
 *   POST   /api/auto-events/:eventId/regenerate-options — regenerate itinerary options
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId } from "../authorization";
import {
  groups as groupsTable,
  rejectedEventDates,
  itineraries,
} from "@shared/schema";

const router = Router();

// ==================== Auto-Event Lifecycle ====================

// Approve a flagged auto-scheduled event
router.post("/auto-events/:id/approve", isAuthenticated, async (req: any, res) => {
  try {
    const { autoScheduledEvents } = await import("../../shared/schema");
    const [event] = await db
      .select()
      .from(autoScheduledEvents)
      .where(eq(autoScheduledEvents.id, req.params.id));

    if (!event) {
      return res.status(404).json({ message: "Auto-scheduled event not found" });
    }

    const group = await storage.getGroup(event.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check ownership
    if (group.userId !== req.user.id) {
      return res.status(403).json({ message: "Only the group owner can approve events" });
    }

    if (!event.itineraryId) {
      return res.status(400).json({ message: "Event has no itinerary" });
    }

    const itinerary = await storage.getItinerary(event.itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    // Update itinerary to proposed status using adaptive timeline
    const { calculateAdaptiveTimeline, calculateRsvpDeadline } = await import(
      "../adaptive-timeline"
    );
    const eventDate = new Date(event.proposedDate);
    const now = new Date();

    // Calculate adaptive timeline based on how far out the event is
    const adaptiveConfig = calculateAdaptiveTimeline(eventDate, now);
    const rsvpDeadline = calculateRsvpDeadline(eventDate, adaptiveConfig);

    console.log(
      `[Auto-Approve] Using ${adaptiveConfig.timelineType} timeline for event ${event.id}: ${adaptiveConfig.reasoning}`
    );

    await storage.updateItinerary(itinerary.id, {
      status: "proposed",
      eventDate: event.proposedDate,
      rsvpDeadline,
      autoScheduleConfig: adaptiveConfig,
    });

    // Log venue visits for rotation tracking
    await storage.logVenueVisits(itinerary.id, new Date(event.proposedDate));

    // Send initial invites
    const { sendInitialInvites } = await import("../reminder-scheduler");
    await sendInitialInvites(itinerary, group);

    // Mark auto-event as sent
    await storage.updateAutoScheduledEventStatus(event.id, "auto_sent");

    // Reset review sampling counter if this was a scheduled review
    if (event.reviewReason === "scheduled_review") {
      await db
        .update(groupsTable)
        .set({ eventCountSinceLastReview: 0 })
        .where(eq(groupsTable.id, group.id));
    }

    res.json({ message: "Event approved and sent", event, itinerary });
  } catch (error: any) {
    console.error("Error approving event:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Skip an auto-scheduled event (mark as rejected, create replacement for later week)
router.post("/auto-events/:id/skip", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const eventId = req.params.id;

    // Get the event to verify ownership
    const event = await storage.getAutoScheduledEvent(eventId);
    if (!event) {
      return res.status(404).json({ message: "Auto-scheduled event not found" });
    }

    // Verify user owns the group
    const group = await storage.getGroup(event.groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Forbidden: You don't own this group" });
    }

    // Skip the event (marks as rejected)
    const result = await storage.skipAutoScheduledEvent(eventId);

    // Import maintainEventPipeline to create replacement event
    const { maintainEventPipeline } = await import("../auto-scheduler");

    console.log(
      `[Auto-Event Skip] Triggering pipeline maintenance for group ${result.groupId}`
    );

    // Trigger pipeline maintenance to create replacement event for a later week
    await maintainEventPipeline(result.groupId, storage);

    res.json({
      message:
        "Event skipped successfully. A replacement event will be created for a future week.",
      groupId: result.groupId,
    });
  } catch (error: any) {
    console.error("[Auto-Event Skip] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Delete an auto-scheduled event (for past events that didn't happen)
router.delete("/auto-events/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const eventId = req.params.id;

    // Get the event to verify ownership
    const event = await storage.getAutoScheduledEvent(eventId);
    if (!event) {
      return res.status(404).json({ message: "Auto-scheduled event not found" });
    }

    // Verify user owns the group
    const group = await storage.getGroup(event.groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Forbidden: You don't own this group" });
    }

    // Track rejected date if the event has a proposed date
    if (event.proposedDate) {
      try {
        await db.insert(rejectedEventDates).values({
          groupId: event.groupId,
          rejectedDate: event.proposedDate,
          reason: "user_deleted",
          sourceType: "auto_event",
          sourceId: eventId,
        });
        console.log(
          `[Rejected Dates] Tracked rejected date for group ${event.groupId}: ${event.proposedDate}`
        );
      } catch (error) {
        console.error("[Rejected Dates] Error tracking rejected date:", error);
        // Don't fail the delete if tracking fails
      }
    }

    // Delete the event
    await storage.deleteAutoScheduledEvent(eventId);

    res.json({
      message: "Event deleted successfully",
      groupId: event.groupId,
    });
  } catch (error: any) {
    console.error("[Auto-Event Delete] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// ==================== Itinerary Options ====================

// Get itinerary options for an auto-scheduled event
router.get("/auto-events/:eventId/options", isAuthenticated, async (req: any, res) => {
  try {
    const { eventId } = req.params;
    const userId = await getUserId(req);

    // Get the auto event
    const event = await storage.getAutoScheduledEvent(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Verify user has access to the group
    const group = await storage.getGroup(event.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isOwner = group.userId === userId;
    const members = await storage.getGroupMembers(event.groupId);
    const isMember = members.some((m) => m.userId === userId);

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Get the options
    const { itineraryOptions: itineraryOptionsTable, itineraryOptionVotes } = await import(
      "../../shared/schema"
    );
    const options = await db
      .select()
      .from(itineraryOptionsTable)
      .where(eq(itineraryOptionsTable.autoEventId, eventId))
      .orderBy(itineraryOptionsTable.optionNumber);

    // Get vote counts for each option
    const optionsWithVotes = await Promise.all(
      options.map(async (option) => {
        const votes = await db
          .select()
          .from(itineraryOptionVotes)
          .where(eq(itineraryOptionVotes.optionId, option.id));

        return {
          ...option,
          voteCount: votes.length,
        };
      })
    );

    res.json({
      event,
      options: optionsWithVotes,
    });
  } catch (error: any) {
    console.error("[Get Itinerary Options] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Vote for an itinerary option (members only if voting is enabled)
router.post("/auto-events/:eventId/vote", isAuthenticated, async (req: any, res) => {
  try {
    const { eventId } = req.params;
    const { optionId } = req.body;
    const userId = await getUserId(req);

    if (!optionId) {
      return res.status(400).json({ message: "Option ID is required" });
    }

    // Get the auto event
    const event = await storage.getAutoScheduledEvent(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if voting is enabled
    if (!event.allowMemberVoting) {
      return res.status(403).json({ message: "Voting is not enabled for this event" });
    }

    // Verify user is a member
    const members = await storage.getGroupMembers(event.groupId);
    const member = members.find((m) => m.userId === userId);
    if (!member) {
      return res.status(403).json({ message: "Only group members can vote" });
    }

    // Verify option exists and belongs to this event
    const { itineraryOptions: itineraryOptionsTable, itineraryOptionVotes } = await import(
      "../../shared/schema"
    );
    const [option] = await db
      .select()
      .from(itineraryOptionsTable)
      .where(eq(itineraryOptionsTable.id, optionId));

    if (!option || option.autoEventId !== eventId) {
      return res.status(404).json({ message: "Invalid option" });
    }

    // Remove any existing vote from this member for this event
    await db
      .delete(itineraryOptionVotes)
      .where(
        and(
          eq(itineraryOptionVotes.autoEventId, eventId),
          eq(itineraryOptionVotes.memberId, member.id)
        )
      );

    // Add the new vote
    await db.insert(itineraryOptionVotes).values({
      optionId,
      autoEventId: eventId,
      memberId: member.id,
      userId,
    });

    res.json({ success: true, message: "Vote recorded" });
  } catch (error: any) {
    console.error("[Vote for Option] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Organizer selects an itinerary option
router.post("/auto-events/:eventId/select-option", isAuthenticated, async (req: any, res) => {
  try {
    const { eventId } = req.params;
    const { optionId } = req.body;
    const userId = await getUserId(req);

    if (!optionId) {
      return res.status(400).json({ message: "Option ID is required" });
    }

    // Get the auto event
    const event = await storage.getAutoScheduledEvent(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Verify user is the group owner
    const group = await storage.getGroup(event.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (group.userId !== userId) {
      return res.status(403).json({ message: "Only the group owner can select an option" });
    }

    // Use the shared approval logic
    const { approveAndCreateItinerary } = await import("../auto-approval");
    const result = await approveAndCreateItinerary(eventId, optionId, "manual");

    if (!result.success) {
      return res.status(400).json({ message: result.error || "Failed to approve option" });
    }

    res.json({
      success: true,
      message: "Option selected",
      itinerary: result.itinerary,
    });
  } catch (error: any) {
    console.error("[Select Option] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Regenerate itinerary options for an auto-scheduled event (Try Again)
router.post(
  "/auto-events/:eventId/regenerate-options",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const userId = await getUserId(req);

      // Get the auto event
      const event = await storage.getAutoScheduledEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verify user is the group owner
      const group = await storage.getGroup(event.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.userId !== userId) {
        return res
          .status(403)
          .json({ message: "Only the group owner can regenerate options" });
      }

      // Don't allow regeneration if an option has already been selected
      if (event.selectedOptionId) {
        return res
          .status(400)
          .json({ message: "Cannot regenerate after an option has been selected" });
      }

      console.log(`[Regenerate Options] Starting for event ${eventId}`);

      // Delete existing options and votes
      const { itineraryOptions: itineraryOptionsTable, itineraryOptionVotes } = await import(
        "../../shared/schema"
      );

      // Delete votes first (foreign key constraint)
      await db
        .delete(itineraryOptionVotes)
        .where(eq(itineraryOptionVotes.autoEventId, eventId));

      // Delete options
      await db
        .delete(itineraryOptionsTable)
        .where(eq(itineraryOptionsTable.autoEventId, eventId));

      console.log(`[Regenerate Options] Deleted old options, generating new ones...`);

      // Generate new options using the auto-scheduler
      const { selectBestItineraryForAutoSchedule } = await import("../auto-scheduler");
      const result = await selectBestItineraryForAutoSchedule(storage, group);

      if (!result.options || result.options.length === 0) {
        return res.status(500).json({ message: "Failed to generate new options" });
      }

      // Save new options
      const savedOptions = await Promise.all(
        result.options.map(async (option: any) => {
          const [saved] = await db
            .insert(itineraryOptionsTable)
            .values({
              autoEventId: eventId,
              optionNumber: option.optionNumber,
              venues: option.venues,
              description: option.description,
              nearbySuggestions: option.nearbySuggestions || null,
            })
            .returning();
          return saved;
        })
      );

      console.log(`[Regenerate Options] Generated ${savedOptions.length} new option(s)`);

      // Fetch the new options with vote counts
      const optionsWithVotes = await Promise.all(
        savedOptions.map(async (option) => ({
          ...option,
          voteCount: 0, // New options have no votes
        }))
      );

      res.json({
        success: true,
        message: "New options generated",
        event,
        options: optionsWithVotes,
      });
    } catch (error: any) {
      console.error("[Regenerate Options] Error:", error);
      res.status(500).json({ message: safeError(error) });
    }
  }
);

export default router;
