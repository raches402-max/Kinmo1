/**
 * Member Extras Routes
 *
 * Routes (no auth — claim token flow):
 *   GET    /api/members/verify-claim/:inviteToken       — verify invite token, return member info
 *   POST   /api/members/:id/claim                       — claim a member identity
 *   PATCH  /api/members/:id/preferences                 — update member preferences (claim token)
 *   PATCH  /api/members/:id/constraints                 — update member constraints (claim token)
 *
 * Routes (auth required):
 *   GET    /api/members/:memberId/constraint-analysis   — AI constraint analysis
 *   PATCH  /api/members/:memberId/constraints           — accept/dismiss constraint suggestion
 *   PATCH  /api/members/:id/profile                     — update member profile
 *   GET    /api/members/:memberId/favorites             — list member favorite venues
 *   POST   /api/members/:memberId/favorites             — add favorite venue
 *   DELETE /api/members/:memberId/favorites/:placeId    — remove favorite venue
 *
 * Group-scoped (auth required):
 *   GET    /api/groups/:groupId/my-preferences          — get member's group preferences
 *   PATCH  /api/groups/:groupId/my-preferences          — update member's group preferences
 *   GET    /api/groups/:groupId/members-availability    — aggregated availability heatmap
 *   GET    /api/groups/:groupId/members-budgets         — aggregated budget data
 *
 * MIGRATED FROM: server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { isAuthenticated } from "../googleAuth";
import { requireMemberAccess, getUserId, userOwnsGroup, userIsMemberOfGroup } from "../authorization";
import { safeParse } from "../validation-middleware";
import { updateMemberConstraintsActionSchema } from "../validation-schemas";
import {
  members as membersTable,
  users,
  userProfiles,
  itineraryInvites,
  curatedVenues,
} from "@shared/schema";
import { getPlaceDetails } from "../google-places";
import { analyzeRSVPPatterns } from "../member-learning";

const router = Router();

// ── Verify invite token ────────────────────────────────────────────────────

router.get("/members/verify-claim/:inviteToken", async (req, res) => {
  try {
    const { inviteToken } = req.params;

    if (!inviteToken) {
      return res.status(400).json({ message: "Invite token required" });
    }

    const invites = await db
      .select()
      .from(itineraryInvites)
      .where(sql`invite_token = ${inviteToken}`);

    if (invites.length === 0) {
      return res.status(404).json({ message: "Invalid or expired invite token" });
    }

    const invite = invites[0];

    // Handle organizer invites (no member yet — memberId is null)
    if (!invite.memberId) {
      if (!invite.itineraryId) {
        return res.status(404).json({ message: "Invalid invite - missing itinerary" });
      }
      const itinerary = await storage.getItinerary(invite.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group || !group.userId) {
        return res.status(404).json({ message: "Group not found" });
      }

      const organizer = await storage.getUser(group.userId);
      if (!organizer) {
        return res.status(404).json({ message: "Organizer not found" });
      }

      return res.json({
        id: null,
        name: `${organizer.firstName} ${organizer.lastName}`,
        email: organizer.email,
        isOrganizer: true,
      });
    }

    const member = await storage.getMember(invite.memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    res.json({
      id: member.id,
      name: member.name,
      email: member.email,
      hasAccount: !!member.userId,
    });
  } catch (error: any) {
    console.error("[Verify Invite] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// ── Claim a member identity ────────────────────────────────────────────────

router.post("/members/:id/claim", async (req, res) => {
  try {
    const { claimToken, groupId } = req.body;

    if (!claimToken) {
      return res.status(400).json({ message: "Claim token required" });
    }

    let memberId = req.params.id;

    // Handle virtual organizer IDs (format: "organizer-{userId}")
    if (memberId.startsWith("organizer-")) {
      const organizerUserId = memberId.replace("organizer-", "");

      if (!groupId) {
        return res.status(400).json({ message: "Group ID required for organizer claim" });
      }

      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== organizerUserId) {
        return res.status(403).json({ message: "Invalid organizer claim" });
      }

      const [organizerInfo] = await db
        .select({
          displayName: userProfiles.displayName,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(eq(users.id, organizerUserId));

      const organizerName =
        organizerInfo?.displayName ||
        (organizerInfo?.firstName && organizerInfo?.lastName
          ? `${organizerInfo.firstName} ${organizerInfo.lastName}`
          : organizerInfo?.firstName || organizerInfo?.email?.split("@")[0] || "Organizer");

      const existingOrganizerMember = await db
        .select()
        .from(membersTable)
        .where(and(eq(membersTable.groupId, groupId), eq(membersTable.userId, organizerUserId)))
        .limit(1);

      if (existingOrganizerMember.length > 0) {
        memberId = existingOrganizerMember[0].id;
      } else {
        const newMember = await storage.createMember({
          groupId,
          name: organizerName,
          email: organizerInfo?.email || null,
          userId: organizerUserId,
          hasJoined: true,
          isGuest: false,
        });
        memberId = newMember.id;
      }
    }

    const existingMember = await storage.getMember(memberId);
    if (!existingMember) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (existingMember.claimToken && existingMember.claimToken !== claimToken) {
      return res.status(409).json({
        message: "This member has already been claimed by someone else",
        alreadyClaimed: true,
      });
    }

    const member = await storage.updateMember(memberId, {
      claimToken,
      hasJoined: true,
    });

    res.json(member);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// ── Update member preferences (claim token, no auth) ───────────────────────

router.patch("/members/:id/preferences", requireMemberAccess(), async (req: any, res) => {
  try {
    const { memberLocation, memberBudgetMin, memberBudgetMax, memberAvailability, claimToken } = req.body;

    if (!claimToken) {
      return res.status(401).json({ message: "Claim token required" });
    }

    const member = await storage.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.claimToken !== claimToken) {
      return res.status(401).json({ message: "Invalid claim token" });
    }

    const updates: any = {};
    if (memberLocation !== undefined) updates.memberLocation = memberLocation;
    if (memberBudgetMin !== undefined) updates.memberBudgetMin = memberBudgetMin;
    if (memberBudgetMax !== undefined) updates.memberBudgetMax = memberBudgetMax;
    if (memberAvailability !== undefined) updates.memberAvailability = memberAvailability;

    const updatedMember = await storage.updateMember(req.params.id, updates);
    res.json(updatedMember);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// ── Update member constraints (claim token, no auth) ───────────────────────

router.patch("/members/:id/constraints", requireMemberAccess(), async (req: any, res) => {
  try {
    const { memberConstraints, claimToken } = req.body;

    if (!claimToken) {
      return res.status(401).json({ message: "Claim token required" });
    }

    const member = await storage.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.claimToken !== claimToken) {
      return res.status(401).json({ message: "Invalid claim token" });
    }

    const updatedMember = await storage.updateMember(req.params.id, { memberConstraints });
    res.json(updatedMember);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// ── Constraint analysis (auth required) ───────────────────────────────────

router.get("/members/:memberId/constraint-analysis", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { memberId } = req.params;

    const member = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, memberId))
      .limit(1);

    if (member.length === 0) {
      return res.status(404).json({ message: "Member not found" });
    }

    const hasAccess =
      (await userOwnsGroup(userId, member[0].groupId)) ||
      (await userIsMemberOfGroup(userId, member[0].groupId));
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    const currentConstraints = (member[0].memberConstraints as any) || {};
    const groupId = member[0].groupId;

    const patterns = await analyzeRSVPPatterns(memberId, groupId);

    const budgetConfidence =
      patterns.totalRSVPs > 0
        ? Math.round((patterns.budgetConcernCount / patterns.totalRSVPs) * 100)
        : 0;
    const locationConfidence =
      patterns.totalRSVPs > 0
        ? Math.round((patterns.locationConcernCount / patterns.totalRSVPs) * 100)
        : 0;
    const timeConfidence =
      patterns.totalRSVPs > 0
        ? Math.round((patterns.timeConcernCount / patterns.totalRSVPs) * 100)
        : 0;

    const suggestions = [];

    if (patterns.budgetConcernCount >= 3 && !currentConstraints.budgetConcern) {
      suggestions.push({
        type: "budgetConcern",
        title: "Budget is a frequent concern",
        description: `Mentioned in ${patterns.budgetConcernCount} of ${patterns.totalRSVPs} recent RSVPs`,
        confidence: budgetConfidence,
        action: "accept",
      });
    }

    if (patterns.locationConcernCount >= 3 && !currentConstraints.distanceConcern) {
      suggestions.push({
        type: "distanceConcern",
        title: "Location/distance is often mentioned",
        description: `Mentioned in ${patterns.locationConcernCount} of ${patterns.totalRSVPs} recent RSVPs`,
        confidence: locationConfidence,
        action: "accept",
      });
    }

    if (patterns.timeConcernCount >= 3) {
      suggestions.push({
        type: "timeConcern",
        title: "Timing conflicts detected",
        description: `Mentioned in ${patterns.timeConcernCount} of ${patterns.totalRSVPs} recent RSVPs`,
        confidence: timeConfidence,
        action: "accept",
      });
    }

    if (patterns.unavailableDays.length >= 3) {
      const dayFrequency: Record<string, number> = {};
      patterns.unavailableDays.forEach((day) => {
        dayFrequency[day] = (dayFrequency[day] || 0) + 1;
      });

      const frequentDays = Object.entries(dayFrequency)
        .filter(([_, count]) => count >= 2)
        .map(([day]) => day);

      if (
        frequentDays.length > 0 &&
        !currentConstraints.scheduleConflicts?.some((d: string) => frequentDays.includes(d))
      ) {
        suggestions.push({
          type: "scheduleConflicts",
          title: `${frequentDays.join(", ")} seem difficult`,
          description: `You've mentioned these days as unavailable multiple times`,
          confidence: Math.round(
            (Math.max(...Object.values(dayFrequency)) / patterns.totalRSVPs) * 100
          ),
          action: "accept",
          data: frequentDays,
        });
      }
    }

    res.json({
      currentConstraints,
      patterns: {
        budgetConcernCount: patterns.budgetConcernCount,
        locationConcernCount: patterns.locationConcernCount,
        timeConcernCount: patterns.timeConcernCount,
        unavailableDays: patterns.unavailableDays,
        totalRSVPs: patterns.totalRSVPs,
      },
      suggestions,
    });
  } catch (error: any) {
    console.error("Error analyzing member constraints:", error);
    if (error.message === "Unauthorized") {
      return res.status(403).json({ message: "You don't have access to this member" });
    }
    res.status(500).json({ message: safeError(error) });
  }
});

// ── Accept/dismiss constraint suggestion (auth required) ───────────────────

router.patch("/members/:memberId/constraints", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { memberId } = req.params;

    const validatedData = safeParse(updateMemberConstraintsActionSchema, req.body, res);
    if (!validatedData) return;
    const { action, constraintType, data } = validatedData;

    const member = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, memberId))
      .limit(1);

    if (member.length === 0) {
      return res.status(404).json({ message: "Member not found" });
    }

    const hasAccess =
      (await userOwnsGroup(userId, member[0].groupId)) ||
      (await userIsMemberOfGroup(userId, member[0].groupId));
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    const currentConstraints = (member[0].memberConstraints as any) || {};

    if (action === "accept") {
      if (constraintType === "budgetConcern") {
        currentConstraints.budgetConcern = true;
      } else if (constraintType === "distanceConcern") {
        currentConstraints.distanceConcern = true;
      } else if (constraintType === "scheduleConflicts" && data) {
        currentConstraints.scheduleConflicts = [
          ...(currentConstraints.scheduleConflicts || []),
          ...data.filter(
            (d: string) => !currentConstraints.scheduleConflicts?.includes(d)
          ),
        ];
      }

      await db
        .update(membersTable)
        .set({ memberConstraints: currentConstraints })
        .where(eq(membersTable.id, memberId));

      res.json({ success: true, constraints: currentConstraints });
    } else {
      res.json({ success: true, message: "Suggestion dismissed" });
    }
  } catch (error: any) {
    console.error("Error updating member constraints:", error);
    if (error.message === "Unauthorized") {
      return res.status(403).json({ message: "You don't have access to this member" });
    }
    res.status(500).json({ message: safeError(error) });
  }
});

// ── Update member profile (auth required) ─────────────────────────────────

router.patch("/members/:id/profile", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { homeBaseLocation, homeBaseLatitude, homeBaseLongitude, activityPreferences, personalAvailability } =
      req.body;

    const member = await storage.getMember(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to modify this member" });
    }

    const updatedMember = await storage.updateMember(req.params.id, {
      homeBaseLocation,
      homeBaseLatitude: homeBaseLatitude ? String(homeBaseLatitude) : undefined,
      homeBaseLongitude: homeBaseLongitude ? String(homeBaseLongitude) : undefined,
      activityPreferences,
      personalAvailability,
      profileCompleted: true,
    });

    res.json(updatedMember);
  } catch (error: any) {
    console.error("[Update Member Profile] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// ── Member favorites (auth required) ──────────────────────────────────────

router.get("/members/:memberId/favorites", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { memberId } = req.params;

    const member = await storage.getMember(memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to view this member's favorites" });
    }

    const favorites = await storage.getMemberFavoriteVenues(memberId);
    res.json(favorites);
  } catch (error: any) {
    console.error("[Get Member Favorites] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

router.post("/members/:memberId/favorites", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { memberId } = req.params;
    const { venuePlaceId, venueName, venueAddress, venuePhotoUrl, category } = req.body;

    if (!venuePlaceId || !venueName) {
      return res.status(400).json({ message: "venuePlaceId and venueName are required" });
    }

    const member = await storage.getMember(memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to modify this member's favorites" });
    }

    const alreadyFavorited = await storage.isFavoriteVenue(memberId, venuePlaceId);
    if (alreadyFavorited) {
      return res.status(400).json({ message: "Venue already in favorites" });
    }

    const favorite = await storage.addMemberFavoriteVenue(memberId, {
      venuePlaceId,
      venueName,
      venueAddress,
      venuePhotoUrl,
      category,
    });

    // Auto-cache venue to curatedVenues if not already there
    try {
      const [existingVenue] = await db
        .select()
        .from(curatedVenues)
        .where(eq(curatedVenues.googlePlaceId, venuePlaceId))
        .limit(1);

      if (!existingVenue) {
        const placeDetails = await getPlaceDetails(venuePlaceId);

        if (placeDetails && placeDetails.location) {
          const categoryMap: Record<string, string> = {
            restaurant: "meal",
            cafe: "cafes",
            coffee: "cafes",
            bar: "drinks",
            dessert: "dessert",
            bakery: "dessert",
            ice_cream: "dessert",
          };
          const mappedCategory = categoryMap[category?.toLowerCase() || ""] || "experiences";

          await db.insert(curatedVenues).values({
            name: placeDetails.name,
            address: placeDetails.address,
            latitude: placeDetails.location.lat.toString(),
            longitude: placeDetails.location.lng.toString(),
            category: mappedCategory,
            rating: placeDetails.rating?.toString() || null,
            reviewCount: placeDetails.reviewCount || null,
            priceLevel:
              typeof placeDetails.priceLevel === "number" ? placeDetails.priceLevel : null,
            photoUrl: placeDetails.photoUrl || null,
            googlePlaceId: venuePlaceId,
            description: null,
            tags: placeDetails.types || [],
            region: "bay_area",
            isActive: true,
            source: "user_suggested",
            suggestedBy: userId,
            openingHours: placeDetails.openingHours || null,
            businessStatus: placeDetails.businessStatus || null,
          });
        }
      }
    } catch (cacheError: any) {
      console.error("[Auto-Cache] Error caching venue:", cacheError);
    }

    res.json(favorite);
  } catch (error: any) {
    console.error("[Add Member Favorite] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

router.delete("/members/:memberId/favorites/:placeId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { memberId, placeId } = req.params;

    const member = await storage.getMember(memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (member.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to modify this member's favorites" });
    }

    await storage.removeMemberFavoriteVenue(memberId, placeId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Remove Member Favorite] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// ── Group-scoped member preferences ───────────────────────────────────────

router.get("/groups/:groupId/my-preferences", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    const group = await storage.getGroup(groupId);
    const members = await storage.getGroupMembers(groupId);
    const member = members.find((m) => m.userId === userId);
    const isOwner = group?.userId === userId;

    if (!member && !isOwner) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    const preferences = await storage.getMemberGroupPreferences(userId, groupId);
    res.json(preferences || null);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

router.patch("/groups/:groupId/my-preferences", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    const group = await storage.getGroup(groupId);
    const members = await storage.getGroupMembers(groupId);
    const member = members.find((m) => m.userId === userId);
    const isOwner = group?.userId === userId;

    if (!member && !isOwner) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    const {
      budgetOverrideMin,
      budgetOverrideMax,
      categoryPreferencesOverride,
      availabilityOverride,
      meetingFrequencyOverride,
    } = req.body;

    const preferences = await storage.upsertMemberGroupPreferences(userId, groupId, {
      budgetOverrideMin,
      budgetOverrideMax,
      categoryPreferencesOverride,
      availabilityOverride,
      meetingFrequencyOverride,
    });

    res.json(preferences);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// ── Members availability heatmap ───────────────────────────────────────────

router.get("/groups/:groupId/members-availability", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    const group = await storage.getGroup(groupId);
    const members = await storage.getGroupMembers(groupId);
    const member = members.find((m) => m.userId === userId);
    const isOwner = group?.userId === userId;

    if (!member && !isOwner) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    const membersAvailability = await storage.getGroupMembersAvailability(groupId);
    const currentUserMemberId = member?.id || null;

    res.json({
      membersAvailability,
      currentUserMemberId,
      totalMembers: membersAvailability.length,
    });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

// ── Members budgets ────────────────────────────────────────────────────────

router.get("/groups/:groupId/members-budgets", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupId } = req.params;

    const group = await storage.getGroup(groupId);
    const members = await storage.getGroupMembers(groupId);
    const member = members.find((m) => m.userId === userId);
    const isOwner = group?.userId === userId;

    if (!member && !isOwner) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    const membersBudgets = await storage.getGroupMembersBudgets(groupId);
    const currentUserMemberId = member?.id || null;

    res.json({
      membersBudgets,
      currentUserMemberId,
      groupBudgetMin: group?.budgetMin ?? 20,
      groupBudgetMax: group?.budgetMax ?? 80,
      totalMembers: membersBudgets.length,
    });
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

export default router;
