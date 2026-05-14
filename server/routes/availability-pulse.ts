/**
 * Availability Pulse Routes
 *
 * Availability pulse creation, retrieval, and response management.
 *
 *   GET    /groups/:groupId/availability-pulse                     — get active pulse
 *   POST   /groups/:groupId/availability-pulse                     — create pulse
 *   POST   /availability-pulse/:pulseId/respond                    — respond (authenticated)
 *   GET    /availability-pulse/:pulseId/respond/:responseToken     — get response page (public)
 *   POST   /availability-pulse/:pulseId/respond/:responseToken     — submit response (public)
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId } from "../authorization";

const router = Router();

router.get("/groups/:groupId/availability-pulse", isAuthenticated, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    const member = await storage.getGroupMemberByUserId(groupId, userId);
    if (!member) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    const pulseData = await storage.getActivePulseWithResponses(groupId);
    if (!pulseData) {
      return res.json({ pulse: null });
    }

    const { pulse, responses } = pulseData;
    const { aggregated, totalResponses } = await storage.getAggregatedPulseAvailability(pulse.id);
    const myResponse = responses.find(r => r.memberId === member.id);

    res.json({
      pulse: {
        id: pulse.id,
        startDate: pulse.startDate,
        endDate: pulse.endDate,
        targetEventDate: pulse.targetEventDate,
        status: pulse.status,
        memberCount: pulse.memberCount,
        responseCount: pulse.responseCount,
        expiresAt: pulse.expiresAt,
      },
      aggregatedAvailability: aggregated,
      totalResponses,
      myResponse: myResponse ? {
        id: myResponse.id,
        availability: myResponse.availability,
        notes: myResponse.notes,
        responseToken: myResponse.responseToken,
        updatedAt: myResponse.updatedAt,
      } : null,
    });
  } catch (error: any) {
    console.error('[Availability Pulse] Error getting pulse:', error);
    res.status(500).json({ message: safeError(error) });
  }
});

router.post("/groups/:groupId/availability-pulse", isAuthenticated, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const { targetEventDate, startDate, endDate } = req.body;
    const userId = await getUserId(req);

    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (group.userId !== userId) {
      return res.status(403).json({ message: "Only the organizer can create availability pulses" });
    }

    const existingPulse = await storage.getActivePulseForGroup(groupId);
    if (existingPulse) {
      return res.status(400).json({
        message: "An active availability pulse already exists for this group",
        existingPulseId: existingPulse.id
      });
    }

    const groupMembers = await storage.getGroupMembers(groupId);

    const now = new Date();
    const target = targetEventDate ? new Date(targetEventDate) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const pulseStartDate = startDate ? new Date(startDate) : new Date(target.getTime() - 3 * 24 * 60 * 60 * 1000);
    const pulseEndDate = endDate ? new Date(endDate) : new Date(target.getTime() + 18 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(target.getTime() - 2 * 24 * 60 * 60 * 1000);

    const pulse = await storage.createAvailabilityPulse({
      groupId,
      startDate: pulseStartDate,
      endDate: pulseEndDate,
      targetEventDate: target,
      memberCount: groupMembers.length,
      expiresAt,
      status: 'active',
    });

    for (const member of groupMembers) {
      await storage.getOrCreatePulseResponseForMember(
        pulse.id,
        member.id,
        member.userId || undefined
      );
    }

    res.json({
      success: true,
      pulse: {
        id: pulse.id,
        startDate: pulse.startDate,
        endDate: pulse.endDate,
        targetEventDate: pulse.targetEventDate,
        memberCount: pulse.memberCount,
        expiresAt: pulse.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('[Availability Pulse] Error creating pulse:', error);
    res.status(500).json({ message: safeError(error) });
  }
});

router.post("/availability-pulse/:pulseId/respond", isAuthenticated, async (req: any, res) => {
  try {
    const { pulseId } = req.params;
    const { availability, notes } = req.body;
    const userId = await getUserId(req);

    const pulse = await storage.getAvailabilityPulse(pulseId);
    if (!pulse) {
      return res.status(404).json({ message: "Pulse not found" });
    }

    if (pulse.status !== 'active') {
      return res.status(400).json({ message: "This availability pulse is no longer active" });
    }

    const member = await storage.getGroupMemberByUserId(pulse.groupId, userId);
    if (!member) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    let response = await storage.getPulseResponse(pulseId, member.id);

    if (response) {
      response = await storage.updatePulseResponse(response.id, availability, notes);
    } else {
      response = await storage.createPulseResponse({
        pulseId,
        memberId: member.id,
        userId,
        availability,
        notes,
      });
    }

    res.json({
      success: true,
      response: {
        id: response?.id,
        availability: response?.availability,
        notes: response?.notes,
        updatedAt: response?.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[Availability Pulse] Error submitting response:', error);
    res.status(500).json({ message: safeError(error) });
  }
});

router.get("/availability-pulse/:pulseId/respond/:responseToken", async (req, res) => {
  try {
    const { pulseId, responseToken } = req.params;

    const data = await storage.getPulseResponseWithDetails(responseToken);
    if (!data) {
      return res.status(404).json({ message: "Response not found" });
    }

    const { response, pulse, member, group } = data;

    if (pulse.id !== pulseId) {
      return res.status(400).json({ message: "Invalid pulse/response combination" });
    }

    const { aggregated, totalResponses } = await storage.getAggregatedPulseAvailability(pulseId);

    res.json({
      pulse: {
        id: pulse.id,
        startDate: pulse.startDate,
        endDate: pulse.endDate,
        targetEventDate: pulse.targetEventDate,
        status: pulse.status,
        memberCount: pulse.memberCount,
        expiresAt: pulse.expiresAt,
      },
      group: {
        name: group.name,
        emoji: group.emoji,
      },
      member: {
        name: member.name,
      },
      existingResponse: {
        availability: response.availability,
        notes: response.notes,
        updatedAt: response.updatedAt,
      },
      aggregatedAvailability: aggregated,
      totalResponses,
    });
  } catch (error: any) {
    console.error('[Availability Pulse] Error getting response page:', error);
    res.status(500).json({ message: safeError(error) });
  }
});

router.post("/availability-pulse/:pulseId/respond/:responseToken", async (req, res) => {
  try {
    const { pulseId, responseToken } = req.params;
    const { availability, notes } = req.body;

    const response = await storage.getPulseResponseByToken(responseToken);
    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    if (response.pulseId !== pulseId) {
      return res.status(400).json({ message: "Invalid pulse/response combination" });
    }

    const pulse = await storage.getAvailabilityPulse(pulseId);
    if (!pulse || pulse.status !== 'active') {
      return res.status(400).json({ message: "This availability pulse is no longer active" });
    }

    const updatedResponse = await storage.updatePulseResponse(response.id, availability, notes);

    res.json({
      success: true,
      response: {
        id: updatedResponse?.id,
        availability: updatedResponse?.availability,
        notes: updatedResponse?.notes,
        updatedAt: updatedResponse?.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[Availability Pulse] Error submitting response by token:', error);
    res.status(500).json({ message: safeError(error) });
  }
});

export default router;
