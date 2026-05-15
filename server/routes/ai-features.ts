/**
 * AI Features Routes
 *
 * AI-powered event planning, venue discovery, and scheduling features.
 *
 *   POST   /api/groups/:id/schedule-from-prompt     — schedule event from natural language
 *   POST   /api/groups/:id/analyze-patterns         — analyze preference patterns
 *   POST   /api/groups/:id/swipe-concepts           — generate swipeable concepts
 *   POST   /api/groups/:groupId/discover-venues     — start discovery swipe session
 *   POST   /api/groups/:id/swipe-feedback           — save swipe feedback
 *   GET    /api/groups/:id/swipe-deck               — get swipe deck
 *   POST   /api/groups/:groupId/nearby-suggestions  — nearby add-on suggestions
 *   POST   /api/groups/:groupId/venue-nearby-suggestions — nearby suggestions by lat/lng
 *   POST   /api/itineraries/:id/ai-suggestions      — AI venue suggestions
 *   POST   /api/itineraries/:id/ai-chat             — conversational AI assistant
 *   POST   /api/itineraries/:id/decide-now           — auto-populate TBD event
 *   POST   /api/itineraries/:id/suggest-time         — AI-suggested time
 *   GET    /api/itineraries/:id/suggested-schedule   — AI-suggested schedule
 *
 * Migration: extracted from server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { isAuthenticated } from "../googleAuth";
import {
  requireGroupOwnership,
  requireItineraryAccess,
  getUserId,
} from "../authorization";
import { storage } from "../storage";
import {
  groups as groupsTable,
  itineraryItems,
  type ItineraryItem,
} from "@shared/schema";
import {
  generateSwipeConcepts,
  analyzePreferencePatterns,
  parseSchedulingPromptWithHistory,
  categorizeVenue,
  type SchedulingParams,
} from "../openai";
import {
  searchPlaces,
  searchNearbyByTypes,
  getBestVenueType,
  getBestVenueTypeSync,
} from "../google-places";
import { planEventWithAgent, type VenueForAgent } from "../ai-event-agent";
import { safeParse } from "../validation-middleware";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { format } from "date-fns";
import { trustFieldsForSource } from "../trust-state";

const router = Router();

// ==================== Helper Functions ====================

// San Francisco neighborhood coordinate boundaries for accurate geographic filtering
const SF_NEIGHBORHOOD_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  'mission': { minLat: 37.747, maxLat: 37.766, minLng: -122.427, maxLng: -122.409 },
  'castro': { minLat: 37.755, maxLat: 37.765, minLng: -122.441, maxLng: -122.428 },
  'haight': { minLat: 37.767, maxLat: 37.775, minLng: -122.454, maxLng: -122.430 },
  'soma': { minLat: 37.770, maxLat: 37.785, minLng: -122.408, maxLng: -122.390 },
  'nob hill': { minLat: 37.790, maxLat: 37.797, minLng: -122.419, maxLng: -122.407 },
  'russian hill': { minLat: 37.798, maxLat: 37.806, minLng: -122.424, maxLng: -122.410 },
  'marina': { minLat: 37.797, maxLat: 37.808, minLng: -122.448, maxLng: -122.428 },
  'pacific heights': { minLat: 37.788, maxLat: 37.798, minLng: -122.443, maxLng: -122.420 },
  'richmond': { minLat: 37.775, maxLat: 37.783, minLng: -122.500, maxLng: -122.450 },
  'sunset': { minLat: 37.750, maxLat: 37.770, minLng: -122.510, maxLng: -122.470 },
  'north beach': { minLat: 37.798, maxLat: 37.808, minLng: -122.413, maxLng: -122.404 },
  'chinatown': { minLat: 37.793, maxLat: 37.798, minLng: -122.411, maxLng: -122.403 },
  'financial district': { minLat: 37.790, maxLat: 37.797, minLng: -122.404, maxLng: -122.395 },
  'potrero hill': { minLat: 37.755, maxLat: 37.765, minLng: -122.404, maxLng: -122.390 },
  'dogpatch': { minLat: 37.755, maxLat: 37.762, minLng: -122.395, maxLng: -122.385 },
  'hayes valley': { minLat: 37.773, maxLat: 37.778, minLng: -122.426, maxLng: -122.419 },
  'lower haight': { minLat: 37.770, maxLat: 37.774, minLng: -122.434, maxLng: -122.426 },
  'fillmore': { minLat: 37.783, maxLat: 37.792, minLng: -122.437, maxLng: -122.428 },
  'presidio': { minLat: 37.793, maxLat: 37.808, minLng: -122.475, maxLng: -122.438 },
  'embarcadero': { minLat: 37.791, maxLat: 37.810, minLng: -122.398, maxLng: -122.387 },
};

function isInNeighborhood(lat: number, lng: number, neighborhood: string): boolean {
  const bounds = SF_NEIGHBORHOOD_BOUNDS[neighborhood];
  if (!bounds) return false;

  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lng >= bounds.minLng && lng <= bounds.maxLng;
}

async function trackFeedbackAndMaybeAnalyze(groupId: string) {
  try {
    const [updatedGroup] = await db
      .update(groupsTable)
      .set({
        feedbackCount: sql`COALESCE(${groupsTable.feedbackCount}, 0) + 1`
      })
      .where(eq(groupsTable.id, groupId))
      .returning();

    if (!updatedGroup) {
      console.error(`Group ${groupId} not found when tracking feedback`);
      return;
    }

    const newCount = updatedGroup.feedbackCount || 0;

    if (newCount > 0 && newCount % 15 === 0) {

      setImmediate(async () => {
        try {
          const activities = await storage.getGroupActivities(groupId);
          const votingEvents = await storage.getGroupVotingEvents(groupId);
          const preferenceSignals = await storage.getGroupPreferenceSignals(groupId);

          const notThisFeedback = activities
            .filter(a => a.feedback === 'less')
            .map(a => ({
              venueName: a.venueName,
              venueType: a.venueType,
              feedback: a.feedback as string,
            }));

          const votingFeedback = votingEvents.map(event => ({
            venueName: event.title,
            venueType: event.venueType || 'event',
            upvotes: event.upvotes,
            downvotes: event.downvotes,
            netVotes: event.netVotes,
            description: event.description || ''
          }));

          const likedConcepts = preferenceSignals
            .filter(s => s.feedback === 'like')
            .map(s => s.conceptDescription);

          const passedConcepts = preferenceSignals
            .filter(s => s.feedback === 'pass')
            .map(s => s.conceptDescription);

          const patterns = await analyzePreferencePatterns({
            notThisFeedback: notThisFeedback.map(f => ({ ...f, description: '' })),
            votingFeedback,
            likedConcepts,
            passedConcepts
          });

          await db
            .update(groupsTable)
            .set({
              preferenceInsights: patterns,
              lastInsightsUpdate: sql`NOW()`
            })
            .where(eq(groupsTable.id, groupId));

        } catch (error) {
          console.error(`[Feedback Tracking] Background insights analysis failed:`, error);
        }
      });
    }
  } catch (error) {
    console.error(`[Feedback Tracking] Error tracking feedback for group ${groupId}:`, error);
  }
}

// Helper function to intelligently infer time preferences and day constraints from activity type
function inferTimeFromActivity(params: SchedulingParams): {
  timePreference: 'morning' | 'afternoon' | 'evening' | 'night',
  dayConstraints: 'weekday' | 'weekend' | 'any',
  appliedInferences: string[]
} {
  const activityLower = params.activityType.toLowerCase();
  const appliedInferences: string[] = [];

  // Start with provided values or defaults
  let timePreference = params.timePreference || 'evening';
  let dayConstraints = params.dayConstraints || 'any';

  // Activity-specific time and day inference
  if (activityLower.includes('brunch')) {
    if (!params.timePreference) {
      timePreference = 'morning';
      appliedInferences.push('Set to morning for brunch');
    }
    if (!params.dayConstraints) {
      dayConstraints = 'weekend';
      appliedInferences.push('Set to weekend for brunch');
    }
  } else if (activityLower.includes('breakfast')) {
    if (!params.timePreference) {
      timePreference = 'morning';
      appliedInferences.push('Set to morning for breakfast');
    }
  } else if (activityLower.includes('lunch')) {
    if (!params.timePreference) {
      timePreference = 'afternoon';
      appliedInferences.push('Set to afternoon for lunch');
    }
  } else if (activityLower.includes('happy hour')) {
    if (!params.timePreference) {
      timePreference = 'afternoon';
      appliedInferences.push('Set to afternoon for happy hour (4-7 PM)');
    }
    if (!params.dayConstraints) {
      dayConstraints = 'weekday';
      appliedInferences.push('Set to weekday for happy hour');
    }
  } else if (activityLower.includes('coffee') || activityLower.includes('cafe')) {
    if (!params.timePreference) {
      timePreference = 'morning';
      appliedInferences.push('Set to morning for coffee');
    }
  } else if (activityLower.includes('dessert') || activityLower.includes('ice cream')) {
    if (!params.timePreference) {
      timePreference = 'night';
      appliedInferences.push('Set to evening for dessert');
    }
  } else if (activityLower.includes('drinks') || activityLower.includes('bar')) {
    if (!params.timePreference) {
      timePreference = 'evening';
      appliedInferences.push('Set to evening for drinks');
    }
  } else if (activityLower.includes('dinner')) {
    if (!params.timePreference) {
      timePreference = 'evening';
      appliedInferences.push('Set to evening for dinner');
    }
  }

  // Parse weeknight constraint (overrides default dayConstraints)
  if (activityLower.includes('weeknight') || activityLower.includes('week night')) {
    dayConstraints = 'weekday'; // Monday-Friday
    appliedInferences.push('Set to weekday for weeknight activity');
    console.log('[Infer Time] Detected weeknight constraint - setting to weekday');
  }

  return { timePreference, dayConstraints, appliedInferences };
}

// Helper function to generate time options based on natural language timeframe
function generateTimeOptions(
  timeframe: string,
  dayConstraints: 'weekday' | 'weekend' | 'any',
  timePreference?: 'morning' | 'afternoon' | 'evening' | 'night',
  timezone: string = 'America/Los_Angeles'
): Array<{ eventDate: string; dayLabel: string; timeLabel: string }> {
  const options: Array<{ eventDate: string; dayLabel: string; timeLabel: string }> = [];
  const now = new Date();

  // Determine time of day based on preference
  let hour = 19; // Default to 7 PM
  let timeLabel = 'Evening';
  if (timePreference === 'morning') {
    hour = 10;
    timeLabel = 'Morning';
  } else if (timePreference === 'afternoon') {
    hour = 14;
    timeLabel = 'Afternoon';
  } else if (timePreference === 'night') {
    hour = 20;
    timeLabel = 'Night';
  }

  // Parse timeframe to determine dates
  const timeframeLower = timeframe.toLowerCase();
  let startDate = new Date(now);
  let daysToCheck = 14; // Default to checking next 2 weeks

  if (timeframeLower.includes('tomorrow')) {
    startDate.setDate(now.getDate() + 1);
    daysToCheck = 1;
  } else if (timeframeLower.includes('this week')) {
    startDate.setDate(now.getDate() + 1);
    daysToCheck = 7;
  } else if (timeframeLower.includes('next week')) {
    startDate.setDate(now.getDate() + 7);
    daysToCheck = 7;
  } else if (timeframeLower.includes('this weekend')) {
    // Find next Saturday
    const dayOfWeek = now.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    startDate.setDate(now.getDate() + daysUntilSaturday);
    daysToCheck = 2;
  }

  // Generate 2-3 options based on day constraints
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let foundOptions = 0;

  for (let i = 0; i < daysToCheck && foundOptions < 3; i++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(startDate.getDate() + i);
    const dayOfWeek = checkDate.getDay();

    // Apply day constraints
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (
      (dayConstraints === 'weekday' && !isWeekday) ||
      (dayConstraints === 'weekend' && !isWeekend)
    ) {
      continue;
    }

    // Create event date
    const eventDate = new Date(checkDate);
    eventDate.setHours(hour, 0, 0, 0);

    options.push({
      eventDate: eventDate.toISOString(),
      dayLabel: `${daysOfWeek[dayOfWeek]}, ${format(eventDate, 'MMM d')}`,
      timeLabel: `${timeLabel} (${format(eventDate, 'h:mm a')})`,
    });

    foundOptions++;
  }

  // If we don't have enough options, generate at least 2
  if (options.length < 2) {
    const fallbackDate = new Date(startDate);
    fallbackDate.setDate(startDate.getDate() + 7);
    fallbackDate.setHours(hour, 0, 0, 0);

    options.push({
      eventDate: fallbackDate.toISOString(),
      dayLabel: `${daysOfWeek[fallbackDate.getDay()]}, ${format(fallbackDate, 'MMM d')}`,
      timeLabel: `${timeLabel} (${format(fallbackDate, 'h:mm a')})`,
    });
  }

  return options;
}

// ==================== Rate Limiters ====================

// Rate limiter for AI chat (10 requests per minute per user)
const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID if authenticated, otherwise skip rate limiting for this endpoint
  // (the isAuthenticated middleware will reject unauthenticated requests anyway)
  skip: (req: any) => !req.user?.id,
  message: { error: "Too many requests. Please wait a moment before sending more messages." }
});

// ==================== Routes ====================

// Schedule event from natural language prompt
router.post("/groups/:id/schedule-from-prompt", isAuthenticated, async (req: any, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Verify user owns this group
    const userId = await getUserId(req);
    if (group.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to modify this group" });
    }

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ message: "Prompt is required" });
    }

    // Parse the natural language prompt with group history for smarter understanding
    // Uses GPT-4o (not mini) for intelligent history application
    // Cost: ~5-7x more than mini, but provides significantly better context understanding
    // Trade-off: Worth it for personalized, history-aware event creation
    const groupHistory = {
      preferenceInsights: group.preferenceInsights as string | null | undefined,
      schedulingPreferences: group.schedulingPreferences,
      closenessLevel: group.closenessLevel
    };
    const schedulingParams = await parseSchedulingPromptWithHistory(prompt, group.locationBase, groupHistory);

    if (schedulingParams.historyApplied && schedulingParams.historyApplied.length > 0) {

    }

    // Use category search to find venues based on parsed params
    const searchLocation = schedulingParams.location || group.locationBase;
    const searchRadius = group.searchRadius || 2;

    // Determine coordinates for distance filtering
    let coordinates: { lat: number; lng: number } | undefined;
    if (group.latitude && group.longitude) {
      coordinates = { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) };
    }

    // Map category to Google Places search query
    const categorySearchQueries: Record<string, string> = {
      'meal': 'restaurants',
      'cafes': 'coffee shops cafes',
      'drinks': 'bars',
      'dessert': 'dessert ice cream boba',
      'experiences': 'museums parks attractions activities'
    };

    // Build context-aware search query
    let searchQuery = `${schedulingParams.activityType} ${categorySearchQueries[schedulingParams.category] || ''}`;

    // Add context keywords for smarter search (e.g., "romantic", "family-friendly")
    if (schedulingParams.contextKeywords && schedulingParams.contextKeywords.length > 0) {
      searchQuery += ' ' + schedulingParams.contextKeywords.join(' ');

    }

    // Add venue attributes (e.g., "outdoor seating", "live music")
    if (schedulingParams.venueAttributes && schedulingParams.venueAttributes.length > 0) {
      searchQuery += ' ' + schedulingParams.venueAttributes.join(' ');

    }

    // Search Google Places with budget filtering
    const places = await searchPlaces(
      `${searchQuery} in ${searchLocation}`,
      searchLocation,
      searchRadius,
      coordinates,
      false, // skipCurated
      undefined, // venueType
      group.budgetMax // Pass budget for filtering
    );

    if (places.length === 0) {
      return res.status(404).json({ message: "No venues found matching your criteria" });
    }

    // Get existing activities to avoid duplicates
    const existingActivities = await storage.getGroupActivities(req.params.id);
    const existingVenueNames = existingActivities.map(a => a.venueName);

    // Neighborhood filtering: if a specific SF neighborhood is mentioned, filter to only that area
    const sfNeighborhoods = ['mission', 'castro', 'haight', 'soma', 'nob hill', 'russian hill',
      'marina', 'pacific heights', 'richmond', 'sunset', 'north beach', 'chinatown', 'financial district',
      'potrero hill', 'dogpatch', 'hayes valley', 'lower haight', 'fillmore', 'presidio', 'embarcadero'];

    let neighborhoodFilter: string | null = null;
    if (schedulingParams.location) {
      const locationLower = schedulingParams.location.toLowerCase();
      // Check if location matches a SF neighborhood
      const matchedNeighborhood = sfNeighborhoods.find(n => locationLower.includes(n));
      if (matchedNeighborhood) {
        neighborhoodFilter = matchedNeighborhood;

      }
    }

    // Apply smart time and day inference based on activity type (MOVED UP for agent)
    const inferredTiming = inferTimeFromActivity(schedulingParams);

    // VALIDATION: Check if inferred time makes sense for activity type
    const activityLower = schedulingParams.activityType.toLowerCase();
    let validatedTimePreference = inferredTiming.timePreference;
    const validationWarnings: string[] = [];

    // Check for obvious mismatches
    if (activityLower.includes('dinner') && (validatedTimePreference === 'morning' || validatedTimePreference === 'afternoon')) {
      validationWarnings.push(`CORRECTED: Dinner scheduled for ${validatedTimePreference}, changing to evening`);
      validatedTimePreference = 'evening';
    } else if (activityLower.includes('breakfast') && validatedTimePreference === 'evening') {
      validationWarnings.push(`CORRECTED: Breakfast scheduled for evening, changing to morning`);
      validatedTimePreference = 'morning';
    } else if (activityLower.includes('brunch') && (validatedTimePreference === 'evening' || validatedTimePreference === 'night')) {
      validationWarnings.push(`CORRECTED: Brunch scheduled for ${validatedTimePreference}, changing to morning`);
      validatedTimePreference = 'morning';
    } else if (activityLower.includes('lunch') && (validatedTimePreference === 'morning' || validatedTimePreference === 'night')) {
      validationWarnings.push(`CORRECTED: Lunch scheduled for ${validatedTimePreference}, changing to afternoon`);
      validatedTimePreference = 'afternoon';
    }

    if (validationWarnings.length > 0) {
      console.log(`[AI Scheduling Validation] ${validationWarnings.join(', ')}`);
    }

    // Generate 2-3 date/time options based on timeframe and constraints
    const timeOptions = generateTimeOptions(
      schedulingParams.timeframe || 'next week',
      inferredTiming.dayConstraints,
      validatedTimePreference,
      group.timezone || 'America/Los_Angeles'
    );

    // Filter places for quality and de-duplication
    const qualityPlaces = places
      .filter(place => !existingVenueNames.includes(place.name))
      .filter(place => {
        const rating = parseFloat(place.rating || '0');
        const reviewCount = place.reviewCount || 0;
        return rating >= 3.5 && reviewCount >= 10 && place.address && place.photoUrl;
      })
      .filter(place => {
        // If neighborhood filter is active, only include venues in that neighborhood
        if (neighborhoodFilter && place.location) {
          const inNeighborhood = isInNeighborhood(place.location.lat, place.location.lng, neighborhoodFilter);
          if (!inNeighborhood) {

          }
          return inNeighborhood;
        }
        return true;
      });

    if (qualityPlaces.length === 0) {
      return res.status(404).json({ message: "No quality venues found" });
    }

    // Convert places to VenueForAgent format for intelligent selection
    const venuesForAgent: VenueForAgent[] = qualityPlaces.map(place => ({
      type: 'activity' as const,
      id: place.placeId || place.name,
      name: place.name,
      score: parseFloat(place.rating || '0') * 3, // Convert rating to score format
      visitCount: 0,
      daysSinceLastVisit: 999,
      qualityScore: parseFloat(place.rating || '0'),
      category: null, // Let agent derive category from venueType for better diversity
      venueType: getBestVenueTypeSync(place.types || []),
      rating: place.rating,
      venueAddress: place.address,
      googlePlaceId: place.placeId,
      latitude: place.location?.lat || null,
      longitude: place.location?.lng || null,
    }));

    // Use AI Event Planning Agent for intelligent venue selection
    let selectedVenuesData: Array<{ name: string; placeId?: string }>;
    let agentReasoning: string | undefined;
    let agentConfidence: number | undefined;

    try {
      const firstEventDate = new Date(timeOptions[0].eventDate);
      const agentResult = await planEventWithAgent({
        group,
        eventDate: firstEventDate,
        availableVenues: venuesForAgent,
        constraints: {
          desiredVenueCount: 3,
          maxDistanceMiles: group.searchRadius || 2,
        },
      });

      if (!agentResult) {
        throw new Error('Agent returned null result');
      }

      selectedVenuesData = agentResult.selectedVenues.map(v => ({
        name: v.name,
        placeId: v.googlePlaceId || undefined,
      }));
      agentReasoning = agentResult.reasoning;
      agentConfidence = agentResult.confidence;

    } catch (agentError) {
      console.error(`[AI Scheduling Agent] Failed, falling back to simple selection:`, agentError);
      // Fallback: simple rating-based selection
      selectedVenuesData = qualityPlaces
        .sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'))
        .slice(0, 3)
        .map(p => ({ name: p.name, placeId: p.placeId }));
    }

    // Get full place data for selected venues
    const topVenues = selectedVenuesData
      .map(selected => qualityPlaces.find(p =>
        p.placeId === selected.placeId || p.name === selected.name
      ))
      .filter(p => p !== undefined);

    if (topVenues.length === 0) {
      return res.status(404).json({ message: "No venues selected" });
    }

    // Create activities from the top venues
    const createdActivities: Array<{ id: string }> = [];
    for (const place of topVenues) {
      const venueType = await getBestVenueType(place.types || [], place.placeId);
      const activityCategory = await categorizeVenue(place.name, venueType);
      const newActivity = await storage.createActivity({
        groupId: req.params.id,
        venueName: place.name,
        venueAddress: place.address,
        city: place.city || null,
        venueType,
        description: place.review || '',
        googlePlaceId: place.placeId,
        latitude: place.location?.lat?.toString() || null,
        longitude: place.location?.lng?.toString() || null,
        rating: place.rating,
        reviewCount: place.reviewCount || null,
        priceLevel: place.priceLevel,
        photoUrl: place.photoUrl,
        googleReview: place.review || null,
        category: activityCategory,
      }, 'google_search');
      createdActivities.push(newActivity);
    }

    // Create itinerary items from activities
    const items = createdActivities.map(activity => ({
      sourceType: 'activity' as const,
      sourceId: activity.id,
      orderIndex: createdActivities.indexOf(activity),
    }));

    // Generate event name
    const eventName = `${schedulingParams.activityType.charAt(0).toUpperCase() + schedulingParams.activityType.slice(1)} ${schedulingParams.timeframe || ''}`.trim();

    // DEDUPLICATION: Check for existing proposed itineraries on the same date
    // This prevents creating duplicate events when user submits multiple times
    const { deduplicateByDate } = await import('../itinerary-deduplication');
    const proposedEventDate = new Date(timeOptions[0].eventDate);
    await deduplicateByDate(req.params.id, proposedEventDate, 'AI Scheduling');

    // Create proposed itinerary with multiple time slots
    // proposedOrder must be set for proposed itineraries (array of item IDs in sequence)
    const proposedOrder = items.map(item => item.sourceId);

    // createItinerary signature: (insertItinerary, userId, itemsData)
    // Set eventDate to first time option so itinerary shows up on Home tab immediately
    const itinerary = await storage.createItinerary(
      {
        groupId: req.params.id,
        name: eventName,
        status: 'proposed',
        timingRecommendations: timeOptions.length > 1 ? 'Vote for your preferred time' : null,
        proposedOrder,
        eventDate: proposedEventDate, // Set default to first time option
      },
      userId, // Passed separately, not in the object!
      items
    );

    // Create time slot options for voting
    for (const option of timeOptions) {
      await storage.createProposedTimeSlot({
        itineraryId: itinerary.id,
        proposedDateTime: new Date(option.eventDate), // Use proposedDateTime, not eventDate
        // Note: label removed - frontend will format datetime with timezone
      });
    }

    // Collect all applied enhancements for transparency
    const appliedEnhancements: {
      timeInferences?: string[];
      contextKeywords?: string[];
      venueAttributes?: string[];
      historyApplied?: string[];
    } = {};

    if (inferredTiming.appliedInferences.length > 0) {
      appliedEnhancements.timeInferences = inferredTiming.appliedInferences;
    }

    if (schedulingParams.contextKeywords && schedulingParams.contextKeywords.length > 0) {
      appliedEnhancements.contextKeywords = schedulingParams.contextKeywords;
    }

    if (schedulingParams.venueAttributes && schedulingParams.venueAttributes.length > 0) {
      appliedEnhancements.venueAttributes = schedulingParams.venueAttributes;
    }

    if (schedulingParams.historyApplied && schedulingParams.historyApplied.length > 0) {
      appliedEnhancements.historyApplied = schedulingParams.historyApplied;
    }

    res.json({
      itinerary,
      venues: createdActivities,
      timeOptions,
      appliedEnhancements: Object.keys(appliedEnhancements).length > 0 ? appliedEnhancements : undefined,
      // A/B test info - so you can see which model was used!
      aiMetadata: {
        model: schedulingParams.aiModel,
        cached: schedulingParams.cached,
        responseTimeMs: schedulingParams.responseTimeMs,
      },
    });
  } catch (error: any) {
    console.error("[AI Scheduling] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Analyze preference patterns and generate insights
router.post("/groups/:id/analyze-patterns", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Gather all feedback data
    const activities = await storage.getAllGroupActivities(req.params.id);
    const notThisFeedback = activities
      .filter(a => a.feedback === 'less')
      .map(a => ({
        venueName: a.venueName,
        venueType: a.venueType,
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
        netVotes: e.netVotes
      }));

    const preferenceSignals = await storage.getGroupPreferenceSignals(req.params.id);
    const likedConcepts = preferenceSignals
      .filter(s => s.feedback === 'like')
      .map(s => s.conceptDescription);
    const passedConcepts = preferenceSignals
      .filter(s => s.feedback === 'pass')
      .map(s => s.conceptDescription);

    // Generate insights using OpenAI
    const patterns = await analyzePreferencePatterns({
      notThisFeedback,
      votingFeedback,
      likedConcepts,
      passedConcepts
    });

    // Update group with insights
    await db.update(groupsTable)
      .set({
        preferenceInsights: patterns,
        lastInsightsUpdate: new Date()
      })
      .where(eq(groupsTable.id, req.params.id));

    res.json({ patterns });
  } catch (error: any) {
    console.error("[AI Insights] Error:", error);
    res.status(500).json({ message: safeError(error) });
  }
});


// Generate swipeable concepts for preference refinement
router.post("/groups/:id/swipe-concepts", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Get previously seen concepts to avoid repeats
    const previousSignals = await storage.getGroupPreferenceSignals(req.params.id);
    const previouslySeenConcepts = previousSignals.map(s => s.conceptDescription);

    const concepts = await generateSwipeConcepts({
      locationBase: group.locationBase,
      budgetMin: group.budgetMin,
      budgetMax: group.budgetMax,
      activityCategories: group.activityCategories || [],
      pastPreferences: group.pastPreferences || '',
      previouslySeenConcepts,
      mealEnabled: group.mealEnabled ?? true,
      cafeEnabled: group.cafeEnabled ?? true,
      drinksEnabled: group.drinksEnabled ?? true,
      dessertEnabled: group.dessertEnabled ?? true,
      experiencesEnabled: group.experiencesEnabled ?? true,
    });

    res.json({ concepts });
  } catch (error: any) {
    console.error("Error generating swipe concepts:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Save swipe feedback (like or pass)
// Discover Venues - Start a discovery swipe session with cache-first strategy
router.post("/groups/:groupId/discover-venues", isAuthenticated, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const userId = await getUserId(req);

    // Verify user has access to this group
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const member = await storage.getGroupMemberByUserId(groupId, userId);
    if (!member) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    // Parse request body (optional category filter)
    const discoverSchema = z.object({
      category: z.enum(['meal', 'cafe', 'drinks', 'dessert', 'experiences']).optional(),
      count: z.number().min(5).max(30).optional().default(15),  // Reduced from 20 to 15
    });

    const validatedData = safeParse(discoverSchema, req.body, res);
    if (!validatedData) return;

    const { category } = validatedData;
    const count = validatedData.count ?? 15;

    // Create a discovery swipe session
    const { createSwipeSession } = await import('../swipe-session-manager');
    const sessionId = await createSwipeSession({
      groupId,
      sessionType: 'discovery',
      triggeredBy: 'manual',
      isBlocking: false,
      targetSwipeCount: count,
      expiresInHours: 48,
    });

    const COOLDOWN_DAYS = 30;
    let deck: any[] = [];

    // TIER 1: Popular cached venues (group favorites with cooldown)

    const popularVenuesQuery = await db.execute<{
      id: string;
      title: string;
      description: string;
      venue_address: string;
      venue_type: string;
      google_place_id: string;
      rating: string;
      price_level: string;
      photo_url: string;
      upvote_count: number;
    }>(sql`
      SELECT DISTINCT
        ve.id,
        ve.title,
        ve.description,
        ve.venue_address,
        ve.venue_type,
        ve.google_place_id,
        ve.rating,
        ve.price_level,
        ve.photo_url,
        COUNT(DISTINCT v.id) FILTER (WHERE v.vote_type = 'upvote') as upvote_count
      FROM voting_events ve
      LEFT JOIN votes v ON ve.id = v.event_id
      LEFT JOIN activity_swipes swipe ON ve.id = swipe.voting_event_id AND swipe.user_id = ${userId}
      WHERE ve.group_id = ${groupId}
        AND (
          swipe.id IS NULL
          OR swipe.created_at < NOW() - INTERVAL '${COOLDOWN_DAYS} days'
        )
        ${category ? sql`AND LOWER(ve.venue_type) LIKE LOWER(${'%' + category + '%'})` : sql``}
      GROUP BY ve.id
      HAVING COUNT(DISTINCT v.id) FILTER (WHERE v.vote_type = 'upvote') > 0
      ORDER BY upvote_count DESC
      LIMIT ${count || 10}
    `);

    const popularVenues = popularVenuesQuery.rows || [];
    deck.push(...popularVenues.map(v => ({
      id: v.id,
      title: v.title,
      description: v.description || `Popular venue in ${group.locationBase}`,
      venueAddress: v.venue_address,
      venueType: v.venue_type,
      googlePlaceId: v.google_place_id,
      rating: v.rating,
      priceLevel: v.price_level,
      photoUrl: v.photo_url,
      sourceType: 'voting_event' as const,
      isNew: false,
      likedByCount: Number(v.upvote_count),
      groupId,
    })));

    // TIER 2: Unvoted activities from cache (if we need more)
    const remaining = count - deck.length;
    if (remaining > 0) {

      const activitiesQuery = await db.execute<{
        id: string;
        venue_name: string;
        description: string;
        venue_address: string;
        venue_type: string;
        google_place_id: string;
        rating: string;
        price_level: string;
        photo_url: string;
      }>(sql`
        SELECT DISTINCT
          a.id,
          a.venue_name,
          a.description,
          a.venue_address,
          a.venue_type,
          a.google_place_id,
          a.rating,
          a.price_level,
          a.photo_url
        FROM activities a
        LEFT JOIN activity_swipes swipe ON a.id = swipe.activity_id AND swipe.user_id = ${userId}
        WHERE a.group_id = ${groupId}
          AND a.archived_at IS NULL
          AND swipe.id IS NULL
          ${category ? sql`AND a.category = ${category}` : sql``}
        LIMIT ${remaining}
      `);

      const activities = activitiesQuery.rows || [];
      deck.push(...activities.map(a => ({
        id: a.id,
        title: a.venue_name,
        description: a.description || `${a.venue_type || 'Activity'} in ${group.locationBase}`,
        venueAddress: a.venue_address,
        venueType: a.venue_type,
        googlePlaceId: a.google_place_id,
        rating: a.rating,
        priceLevel: a.price_level,
        photoUrl: a.photo_url,
        sourceType: 'ai_suggestion' as const,
        isNew: true,
        groupId,
      })));

    }

    // TIER 3: Google Places API (only if still need more)
    const stillNeeded = count - deck.length;
    if (stillNeeded > 0) {

      const { generateSwipeConcepts } = await import('../openai');
      const categoryFilters = {
        mealEnabled: category === 'meal' || (!category && (group.mealEnabled ?? true)),
        cafeEnabled: category === 'cafe' || (!category && (group.cafeEnabled ?? true)),
        drinksEnabled: category === 'drinks' || (!category && (group.drinksEnabled ?? true)),
        dessertEnabled: category === 'dessert' || (!category && (group.dessertEnabled ?? true)),
        experiencesEnabled: category === 'experiences' || (!category && (group.experiencesEnabled ?? true)),
      };

      const previousSignals = await storage.getGroupPreferenceSignals(groupId);
      const previouslySeenConcepts = previousSignals.map(s => s.conceptDescription);

      // Generate fewer concepts (3-5 instead of 10)
      const concepts = await generateSwipeConcepts({
        locationBase: group.locationBase,
        budgetMin: group.budgetMin,
        budgetMax: group.budgetMax,
        activityCategories: group.activityCategories || [],
        pastPreferences: group.pastPreferences || '',
        previouslySeenConcepts,
        ...categoryFilters,
      });

      if (concepts && concepts.length > 0) {
        const { searchPlaces } = await import('../google-places');

        // Limit concepts to reduce API calls
        const limitedConcepts = concepts.slice(0, Math.min(3, concepts.length));

        const venuePromises = limitedConcepts.map(async (concept) => {
          try {
            const venues = await searchPlaces(
              concept.searchQuery,
              `${group.latitude || ''},${group.longitude || ''}`,
              group.searchRadius || 5,
              group.latitude && group.longitude
                ? { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) }
                : undefined,
              false, // skipCurated
              undefined, // venueType
              group.budgetMax,
              [], // seenVenues
              false // forceComprehensiveSearch
            );

            return venues.slice(0, Math.ceil(stillNeeded / limitedConcepts.length));
          } catch (error) {
            console.error(`[Discover Venues] Error searching for "${concept.searchQuery}":`, error);
            return [];
          }
        });

        const venueArrays = await Promise.all(venuePromises);
        const newVenues = venueArrays.flat();

        // Filter out duplicates
        const existingIds = new Set(deck.map(v => v.googlePlaceId).filter(Boolean));
        const rejectedIds = new Set(group.rejectedVenues || []);

        const filteredNewVenues = newVenues.filter(venue =>
          !existingIds.has(venue.placeId) &&
          !rejectedIds.has(venue.placeId || venue.name)
        );

        deck.push(...filteredNewVenues.slice(0, stillNeeded).map(venue => ({
          id: venue.placeId,
          title: venue.name,
          description: `${venue.types?.[0] || 'Venue'} in ${group.locationBase}`,
          venueAddress: venue.address,
          venueType: venue.types?.[0] || 'place',
          googlePlaceId: venue.placeId,
          rating: venue.rating,
          reviewCount: venue.reviewCount,
          priceLevel: venue.priceLevel,
          photoUrl: venue.photoUrl,
          sourceType: 'ai_suggestion' as const,
          isNew: true,
          groupId,
        })));

      }
    }

    // Shuffle the final deck for variety
    const shuffledDeck = deck.sort(() => Math.random() - 0.5);

    res.json({
      sessionId,
      deck: shuffledDeck,
      totalVenues: shuffledDeck.length,
      category: category || 'all',
      cacheStats: {
        popularVenues: popularVenues.length,
        cachedActivities: deck.filter(d => d.sourceType === 'ai_suggestion' && !d.likedByCount).length,
        newFromAPI: deck.filter(d => d.isNew && !popularVenues.some(p => p.id === d.id)).length,
      }
    });
  } catch (error: any) {
    console.error('[Discover Venues] Error:', error);
    res.status(500).json({
      message: error.message || "Failed to create discovery session"
    });
  }
});

router.post("/groups/:id/swipe-feedback", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const { conceptType, conceptDescription, feedback } = req.body;

    if (!conceptType || !conceptDescription || !feedback) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (feedback !== 'like' && feedback !== 'pass') {
      return res.status(400).json({ message: "Feedback must be 'like' or 'pass'" });
    }

    const signal = await storage.createPreferenceSignal({
      groupId: req.params.id,
      conceptType,
      conceptDescription,
      feedback,
    });

    await trackFeedbackAndMaybeAnalyze(req.params.id);

    res.json({ signal });
  } catch (error: any) {
    console.error("Error saving swipe feedback:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Get swipe deck - mix of voting events and AI suggestions
router.get("/groups/:id/swipe-deck", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const groupId = req.params.id;

    // Get group settings for category filtering
    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Get all voting events for this group with vote data
    const votingEvents = await storage.getGroupVotingEvents(groupId);

    // Get user's existing votes to filter out already-voted venues
    const userVotes = await storage.getUserVotes(userId);
    const votedEventIds = new Set(userVotes.map(v => v.eventId));

    // Filter out venues user has already voted on OR created (adding = implicit like)
    const unvotedEvents = votingEvents.filter(event =>
      !votedEventIds.has(event.id) && event.createdBy !== userId
    );

    // Get who liked each event (for "Liked by X" badges)
    const eventsWithLikers = await Promise.all(
      unvotedEvents.map(async (event) => {
        const votes = await storage.getEventVotes(event.id);
        const upvoters = votes.filter(v => v.voteType === 'upvote');

        // Get user names for upvoters
        const likerNames = await Promise.all(
          upvoters.slice(0, 3).map(async (vote) => {
            const user = await storage.getUser(vote.userId);
            return user?.firstName || 'Someone';
          })
        );

        return {
          ...event,
          likedBy: likerNames,
          likedByCount: upvoters.length,
          sourceType: 'voting_event' as const,
        };
      })
    );

    // Filter out voting events from disabled categories (keyword-based)
    const filteredEvents = eventsWithLikers.filter(event => {
      const venueType = (event.venueType || '').toLowerCase();
      const title = event.title.toLowerCase();

      // Check if venue belongs to a disabled category
      if (group.cafeEnabled === false && (venueType.includes('cafe') || venueType.includes('coffee') || title.includes('cafe') || title.includes('coffee'))) {

        return false;
      }

      if (group.mealEnabled === false && (venueType.includes('restaurant') || venueType.includes('dining') || venueType.includes('food'))) {

        return false;
      }

      if (group.drinksEnabled === false && (venueType.includes('bar') || venueType.includes('brewery') || venueType.includes('pub') || venueType.includes('wine'))) {

        return false;
      }

      if (group.dessertEnabled === false && (venueType.includes('dessert') || venueType.includes('ice cream') || venueType.includes('boba') || venueType.includes('bakery'))) {

        return false;
      }

      return true;
    });

    // If we have fewer than 10 venues, backfill with AI suggestions
    let deck = filteredEvents;
    const MIN_DECK_SIZE = 10;

    if (deck.length < MIN_DECK_SIZE) {
      // Get previously seen concepts to avoid repeats
      const previousSignals = await storage.getGroupPreferenceSignals(groupId);
      const previouslySeenConcepts = previousSignals.map(s => s.conceptDescription);

      // Get already suggested place IDs to avoid duplicates
      const existingPlaceIds = new Set(
        eventsWithLikers
          .map(e => e.googlePlaceId)
          .filter(Boolean)
      );

      // Generate new AI suggestions
      const neededCount = MIN_DECK_SIZE - deck.length;
      const concepts = await generateSwipeConcepts({
        locationBase: group.locationBase,
        budgetMin: group.budgetMin,
        budgetMax: group.budgetMax,
        activityCategories: group.activityCategories || [],
        pastPreferences: group.pastPreferences || '',
        previouslySeenConcepts,
        mealEnabled: group.mealEnabled ?? true,
        cafeEnabled: group.cafeEnabled ?? true,
        drinksEnabled: group.drinksEnabled ?? true,
        dessertEnabled: group.dessertEnabled ?? true,
        experiencesEnabled: group.experiencesEnabled ?? true,
      });

      // Drop concepts whose search queries normalize to the same key — Text
      // Search on "wine bar" vs "bar with wine" returns the same venues but
      // costs $32/1k each. Keep the first concept per key.
      const STOPWORDS = new Set([
        'a', 'an', 'the', 'in', 'on', 'at', 'with', 'for', 'and', 'or', 'of', 'to',
      ]);
      const seenConceptKeys = new Set<string>();
      const uniqueConcepts = concepts.filter((c) => {
        const key = (c.searchQuery || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w && !STOPWORDS.has(w))
          .sort()
          .join(' ');
        if (!key || seenConceptKeys.has(key)) return false;
        seenConceptKeys.add(key);
        return true;
      });
      if (uniqueConcepts.length < concepts.length) {
        console.log(`[Swipe Deck] Deduped ${concepts.length - uniqueConcepts.length} redundant concept searches`);
      }

      // Convert concepts to venue-style cards and enrich with Google Places
      const enrichedConcepts = await Promise.all(
        uniqueConcepts.slice(0, neededCount * 2).map(async (concept) => {
          // Use the searchQuery field for Google Places search

          try {
            // Parse coordinates - they're stored as strings in DB
            const lat = group.latitude ? parseFloat(group.latitude) : undefined;
            const lng = group.longitude ? parseFloat(group.longitude) : undefined;
            const radius = group.searchRadius || 10; // default 10 miles

            // Only pass coordinates object if both values are defined
            const coordinates = (lat !== undefined && lng !== undefined) ? { lat, lng } : undefined;

            const places = await import('../google-places').then(m =>
              m.searchPlaces(concept.searchQuery, group.locationBase, radius, coordinates, false, undefined, group.budgetMax)
            );

            if (places.length > 0) {
              const place = places[0];

              // Skip if we already have this place
              if (existingPlaceIds.has(place.placeId)) {

                return null;
              }

              // Filter out places from disabled categories
              const placeTypes = (place.types || []).map(t => t.toLowerCase()).join(' ');
              const placeName = place.name.toLowerCase();

              if (group.cafeEnabled === false) {
                if (placeTypes.includes('cafe') || placeTypes.includes('coffee') || placeName.includes('cafe') || placeName.includes('coffee')) {

                  return null;
                }
              }

              if (group.mealEnabled === false) {
                if (placeTypes.includes('restaurant') || placeTypes.includes('food')) {

                  return null;
                }
              }

              if (group.drinksEnabled === false) {
                if (placeTypes.includes('bar') || placeTypes.includes('night_club') || placeTypes.includes('liquor_store')) {

                  return null;
                }
              }

              if (group.dessertEnabled === false) {
                if (placeTypes.includes('bakery') || placeTypes.includes('ice_cream') || placeName.includes('dessert') || placeName.includes('boba')) {

                  return null;
                }
              }

              // Add to existing places to avoid duplicates in this batch
              existingPlaceIds.add(place.placeId);

              return {
                id: `ai-${concept.conceptType}-${Date.now()}-${Math.random()}`,
                title: place.name,
                description: concept.conceptDescription,
                venueAddress: place.address,
                venueType: getBestVenueTypeSync(place.types || []) || concept.conceptType,
                googlePlaceId: place.placeId,
                rating: place.rating?.toString(),
                reviewCount: place.reviewCount,
                priceLevel: place.priceLevel ? '$'.repeat(parseInt(place.priceLevel)) : undefined,
                photoUrl: place.photoUrl,
                sourceType: 'ai_suggestion' as const,
                isNew: true,
                groupId,
              };
            } else {
              console.warn(`[Swipe Deck] ❌ No Google Places results for: "${concept.searchQuery}"`);
              return null;
            }
          } catch (error) {
            console.error(`[Swipe Deck] Error searching for "${concept.searchQuery}":`, error);
            return null;
          }
        })
      );

      // Filter out nulls and add to deck
      const validConcepts = enrichedConcepts.filter((c): c is NonNullable<typeof c> => c !== null);
      deck.push(...(validConcepts as any[]));
    }

    // Shuffle the deck to mix voting events and new suggestions
    const shuffledDeck = deck.sort(() => Math.random() - 0.5);

    res.json({ deck: shuffledDeck });
  } catch (error: any) {
    console.error("Error generating swipe deck:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Get nearby add-on suggestions for selected venues
router.post("/groups/:groupId/nearby-suggestions", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const { selectedVenues } = req.body; // Array of { sourceType, sourceId }
    const { groupId } = req.params;

    if (!selectedVenues || !Array.isArray(selectedVenues) || selectedVenues.length === 0) {
      return res.json({ suggestions: [] });
    }

    // Fetch venue details with location data
    const venuesWithLocations = await Promise.all(
      selectedVenues.map(async (v: { sourceType: string; sourceId: string }) => {
        if (v.sourceType === 'activity') {
          const activities = await storage.getGroupActivities(groupId);
          const activity = activities.find(a => a.id === v.sourceId);
          if (!activity?.googlePlaceId) return null;

          // Use stored location coordinates (already saved from search results)
          if (!activity.latitude || !activity.longitude) return null;

          return {
            location: {
              lat: parseFloat(activity.latitude),
              lng: parseFloat(activity.longitude),
            },
            placeId: activity.googlePlaceId,
            name: activity.venueName,
          };
        } else {
          const events = await storage.getGroupVotingEvents(groupId);
          const event = events.find(e => e.id === v.sourceId);
          if (!event?.googlePlaceId) return null;

          // Use stored location coordinates (already saved from search results)
          if (!event.latitude || !event.longitude) return null;

          return {
            location: {
              lat: parseFloat(event.latitude),
              lng: parseFloat(event.longitude),
            },
            placeId: event.googlePlaceId,
            name: event.title,
          };
        }
      })
    );

    const validLocations = venuesWithLocations.filter(Boolean);

    if (validLocations.length === 0) {
      return res.json({ suggestions: [] });
    }

    // Search for nearby high-rated places around the first venue
    const centerLocation = validLocations[0]!.location;
    const selectedPlaceIds = validLocations.map(v => v!.placeId);

    // Search for various types of nearby venues — single batched API call
    const allNearbyPlaces = await searchNearbyByTypes(
      ['restaurant', 'cafe', 'bar', 'bakery', 'ice_cream_shop'],
      centerLocation, 805, 4.0 // 0.5 miles = 805 meters, 4.0+ rating
    );

    // Deduplicate
    const uniquePlaces = new Map();
    allNearbyPlaces.forEach(place => {
      // Skip if it's one of the selected venues
      if (selectedPlaceIds.includes(place.placeId)) return;

      if (!uniquePlaces.has(place.placeId)) {
        uniquePlaces.set(place.placeId, place);
      }
    });

    // Take top 3 suggestions by rating
    const suggestions = Array.from(uniquePlaces.values())
      .sort((a, b) => {
        const ratingA = parseFloat(a.rating || '0');
        const ratingB = parseFloat(b.rating || '0');
        return ratingB - ratingA;
      })
      .slice(0, 3);

    res.json({ suggestions });
  } catch (error: any) {
    console.error("Error fetching nearby suggestions:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Get nearby suggestions for a specific venue by lat/lng
router.post("/groups/:groupId/venue-nearby-suggestions", async (req, res) => {
  try {
    const { lat, lng, placeId, excludePlaceIds } = req.body;
    const { groupId } = req.params;

    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      return res.json({ suggestions: [] });
    }

    const location = { lat: parseFloat(lat), lng: parseFloat(lng) };
    const excludeIds = new Set([placeId, ...(excludePlaceIds || [])]);

    // Search for various types of nearby venues — single batched API call
    const allNearbyPlaces = await searchNearbyByTypes(
      ['restaurant', 'cafe', 'bar', 'bakery', 'ice_cream_shop'],
      location, 805, 4.0 // 0.5 miles = 805 meters, 4.0+ rating
    );

    // Deduplicate
    const uniquePlaces = new Map();
    allNearbyPlaces.forEach(place => {
      if (excludeIds.has(place.placeId)) return;
      if (!uniquePlaces.has(place.placeId)) {
        uniquePlaces.set(place.placeId, place);
      }
    });

    // Take top 3 suggestions by rating
    const suggestions = Array.from(uniquePlaces.values())
      .sort((a, b) => {
        const ratingA = parseFloat(a.rating || '0');
        const ratingB = parseFloat(b.rating || '0');
        return ratingB - ratingA;
      })
      .slice(0, 3);

    res.json({ suggestions });
  } catch (error: any) {
    console.error("Error fetching venue nearby suggestions:", error);
    res.status(500).json({ message: safeError(error) });
  }
});

// AI suggestions for itinerary venues
router.post("/itineraries/:id/ai-suggestions", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
  try {
    const itineraryId = req.params.id;
    const { venueId, suggestionType = 'alternatives' } = req.body;

    // Get the itinerary
    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    // Need group context for AI suggestions
    if (!itinerary.groupId) {
      return res.status(400).json({ message: "AI suggestions require group context" });
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Import scoring utilities
    const { calculateVenueScore, getVisitStats: getVisitStatsUtil, shouldSkipVenue, calculateQualityScore, calculateVotingEventQuality } = await import('../venue-scoring-utils');
    const { suggestAlternativesWithAgent, suggestComplementsWithAgent } = await import('../ai-event-agent');
    const { getVenueVisitStats } = await import('../auto-scheduler');

    // Get all available venues (activities + voting events)
    const activities = await storage.getGroupActivities(group.id);
    const votingEvents = await storage.getGroupVotingEvents(group.id);

    console.log(`[AI Suggestions] Found ${activities.length} activities, ${votingEvents.length} favorites for group "${group.name}"`);

    // Get visit history
    const visitStats = await getVenueVisitStats(group.id);

    // Score all venues - use any[] and let the agent functions handle typing
    const scoredVenues: any[] = [];

    // Score activities
    for (const activity of activities) {
      if (shouldSkipVenue(activity.businessStatus, activity.feedback)) continue;

      const qualityScore = calculateQualityScore(activity.feedback);
      const stats = visitStats.find((v: any) => v.activityId === activity.id);
      const { visitCount, daysSinceLastVisit } = getVisitStatsUtil(stats);
      const score = calculateVenueScore(qualityScore, visitCount, daysSinceLastVisit);

      scoredVenues.push({
        type: 'activity',
        id: activity.id,
        name: activity.venueName,
        score,
        visitCount,
        daysSinceLastVisit,
        qualityScore,
        feedback: activity.feedback,
        category: activity.category,
        timeCategory: activity.timeCategory,
        venueType: activity.venueType,
        rating: activity.rating,
        venueAddress: activity.venueAddress,
        googlePlaceId: activity.googlePlaceId,
        latitude: activity.latitude,
        longitude: activity.longitude,
      });
    }

    // Score voting events (favorites)
    const voteCounts = await Promise.all(
      votingEvents.map(async (ve) => {
        const votes = await storage.getEventVotes(ve.id);
        const upvotes = votes.filter((v: any) => v.voteType === 'upvote').length;
        const downvotes = votes.filter((v: any) => v.voteType === 'downvote').length;
        return { id: ve.id, upvotes, downvotes, netVotes: upvotes - downvotes };
      })
    );

    for (const votingEvent of votingEvents) {
      const voteCount = voteCounts.find(vc => vc.id === votingEvent.id);
      const upvotes = voteCount?.upvotes || 0;
      const downvotes = voteCount?.downvotes || 0;

      const qualityScore = calculateVotingEventQuality(upvotes, downvotes);
      if (qualityScore === -1) continue; // Skip net-downvoted

      const stats = visitStats.find((v: any) => v.votingEventId === votingEvent.id);
      const { visitCount, daysSinceLastVisit } = getVisitStatsUtil(stats);
      const score = calculateVenueScore(qualityScore, visitCount, daysSinceLastVisit);

      scoredVenues.push({
        type: 'voting_event',
        id: votingEvent.id,
        name: votingEvent.title,
        score,
        visitCount,
        daysSinceLastVisit,
        qualityScore,
        venueType: votingEvent.venueType || undefined,
        rating: votingEvent.rating || undefined,
        venueAddress: votingEvent.venueAddress || undefined,
        googlePlaceId: votingEvent.googlePlaceId || undefined,
        latitude: votingEvent.latitude,
        longitude: votingEvent.longitude,
      });
    }

    // Sort by score descending
    scoredVenues.sort((a, b) => b.score - a.score);

    console.log(`[AI Suggestions] ${scoredVenues.length} scored venues available`);

    // Prepare event date (use itinerary date or default to now)
    const eventDate = itinerary.eventDate ? new Date(itinerary.eventDate) : new Date();

    // Find current venue if venueId provided
    let currentVenue: VenueForAgent | undefined;
    if (venueId) {
      currentVenue = scoredVenues.find(v => v.id === venueId);
    }

    // Get existing venues in itinerary (for complements)
    const existingVenues: VenueForAgent[] = [];
    if (itinerary.items && itinerary.items.length > 0) {
      for (const item of itinerary.items) {
        const found = scoredVenues.find(v => v.id === item.sourceId);
        if (found) existingVenues.push(found);
      }
    }

    // Call the appropriate agent function
    const result: { alternatives?: any[]; complements?: any[] } = {};

    if (suggestionType === 'alternatives' || suggestionType === 'both') {
      const alternatives = await suggestAlternativesWithAgent({
        group,
        eventDate,
        availableVenues: scoredVenues,
        currentVenue,
      });
      result.alternatives = alternatives.map(s => ({
        venue: {
          id: s.venue.id,
          name: s.venue.name,
          type: s.venue.type,
          venueType: s.venue.venueType,
          rating: s.venue.rating,
          address: s.venue.venueAddress,
          googlePlaceId: s.venue.googlePlaceId,
          latitude: s.venue.latitude,
          longitude: s.venue.longitude,
        },
        confidence: s.confidence,
        category: s.category,
        replaces: currentVenue?.name,
      }));
    }

    if (suggestionType === 'complements' || suggestionType === 'both') {
      const complements = await suggestComplementsWithAgent({
        group,
        eventDate,
        availableVenues: scoredVenues,
        existingVenues,
      });
      result.complements = complements.map(s => ({
        venue: {
          id: s.venue.id,
          name: s.venue.name,
          type: s.venue.type,
          venueType: s.venue.venueType,
          rating: s.venue.rating,
          address: s.venue.venueAddress,
          googlePlaceId: s.venue.googlePlaceId,
          latitude: s.venue.latitude,
          longitude: s.venue.longitude,
        },
        confidence: s.confidence,
        category: s.category,
      }));
    }

    res.json(result);
  } catch (error: any) {
    console.error("[AI Suggestions] Error:", error);
    res.status(500).json({ message: safeError(error, "Failed to get AI suggestions") });
  }
});

// AI Chat for conversational event planning
// ============================================================================

/**
 * Conversational AI assistant for event planning
 * Supports streaming responses via SSE
 */
