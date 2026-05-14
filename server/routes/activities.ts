/**
 * Activities & Voting Events Routes
 *
 * Handles basic activity CRUD and voting event CRUD:
 *   GET    /api/groups/:id/activities               — list group activities (public)
 *   PATCH  /api/activities/:activityId/feedback     — update activity feedback
 *   DELETE /api/groups/:id/activities               — clear all group activities (owner only)
 *   DELETE /api/activities/:activityId              — delete single activity (owner only)
 *
 *   GET    /api/groups/:groupId/voting-events       — list group voting events with likedBy
 *   PATCH  /api/voting-events/:id                   — update voting event (creator only)
 *   DELETE /api/voting-events/:id                   — delete voting event (member/creator)
 *   POST   /api/voting-events/:id/vote              — cast vote
 *   DELETE /api/voting-events/:id/vote              — remove vote
 *   GET    /api/voting-events/:id/votes             — get votes for event
 *   GET    /api/voting-events/:id/my-vote           — get user's own vote
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router, type Response } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import {
  requireGroupOwnership,
  requireGroupAccess,
  requireVotingEventAccess,
  getUserId,
} from "../authorization";
import { safeParse } from "../validation-middleware";
import { updateVotingEventSchema } from "@shared/schema";
import { updateActivityFeedbackSchema, castVoteSchema } from "../validation-schemas";
import { groups as groupsTable } from "@shared/schema";
import rateLimit from "express-rate-limit";

const router = Router();

// Rate limiter for public endpoint
const publicEndpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Increment group feedback count and conditionally trigger analysis.
 * Simplified version: just delegates to insight triggers (non-blocking).
 */
async function trackFeedbackAndMaybeAnalyze(groupId: string) {
  try {
    await db
      .update(groupsTable)
      .set({
        feedbackCount: sql`COALESCE(${groupsTable.feedbackCount}, 0) + 1`,
      })
      .where(eq(groupsTable.id, groupId));
  } catch (err) {
    console.error("[activities] trackFeedback error:", err);
  }
}

// ============================================================
// ACTIVITY ROUTES
// ============================================================

