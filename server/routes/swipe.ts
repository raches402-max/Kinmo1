/**
 * Swipe Routes
 *
 * Swipe session management and swipe recording.
 *
 *   POST   /api/groups/:groupId/swipe-sessions                     — create swipe session
 *   GET    /api/groups/:groupId/swipe-sessions                     — get active sessions
 *   GET    /api/swipe-sessions/:sessionId                          — get session result
 *   POST   /api/swipe-sessions/:sessionId/complete                 — manually complete session
 *   POST   /api/groups/:groupId/activities/:activityId/swipe       — swipe on activity
 *   POST   /api/groups/:groupId/favorites/:votingEventId/swipe     — swipe on voting event
 *   GET    /api/groups/:groupId/swipe-progress                     — get swipe progress
 *   GET    /api/groups/:groupId/swipe-triggers/status              — check trigger opportunities
 *   POST   /api/groups/:groupId/swipe-triggers/manual              — manually trigger session
 *   POST   /api/groups/:groupId/swipe-triggers/weekly-digest       — trigger weekly digest
 *   POST   /api/cron/weekly-digest                                 — process all weekly digests (cron)
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
import { safeParse } from "../validation-middleware";
import { z } from "zod";
import { activities, votingEvents, swipeSessions, activitySwipes } from "@shared/schema";

const router = Router();

// ===== SWIPE SESSION MANAGEMENT =====

// Create a new swipe session for a group
router.post("/groups/:groupId/swipe-sessions", isAuthenticated, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Verify user is a member or organizer
    const member = await storage.getGroupMemberByUserId(groupId, userId);
    if (!member) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    // Validate request body
    const sessionSchema = z.object({
      sessionType: z.enum([
        "itinerary_validation",
        "activity_curation",
        "favorites_triage",
        "discovery",
        "weekly_digest",
      ]),
      triggeredBy: z
        .enum(["auto_scheduler", "ai_generation", "manual", "weekly_job", "post_event"])
        .default("manual"),
      isBlocking: z.boolean().optional(),
      targetSwipeCount: z.number().min(1).max(20).optional(),
      expiresInHours: z.number().min(1).max(168).optional(), // Max 1 week
      autoEventId: z.string().optional(),
    });

    const validatedData = safeParse(sessionSchema, req.body, res);
    if (!validatedData) return;

    // Create session
    const { createSwipeSession } = await import("../swipe-session-manager");
    const sessionId = await createSwipeSession({
      groupId,
      sessionType: validatedData.sessionType,
      triggeredBy: validatedData.triggeredBy || "manual",
      isBlocking: validatedData.isBlocking,
      targetSwipeCount: validatedData.targetSwipeCount,
      expiresInHours: validatedData.expiresInHours,
      autoEventId: validatedData.autoEventId,
    });

    res.json({ sessionId });
  } catch (error: any) {
    console.error("Error creating swipe session:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Get active swipe sessions for a group
router.get("/groups/:groupId/swipe-sessions", isAuthenticated, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Verify user is a member
    const member = await storage.getGroupMemberByUserId(groupId, userId);
    if (!member) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    // Get active sessions
    const { getActiveSwipeSessions } = await import("../swipe-session-manager");
    const sessions = await getActiveSwipeSessions(groupId);

    res.json({ sessions });
  } catch (error: any) {
    console.error("Error fetching swipe sessions:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Get swipe session result
router.get("/swipe-sessions/:sessionId", isAuthenticated, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const userId = await getUserId(req);

    // Get session
    const { getSwipeSessionResult } = await import("../swipe-session-manager");
    const session = await getSwipeSessionResult(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Swipe session not found" });
    }

    // Verify user is member of this group
    const sessionData = await db
      .select()
      .from(swipeSessions)
      .where(eq(swipeSessions.id, sessionId))
      .limit(1);

    if (sessionData.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    const member = await storage.getGroupMemberByUserId(sessionData[0].groupId, userId);
    if (!member) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    res.json(session);
  } catch (error: any) {
    console.error("Error fetching swipe session:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Manually complete a swipe session
router.post("/swipe-sessions/:sessionId/complete", isAuthenticated, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const userId = await getUserId(req);

    // Get session to verify group membership
    const sessionData = await db
      .select()
      .from(swipeSessions)
      .where(eq(swipeSessions.id, sessionId))
      .limit(1);

    if (sessionData.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Verify user is organizer (group owner)
    const group = await storage.getGroup(sessionData[0].groupId);
    if (!group || group.userId !== userId) {
      return res.status(403).json({ message: "Only organizers can manually complete sessions" });
    }

    // Complete session
    const { completeSwipeSession, getSwipeSessionResult } = await import("../swipe-session-manager");
    await completeSwipeSession(sessionId);

    // Get updated result
    const result = await getSwipeSessionResult(sessionId);

    res.json(result);
  } catch (error: any) {
    console.error("Error completing swipe session:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// ===== SWIPE RECORDING =====

// Swipe on an activity (democratic curation)
router.post(
  "/groups/:groupId/activities/:activityId/swipe",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const { groupId, activityId } = req.params;
      const userId = await getUserId(req);

      // Validate request body
      const swipeSchema = z.object({
        direction: z.enum(["right", "left"]),
        sessionId: z.string().optional(),
      });

      const validatedData = safeParse(swipeSchema, req.body, res);
      if (!validatedData) return;

      const { direction, sessionId } = validatedData;

      // Verify activity exists and belongs to group
      const activity = await db
        .select()
        .from(activities)
        .where(and(eq(activities.id, activityId), eq(activities.groupId, groupId)))
        .limit(1);

      if (!activity || activity.length === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }

      // Get member for this user in this group
      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Check if user already swiped on this activity
      const { hasUserSwipedActivity } = await import("../swipe-consensus");
      const alreadySwiped = await hasUserSwipedActivity(userId, activityId);

      if (alreadySwiped) {
        return res.status(400).json({ message: "You've already swiped on this activity" });
      }

      // Record the swipe
      const swipe = await db
        .insert(activitySwipes)
        .values({
          groupId,
          activityId,
          votingEventId: null,
          userId,
          memberId: member.id,
          swipeDirection: direction,
          swipeSessionId: sessionId || null,
        })
        .returning();

      // Update consensus for this activity
      const {
        updateActivityConsensus,
        getActivitySwipeStats,
        performActivityAutoActions,
      } = await import("../swipe-consensus");
      await updateActivityConsensus(activityId);

      // Get updated stats
      const stats = await getActivitySwipeStats(activityId);

      // Perform auto-actions if consensus thresholds are met
      const autoAction = await performActivityAutoActions(activityId);

      // Check if favorites overflow trigger should fire (after auto-promotion)
      if (autoAction?.action === "promoted") {
        try {
          const { triggerSwipeSession } = await import("../swipe-trigger-manager");
          const triggerResult = await triggerSwipeSession({
            groupId,
            triggerType: "favorites_overflow",
          });

          if (triggerResult.triggered) {
            console.log(`[FavoritesOverflow] ${triggerResult.reason}`);
          }
        } catch (triggerError) {
          console.error("[FavoritesOverflow] Error checking trigger:", triggerError);
        }
      }

      // If part of a session, update session participation and check auto-complete
      if (sessionId) {
        const { recordSwipeInSession, checkAndAutoCompleteSession } = await import(
          "../swipe-session-manager"
        );
        await recordSwipeInSession(sessionId, member.id, userId);
        await checkAndAutoCompleteSession(sessionId);
      }

      res.json({
        swipe: swipe[0],
        stats,
        autoAction, // Include auto-action result in response
      });
    } catch (error: any) {
      console.error("Error recording activity swipe:", error);
      res.status(500).json({ message: safeError(error) });
    }
  }
);

// Swipe on a voting event (Favorite) - for shortlisting
router.post(
  "/groups/:groupId/favorites/:votingEventId/swipe",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const { groupId, votingEventId } = req.params;
      const userId = await getUserId(req);

      // Validate request body
      const swipeSchema = z.object({
        direction: z.enum(["right", "left"]),
        sessionId: z.string().optional(),
      });

      const validatedData = safeParse(swipeSchema, req.body, res);
      if (!validatedData) return;

      const { direction, sessionId } = validatedData;

      // Verify voting event exists and belongs to group
      const votingEvent = await db
        .select()
        .from(votingEvents)
        .where(and(eq(votingEvents.id, votingEventId), eq(votingEvents.groupId, groupId)))
        .limit(1);

      if (!votingEvent || votingEvent.length === 0) {
        return res.status(404).json({ message: "Favorite not found" });
      }

      // Get member for this user in this group
      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Check if user already swiped on this voting event
      const { hasUserSwipedVotingEvent } = await import("../swipe-consensus");
      const alreadySwiped = await hasUserSwipedVotingEvent(userId, votingEventId);

      if (alreadySwiped) {
        return res.status(400).json({ message: "You've already swiped on this favorite" });
      }

      // Record the swipe
      const swipe = await db
        .insert(activitySwipes)
        .values({
          groupId,
          activityId: null,
          votingEventId,
          userId,
          memberId: member.id,
          swipeDirection: direction,
          swipeSessionId: sessionId || null,
        })
        .returning();

      // Update consensus for this voting event
      const {
        updateVotingEventConsensus,
        getVotingEventSwipeStats,
        performVotingEventAutoActions,
      } = await import("../swipe-consensus");
      await updateVotingEventConsensus(votingEventId);

      // Get updated stats
      const stats = await getVotingEventSwipeStats(votingEventId);

      // Perform auto-actions if consensus thresholds are met
      const autoAction = await performVotingEventAutoActions(votingEventId);

      // If part of a session, update session participation and check auto-complete
      if (sessionId) {
        const { recordSwipeInSession, checkAndAutoCompleteSession } = await import(
          "../swipe-session-manager"
        );
        await recordSwipeInSession(sessionId, member.id, userId);
        await checkAndAutoCompleteSession(sessionId);
      }

      res.json({
        swipe: swipe[0],
        stats,
        autoAction, // Include auto-action result in response
      });
    } catch (error: any) {
      console.error("Error recording favorite swipe:", error);
      res.status(500).json({ message: safeError(error) });
    }
  }
);

// Get swipe progress for a group
router.get("/groups/:groupId/swipe-progress", isAuthenticated, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Verify user has access to this group
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const member = await storage.getGroupMemberByUserId(groupId, userId);
    if (!member && group.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to view this group" });
    }

    // Get swipe progress
    const { getGroupSwipeProgress } = await import("../swipe-consensus");
    const progress = await getGroupSwipeProgress(groupId);

    res.json(progress);
  } catch (error: any) {
    console.error("Error fetching swipe progress:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Check swipe trigger opportunities
router.get("/groups/:groupId/swipe-triggers/status", isAuthenticated, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Verify user has access to this group
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const member = await storage.getGroupMemberByUserId(groupId, userId);
    if (!member && group.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to view this group" });
    }

    // Check all trigger opportunities
    const { checkTriggerOpportunities } = await import("../swipe-trigger-manager");
    const opportunities = await checkTriggerOpportunities(groupId);

    res.json(opportunities);
  } catch (error: any) {
    console.error("Error checking swipe triggers:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Manually trigger a swipe session (organizer only)
router.post("/groups/:groupId/swipe-triggers/manual", isAuthenticated, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Verify user is organizer
    const group = await storage.getGroup(groupId);
    if (!group || group.userId !== userId) {
      return res
        .status(403)
        .json({ message: "Only group organizers can manually trigger swipe sessions" });
    }

    // Validate request body
    const manualTriggerSchema = z.object({
      activityIds: z.array(z.string()).min(1),
      reason: z.string().optional(),
      expiresInHours: z.number().min(1).max(168).optional(),
    });

    const validatedData = safeParse(manualTriggerSchema, req.body, res);
    if (!validatedData) return;

    const { activityIds, reason, expiresInHours } = validatedData;

    // Trigger manual swipe session
    const { triggerSwipeSession } = await import("../swipe-trigger-manager");
    const result = await triggerSwipeSession({
      groupId,
      triggerType: "manual",
      activityIds,
      reason,
      expiresInHours,
    });

    if (result.triggered) {
      res.json({
        success: true,
        sessionId: result.sessionId,
        message: result.reason,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.skippedReason,
      });
    }
  } catch (error: any) {
    console.error("Error triggering manual swipe session:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Trigger weekly digest (organizer only or cron)
router.post(
  "/groups/:groupId/swipe-triggers/weekly-digest",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user is organizer
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) {
        return res
          .status(403)
          .json({ message: "Only group organizers can trigger weekly digests" });
      }

      // Trigger weekly digest
      const { triggerSwipeSession } = await import("../swipe-trigger-manager");
      const result = await triggerSwipeSession({
        groupId,
        triggerType: "weekly_digest",
      });

      if (result.triggered) {
        res.json({
          success: true,
          sessionId: result.sessionId,
          message: result.reason,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.skippedReason,
        });
      }
    } catch (error: any) {
      console.error("Error triggering weekly digest:", error);
      res.status(500).json({ message: safeError(error) });
    }
  }
);

// Process weekly digests for all groups (for cron jobs)
router.post("/cron/weekly-digest", async (req, res) => {
  try {
    // Simple auth: check for CRON_SECRET in headers or query
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET environment variable not configured");
      return res.status(500).json({ message: "Server configuration error" });
    }
    const providedSecret = req.headers["x-cron-secret"] || req.query.secret;

    if (providedSecret !== cronSecret) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Process weekly digests for all groups
    const { processWeeklyDigests } = await import("../swipe-digest-worker");
    await processWeeklyDigests();

    res.json({ success: true, message: "Weekly digests processed" });
  } catch (error: any) {
    console.error("Error processing weekly digests:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

export default router;