router.post("/itineraries/:id/ai-chat", isAuthenticated, aiChatLimiter, requireItineraryAccess(), async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const itineraryId = req.params.id;
    const { prompt, sessionId, stream = false } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (prompt.length > 2000) {
      return res.status(400).json({ error: "Prompt too long (max 2000 characters)" });
    }

    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "AI chat is not configured. Please add ANTHROPIC_API_KEY to environment secrets." });
    }

    // Get itinerary (already verified by requireItineraryAccess)
    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary) {
      return res.status(404).json({ error: "Itinerary not found" });
    }

    // Fetch group data to provide context to the AI
    let groupContext = null;
    if (itinerary.groupId) {
      const group = await storage.getGroup(itinerary.groupId);
      if (group) {
        const enabledCategories: string[] = [];
        if (group.mealEnabled !== false) enabledCategories.push('meals');
        if (group.cafeEnabled !== false) enabledCategories.push('cafes');
        if (group.drinksEnabled !== false) enabledCategories.push('drinks');
        if (group.dessertEnabled !== false) enabledCategories.push('dessert');
        if (group.experiencesEnabled !== false) enabledCategories.push('experiences');

        groupContext = {
          name: group.name,
          locationBase: group.locationBase,
          latitude: group.latitude,
          longitude: group.longitude,
          searchRadius: group.searchRadius,
          budgetMin: group.budgetMin,
          budgetMax: group.budgetMax,
          enabledCategories,
          additionalInstructions: group.additionalInstructions,
          timezone: group.timezone
        };
      }
    }

    // Import the agent module
    const { runEventPlanningAgent, streamEventPlanningAgent } = await import("../ai-agent-chat");

    const agentOptions = {
      prompt,
      itineraryId,
      groupId: itinerary.groupId,
      groupContext,
      sessionId
    };

    if (stream) {
      // Set up Server-Sent Events for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const result = await streamEventPlanningAgent(agentOptions, (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
      });

      // Send final message
      res.write(`data: ${JSON.stringify({
        type: "done",
        sessionId: result.sessionId,
        toolsUsed: result.toolsUsed
      })}\n\n`);
      res.end();
    } else {
      // Non-streaming response
      const result = await runEventPlanningAgent(agentOptions);

      res.json({
        response: result.response,
        sessionId: result.sessionId,
        toolsUsed: result.toolsUsed
      });
    }
  } catch (error: any) {
    console.error("[AI Chat] Error:", error);

    // Handle streaming errors
    if (req.body?.stream) {
      res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: safeError(error, "Failed to communicate with AI assistant") });
    }
  }
});

