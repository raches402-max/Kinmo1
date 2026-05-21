/**
 * Hosting Routes
 *
 * Event hosting management: toggle availability, volunteer, hand-off, rotating host assignments.
 *
 *   PATCH  /members/:id/hosting-toggle                  — toggle hosting availability
 *   POST   /itineraries/:id/volunteer-host              — volunteer to host
 *   POST   /itineraries/:id/hand-off-host               — hand off hosting
 *  POST   /groups/:groupId/request-host                — request a host (organizer)
 *   GET    /groups/:groupId/pending-host-request         — get pending host request
 *   GET    /members/:memberId/host-assignments           — get host assignments
 *   POST   /host-assignments/:assignmentId/respond       — respond to host assignment
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId, requireGroupOwnership, requireMemberAccess } from "../authorization";
import { hostAssignments } from "@shared/schema";
import { fail } from "../lib/responses";

const router = Router();

router.patch("/members/:id/hosting-toggle", requireMemberAccess(), async (req: any, res) => {
  try {
    const { openToHosting, claimToken } = req.body;
    const userId = await getUserId(req);

    if (!userId && !claimToken) {
      return fail(res, 401, "Authentication or claim token required");
    }

    const member = await storage.getMember(req.params.id);
    if (!member) {
      return fail(res, 404, "Member not found");
    }

    if (claimToken && member.claimToken !== claimToken) {
      return fail(res, 403, "Invalid claim token");
    }
    if (userId && member.userId !== userId) {
      return fail(res, 403, "Not authorized to modify this member");
    }

    const updatedMember = await storage.toggleMemberHosting(req.params.id, openToHosting);
    res.json(updatedMember);
  } catch (error: any) {
    fail(res, 400, error.message);
  }
});

router.post("/itineraries/:id/volunteer-host", requireMemberAccess(), async (req: any, res) => {
  try {
    const { claimToken } = req.body;
    const userId = await getUserId(req);

    if (!userId && !claimToken) {
      return fail(res, 401, "Authentication or claim token required");
    }

    const itinerary = await storage.getItinerary(req.params.id);
    if (!itinerary || !itinerary.groupId) {
      return fail(res, 404, "Itinerary not found");
    }

    const groupMembers = await storage.getGroupMembers(itinerary.groupId);
    let member;

    if (claimToken) {
      member = groupMembers.find(m => m.claimToken === claimToken);
    } else if (userId) {
      member = groupMembers.find(m => m.userId === userId);
    }

    if (!member) {
      return fail(res, 404, "You are not a member of this group");
    }

    if (!member.openToHosting) {
      return fail(res, 400, "You must be open to hosting to volunteer");
    }

    const updatedItinerary = await storage.volunteerToHost(req.params.id, member.id);

    const existingRsvps = await storage.getItineraryRsvps(req.params.id);
    const existingRsvp = existingRsvps.find(r => r.memberId === member.id);

    if (!existingRsvp) {
      await storage.createRsvp({
        itineraryId: req.params.id,
        memberId: member.id,
        memberName: member.name || undefined,
        response: 'yes',
      });
    } else if (existingRsvp.response !== 'yes') {
      await storage.updateRsvp(existingRsvp.id, { response: 'yes' });
    }

    res.json(updatedItinerary);
  } catch (error: any) {
    fail(res, 400, error.message);
  }
});

router.post("/itineraries/:id/hand-off-host", requireMemberAccess(), async (req: any, res) => {
  try {
    const { newHostMemberId, claimToken } = req.body;
    const userId = await getUserId(req);

    if (!userId && !claimToken) {
      return fail(res, 401, "Authentication or claim token required");
    }

    const itinerary = await storage.getItinerary(req.params.id);
    if (!itinerary || !itinerary.groupId) {
      return fail(res, 404, "Itinerary not found");
    }

    const groupMembers = await storage.getGroupMembers(itinerary.groupId);
    let currentMember;

    if (claimToken) {
      currentMember = groupMembers.find(m => m.claimToken === claimToken);
    } else if (userId) {
      currentMember = groupMembers.find(m => m.userId === userId);
    }

    if (!currentMember) {
      return fail(res, 404, "You are not a member of this group");
    }

    if (itinerary.hostMemberId !== currentMember.id) {
      return fail(res, 403, "You are not the current host");
    }

    const newHostMember = await storage.getMember(newHostMemberId);
    if (!newHostMember) {
      return fail(res, 404, "New host member not found");
    }

    if (!newHostMember.openToHosting) {
      return fail(res, 400, "New host must be open to hosting");
    }

    const updatedItinerary = await storage.handOffHost(req.params.id, newHostMemberId);

    const existingRsvps = await storage.getItineraryRsvps(req.params.id);
    const existingRsvp = existingRsvps.find(r => r.memberId === newHostMemberId);

    if (!existingRsvp) {
      await storage.createRsvp({
        itineraryId: req.params.id,
        memberId: newHostMemberId,
        memberName: newHostMember.name || undefined,
        response: 'yes',
      });
    } else if (existingRsvp.response !== 'yes') {
      await storage.updateRsvp(existingRsvp.id, { response: 'yes' });
    }

    res.json(updatedItinerary);
  } catch (error: any) {
    fail(res, 400, error.message);
  }
});

router.post("/groups/:groupId/request-host", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const { itineraryId } = req.body;
    const userId = await getUserId(req);

    if (!userId) {
      return fail(res, 401, "Authentication required");
    }

    const group = await storage.getGroup(req.params.groupId);
    if (!group) {
      return fail(res, 404, "Group not found");
    }

    if (group.userId !== userId) {
      return fail(res, 403, "Only group owner can request a host");
    }

    const pendingAssignment = await storage.getPendingHostAssignment(req.params.groupId);
    if (pendingAssignment) {
      return fail(res, 400, "There is already a pending host request");
    }

    const nextVolunteer = await storage.getNextHostVolunteer(req.params.groupId);
    if (!nextVolunteer) {
      return fail(res, 404, "No volunteers available to host");
    }

    const assignment = await storage.createHostAssignment(
      req.params.groupId,
      nextVolunteer.id,
      itineraryId
    );

    res.json({ assignment, volunteer: nextVolunteer });
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

router.get("/groups/:groupId/pending-host-request", async (req: any, res) => {
  try {
    const userId = await getUserId(req);

    if (!userId) {
      return fail(res, 401, "Authentication required");
    }

    const assignment = await storage.getPendingHostAssignment(req.params.groupId);
    if (!assignment) {
      return res.json(null);
    }

    const volunteer = await storage.getMember(assignment.memberId);
    res.json({ assignment, volunteer });
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

router.get("/members/:memberId/host-assignments", async (req: any, res) => {
  try {
    const { claimToken } = req.query;
    const userId = await getUserId(req);

    if (!userId && !claimToken) {
      return fail(res, 401, "Authentication or claim token required");
    }

    const member = await storage.getMember(req.params.memberId);
    if (!member) {
      return fail(res, 404, "Member not found");
    }

    if (claimToken && member.claimToken !== claimToken) {
      return fail(res, 403, "Invalid claim token");
    }
    if (userId && member.userId !== userId) {
      return fail(res, 403, "Not authorized");
    }

    const assignments = await storage.getMemberHostAssignments(req.params.memberId);
    res.json(assignments);
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

router.post("/host-assignments/:assignmentId/respond", requireMemberAccess(), async (req: any, res) => {
  try {
    const { accepted, claimToken } = req.body;
    const userId = await getUserId(req);

    if (!userId && !claimToken) {
      return fail(res, 401, "Authentication or claim token required");
    }

    const assignments = await db
      .select()
      .from(hostAssignments)
      .where(eq(hostAssignments.id, req.params.assignmentId));

    if (assignments.length === 0) {
      return fail(res, 404, "Host assignment not found");
    }

    const assignment = assignments[0];

    const member = await storage.getMember(assignment.memberId);
    if (!member) {
      return fail(res, 404, "Member not found");
    }

    if (claimToken && member.claimToken !== claimToken) {
      return fail(res, 403, "Invalid claim token");
    }
    if (userId && member.userId !== userId) {
      return fail(res, 403, "Not authorized");
    }

    const updatedAssignment = await storage.respondToHostAssignment(
      req.params.assignmentId,
      accepted,
      member.id
    );

    if (accepted && assignment.itineraryId) {
      await storage.volunteerToHost(assignment.itineraryId, member.id);

      const existingRsvps = await storage.getItineraryRsvps(assignment.itineraryId);
      const existingRsvp = existingRsvps.find(r => r.memberId === member.id);

      if (!existingRsvp) {
        await storage.createRsvp({
          itineraryId: assignment.itineraryId,
          memberId: member.id,
          memberName: member.name || undefined,
          response: 'yes',
        });
      } else if (existingRsvp.response !== 'yes') {
        await storage.updateRsvp(existingRsvp.id, { response: 'yes' });
      }
    }

    if (!accepted) {
      const nextVolunteer = await storage.getNextHostVolunteer(
        assignment.groupId,
        [member.id]
      );

      if (nextVolunteer) {
        const newAssignment = await storage.createHostAssignment(
          assignment.groupId,
          nextVolunteer.id,
          assignment.itineraryId || undefined
        );

        return res.json({
          assignment: updatedAssignment,
          nextAssignment: newAssignment,
          nextVolunteer
        });
      }
    }

    res.json({ assignment: updatedAssignment });
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

export default router;
