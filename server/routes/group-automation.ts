/**
 * Group Automation & Invite Link Routes
 *
 * Routes:
 *   PATCH /api/groups/:id/automation       — update automation settings
 *   PATCH /api/groups/:id/invite-link      — open/close or regenerate invite link
 *   POST  /api/groups/:id/pause-automation — pause auto-scheduling
 *   POST  /api/groups/:id/resume-automation — resume auto-scheduling
 *
 * MIGRATED FROM: server/routes.ts
 */

import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../googleAuth";
import { requireGroupOwnership } from "../authorization";
import { safeParse } from "../validation-middleware";
import { updateAutomationSchema, pauseAutomationSchema } from "../validation-schemas";

const router = Router();

// ── Update automation settings ────────────────────────────────────────────

router.patch("/groups/:id/automation", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const validatedData = safeParse(updateAutomationSchema, req.body, res);
    if (!validatedData) return;

    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const fieldMapping: Record<string, string> = {
      meal_enabled: "mealEnabled",
      cafe_enabled: "cafeEnabled",
      drinks_enabled: "drinksEnabled",
      dessert_enabled: "dessertEnabled",
      experiences_enabled: "experiencesEnabled",
      autoActivitiesEnabled: "autoActivitiesEnabled",
      autoItineraryEnabled: "autoItineraryEnabled",
      autoScheduleEnabled: "autoScheduleEnabled",
      automation_level: "automationLevel",
      automationLevel: "automationLevel",
      review_every_nth_event: "reviewEveryNthEvent",
      reviewEveryNthEvent: "reviewEveryNthEvent",
      membersCanCreateEvents: "membersCanCreateEvents",
      members_can_create_events: "membersCanCreateEvents",
    };

    const updates: any = {};

    // Pattern 1: { field, value }
    if (validatedData.field && validatedData.value !== undefined) {
      const dbField = fieldMapping[validatedData.field];
      if (!dbField) {
        return res.status(400).json({ message: `Invalid field: ${validatedData.field}` });
      }
      updates[dbField] = validatedData.value;
    } else {
      // Pattern 2: direct fields (snake_case or camelCase)
      for (const apiField in validatedData) {
        const value = validatedData[apiField as keyof typeof validatedData];
        const dbField = fieldMapping[apiField];
        if (dbField && (typeof value === "boolean" || typeof value === "string" || typeof value === "number")) {
          updates[dbField] = value;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid automation settings provided" });
    }

    // Initialize nextEventDueDate when enabling auto-scheduling for the first time
    if (updates.autoScheduleEnabled === true && !group.nextEventDueDate && group.meetingFrequency) {
      const { calculateNextEventDueDate } = await import("../auto-scheduler");
      const baseDate = group.lastEventDate ? new Date(group.lastEventDate) : new Date();
      updates.nextEventDueDate = calculateNextEventDueDate(baseDate, group.meetingFrequency);
    }

    const updatedGroup = await storage.updateGroup(req.params.id, updates);
    res.json(updatedGroup);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// ── Manage invite link ────────────────────────────────────────────────────

router.patch("/groups/:id/invite-link", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const { open, regenerate } = req.body;
    const updates: any = {};

    if (typeof open === "boolean") {
      updates.inviteLinkOpen = open;
    }

    if (regenerate === true) {
      const { randomBytes } = await import("crypto");
      updates.shareableLink = randomBytes(16).toString("hex");
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid options provided. Use 'open' (boolean) or 'regenerate' (true).",
      });
    }

    const updatedGroup = await storage.updateGroup(req.params.id, updates);
    res.json({
      shareableLink: updatedGroup.shareableLink,
      inviteLinkOpen: updatedGroup.inviteLinkOpen,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ── Pause automation ──────────────────────────────────────────────────────

router.post("/groups/:id/pause-automation", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const validatedData = safeParse(pauseAutomationSchema, req.body, res);
    if (!validatedData) return;
    const { pauseType, value } = validatedData;

    const updates: any = { automationPaused: true };

    if (pauseType === "events") {
      updates.automationPauseEventsRemaining = value;
      updates.automationPausedUntil = null;
    } else {
      updates.automationPausedUntil = new Date(value as string);
      updates.automationPauseEventsRemaining = null;
    }

    const updatedGroup = await storage.updateGroup(req.params.id, updates);
    res.json(updatedGroup);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// ── Resume automation ─────────────────────────────────────────────────────

router.post("/groups/:id/resume-automation", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const updates = {
      automationPaused: false,
      automationPausedUntil: null,
      automationPauseEventsRemaining: null,
    };

    const updatedGroup = await storage.updateGroup(req.params.id, updates);
    res.json(updatedGroup);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