// Auto-populate TBD event with AI-selected venues
router.post("/itineraries/:id/decide-now", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
  try {
    const itineraryId = req.params.id;
    const userId = await getUserId(req);

    console.log('');
    console.log('🎯 ========================================');
    console.log('🎯 DECIDE NOW ENDPOINT CALLED!');
    console.log('🎯 Itinerary ID:', itineraryId);
    console.log('🎯 User ID:', userId);
    console.log('🎯 ========================================');
    console.log('');
    console.log('[Decide Now] Starting venue selection for itinerary:', itineraryId);

    // Get the itinerary
    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    // Get the group
    const group = await storage.getGroup(itinerary.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Use the existing auto-scheduler logic to select best venues
    const { selectBestItineraryForAutoSchedule } = await import('../auto-scheduler');

    const result = await selectBestItineraryForAutoSchedule(
      storage,
      group
    );

    // For backwards compatibility, support both options and itineraryOptions
    const itineraryOptions = result.options || result.itineraryOptions || [];

    if (!result || itineraryOptions.length === 0) {
      return res.status(500).json({
        message: "Hmm, we're struggling to find suitable venues for this one. While we think about it, feel free to manually add some spots you have in mind!"
      });
    }

    const usedAI = result.usedAI !== false; // Default to true if not specified

    console.log('[Decide Now] Venue selection complete:', {
      usedAI,
      optionCount: itineraryOptions.length,
      topOptionVenues: itineraryOptions[0]?.venues.length || 0
    });

    // Get the top option (best selected itinerary)
    const topOption = itineraryOptions[0];

    if (!topOption || !topOption.venues || topOption.venues.length === 0) {
      return res.status(500).json({
        message: "No suitable venues found. Try adding more activities or favorites to this group."
      });
    }

    // Create itinerary items from the selected venues. These are inherited from existing
    // activity/voting_event rows (already vetted upstream), so mark trust state accordingly.
    const inheritedTrust = trustFieldsForSource('inherited');
    const items = topOption.venues.map((venue: any, index: number) => ({
      itineraryId,
      venueName: venue.venueName,
      venueType: venue.venueType || venue.category || 'venue',
      venueAddress: venue.venueAddress || venue.address,
      photoUrl: venue.photoUrl,
      rating: venue.rating,
      googlePlaceId: venue.googlePlaceId || venue.placeId,
      notes: venue.reasoning || null,
      googleMapsUrl: venue.googleMapsUrl || venue.mapsUrl ||
        (venue.googlePlaceId ? `https://www.google.com/maps/place/?q=place_id:${venue.googlePlaceId}` : null),
      sourceType: venue.sourceType || 'activity',
      sourceId: venue.sourceId || venue.activityId || venue.votingEventId,
      orderIndex: index,
      arrivalTime: null,
      departureTime: null,
      travelNotes: null,
      ...inheritedTrust,
    }));

    // Clear existing items and add new ones
    const existingItems = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, itineraryId));

    if (existingItems.length > 0) {
      await db
        .delete(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itineraryId));
    }

    // Insert new items
    await db.insert(itineraryItems).values(items);

    // Update itinerary name if it's generic
    const itineraryName = itinerary.name || '';
    if (itineraryName.includes('Auto-scheduled') || itineraryName.includes('TBD')) {
      const venueSummary = items.map((v: any) => v.venueName).join(', ');
      const newName = items.length === 0
        ? 'Event'
        : items.length === 1
          ? items[0].venueName
          : `${items[0].venueName} + ${items.length - 1} more`;

      await storage.updateItinerary(itineraryId, {
        name: newName.length > 100 ? newName.substring(0, 97) + '...' : newName
      });
    }

    console.log('[Decide Now] Successfully populated', items.length, 'venues');

    // Return the updated itinerary with items
    const updatedItinerary = await storage.getItinerary(itineraryId);
    const updatedItems = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, itineraryId))
      .orderBy(itineraryItems.orderIndex);

    // Friendly messages based on selection method
    let successMessage: string;
    if (usedAI) {
      successMessage = `AI selected ${items.length} venue${items.length > 1 ? 's' : ''} for your event`;
    } else {
      successMessage = "We had trouble getting AI's picks this time, so we went with our backup venue selection! Feel free to regenerate if you want AI to take another shot.";
    }

    res.json({
      itinerary: updatedItinerary,
      items: updatedItems,
      venueCount: items.length,
      reasoning: topOption.reasoning || topOption.description || 'Selected venues based on your group preferences and visit history',
      usedAI,
      message: successMessage,
    });

  } catch (error: any) {
    console.error('[Decide Now] Error:', error);
    console.error('[Decide Now] Error stack:', error.stack);
    console.error('[Decide Now] Error details:', {
      message: error.message,
      itineraryId: req.params.id,
      errorType: error.constructor.name
    });
    res.status(500).json({
      message: error.message || "We hit a snag. Mind giving it another try?",
      errorDetails: error.message
    });
  }
});