// List group activities (public)
router.get("/groups/:id/activities", publicEndpointLimiter, async (req, res) => {
  try {
    const activitiesData = await storage.getGroupActivities(req.params.id);

    // Filter sensitive AI reasoning that may contain private context
    const safeActivities = activitiesData.map((a: any) => ({
      id: a.id,
      groupId: a.groupId,
      venueName: a.venueName,
      venueAddress: a.venueAddress,
      city: a.city,
      venueType: a.venueType,
      description: a.description,
      googlePlaceId: a.googlePlaceId,
      latitude: a.latitude,
      longitude: a.longitude,
      rating: a.rating,
      reviewCount: a.reviewCount,
      priceLevel: a.priceLevel,
      photoUrl: a.photoUrl,
      // Exclude: aiReasoning (may contain sensitive context about group dynamics)
      suggestedDate: a.suggestedDate,
      suggestedTime: a.suggestedTime,
      priceEstimate: a.priceEstimate,
      createdAt: a.createdAt,
    }));

    res.json(safeActivities);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Update activity feedback
router.patch("/activities/:activityId/feedback", isAuthenticated, async (req: any, res: Response) => {
  try {
    const validatedData = safeParse(updateActivityFeedbackSchema, req.body, res);
    if (!validatedData) return;

    const { feedback } = validatedData;

    const activity = await storage.getActivity(req.params.activityId);
    if (!activity || !activity.groupId) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const userId = await getUserId(req);
    const group = await storage.getGroup(activity.groupId);

    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Forbidden: You don't have access to this activity" });
    }

    const updatedActivity = await storage.updateActivityFeedback(req.params.activityId, feedback || "");

    if (updatedActivity.groupId) {
      await trackFeedbackAndMaybeAnalyze(updatedActivity.groupId);
    }

    res.json(updatedActivity);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Delete all activities for a group (owner only)
router.delete("/groups/:id/activities", isAuthenticated, requireGroupOwnership(), async (req: any, res: Response) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    await storage.deleteAllGroupActivities(req.params.id);
    res.json({ success: true, message: "All activities cleared" });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Delete a single activity
router.delete("/activities/:activityId", isAuthenticated, async (req: any, res: Response) => {
  try {
    const { activityId } = req.params;
    const userId = await getUserId(req);

    const activity = await storage.getActivity(activityId);
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const group = await storage.getGroup(activity.groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this activity" });
    }

    await storage.deleteActivity(activityId);
    res.json({ success: true, message: "Activity deleted" });
  } catch (error: any) {
    console.error("[Delete Activity] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// ============================================================
// VOTING EVENT ROUTES
// ============================================================

// Get group-specific voting events with likedBy member names
router.get("/groups/:groupId/voting-events", isAuthenticated, requireGroupAccess(), async (req, res: Response) => {
  try {
    const group = await storage.getGroup(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const events = await storage.getGroupVotingEvents(req.params.groupId);

    const groupMembers = await storage.getGroupMembers(req.params.groupId);
    const memberMap = new Map(groupMembers.map((m: any) => [m.userId, m.name]));

    const eventsWithLikedByResults = await Promise.allSettled(
      events.map(async (event: any) => {
        const eventVotes = await storage.getEventVotes(event.id);
        const upvoters = eventVotes
          .filter((v: any) => v.voteType === "upvote")
          .map((v: any) => memberMap.get(v.userId))
          .filter((name: any): name is string => !!name);
        return { ...event, likedBy: upvoters };
      })
    );

    const eventsWithLikedBy = eventsWithLikedByResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value);

    const failedVotes = eventsWithLikedByResults.filter((r) => r.status === "rejected");
    if (failedVotes.length > 0) {
      console.error(`[Voting Events] ${failedVotes.length}/${events.length} vote fetches failed`);
    }

    res.json(eventsWithLikedBy);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Update a voting event (creator only)
router.patch("/voting-events/:id", isAuthenticated, requireVotingEventAccess(), async (req: any, res: Response) => {
  try {
    const event = await storage.getVotingEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const userId = await getUserId(req);
    if (event.createdBy !== userId) {
      return res.status(403).json({ message: "Unauthorized to edit this event" });
    }

    const validatedUpdates = updateVotingEventSchema.parse(req.body);
    const updatedEvent = await storage.updateVotingEvent(req.params.id, validatedUpdates);
    res.json(updatedEvent);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a voting event (creator or group member)
router.delete("/voting-events/:id", isAuthenticated, requireVotingEventAccess(), async (req: any, res: Response) => {
  try {
    const event = await storage.getVotingEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const userId = await getUserId(req);
    const member = await storage.getGroupMemberByUserId(event.groupId, userId);
    if (event.createdBy !== userId && !member) {
      return res.status(403).json({ message: "Unauthorized to delete this event" });
    }

    await storage.deleteVotingEvent(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Cast a vote
router.post("/voting-events/:id/vote", isAuthenticated, async (req: any, res: Response) => {
  try {
    const validatedData = safeParse(castVoteSchema, req.body, res);
    if (!validatedData) return;

    const userId = await getUserId(req);
    const { voteType } = validatedData;

    const vote = await storage.castVote(req.params.id, userId, voteType);

    const event = await storage.getVotingEvent(req.params.id);
    if (event?.groupId) {
      await trackFeedbackAndMaybeAnalyze(event.groupId);
    }

    res.json(vote);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// Remove a vote
router.delete("/voting-events/:id/vote", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = await getUserId(req);
    await storage.removeVote(req.params.id, userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Get votes for an event
router.get("/voting-events/:id/votes", isAuthenticated, requireVotingEventAccess(), async (req, res: Response) => {
  try {
    const votes = await storage.getEventVotes(req.params.id);
    res.json(votes);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// Get user's vote for an event
router.get("/voting-events/:id/my-vote", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = await getUserId(req);
    const vote = await storage.getUserVote(req.params.id, userId);
    res.json(vote || null);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

export default router;
