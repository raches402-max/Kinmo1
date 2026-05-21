/**
 * Generation Routes
 *
 * AI-powered venue generation, category-specific discovery, and regeneration.
 *
 *   POST /api/groups/:id/retry-generation                    — retry activity generation (deprecated, returns 410)
 *   POST /api/groups/:id/activities/cancel-generation        — cancel in-progress generation
 *   POST /api/groups/:id/activities/regenerate-category      — regenerate venues for a specific category
 *   POST /api/groups/:id/generate-category                   — discover venues by category (Google Places + AI validation)
 *   POST /api/groups/:id/activities/from-category-result     — save a discovered venue as a voting event
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import * as Sentry from "@sentry/node";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import pLimit from "p-limit";
import { isAuthenticated } from "../googleAuth";
import { requireGroupOwnership, getUserId } from "../authorization";
import { storage } from "../storage";
import { fail } from "../lib/responses";
import {
  activities as activitiesTable,
  venueVisitHistory,
} from "@shared/schema";
import {
  generateActivitySuggestions,
  categorizeByTime,
  categorizeVenue,
  detectCategory,
  validateVenueForCategory,
} from "../openai";
import {
  searchPlaces,
  searchNearbyPlaces,
  geocodeLocation,
  calculateNameSimilarity,
  getBestVenueTypeSync,
} from "../google-places";
import { safeParse } from "../validation-middleware";
import {
  generateCategorySchema,
  regenerateCategorySchema,
} from "../validation-schemas";
import { getQualityThresholds } from "../lib/place-quality";

const router = Router();

// ==================== Retry Generation (Deprecated) ====================

router.post("/groups/:id/retry-generation", isAuthenticated, async (req: any, res) => {
    // Return 410 Gone - this feature has been replaced with category-specific generation
    return res.status(410).json({
      message: "General AI generation is no longer supported. Please use category-specific generation instead.",
      hint: "Select a category (Bars, Coffee, Meals, Dessert, Events) and generate from there."
    });

    /*
    // OLD CODE - kept for reference
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return fail(res, 404, "Group not found");
      }

      // Verify user owns this group
      const userId = await getUserId(req);
      if (group.userId !== userId) {
        return fail(res, 403, "Not authorized to modify this group");
      }

      // Accept temporary instructions from the request body
      const { tempInstructions } = req.body;

      // Combine permanent and temporary instructions
      const combinedInstructions = [
        group.additionalInstructions,
        tempInstructions
      ].filter(Boolean).join('\n');

      // Reset status and trigger regeneration
      await storage.updateGroupStatus(req.params.id, "pending");

      generateAndStoreActivities(req.params.id, {
        locationBase: group.locationBase,
        budgetMin: group.budgetMin,
        budgetMax: group.budgetMax,
        meetingFrequency: group.meetingFrequency,
        availability: group.availability,
        closenessLevel: group.closenessLevel,
        noveltyPreference: group.noveltyPreference,
        pastPreferences: group.pastPreferences,
        additionalInstructions: combinedInstructions || group.additionalInstructions,
        activityCategories: group.activityCategories,
        searchRadius: group.searchRadius,
        latitude: group.latitude,
        longitude: group.longitude,
        rejectedVenues: group.rejectedVenues,
        mealEnabled: group.mealEnabled,
        cafeEnabled: group.cafeEnabled,
        drinksEnabled: group.drinksEnabled,
        dessertEnabled: group.dessertEnabled,
        experiencesEnabled: group.experiencesEnabled,
      }).catch((error) => {
        console.error(`[Activity Regeneration] Failed for group ${req.params.id}:`, error);
        Sentry.captureException(error, {
          tags: { groupId: req.params.id, operation: 'regenerateActivities' },
          level: 'error'
        });
      });

      res.json({ success: true, message: "Activity generation restarted" });
    } catch (error: any) {
      fail(res, 500, safeError(error));
    }
    */
  });

// ==================== Cancel Generation ====================

router.post("/groups/:id/activities/cancel-generation", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return fail(res, 404, "Group not found");
      }

      // Verify user owns this group
      const userId = await getUserId(req);
      if (group.userId !== userId) {
        return fail(res, 403, "Not authorized to modify this group");
      }

      // Update status to failed with cancellation message (idempotent - safe to call multiple times)
      await storage.updateGroupStatus(req.params.id, "failed", "Generation cancelled by user");

      res.json({ success: true, message: "Activity generation cancelled" });
    } catch (error: any) {
      fail(res, 500, safeError(error));
    }
  });

// ==================== Regenerate Category ====================