// Get AI-suggested time for an itinerary
router.post("/itineraries/:id/suggest-time", isAuthenticated, async (req, res) => {
  try {
    const itinerary = await storage.getItinerary(req.params.id);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    const group = await storage.getGroup(itinerary.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Get member constraints if any
    const members = await storage.getGroupMembers(group.id);
    const memberConstraints = members
      .filter(m => m.memberConstraints)
      .map(m => {
        const constraints = m.memberConstraints;
        const parts: string[] = [];
        if (constraints && typeof constraints === 'object' && 'scheduleConflicts' in constraints) {
          const sc = (constraints as {scheduleConflicts?: string[]}).scheduleConflicts;
          if (sc) parts.push(`Not available ${sc.join(', ')}`);
        }
        if (constraints && typeof constraints === 'object' && 'notes' in constraints) {
          const notes = (constraints as {notes?: string}).notes;
          if (notes) parts.push(notes);
        }
        return parts.join('; ');
      })
      .filter(Boolean);

    // Prepare venues for AI
    // Prefer venues from request body (current cart state) over saved itinerary venues
    let venues;
    if (req.body.venues && Array.isArray(req.body.venues) && req.body.venues.length > 0) {
      venues = req.body.venues;

    } else {
      venues = itinerary.items.map((item: ItineraryItem) => ({
        name: item.venueName,
        type: item.venueType,
      }));

    }

    const { suggestMultipleTimeOptions, convertAvailabilityToString } = await import('../ai-time-picker');

    // Convert availability object to natural language string
    const availabilityString = convertAvailabilityToString(group.availability);

    const result = await suggestMultipleTimeOptions({
      generalAvailability: availabilityString,
      venues,
      memberConstraints: memberConstraints.length > 0 ? memberConstraints : undefined,
      location: group.locationBase, // Pass location for timezone detection
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Suggest Time] Error:', error);
    res.status(500).json({ message: safeError(error) });
  }
});

// Get AI-suggested schedule for an itinerary
router.get("/itineraries/:id/suggested-schedule", isAuthenticated, async (req, res) => {
  try {
    const itinerary = await storage.getItinerary(req.params.id);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    // Get group info for member count
    const group = await storage.getGroup(itinerary.groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const members = await storage.getGroupMembers(itinerary.groupId);
    const groupSize = members.length || 2; // Default to 2 if no members

    // Prepare venue info for AI
    const venueInfo = itinerary.items.map((item: ItineraryItem) => ({
      name: item.venueName || 'Venue',
      type: item.venueType,
      requiresReservation: item.venueType.toLowerCase().includes('fine') ||
                           item.venueType.toLowerCase().includes('upscale'),
    }));

    const { generateScheduleConfig } = await import('../ai-scheduling');
    const scheduleConfig = await generateScheduleConfig(venueInfo, groupSize);

    res.json(scheduleConfig);
  } catch (error: any) {
    res.status(500).json({ message: safeError(error) });
  }
});

export default router;
