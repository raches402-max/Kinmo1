/**
 * Groups CRUD Routes
 *
 * Handles basic group lifecycle:
 *   POST   /api/groups            — create group
 *   GET    /api/groups/:id        — get group by ID
 *   PATCH  /api/groups/:id        — update group
 *   PATCH  /api/groups/:id/radius — update search radius
 *   DELETE /api/groups/:id        — delete group (organizer only)
 *   GET    /api/user/groups       — list user's groups
 *
 * MIGRATED FROM: server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import * as Sentry from "@sentry/node";
import { storage } from "../storage";
import {
  insertGroupSchema,
  updateGroupSchema,
} from "@shared/schema";
import { isAuthenticated } from "../googleAuth";
import {
  requireGroupOwnership,
  getUserId,
} from "../authorization";
import { geocodeLocation } from "../google-places";
import { sendMemberWelcome, type EmailRecipient, type MemberWelcomeData } from "../email-service";
import { safeParse } from "../validation-middleware";
import { createGroupSchema, updateGroupRadiusSchema } from "../validation-schemas";

const router = Router();

// Helper: assign accent color deterministically from group ID
const GROUP_COLOR_PALETTE = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
];

function assignGroupColor(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = ((hash << 5) - hash) + groupId.charCodeAt(i);
    hash = hash & hash;
  }
  return GROUP_COLOR_PALETTE[Math.abs(hash) % GROUP_COLOR_PALETTE.length];
}

// ── List user's groups ──────────────────────────────────────────────────────
// NOTE: This router is mounted at /api, so paths below are relative to /api

router.get("/user/groups", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const groups = await storage.getUserGroups(userId);
    res.json(groups);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// ── Create group ────────────────────────────────────────────────────────────

router.post("/groups", isAuthenticated, async (req: any, res) => {
  try {
    const validatedInput = safeParse(createGroupSchema, req.body, res);
    if (!validatedInput) return;

    const { members, ...groupData } = validatedInput;
    const userId = await getUserId(req);

    const validatedGroup = insertGroupSchema.parse(groupData);

    // Geocode location
    const geocoded = await geocodeLocation(validatedGroup.locationBase);
    if (geocoded) {
      validatedGroup.latitude = geocoded.latitude.toString();
      validatedGroup.longitude = geocoded.longitude.toString();
      validatedGroup.timezone = geocoded.timezone;
      console.log(`Geocoded location: ${validatedGroup.locationBase} -> (${geocoded.latitude}, ${geocoded.longitude}) timezone: ${geocoded.timezone}`);
    } else {
      console.warn(`Failed to geocode location: ${validatedGroup.locationBase}`);
    }

    const group = await storage.createGroup(validatedGroup, userId, members || []);

    // Auto-assign accent color
    if (!validatedGroup.accentColor) {
      const accentColor = assignGroupColor(group.id);
      await storage.updateGroup(group.id, { accentColor });
      group.accentColor = accentColor;
      console.log(`Auto-assigned color ${accentColor} to group ${group.id}`);
    }

    // Generate AI activity suggestions in background
    import("../routes").then(({ generateAndStoreActivities }) => {
      generateAndStoreActivities(group.id, validatedGroup).catch((error) => {
        console.error(`[Activity Generation] Failed for group ${group.id}:`, error);
        Sentry.captureException(error, {
          tags: { groupId: group.id, operation: "generateActivities" },
          level: "error",
        });
      });
    });

    // Send welcome emails in background
    if (members && members.length > 0) {
      setImmediate(async () => {
        try {
          const createdMembers = await storage.getGroupMembers(group.id);
          for (const member of createdMembers) {
            if (member.email && member.claimToken) {
              const claimLink = `${process.env.FRONTEND_URL || "http://localhost:5000"}/claim/${member.claimToken}`;
              const recipient: EmailRecipient = { email: member.email, name: member.name || "there" };
              const welcomeData: MemberWelcomeData = {
                groupName: group.name,
                groupEmoji: group.emoji || "🎉",
                organizerName: group.name,
                claimLink,
              };
              await sendMemberWelcome(recipient, welcomeData);
              console.log(`Sent welcome email to ${member.email} for group ${group.name}`);
            }
          }
        } catch (error) {
          console.error("Error sending welcome emails:", error);
          Sentry.captureException(error, {
            tags: { groupId: group.id, operation: "sendWelcomeEmails" },
            level: "warning",
          });
        }
      });
    }

    res.json(group);
  } catch (error: any) {
    console.error("Error creating group:", error);
    res.status(400).json({ message: error.message });
  }
});

// ── Get group by ID ─────────────────────────────────────────────────────────

router.get("/groups/:id", async (req, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const members = await storage.getGroupMembers(req.params.id);
    const memberBudgets: number[] = [];

    for (const member of members) {
      if (member.userId) {
        const memberPrefs = await storage.getMemberGroupPreferences(member.userId, req.params.id);
        if (memberPrefs?.budgetOverrideMin != null || memberPrefs?.budgetOverrideMax != null) {
          const avg = ((memberPrefs.budgetOverrideMin || 0) + (memberPrefs.budgetOverrideMax || 100)) / 2;
          memberBudgets.push(avg);
        } else {
          const profile = await storage.getUserProfile(member.userId);
          if (profile?.budgetMin != null || profile?.budgetMax != null) {
            const avg = ((profile.budgetMin || 0) + (profile.budgetMax || 100)) / 2;
            memberBudgets.push(avg);
          }
        }
      }
    }

    const memberBudgetStats = memberBudgets.length > 0
      ? {
          budgets: memberBudgets,
          average: Math.round(memberBudgets.reduce((a, b) => a + b, 0) / memberBudgets.length),
          count: memberBudgets.length,
        }
      : null;

    res.json({ ...group, memberBudgetStats });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// ── Update group ────────────────────────────────────────────────────────────

router.patch("/groups/:id", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const group = req.group;
    const validatedUpdates = updateGroupSchema.parse(req.body);

    let cadenceChanged = false;
    let pipelineRebuilt = false;
    let eventsCleared = 0;
    let eventsCreated = 0;

    if (
      validatedUpdates.meetingFrequency &&
      validatedUpdates.meetingFrequency !== group.meetingFrequency &&
      group.autoScheduleEnabled
    ) {
      console.log(`[Cadence Change] ${group.name}: ${group.meetingFrequency} → ${validatedUpdates.meetingFrequency}`);
      cadenceChanged = true;
      eventsCleared = await storage.deletePendingAutoEvents(req.params.id);
      console.log(`[Cadence Change] Cleared ${eventsCleared} pending events`);
    }

    let geocodingResult: "success" | "failed" | "not_attempted" = "not_attempted";
    if (validatedUpdates.locationBase) {
      const geocoded = await geocodeLocation(validatedUpdates.locationBase);
      if (geocoded) {
        validatedUpdates.latitude = geocoded.latitude.toString();
        validatedUpdates.longitude = geocoded.longitude.toString();
        validatedUpdates.timezone = geocoded.timezone;
        geocodingResult = "success";
      } else {
        geocodingResult = "failed";
        console.warn(`Failed to geocode location: ${validatedUpdates.locationBase}`);
      }
    }

    const updatedGroup = await storage.updateGroup(req.params.id, validatedUpdates);

    if (cadenceChanged) {
      const { maintainEventPipeline } = await import("../auto-scheduler.js");
      eventsCreated = await maintainEventPipeline(req.params.id, storage);
      pipelineRebuilt = true;
      console.log(`[Cadence Change] Created ${eventsCreated} new events`);
    }

    res.json({
      ...updatedGroup,
      geocodingResult,
      cadenceChange: cadenceChanged
        ? { oldCadence: group.meetingFrequency, newCadence: validatedUpdates.meetingFrequency, eventsCleared, eventsCreated, pipelineRebuilt }
        : undefined,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// ── Update search radius ────────────────────────────────────────────────────

router.patch("/groups/:id/radius", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const validatedData = safeParse(updateGroupRadiusSchema, req.body, res);
    if (!validatedData) return;
    const updatedGroup = await storage.updateGroup(req.params.id, { searchRadius: validatedData.searchRadius });
    res.json(updatedGroup);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// ── Delete group ────────────────────────────────────────────────────────────

router.delete("/groups/:id", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    await storage.softDeleteGroup(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

export default router;
