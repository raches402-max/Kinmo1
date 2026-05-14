/**
 * Venues / Places CRUD Routes
 *
 * Basic venue and saved places management.
 *
 * Routes:
 *   GET    /api/venues/search                          — search venues (auth required)
 *   POST   /api/venues/suggest-alternatives            — suggest alternate venues (auth required)
 *   GET    /api/places/search                          — ad-hoc places search (public)
 *   GET    /api/groups/:groupId/search-venues          — group-context venue search (public)
 *   GET    /api/curated-venues                         — list curated venues (auth required)
 *   POST   /api/venues/:googlePlaceId/refresh-photo    — refresh venue photo (auth required)
 *   GET    /api/user/saved-places                      — get user's saved places (auth required)
 *   GET    /api/user/all-places                        — get user's personal + group venue libraries (auth required)
 *   GET    /api/user/places-swipe-queue                — get user's unreviewed venue swipe queue (auth required)
 *   POST   /api/user/saved-places                      — add user saved place (auth required)
 *   DELETE /api/user/saved-places/:placeId             — remove user saved place (auth required)
 *   GET    /api/groups/:groupId/saved-places           — get group's saved places (auth required)
 *   POST   /api/groups/:groupId/saved-places           — add group saved place (auth required)
 *   DELETE /api/groups/:groupId/saved-places/:placeId  — remove group saved place (auth required)
 *
 * MIGRATED FROM: server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { isAuthenticated } from "../googleAuth";
import { storage } from "../storage";
import { getUserId, requireGroupAccess } from "../authorization";
import { searchPlaces, getPlaceDetails } from "../google-places";
import { safeParse } from "../validation-middleware";
import { suggestAlternativesSchema } from "../validation-schemas";
import {
  curatedVenues,
  votingEvents,
  userSavedPlaces,
  groupSavedPlaces,
} from "@shared/schema";

const router = Router();

// ==================== Venue Search ====================

// Search venues by query string
// GET /api/venues/search?query=...&location=...
router.get("/venues/search", isAuthenticated, async (req: any, res) => {
  try {
    const { query, location } = req.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ message: "Query parameter required" });
    }

    const searchLocation =
      location && typeof location === "string" ? location : "San Francisco, CA";

    const results = await searchPlaces(
      query,
      searchLocation,
      6.2, // 10km radius (~6.2 miles)
      undefined, // coordinates
      false,     // skipCurated
      undefined, // venueType
      undefined, // budgetMax
      undefined, // seenVenues
      false,     // forceComprehensiveSearch
      true       // userDirected
    );

    const suggestions = results.map((place: any) => ({
      placeId: place.placeId || place.googlePlaceId,
      name: place.name,
      address: place.address,
      category: place.types?.[0] || "other",
      photoUrl: place.photoUrl,
      rating: place.rating,
      priceLevel: place.priceLevel,
    }));

    res.json({ results: suggestions });
  } catch (error: any) {
    console.error("[Venue Search] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Suggest similar venue alternatives for an itinerary context
// POST /api/venues/suggest-alternatives
router.post("/venues/suggest-alternatives", isAuthenticated, async (req: any, res) => {
  try {
    const validatedData = safeParse(suggestAlternativesSchema, req.body, res);
    if (!validatedData) return;

    const { currentVenue, itineraryId } = validatedData;

    let groupLocation = "San Francisco, CA";

    if (itineraryId) {
      const itinerary = await storage.getItinerary(itineraryId);
      if (itinerary?.groupId) {
        const group = await storage.getGroup(itinerary.groupId);
        if (group?.locationBase) {
          groupLocation = group.locationBase;
        }
      }
    }

    const venueType = currentVenue.venueType || "restaurant";
    const searchQuery = `${venueType} near ${currentVenue.address || groupLocation}`;

    const alternatives = await searchPlaces(
      searchQuery,
      groupLocation,
      3,
      undefined,
      false,
      venueType,
      undefined,
      currentVenue.placeId ? [currentVenue.placeId] : [],
      false,
      true,
    );

    const suggestions = alternatives.slice(0, 5).map((alt: any) => {
      const reasons: string[] = [];

      if (alt.rating && parseFloat(alt.rating) >= 4.0) {
        reasons.push(`Highly rated (${alt.rating})`);
      }
      if (alt.reviewCount && alt.reviewCount > 100) {
        reasons.push(`Well-reviewed (${alt.reviewCount} reviews)`);
      }
      if (alt.priceLevel) {
        const priceLen = alt.priceLevel.length;
        if (priceLen <= 2) {
          reasons.push(`Affordable (${alt.priceLevel})`);
        }
      }

      return {
        placeId: alt.placeId,
        name: alt.name,
        address: alt.address,
        rating: alt.rating,
        priceLevel: alt.priceLevel,
        reviewCount: alt.reviewCount,
        photoUrl: alt.photoUrl,
        types: alt.types,
        type: alt.types?.[0] || venueType,
        latitude: alt.location?.lat,
        longitude: alt.location?.lng,
        reasoning: reasons.length > 0 ? reasons.join(", ") : "Similar venue in area",
      };
    });

    res.json({ suggestions });
  } catch (error: any) {
    console.error("[AI Venue Suggestions] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Public places search for ad-hoc venue dialogs and "search near" flows
// GET /api/places/search?query=...&lat=...&lng=...&radius=...
router.get("/places/search", async (req, res) => {
  try {
    const { query, lat, lng, radius } = req.query;

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return res.json({ results: [] });
    }

    const hasCustomCoords =
      lat &&
      lng &&
      !isNaN(parseFloat(lat as string)) &&
      !isNaN(parseFloat(lng as string));

    const searchQuery = query.trim();
    const defaultLocation = "San Francisco Bay Area";
    const searchRadius = radius ? parseFloat(radius as string) : hasCustomCoords ? 0.5 : 25;
    const coordinates = hasCustomCoords
      ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) }
      : { lat: 37.7749, lng: -122.4194 };

    const results = await searchPlaces(
      searchQuery,
      defaultLocation,
      searchRadius,
      coordinates,
      false,
      undefined,
      undefined,
      undefined,
      true,
      true,
    );

    res.json({
      results: results.slice(0, 10).map((place: any) => ({
        placeId: place.placeId,
        name: place.name,
        address: place.address,
        photoUrl: place.photoUrl,
        rating: place.rating,
        reviewCount: place.reviewCount,
        types: place.types || [],
      })),
    });
  } catch (error: any) {
    console.error("[Places Search] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Public search with group location/budget context
// GET /api/groups/:groupId/search-venues?query=...
router.get("/groups/:groupId/search-venues", async (req, res) => {
  try {
    const { query } = req.query;
    const { groupId } = req.params;

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return res.json({ results: [] });
    }

    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const results = await searchPlaces(
      query.trim(),
      group.locationBase,
      group.searchRadius || 10,
      group.latitude && group.longitude
        ? { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) }
        : undefined,
      false,
      undefined,
      group.budgetMax,
      undefined,
      true,
      true,
    );

    res.json({
      results: results.slice(0, 10).map((place: any) => ({
        placeId: place.placeId,
        name: place.name,
        address: place.address,
        photoUrl: place.photoUrl,
        rating: place.rating,
        reviewCount: place.reviewCount,
        types: place.types || [],
      })),
    });
  } catch (error: any) {
    console.error("Error searching venues:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// ==================== Curated Venues ====================

// List curated venues with optional filters
// GET /api/curated-venues?category=...&priceLevel=...&limit=...
router.get("/curated-venues", isAuthenticated, async (req: any, res) => {
  try {
    const { category, priceLevel, limit = "20" } = req.query;

    const conditions: any[] = [eq(curatedVenues.isActive, true)];

    if (category && typeof category === "string") {
      conditions.push(eq(curatedVenues.category, category));
    }

    if (priceLevel && typeof priceLevel === "string") {
      const priceLevelNum = parseInt(priceLevel);
      if (!isNaN(priceLevelNum)) {
        conditions.push(eq(curatedVenues.priceLevel, priceLevelNum));
      }
    }

    const venues = await db
      .select()
      .from(curatedVenues)
      .where(and(...conditions))
      .orderBy(desc(curatedVenues.rating))
      .limit(parseInt(limit as string) || 20);

    res.json(venues);
  } catch (error: any) {
    console.error("[Curated Venues] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// ==================== Venue Photo Refresh ====================

// Refresh a venue's photo from Google Places API
// POST /api/venues/:googlePlaceId/refresh-photo
router.post(
  "/venues/:googlePlaceId/refresh-photo",
  isAuthenticated,
  async (req, res) => {
    try {
      const { googlePlaceId } = req.params;

      if (!googlePlaceId) {
        return res.status(400).json({ message: "Google Place ID is required" });
      }

      const placeDetails = await getPlaceDetails(googlePlaceId);

      if (!placeDetails?.photoUrl) {
        return res
          .status(404)
          .json({ message: "No photo available for this place" });
      }

      const updatedVotingEvents = await db
        .update(votingEvents)
        .set({ photoUrl: placeDetails.photoUrl })
        .where(eq(votingEvents.googlePlaceId, googlePlaceId))
        .returning({ id: votingEvents.id, title: votingEvents.title });

      const updatedComplementary1 = await db
        .update(votingEvents)
        .set({ complementaryPlacePhotoUrl: placeDetails.photoUrl })
        .where(eq(votingEvents.complementaryPlaceId, googlePlaceId))
        .returning({ id: votingEvents.id });

      const updatedComplementary2 = await db
        .update(votingEvents)
        .set({ complementaryPlacePhotoUrl2: placeDetails.photoUrl })
        .where(eq(votingEvents.complementaryPlaceId2, googlePlaceId))
        .returning({ id: votingEvents.id });

      await db
        .update(curatedVenues)
        .set({ photoUrl: placeDetails.photoUrl })
        .where(eq(curatedVenues.googlePlaceId, googlePlaceId));

      await db
        .update(userSavedPlaces)
        .set({ photoUrl: placeDetails.photoUrl })
        .where(eq(userSavedPlaces.googlePlaceId, googlePlaceId));

      await db
        .update(groupSavedPlaces)
        .set({ photoUrl: placeDetails.photoUrl })
        .where(eq(groupSavedPlaces.googlePlaceId, googlePlaceId));

      const totalUpdated =
        updatedVotingEvents.length +
        updatedComplementary1.length +
        updatedComplementary2.length;

      res.json({
        success: true,
        photoUrl: placeDetails.photoUrl,
        updatedCount: totalUpdated,
        venues: updatedVotingEvents.map((v) => v.title),
      });
    } catch (error: any) {
      console.error("[Photo Refresh] Error:", error);
      res.status(500).json({ message: safeError(error, "Failed to refresh photo") });
    }
  }
);

// ==================== User Saved Places ====================

// Get all places for a user (personal + all their groups' venue libraries)
// GET /api/user/all-places?category=...
router.get("/user/all-places", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { category } = req.query;
    const categoryFilter = category && typeof category === "string" ? category : undefined;

    console.log(`[All Places] Fetching for user ${userId}, category filter: ${categoryFilter}`);

    const personalPlaces = await storage.getUserSavedPlaces(userId, categoryFilter);
    const userGroups = await storage.getUserGroups(userId);

    const venueLibraryResults = await Promise.allSettled(
      userGroups.map(async (group) => {
        const votingEvents = await storage.getGroupVotingEvents(group.id);

        const places = votingEvents
          .filter((ve) => ve.googlePlaceId)
          .filter((ve) => !categoryFilter || ve.venueType === categoryFilter)
          .map((ve) => ({
            id: ve.id,
            googlePlaceId: ve.googlePlaceId!,
            name: ve.title,
            address: ve.venueAddress || null,
            category: ve.venueType || null,
            rating: ve.rating || null,
            priceLevel: ve.priceLevel ? parseInt(ve.priceLevel) : null,
            photoUrl: ve.photoUrl || null,
            createdAt: ve.createdAt.toISOString(),
            upvotes: ve.upvotes,
            downvotes: ve.downvotes,
          }));

        return {
          groupId: group.id,
          groupName: group.name,
          groupEmoji: group.emoji,
          places,
        };
      })
    );

    const venueLibrary = venueLibraryResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
      .map((result) => result.value);

    const failedLibrary = venueLibraryResults.filter((result) => result.status === "rejected");
    if (failedLibrary.length > 0) {
      console.error(`[All Places] ${failedLibrary.length}/${userGroups.length} venue library fetches failed`);
    }

    console.log(
      `[All Places] Found ${userGroups.length} groups, venueLibrary totals: ${venueLibrary
        .map((group) => `${group.groupName}:${group.places.length}`)
        .join(", ")}`
    );

    const groupPlacesResults = await Promise.allSettled(
      userGroups.map(async (group) => ({
        groupId: group.id,
        groupName: group.name,
        groupEmoji: group.emoji,
        places: await storage.getGroupSavedPlaces(group.id, categoryFilter),
      }))
    );

    const groupPlaces = groupPlacesResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
      .map((result) => result.value);

    const failedPlaces = groupPlacesResults.filter((result) => result.status === "rejected");
    if (failedPlaces.length > 0) {
      console.error(`[All Places] ${failedPlaces.length}/${userGroups.length} group places fetches failed`);
    }

    res.json({
      personal: personalPlaces,
      groups: groupPlaces,
      venueLibrary,
    });
  } catch (error: any) {
    console.error("[Get All Places] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Get unreviewed venues across all groups for Places swipe flow
// GET /api/user/places-swipe-queue
router.get("/user/places-swipe-queue", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const userGroups = await storage.getUserGroups(userId);
    const userVotes = await storage.getUserVotes(userId);
    const votedEventIds = new Set(userVotes.map((vote) => vote.eventId));

    const groupQueues = await Promise.all(
      userGroups.map(async (group) => {
        const votingEvents = await storage.getGroupVotingEvents(group.id);
        const unvotedEvents = votingEvents.filter((event) => !votedEventIds.has(event.id));
        const members = await storage.getGroupMembers(group.id);
        const memberNames = members
          .filter((member) => member.userId !== userId)
          .slice(0, 5)
          .map((member) => member.name || member.email?.split("@")[0] || "Member");

        const venuesWithContext = await Promise.all(
          unvotedEvents.map(async (event) => {
            const addedByUser = event.createdBy ? await storage.getUser(event.createdBy) : null;
            const addedByName =
              addedByUser?.firstName || addedByUser?.email?.split("@")[0] || "Someone";

            const votes = await storage.getEventVotes(event.id);
            const upvoters = votes.filter((vote) => vote.voteType === "upvote");
            const likerNames = await Promise.all(
              upvoters.slice(0, 3).map(async (vote) => {
                const user = await storage.getUser(vote.userId);
                return user?.firstName || "Someone";
              })
            );

            return {
              id: event.id,
              title: event.title,
              venueAddress: event.venueAddress,
              venueType: event.venueType,
              googlePlaceId: event.googlePlaceId,
              rating: event.rating,
              reviewCount: event.reviewCount,
              priceLevel: event.priceLevel,
              photoUrl: event.photoUrl,
              addedBy: addedByName,
              likedBy: likerNames,
              likedByCount: upvoters.length,
            };
          })
        );

        return {
          groupId: group.id,
          groupName: group.name,
          groupEmoji: group.emoji || "👥",
          memberNames,
          memberCount: members.length,
          venues: venuesWithContext,
          totalUnreviewed: venuesWithContext.length,
        };
      })
    );

    const groupsWithVenues = groupQueues.filter((group) => group.venues.length > 0);
    groupsWithVenues.sort((a, b) => b.totalUnreviewed - a.totalUnreviewed);

    const totalUnreviewed = groupsWithVenues.reduce(
      (sum, group) => sum + group.totalUnreviewed,
      0
    );

    res.json({
      groups: groupsWithVenues,
      totalUnreviewed,
      totalGroups: groupsWithVenues.length,
    });
  } catch (error: any) {
    console.error("[Places Swipe Queue] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Get user's personal saved places
// GET /api/user/saved-places?category=...
router.get("/user/saved-places", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { category } = req.query;

    const places = await storage.getUserSavedPlaces(
      userId,
      category && typeof category === "string" ? category : undefined
    );
    res.json(places);
  } catch (error: any) {
    console.error("[Get User Saved Places] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Add a personal saved place
// POST /api/user/saved-places
router.post("/user/saved-places", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const {
      googlePlaceId,
      name,
      address,
      latitude,
      longitude,
      category,
      rating,
      priceLevel,
      photoUrl,
      notes,
    } = req.body;

    if (!googlePlaceId || !name) {
      return res
        .status(400)
        .json({ message: "googlePlaceId and name are required" });
    }

    const alreadySaved = await storage.isUserSavedPlace(userId, googlePlaceId);
    if (alreadySaved) {
      return res.status(400).json({ message: "Place already saved" });
    }

    const place = await storage.addUserSavedPlace({
      userId,
      googlePlaceId,
      name,
      address,
      latitude,
      longitude,
      category,
      rating,
      priceLevel,
      photoUrl,
      notes,
    });

    res.json(place);
  } catch (error: any) {
    console.error("[Add User Saved Place] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Remove a personal saved place
// DELETE /api/user/saved-places/:placeId
router.delete(
  "/user/saved-places/:placeId",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { placeId } = req.params;

      await storage.removeUserSavedPlace(userId, placeId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Remove User Saved Place] Error:", error);
      res.status(500).json({ message: safeError(error) });
    }
  }
);

// ==================== Group Saved Places ====================

// Get group's saved places
// GET /api/groups/:groupId/saved-places?category=...
router.get(
  "/groups/:groupId/saved-places",
  isAuthenticated,
  requireGroupAccess,
  async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const { category } = req.query;

      const places = await storage.getGroupSavedPlaces(
        groupId,
        category && typeof category === "string" ? category : undefined
      );
      res.json(places);
    } catch (error: any) {
      console.error("[Get Group Saved Places] Error:", error);
      res.status(500).json({ message: safeError(error) });
    }
  }
);

// Add a group saved place
// POST /api/groups/:groupId/saved-places
router.post(
  "/groups/:groupId/saved-places",
  isAuthenticated,
  requireGroupAccess,
  async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;
      const {
        googlePlaceId,
        name,
        address,
        latitude,
        longitude,
        category,
        rating,
        priceLevel,
        photoUrl,
        notes,
      } = req.body;

      if (!googlePlaceId || !name) {
        return res
          .status(400)
          .json({ message: "googlePlaceId and name are required" });
      }

      const alreadySaved = await storage.isGroupSavedPlace(
        groupId,
        googlePlaceId
      );
      if (alreadySaved) {
        return res
          .status(400)
          .json({ message: "Place already saved to this group" });
      }

      const user = await storage.getUser(userId);
      const addedByName =
        user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.firstName || user?.email || "Someone";

      const place = await storage.addGroupSavedPlace({
        groupId,
        addedByUserId: userId,
        addedByName,
        googlePlaceId,
        name,
        address,
        latitude,
        longitude,
        category,
        rating,
        priceLevel,
        photoUrl,
        notes,
      });

      res.json(place);
    } catch (error: any) {
      console.error("[Add Group Saved Place] Error:", error);
      res.status(500).json({ message: safeError(error) });
    }
  }
);

// Remove a group saved place
// DELETE /api/groups/:groupId/saved-places/:placeId
router.delete(
  "/groups/:groupId/saved-places/:placeId",
  isAuthenticated,
  requireGroupAccess,
  async (req: any, res) => {
    try {
      const { groupId, placeId } = req.params;

      await storage.removeGroupSavedPlace(groupId, placeId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Remove Group Saved Place] Error:", error);
      res.status(500).json({ message: safeError(error) });
    }
  }
);

export default router;