router.post("/groups/:id/activities/regenerate-category", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return fail(res, 404, "Group not found");
      }

      // Validate request body
      const validatedData = safeParse(regenerateCategorySchema, req.body, res);
      if (!validatedData) return;

      const { category, currentVenueNames, checkedActivityIds } = validatedData;

      // Calculate how many new activities we need
      const existingActivities = await storage.getGroupActivities(req.params.id);
      const checkedIds = new Set(checkedActivityIds || []);
      let checkedCount = 0;

      for (const a of existingActivities) {
        const activityCategory = await categorizeVenue(a.venueName, a.venueType);
        if (activityCategory === category && checkedIds.has(a.id)) {
          checkedCount++;
        }
      }

      const neededCount = 3 - checkedCount;

      if (neededCount <= 0) {

        return res.json([]);
      }

      // Get feedback data for AI context
      const previousFeedback = existingActivities
        .filter(a => a.feedback)
        .map(a => ({
          venueName: a.venueName,
          venueType: a.venueType,
          feedback: a.feedback!,
          description: a.description
        }));

      const votingEvents = await storage.getGroupVotingEvents(req.params.id);
      const votingFeedback = votingEvents
        .filter(e => e.netVotes !== 0 && e.venueType)
        .map(e => ({
          venueName: e.title,
          venueType: e.venueType!,
          upvotes: e.upvotes,
          downvotes: e.downvotes,
          netVotes: e.netVotes,
          description: e.description || ''
        }));

      const preferenceSignals = await storage.getGroupPreferenceSignals(req.params.id);
      const likedConcepts = preferenceSignals
        .filter(s => s.feedback === 'like')
        .map(s => s.conceptDescription);
      const passedConcepts = preferenceSignals
        .filter(s => s.feedback === 'pass')
        .map(s => s.conceptDescription);

      // Fetch seen venues from database to prevent repetitive suggestions
      const seenVenuesFromDB = await storage.getSeenVenues(req.params.id);
      const seenVenueNames = seenVenuesFromDB.map(v => v.venueName);

      // Retry logic to ensure we get enough quality venues
      let allValidActivities: any[] = [];
      const seenVenues = new Set<string>(); // Track across attempts

      // Add existing venues (both checked and current) to prevent duplicates
      for (const venue of existingActivities) {
        const venueKey = venue.googlePlaceId || venue.venueName.toLowerCase();
        seenVenues.add(venueKey);
      }
      for (const venue of currentVenueNames || []) {
        seenVenues.add(venue.toLowerCase());
      }

      let attempt = 0;
      const maxAttempts = 3;

      while (allValidActivities.length < neededCount && attempt < maxAttempts) {
        attempt++;

        // Refresh group data to get latest rejected venues
        const refreshedGroup = await storage.getGroup(req.params.id);
        if (!refreshedGroup) {
          return fail(res, 404, "Group not found");
        }
        const rejectedVenues = refreshedGroup.rejectedVenues || [];
        const rejectedSet = new Set(rejectedVenues.map(v => v.toLowerCase()));

        // Get member constraints for this category regeneration
        const groupMembers = await storage.getGroupMembers(refreshedGroup.id);
        const memberConstraints = groupMembers
          .filter(m => m.memberConstraints)
          .map(m => m.memberConstraints as { scheduleConflicts?: string[]; budgetConcern?: boolean; distanceConcern?: boolean; notes?: string });

        // Get group insights for AI context
        const groupInsights = refreshedGroup.preferenceInsights || undefined;

        // Generate suggestions for this specific category
        const suggestions = await generateActivitySuggestions({
          locationBase: refreshedGroup.locationBase,
          budgetMin: refreshedGroup.budgetMin,
          budgetMax: refreshedGroup.budgetMax,
          meetingFrequency: refreshedGroup.meetingFrequency,
          availability: refreshedGroup.availability,
          closenessLevel: refreshedGroup.closenessLevel,
          noveltyPreference: refreshedGroup.noveltyPreference,
          activityCategories: refreshedGroup.activityCategories || undefined,
          pastPreferences: refreshedGroup.pastPreferences || undefined,
          additionalInstructions: refreshedGroup.additionalInstructions || undefined,
          searchRadius: refreshedGroup.searchRadius || undefined,
          previousFeedback: previousFeedback.length > 0 ? previousFeedback : undefined,
          votingFeedback: votingFeedback.length > 0 ? votingFeedback : undefined,
          likedConcepts: likedConcepts.length > 0 ? likedConcepts : undefined,
          passedConcepts: passedConcepts.length > 0 ? passedConcepts : undefined,
          mealEnabled: refreshedGroup.mealEnabled ?? true,
          cafeEnabled: refreshedGroup.cafeEnabled ?? true,
          drinksEnabled: refreshedGroup.drinksEnabled ?? true,
          dessertEnabled: refreshedGroup.dessertEnabled ?? true,
          experiencesEnabled: refreshedGroup.experiencesEnabled ?? true,
          previouslySuggestedVenues: [...(currentVenueNames || []), ...seenVenueNames],
          targetCategories: [category],
          memberConstraints: memberConstraints.length > 0 ? memberConstraints : undefined,
          rejectedVenues: rejectedVenues,
          seenVenues: seenVenueNames.length > 0 ? seenVenueNames : undefined,
          groupInsights: groupInsights,
        });

        // Filter out rejected venues AND disabled categories before calling Google Places
        const filteredSuggestions = suggestions.filter(s => {
          const normalized = s.venueName.trim().toLowerCase();

          // Skip blacklisted venues
          if (rejectedSet.has(normalized)) {

            return false;
          }

          // CRITICAL: Skip disabled categories to save API quota
          const detectedCategory = detectCategory(s.venueName, s.venueType);
          const categoryEnabled =
            (detectedCategory === 'meal' && (refreshedGroup.mealEnabled ?? true)) ||
            (detectedCategory === 'cafes' && (refreshedGroup.cafeEnabled ?? true)) ||
            (detectedCategory === 'drinks' && (refreshedGroup.drinksEnabled ?? true)) ||
            (detectedCategory === 'dessert' && (refreshedGroup.dessertEnabled ?? true)) ||
            (detectedCategory === 'experiences' && (refreshedGroup.experiencesEnabled ?? true));

          if (!categoryEnabled) {

            return false;
          }

          return true;
        });

        // Enrich with Google Places
        const coordinates = refreshedGroup.latitude && refreshedGroup.longitude
          ? { lat: parseFloat(refreshedGroup.latitude), lng: parseFloat(refreshedGroup.longitude) }
          : undefined;
        const enrichedActivities = await Promise.all(
        filteredSuggestions.map(async (suggestion) => {
          const places = await searchPlaces(
            suggestion.searchQuery,
            refreshedGroup.locationBase,
            refreshedGroup.searchRadius || 2,
            coordinates,
            false, // skipCurated
            undefined, // venueType
            refreshedGroup.budgetMax // Pass budget for filtering
          );

          // If Google Places returns NO results at all, this is likely a fake/non-existent venue
          if (places.length === 0) {

            await storage.addRejectedVenue(req.params.id, suggestion.venueName);
            return null;
          }

          const searchRadius = refreshedGroup.searchRadius || 2;
          const { minRating, minReviews } = getQualityThresholds(searchRadius);

          const qualityFiltered = places.filter(place => {
            const rating = parseFloat(place.rating || '0');
            const reviewCount = place.reviewCount || 0;
            return rating >= minRating && reviewCount >= minReviews;
          });

          // Budget filtering now handled by searchPlaces itself
          const budgetFiltered = qualityFiltered;

          // Only use venues that meet quality AND budget standards
          const finalPlaces = budgetFiltered;

          if (finalPlaces.length > 0) {
            // Rank venues by name similarity to AI suggestion
            const rankedPlaces = finalPlaces.map(place => ({
              place,
              similarity: calculateNameSimilarity(suggestion.venueName, place.name)
            })).sort((a, b) => b.similarity - a.similarity);

            const bestMatch = rankedPlaces[0];
            const SIMILARITY_THRESHOLD = 0.6;

            // Only accept matches above threshold, otherwise fall back to API
            if (bestMatch.similarity < SIMILARITY_THRESHOLD) {

              return null; // This will trigger API fallback in searchPlaces
            }

            const place = bestMatch.place;

            // Search for complementary places
            let complementaryPlace = null;
            let complementaryPlace2 = null;
            if (suggestion.complementaryFoodPlace && place.location) {
              const foodPlaces = await searchNearbyPlaces(
                suggestion.complementaryFoodPlace,
                place.location,
                805,
                3.5
              );
              const validFoodPlaces = foodPlaces.filter(fp => fp.placeId !== place.placeId);
              if (validFoodPlaces.length > 0) {
                complementaryPlace = validFoodPlaces[0];
              }
              if (validFoodPlaces.length > 1) {
                complementaryPlace2 = validFoodPlaces[1];
              }
            }

            // CRITICAL: Only include venues with verified Google Places data
            // Note: photoUrl is optional - we can fetch it later on-demand
            if (!place.rating || !place.address) {

              return null;
            }

            return {
              aiSuggestedName: suggestion.venueName,
              venueName: place.name,
              venueAddress: place.address,
              city: place.city || null,
              venueType: suggestion.venueType,
              description: suggestion.description,
              googlePlaceId: place.placeId,
              latitude: place.location?.lat?.toString() || null,
              longitude: place.location?.lng?.toString() || null,
              rating: place.rating,
              reviewCount: place.reviewCount || null,
              priceLevel: place.priceLevel,
              photoUrl: place.photoUrl,
              googleReview: place.review || null,
              aiReasoning: suggestion.reasoning,
              timeCategory: categorizeByTime(suggestion.venueType),
              category: await categorizeVenue(place.name, suggestion.venueType, place.types),
              complementaryPlaceName: complementaryPlace?.name || null,
              complementaryPlaceAddress: complementaryPlace?.address || null,
              complementaryPlaceId: complementaryPlace?.placeId || null,
              complementaryPlacePhotoUrl: complementaryPlace?.photoUrl || null,
              complementaryPlaceRating: complementaryPlace?.rating || null,
              complementaryPlaceName2: complementaryPlace2?.name || null,
              complementaryPlaceAddress2: complementaryPlace2?.address || null,
              complementaryPlaceId2: complementaryPlace2?.placeId || null,
              complementaryPlacePhotoUrl2: complementaryPlace2?.photoUrl || null,
              complementaryPlaceRating2: complementaryPlace2?.rating || null,
            };
          }

          // If we reach here, finalPlaces is empty due to quality/budget filtering
          // This is NOT a fake venue - it's a real venue that doesn't meet our criteria

          return null;
        })
      );

        const validActivities = enrichedActivities.filter(a => a !== null);

        // CRITICAL: Filter out disabled categories AFTER AI categorization (in case AI categorized differently)
        const beforeFilter = validActivities.length;
        const categoryFilteredActivities = validActivities.filter((activity: any) => {
          const activityCategory = activity.category;
          const categoryEnabled =
            (activityCategory === 'meal' && (refreshedGroup.mealEnabled ?? true)) ||
            (activityCategory === 'cafes' && (refreshedGroup.cafeEnabled ?? true)) ||
            (activityCategory === 'drinks' && (refreshedGroup.drinksEnabled ?? true)) ||
            (activityCategory === 'dessert' && (refreshedGroup.dessertEnabled ?? true)) ||
            (activityCategory === 'experiences' && (refreshedGroup.experiencesEnabled ?? true));

          if (!categoryEnabled) {
            console.log(`[Category Regen Post-Filter] ❌ REMOVING: ${activity.venueName} - categorized as "${activityCategory}" which is disabled`);
            return false;
          }
          return true;
        });

        if (categoryFilteredActivities.length < beforeFilter) {
          console.log(`[Category Regen Post-Filter] Filtered out ${beforeFilter - categoryFilteredActivities.length} venues in disabled categories`);
        }

        // Add unique activities to our collection (using the filtered list!)
        for (const activity of categoryFilteredActivities) {
          const venueKey = activity.googlePlaceId || activity.venueName.toLowerCase();
          if (!seenVenues.has(venueKey) && allValidActivities.length < neededCount) {
            seenVenues.add(venueKey);
            allValidActivities.push(activity);

          }
        }

      }

      // Check if we successfully collected enough venues
      if (allValidActivities.length < neededCount) {
        const errorMsg = `Could not find enough quality venues after ${maxAttempts} attempts. Found ${allValidActivities.length}/${neededCount} venues. Try adjusting search radius or preferences.`;
        console.error(`[Category Regen] ${errorMsg}`);
        return fail(res, 400, errorMsg);
      }

      // Delete unchecked activities in this category
      const uncheckedActivities = [];

      for (const a of existingActivities) {
        const activityCategory = await categorizeVenue(a.venueName, a.venueType);
        if (activityCategory === category && !checkedIds.has(a.id)) {
          uncheckedActivities.push(a);
        }
      }

      // Delete unchecked activities
      for (const activity of uncheckedActivities) {
        await db.delete(activitiesTable).where(eq(activitiesTable.id, activity.id));
      }

      // Insert new activities to reach exactly 3 total for this category
      const newActivities = [];

      for (let i = 0; i < Math.min(neededCount, allValidActivities.length); i++) {
        const activityData = allValidActivities[i];
        const activityCategory = await categorizeVenue(activityData.venueName, activityData.venueType);
        const newActivity = await storage.createActivity({
          ...activityData,
          groupId: req.params.id,
          category: activityCategory,
        });
        newActivities.push(newActivity);
      }

      const finalCount = checkedCount + newActivities.length;

      res.json(newActivities);
    } catch (error: any) {
      console.error("[Category Regen] Error:", error);
      fail(res, 500, safeError(error));
    }
  });

// ==================== Generate Category ====================

router.post("/groups/:id/generate-category", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return fail(res, 404, "Group not found");
      }

      // Verify user is a member of this group (or owns it)
      const userId = await getUserId(req);
      const isOwner = group.userId === userId;
      const member = await storage.getGroupMemberByUserId(req.params.id, userId);

      if (!isOwner && !member) {
        return fail(res, 403, "Not authorized to access this group");
      }

      // Check if members are allowed to create events
      if (!isOwner && member && !group.membersCanCreateEvents) {
        return fail(res, 403, "Only the group organizer can discover venues for this group");
      }

      // Fetch member group preferences for fallback chain
      const memberPreferences = await storage.getMemberGroupPreferences(userId, req.params.id);

      // Fetch global user profile for fallback chain
      const userProfile = await storage.getUserProfile(userId);

      // Implement preference fallback chain for all preferences:
      // 1. Member group preferences (budgetOverrideMax, categoryPreferencesOverride, availabilityOverride)
      // 2. Global user profile (budgetMax, activityPreferences, personalAvailability)
      // 3. Group defaults (budgetMax, enabled categories, availability)
      const effectiveBudget = memberPreferences?.budgetOverrideMax ?? userProfile?.budgetMax ?? group.budgetMax;
      const effectiveCategories = memberPreferences?.categoryPreferencesOverride ?? userProfile?.activityPreferences ?? null;
      const effectiveAvailability = memberPreferences?.availabilityOverride ?? userProfile?.personalAvailability ?? group.availability;

      console.log(`  Budget: ${effectiveBudget} (member: ${memberPreferences?.budgetOverrideMax}, profile: ${userProfile?.budgetMax}, group: ${group.budgetMax})`);
      console.log(`  Categories: ${effectiveCategories ? JSON.stringify(effectiveCategories) : 'null'} (member: ${memberPreferences?.categoryPreferencesOverride ? 'set' : 'null'}, profile: ${userProfile?.activityPreferences ? 'set' : 'null'})`);
      console.log(`  Availability: ${effectiveAvailability ? 'set' : 'null'} (member: ${memberPreferences?.availabilityOverride ? 'set' : 'null'}, profile: ${userProfile?.personalAvailability ? 'set' : 'null'}, group: ${group.availability ? 'set' : 'null'})`);

      // Validate request body
      const validatedData = safeParse(generateCategorySchema, req.body, res);
      if (!validatedData) return;

      const { categories, category, location, radius, count = 9, sortBy = 'rating', budgetOverride, tempInstructions } = validatedData;

      // Use budgetOverride if provided, otherwise fall back to effectiveBudget
      const finalBudget = budgetOverride !== undefined ? budgetOverride : effectiveBudget;

      if (budgetOverride !== undefined) {

      } else {

      }

      // Support both single category (backward compatibility) and multiple categories
      let categoriesToProcess = categories || (category ? [category] : []);

      // Apply category preference override: if user has category preferences,
      // filter requested categories to only include those in their preferences
      if (effectiveCategories && Array.isArray(effectiveCategories) && effectiveCategories.length > 0) {
        if (categoriesToProcess.length > 0) {
          // Filter requested categories to only include user's preferred categories
          const originalCount = categoriesToProcess.length;
          categoriesToProcess = categoriesToProcess.filter((cat: string) => effectiveCategories.includes(cat));
          if (categoriesToProcess.length < originalCount) {

          }
        } else {
          // No explicit categories requested, use user's preferred categories
          categoriesToProcess = effectiveCategories;

        }
      }

      if (!categoriesToProcess.length) {
        return fail(res, 400, "No categories provided or all requested categories filtered out by preferences");
      }

      // Validate all categories
      const validCategories = ['meal', 'cafes', 'drinks', 'dessert', 'experiences'];
      for (const cat of categoriesToProcess) {
        if (!validCategories.includes(cat)) {
          return fail(res, 400, `Invalid category: ${cat}`);
        }
      }

      if (sortBy && !['distance', 'rating'].includes(sortBy)) {
        return fail(res, 400, "Invalid sortBy parameter. Must be 'distance' or 'rating'");
      }

      if (tempInstructions) {

      }

      // Use custom location if provided, otherwise use group location
      const searchLocation = location?.address || group.locationBase;
      const searchRadius = radius || group.searchRadius || 2;

      // Determine coordinates for distance filtering
      let coordinates: { lat: number; lng: number } | undefined;

      if (location?.lat && location?.lng) {
        // Explicit coordinates provided
        coordinates = { lat: location.lat, lng: location.lng };
      } else if (location?.address) {
        // Custom location text provided - geocode it for strict distance filtering

        const geocoded = await geocodeLocation(location.address);
        if (geocoded) {
          coordinates = { lat: geocoded.latitude, lng: geocoded.longitude };

        } else {

        }
      } else if (group.latitude && group.longitude) {
        // Use group's stored coordinates
        coordinates = { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) };
      }

      // Get existing activities to avoid duplicates
      const existingActivities = await storage.getGroupActivities(req.params.id);
      const existingVenueNames = existingActivities.map(a => a.venueName);

      // ========== LEARNING SYSTEM: Query Historical Data ==========

      // 1. Get venue visit history for rotation and proven winners
      const visitStats = await db.select({
        venueName: venueVisitHistory.venueName,
        count: sql<number>`count(*)`.as('count'),
        lastVisit: sql<Date>`max(visited_at)`.as('last_visit'),
      })
      .from(venueVisitHistory)
      .where(eq(venueVisitHistory.groupId, req.params.id))
      .groupBy(venueVisitHistory.venueName);

      const visitMap = new Map(visitStats.map(v => [v.venueName, {
        count: Number(v.count),
        lastVisit: v.lastVisit,
        daysSinceVisit: v.lastVisit ? Math.floor((Date.now() - new Date(v.lastVisit).getTime()) / (1000 * 60 * 60 * 24)) : 999
      }]));

      // 2. Get member favorites for boosting
      const groupMembers = await storage.getGroupMembers(req.params.id);
      const allMemberFavorites = await Promise.all(
        groupMembers.map(m => storage.getMemberFavoriteVenues(m.id))
      );
      const favoritesMap = new Map<string, number>(); // placeId -> member count
      for (const memberFavs of allMemberFavorites) {
        for (const fav of memberFavs) {
          if (fav.venuePlaceId) {
            favoritesMap.set(fav.venuePlaceId, (favoritesMap.get(fav.venuePlaceId) || 0) + 1);
          }
        }
      }

      // 3. Build swipe consensus map from existing activities (already have swipeConsensus field)
      const swipeConsensusMap = new Map<string, number>();
      for (const activity of existingActivities) {
        if (activity.googlePlaceId && activity.swipeConsensus !== null) {
          swipeConsensusMap.set(activity.googlePlaceId, activity.swipeConsensus);
        }
      }

      // Map category to Google Places search query
      const categorySearchQueries: Record<string, string> = {
        'meal': 'restaurants',
        'cafes': 'coffee shops cafes',
        'drinks': 'bars',
        'dessert': 'dessert ice cream boba',
        'experiences': 'museums parks attractions activities'
      };

      // Process each category
      const resultsByCategory: Record<string, any[]> = {};
      const allResults: any[] = [];

      for (const currentCategory of categoriesToProcess) {

        let searchQuery = categorySearchQueries[currentCategory] || currentCategory;

        // If custom instructions provided, append them to refine the search
        if (tempInstructions && tempInstructions.trim()) {
          searchQuery = `${tempInstructions.trim()} ${searchQuery}`;

        } else {

        }

        // Search Google Places directly (no AI needed!)
        // Apply budget filter (uses budgetOverride if provided, otherwise effectiveBudget)
        const places = await searchPlaces(
          `${searchQuery} in ${searchLocation}`,
          searchLocation,
          searchRadius,
          coordinates,
          false, // skipCurated
          undefined, // venueType
          finalBudget || undefined // Apply final budget (override or effective)
        );

        if (places.length === 0) {
          resultsByCategory[currentCategory] = [];
          continue;
        }

        // Process and filter Google Places results with concurrency limiting
        // Limit to 5 concurrent AI validation calls to prevent rate limiting
        const limit = pLimit(5);

        const enrichedActivities = await Promise.all(
          places.map(place => limit(async () => {
            // Skip if already in existing activities
            if (existingVenueNames.includes(place.name)) {

              return null;
            }

            // Relaxed quality filtering for category-specific searches
            const rating = parseFloat(place.rating || '0');
            const reviewCount = place.reviewCount || 0;

            // Ensure minimum quality (3.5★ + 10 reviews) regardless of radius
            if (rating < 3.5 || reviewCount < 10) {

              return null;
            }

            // Only include venues with complete data
            if (!place.rating || !place.address || !place.photoUrl) {

              return null;
            }

            // LAYER 1: Google Place Type Filtering
            // Exclude obviously wrong business types (universal exclusions)
            const invalidTypes = ['liquor_store', 'convenience_store', 'gas_station', 'supermarket', 'grocery_store', 'pharmacy', 'drugstore'];
            const placeTypes = place.types || [];
            const hasInvalidType = placeTypes.some((type: string) => invalidTypes.includes(type));

            if (hasInvalidType) {
              const invalidType = placeTypes.find((type: string) => invalidTypes.includes(type));

              return null;
            }

            // Category-specific type validation
            if (currentCategory === 'meal') {
              // Exclude dessert-specific venues from meal searches
              const dessertTypes = ['ice_cream_shop', 'dessert_shop', 'dessert', 'bakery'];
              const isDessertVenue = placeTypes.some((type: string) => dessertTypes.includes(type));

              if (isDessertVenue) {

                return null;
              }

              // For meal category, prefer restaurant types
              const mealTypes = ['restaurant', 'meal_takeaway', 'meal_delivery', 'cafe', 'food'];
              const hasMealType = placeTypes.some((type: string) => mealTypes.some(mt => type.includes(mt)));

              if (!hasMealType) {

                return null;
              }
            } else if (currentCategory === 'dessert') {
              // For dessert category, require dessert-specific types
              const dessertTypes = ['ice_cream_shop', 'dessert_shop', 'dessert', 'bakery', 'cafe'];
              const isDessertVenue = placeTypes.some((type: string) => dessertTypes.includes(type));

              if (!isDessertVenue) {

                return null;
              }
            } else if (currentCategory === 'drinks') {
              // For drinks category, require bar/nightlife types
              const drinkTypes = ['bar', 'night_club', 'nightclub', 'pub', 'wine_bar', 'cocktail_bar'];
              const isDrinkVenue = placeTypes.some((type: string) => drinkTypes.some(dt => type.includes(dt)));

              if (!isDrinkVenue) {

                return null;
              }
            } else if (currentCategory === 'cafes') {
              // For cafes category, require cafe/coffee types
              const cafeTypes = ['cafe', 'coffee_shop', 'coffee', 'tea'];
              const isCafeVenue = placeTypes.some((type: string) => cafeTypes.some(ct => type.includes(ct)));

              if (!isCafeVenue) {

                return null;
              }
            }

            // Calculate distance from search center
            let distanceFromBase: number | undefined;
            if (coordinates && place.location?.lat && place.location?.lng) {
              const R = 3959; // Earth's radius in miles
              const lat1 = coordinates.lat * Math.PI / 180;
              const lat2 = place.location.lat * Math.PI / 180;
              const dLat = (place.location.lat - coordinates.lat) * Math.PI / 180;
              const dLng = (place.location.lng - coordinates.lng) * Math.PI / 180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                       Math.cos(lat1) * Math.cos(lat2) *
                       Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              distanceFromBase = R * c;
            }

            // LAYER 3: Enhanced Location Validation (Moderate Strictness)
            // Enforce distance < radius * 1.2 (20% buffer for edge-of-radius venues)
            if (distanceFromBase !== undefined) {
              const maxDistance = searchRadius * 1.2; // 20% buffer
              if (distanceFromBase > maxDistance) {

                return null;
              } else if (distanceFromBase > searchRadius) {

              }
            }

            // City validation - check if venue city matches search location
            if (place.city && searchLocation) {
              const searchLower = searchLocation.toLowerCase();
              const placeCityLower = place.city.toLowerCase();

              // SF city name variants for flexible matching
              const sfVariants = ['sf', 'san francisco', 'san fran', 'san fransisco', 'frisco'];
              const oaklandVariants = ['oakland', 'oak'];
              const berkeleyVariants = ['berkeley', 'berk'];

              // Check if search is for SF
              const isSearchSF = sfVariants.some(v => searchLower.includes(v));
              const isPlaceSF = sfVariants.some(v => placeCityLower.includes(v));

              // Check if search is for Oakland
              const isSearchOakland = oaklandVariants.some(v => searchLower.includes(v));
              const isPlaceOakland = oaklandVariants.some(v => placeCityLower.includes(v));

              // Check if search is for Berkeley
              const isSearchBerkeley = berkeleyVariants.some(v => searchLower.includes(v));
              const isPlaceBerkeley = berkeleyVariants.some(v => placeCityLower.includes(v));

              // Flag city mismatches (but allow if within distance buffer)
              if ((isSearchSF && !isPlaceSF) ||
                  (isSearchOakland && !isPlaceOakland) ||
                  (isSearchBerkeley && !isPlaceBerkeley)) {

                // If venue is outside city AND outside distance buffer, reject
                if (distanceFromBase && distanceFromBase > searchRadius) {

                  return null;
                } else {
                  // Within distance buffer, log warning but allow

                }
              }
            }

            // LAYER 2: Smart AI Quality Validation (Edge Case Detection)
            // Only run AI validation after Google type filtering passes
            // This catches edge cases like "sports bar with extensive menu" classified incorrectly
            const aiValidation = await validateVenueForCategory(
              place.name,
              place.address,
              placeTypes,
              currentCategory as 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences'
            );

            if (!aiValidation.isValid) {

              return null;
            }

            // ========== PERSONALIZED SCORING: Apply Learning Signals ==========
            const googleRating = parseFloat(place.rating || '0');
            let personalizedScore = googleRating;
            let badges: string[] = [];
            let learningBoosts: string[] = [];

            // 1. Visit History (rotation + proven winners)
            const visitInfo = visitMap.get(place.placeId);
            if (visitInfo) {
              if (visitInfo.daysSinceVisit < 60) {
                // Recently visited - filter out

                return null;
              } else if (visitInfo.daysSinceVisit >= 180 && googleRating >= 4.5) {
                // Proven winner: visited 6+ months ago with great rating
                personalizedScore += 0.5;
                badges.push('🏆 Proven winner');
                learningBoosts.push(`proven winner (+0.5)`);

              } else {
                // Been a while
                personalizedScore += 0.2;
                badges.push('📅 Been a while');
                learningBoosts.push(`rotation (+0.2)`);
              }
            } else {
              // Never visited
              personalizedScore += 0.3;
              badges.push('✨ New to group');
              learningBoosts.push(`new spot (+0.3)`);
            }

            // 2. Member Favorites
            const favCount = favoritesMap.get(place.placeId);
            if (favCount && favCount > 0) {
              const boost = Math.min(favCount * 0.3, 1.0); // +0.3 per member, max +1.0
              personalizedScore += boost;
              badges.push(`❤️ ${favCount} member${favCount > 1 ? 's' : ''} favorited`);
              learningBoosts.push(`${favCount} favorites (+${boost.toFixed(1)})`);

            }

            // 3. Swipe Consensus (if venue was swiped before)
            const swipeConsensus = swipeConsensusMap.get(place.placeId);
            if (swipeConsensus !== undefined) {
              if (swipeConsensus >= 70) {
                // High consensus - strong boost
                personalizedScore += 0.8;
                badges.push('🌟 High group approval');
                learningBoosts.push(`${swipeConsensus}% approval (+0.8)`);

              } else if (swipeConsensus >= 50) {
                // Moderate consensus
                personalizedScore += 0.4;
                learningBoosts.push(`${swipeConsensus}% approval (+0.4)`);
              } else if (swipeConsensus < 30) {
                // Low consensus - penalize or skip

                return null;
              }
            }

            return {
              venueName: place.name,
              venueAddress: place.address,
              city: place.city || null,
              venueType: getBestVenueTypeSync(place.types || []),
              description: place.review || '',
              googlePlaceId: place.placeId,
              latitude: place.location?.lat?.toString() || null,
              longitude: place.location?.lng?.toString() || null,
              rating: place.rating,
              reviewCount: place.reviewCount || null,
              priceLevel: place.priceLevel,
              photoUrl: place.photoUrl,
              googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.placeId}`,
              googleReview: place.review || null,
              category: currentCategory, // Use the requested category directly
              distanceFromGroupBase: distanceFromBase,
              personalizedScore, // Add personalized score for sorting
              badges, // Add badges for transparency
            };
          }))
        );

        // Filter out nulls (filtered items) and calculate filtering stats
        let validActivities = enrichedActivities.filter(a => a !== null);

        // Log filtering statistics
        const totalFromGoogle = places.length;
        const passedFiltering = validActivities.length;
        const filteredCount = totalFromGoogle - passedFiltering;
        const passRate = totalFromGoogle > 0 ? ((passedFiltering / totalFromGoogle) * 100).toFixed(1) : 0;

        console.log(`  ├─ Total from Google: ${totalFromGoogle}`);
        console.log(`  ├─ Passed all filters: ${passedFiltering}`);
        console.log(`  ├─ Filtered out: ${filteredCount}`);
        console.log(`  └─ Pass rate: ${passRate}%\n`);

        // Sort based on mode: personalized score (default) or distance
        if (sortBy === 'distance') {
          validActivities.sort((a, b) => {
            const distA = a.distanceFromGroupBase || 999;
            const distB = b.distanceFromGroupBase || 999;
            return distA - distB;
          });

        } else {
          // Sort by personalized score (combines Google rating + learning signals)
          validActivities.sort((a, b) => {
            const scoreA = a.personalizedScore || parseFloat(a.rating || '0');
            const scoreB = b.personalizedScore || parseFloat(b.rating || '0');
            return scoreB - scoreA; // Highest score first
          });

        }

        // Return ALL results for pagination (don't limit to count)
        // Users can now scroll through dozens of venues without extra API calls

        resultsByCategory[currentCategory] = validActivities;
        allResults.push(...validActivities);

        // NOTE: No longer auto-saving to history - user must select which venues to keep
        // They will be saved via POST /api/groups/:id/add-venues-to-library
      }

      // Return grouped results if multiple categories, flat array if single category
      if (categoriesToProcess.length === 1) {
        res.json(allResults);
      } else {
        res.json(resultsByCategory);
      }
    } catch (error: any) {
      console.error("[Category Generate] Error:", error);
      fail(res, 500, safeError(error));
    }
  });

// ==================== Save Category Result as Voting Event ====================

router.post("/groups/:id/activities/from-category-result", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return fail(res, 404, "Group not found");
      }

      // Any authenticated user can add to group favorites (not just owner)
      const userId = await getUserId(req);

      const { activityData } = req.body;

      // Create a voting event so the whole group can vote on this favorite
      const votingEvent = await storage.createVotingEvent({
        groupId: req.params.id,
        title: activityData.venueName,
        venueType: activityData.venueType || null,
        venueAddress: activityData.venueAddress || null,
        description: activityData.description || null,
        googlePlaceId: activityData.googlePlaceId || null,
        latitude: activityData.latitude || null,
        longitude: activityData.longitude || null,
        rating: activityData.rating ? activityData.rating.toString() : null,
        priceLevel: activityData.priceLevel || null,
        photoUrl: activityData.photoUrl || null,
      }, userId, 'inherited');

      res.json(votingEvent);
    } catch (error: any) {
      fail(res, 500, safeError(error));
    }
  });

export default router;
