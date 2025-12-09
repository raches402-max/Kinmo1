import { IStorage } from "./storage";
import type { Group, Itinerary, Activity, VotingEvent } from "@shared/schema";
import { addDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { db } from "./db";
import { venueVisitHistory, rejectedEventDates, autoScheduledEvents, itineraries } from "@shared/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { selectVenuesWithAI, type VenueForSelection } from "./ai-venue-selector";
import { planEventWithAgent, type VenueForAgent } from "./ai-event-agent";
import {
  calculateQualityScore,
  calculateVotingEventQuality,
  calculateVenueScore,
  shouldSkipVenue,
  getVisitStats,
} from "./venue-scoring-utils";
import { orderVenuesLogically } from "./venue-ordering-utils";
import { selectDiverseVenues, getVenueCategory } from "./venue-diversity-utils";
import { calculateAdaptiveTimeline, calculateInviteSendDate } from "./adaptive-timeline";

/**
 * Hash a string to a 32-bit integer for PostgreSQL advisory locks
 * Uses a simple hash function that's consistent across runs
 */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Determine the best default time for an event based on group availability
 * Returns an hour (0-23) in the group's local timezone
 */
function getDefaultEventTime(group: Group): number {
  const availability = group.availability as Record<string, { morning?: boolean; afternoon?: boolean; evening?: boolean }> | null;

  if (!availability) {
    return 19; // Default to 7:00 PM if no availability data
  }

  // Count preferences across all days
  let morningCount = 0;
  let afternoonCount = 0;
  let eveningCount = 0;

  for (const day of Object.values(availability)) {
    if (day.morning) morningCount++;
    if (day.afternoon) afternoonCount++;
    if (day.evening) eveningCount++;
  }

  // Determine primary time preference
  const maxCount = Math.max(morningCount, afternoonCount, eveningCount);

  if (maxCount === 0) {
    // No preferences set - default to evening
    return 18; // 6:00 PM
  }

  // Return time based on preference (using most common preference)
  if (eveningCount === maxCount) {
    return 18; // 6:00 PM - most common for social events
  } else if (afternoonCount === maxCount) {
    return 14; // 2:00 PM
  } else {
    return 10; // 10:00 AM
  }
}

/**
 * Get visit statistics for all venues in a group
 */
export async function getVenueVisitStats(groupId: string) {
  const visits = await db.select({
    activityId: venueVisitHistory.activityId,
    votingEventId: venueVisitHistory.votingEventId,
    count: sql<number>`count(*)`.as('count'),
    lastVisit: sql<Date>`max(visited_at)`.as('last_visit'),
  })
  .from(venueVisitHistory)
  .where(eq(venueVisitHistory.groupId, groupId))
  .groupBy(venueVisitHistory.activityId, venueVisitHistory.votingEventId);

  return visits;
}

/**
 * Generate badges explaining why a venue was selected
 */
function generateVenueBadges(
  qualityScore: number,
  visitCount: number,
  daysSinceLastVisit: number,
  feedback?: string | null
): string[] {
  const badges: string[] = [];

  // Quality badges
  if (feedback === 'favorite') {
    badges.push('🌟 Group favorite');
  } else if (qualityScore >= 2.5) {
    badges.push('⭐ Highly rated');
  }

  // Visit frequency badges
  if (visitCount === 0) {
    badges.push('✨ New spot');
  } else if (visitCount === 1 && qualityScore >= 2) {
    badges.push('🔄 Worth going back');
  } else if (daysSinceLastVisit >= 60) {
    badges.push('📅 Been a while');
  }

  // Recency badge
  if (daysSinceLastVisit < 30 && visitCount > 0) {
    badges.push('🆕 Recent visit');
  }

  return badges;
}

/**
 * Generate Google Maps URL from venue data
 */
function generateGoogleMapsUrl(googlePlaceId?: string | null, venueName?: string | null, venueAddress?: string | null): string | null {
  if (googlePlaceId) {
    return `https://www.google.com/maps/place/?q=place_id:${googlePlaceId}`;
  } else if (venueName && venueAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueName}, ${venueAddress}`)}`;
  }
  return null;
}

// Venue ordering and diversity functions moved to utilities:
// - orderVenuesLogically() → venue-ordering-utils.ts
// - selectDiverseVenues() → venue-diversity-utils.ts

/**
 * Calculate optimal venue count based on venue categories and time requirements
 * Returns 1-3 venues depending on the types of venues being suggested
 */
function calculateOptimalVenueCount(venues: Array<{
  category?: string | null;
  timeCategory?: string | null;
  venueType?: string | null;
}>): number {
  if (venues.length === 0) return 0;
  if (venues.length === 1) return 1;

  // Analyze venue categories and time requirements
  const categories = venues.map(v => v.category?.toLowerCase() || '');
  const timeCategories = venues.map(v => v.timeCategory?.toLowerCase() || '');
  const venueTypes = venues.map(v => v.venueType?.toLowerCase() || '');

  // Check if any venue is "large" (4+ hours) - if so, limit to 1-2 venues
  const hasLargeActivity = timeCategories.some(tc => tc === 'large');
  if (hasLargeActivity) {
    return Math.min(2, venues.length);
  }

  // Check if meal-focused (restaurants, dining)
  const hasMeal = categories.some(c => c === 'meal') ||
                  venueTypes.some(vt => vt.includes('restaurant') || vt.includes('dining'));
  if (hasMeal) {
    // Meals typically need 1-2 venues (dinner, maybe dessert)
    return Math.min(2, venues.length);
  }

  // Check if drinks-focused (bars, breweries)
  const hasDrinks = categories.some(c => c === 'drinks') ||
                    venueTypes.some(vt => vt.includes('bar') || vt.includes('brewery') || vt.includes('pub'));
  if (hasDrinks) {
    // Bar crawls can do 2-3 venues
    return Math.min(3, venues.length);
  }

  // Check if cafe/dessert focused
  const hasCafeOrDessert = categories.some(c => c === 'cafes' || c === 'dessert') ||
                           venueTypes.some(vt => vt.includes('cafe') || vt.includes('coffee') || vt.includes('dessert'));
  if (hasCafeOrDessert) {
    return Math.min(2, venues.length);
  }

  // Default for experiences or mixed: 1-2 venues
  return Math.min(2, venues.length);
}

/**
 * Smart itinerary selection with visit frequency tracking
 * NOW GENERATES UP TO 3 DISTINCT ITINERARY OPTIONS
 * Scores venues based on: Quality (feedback) × Recency × Frequency
 * Ensures fair rotation through all available venues
 * Dynamically adjusts venue count per option based on venue categories
 */
export async function selectBestItineraryForAutoSchedule(
  storage: IStorage,
  group: Group
): Promise<{
  itineraryId?: string;
  selectedVenues?: Array<{ sourceType: 'activity' | 'voting_event', sourceId: string }>;
  usedAI?: boolean;
  options?: Array<{
    optionNumber: number;
    venues: Array<{
      sourceType: 'activity' | 'voting_event';
      sourceId: string;
      venueName: string;
      badges: string[];
    }>;
    description: string;
    nearbySuggestions?: any[];
  }>;
  itineraryOptions?: Array<any>; // For backwards compatibility
}> {

  console.log(`[Selection] Starting venue selection for group ${group.name}`);

  // Get all available venues (activities + voting events)
  const activities = await storage.getGroupActivities(group.id);
  const votingEvents = await storage.getGroupVotingEvents(group.id);

  console.log(`[Selection] Found ${activities.length} activities, ${votingEvents.length} voting events`);

  // Get visit history
  const visitStats = await getVenueVisitStats(group.id);
  console.log(`[Selection] ${visitStats.length} venues have visit history`);

  // Get venues already scheduled in upcoming events (to avoid duplicates)
  const { itineraryItems } = await import('../shared/schema');
  const upcomingItineraryVenues = await db
    .select({
      sourceId: itineraryItems.sourceId,
      sourceType: itineraryItems.sourceType,
      venueName: itineraryItems.venueName,
    })
    .from(itineraryItems)
    .innerJoin(itineraries, eq(itineraryItems.itineraryId, itineraries.id))
    .where(
      and(
        eq(itineraries.groupId, group.id),
        gte(itineraries.eventDate, new Date()), // Future events only
        sql`${itineraries.status} IN ('draft', 'proposed', 'scheduled')` // Active events
      )
    );

  const scheduledVenueIds = new Set(upcomingItineraryVenues.map(v => v.sourceId).filter(Boolean));
  console.log(`[Selection] ${scheduledVenueIds.size} venues already scheduled in upcoming events:`,
    upcomingItineraryVenues.map(v => v.venueName).join(', ') || 'none');

  // Score all venues
  type ScoredVenue = {
    type: 'activity' | 'voting_event';
    id: string;
    name: string;
    score: number;
    visitCount: number;
    daysSinceLastVisit: number;
    qualityScore: number;
    feedback?: string | null;
    category?: string | null; // meal, cafes, drinks, dessert, experiences
    timeCategory?: string | null; // quick, standard, large
    venueType?: string | null; // restaurant, bar, etc.
    rating?: string | null;
    venueAddress?: string | null;
    googlePlaceId?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };

  const scoredVenues: ScoredVenue[] = [];
  const now = Date.now();

  // Score activities
  for (const activity of activities) {
    // Skip venues already scheduled in upcoming events
    if (scheduledVenueIds.has(activity.id)) {
      console.log(`[Selection] Skipping ${activity.venueName} - already scheduled in upcoming event`);
      continue;
    }

    // Skip downvoted or closed venues
    if (shouldSkipVenue(activity.businessStatus, activity.feedback)) {
      if (activity.businessStatus === 'CLOSED_PERMANENTLY' || activity.businessStatus === 'CLOSED_TEMPORARILY') {
        console.log(`[Selection] Skipping ${activity.venueName} - ${activity.businessStatus}`);
      }
      continue;
    }

    // Quality score from feedback
    const qualityScore = calculateQualityScore(activity.feedback);

    // Visit stats
    const stats = visitStats.find(v => v.activityId === activity.id);
    const { visitCount, daysSinceLastVisit } = getVisitStats(stats);

    // Final score
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

  // Get votes for all voting events to calculate quality scores
  const voteCounts = await Promise.all(
    votingEvents.map(async (ve) => {
      const votes = await storage.getEventVotes(ve.id);
      const upvotes = votes.filter(v => v.voteType === 'upvote').length;
      const downvotes = votes.filter(v => v.voteType === 'downvote').length;
      return { id: ve.id, upvotes, downvotes, netVotes: upvotes - downvotes };
    })
  );

  // Score voting events
  for (const votingEvent of votingEvents) {
    // Skip venues already scheduled in upcoming events
    if (scheduledVenueIds.has(votingEvent.id)) {
      console.log(`[Selection] Skipping ${votingEvent.title} - already scheduled in upcoming event`);
      continue;
    }

    const voteCount = voteCounts.find(vc => vc.id === votingEvent.id);
    const upvotes = voteCount?.upvotes || 0;
    const downvotes = voteCount?.downvotes || 0;
    const netVotes = voteCount?.netVotes || 0;

    // Calculate quality score (returns -1 if net downvotes)
    const qualityScore = calculateVotingEventQuality(upvotes, downvotes);

    // Skip if downvoted more than upvoted
    if (qualityScore === -1) {
      console.log(`[Selection] Skipping ${votingEvent.title} - net downvotes: ${netVotes}`);
      continue;
    }

    // Visit stats
    const stats = visitStats.find(v => v.votingEventId === votingEvent.id);
    const { visitCount, daysSinceLastVisit } = getVisitStats(stats);

    // Final score
    const score = calculateVenueScore(qualityScore, visitCount, daysSinceLastVisit);

    scoredVenues.push({
      type: 'voting_event',
      id: votingEvent.id,
      name: votingEvent.title,
      score,
      visitCount,
      daysSinceLastVisit,
      qualityScore,
      feedback: upvotes >= 3 ? 'favorite' : null, // Mark as favorite if 3+ upvotes
      category: null, // Voting events don't have category/timeCategory
      timeCategory: null,
      venueType: votingEvent.venueType,
      rating: votingEvent.rating,
      venueAddress: votingEvent.venueAddress,
      googlePlaceId: votingEvent.googlePlaceId,
      latitude: votingEvent.latitude,
      longitude: votingEvent.longitude,
    });
  }

  // Sort by score (highest first)
  scoredVenues.sort((a, b) => b.score - a.score);

  // Log top 10 for debugging
  console.log(`[Selection] Top 10 scored venues:`);
  scoredVenues.slice(0, 10).forEach((v, i) => {
    console.log(`  ${i+1}. ${v.name} (${v.type})`);
    console.log(`     Score: ${v.score.toFixed(2)}, Visits: ${v.visitCount}, Days since: ${v.daysSinceLastVisit.toFixed(0)}, Quality: ${v.qualityScore}`);
  });

  // **NEW: Prioritize Favorites when available**
  // Separate favorites (voting_events) from other venues
  const favoriteVenues = scoredVenues.filter(v => v.type === 'voting_event');
  const suitableFavorites = favoriteVenues.filter(v =>
    v.daysSinceLastVisit >= 60 || v.visitCount === 0  // Not visited recently
  );

  console.log(`[Selection] Found ${favoriteVenues.length} total favorites, ${suitableFavorites.length} suitable (not recently visited)`);

  // ============================================================================
  // TRY AI AGENT SELECTION FIRST (falls back to old AI, then algorithmic)
  // ============================================================================
  if (scoredVenues.length >= 1) {
    console.log('[Selection] Attempting AI agent venue selection...');

    // Try new AI agent first (now selects 1 primary venue)
    const agentResult = await planEventWithAgent({
      group,
      eventDate: new Date(), // TODO: Pass actual event date when available
      availableVenues: scoredVenues as VenueForAgent[],
      constraints: {
        maxDistanceMiles: 5,
        minConfidence: 75,
        desiredVenueCount: 1, // Select 1 primary venue
      },
    });

    if (agentResult && agentResult.selectedVenues.length >= 1) {
      console.log(`[Selection] ✅ Agent selected ${agentResult.selectedVenues.length} venue(s)`);
      console.log(`[Selection] Agent confidence: ${agentResult.confidence}%`);
      console.log(`[Selection] Agent reasoning: ${agentResult.reasoning}`);

      const primaryVenue = agentResult.selectedVenues[0];
      const isFavorite = primaryVenue.type === 'voting_event';

      console.log(`[Selection] Primary venue: ${primaryVenue.name} (${isFavorite ? 'Favorite' : 'Activity'})`);

      // Find nearby complementary venues (within context-aware distance)
      const { findNearbyVenues, getDistanceThreshold } = await import('./venue-distance-utils');
      const distanceThreshold = getDistanceThreshold(group);

      console.log(`[Selection] Distance threshold for this group: ${distanceThreshold} miles`);
      console.log(`[Selection] Primary venue coords: lat=${primaryVenue.latitude}, lon=${primaryVenue.longitude}`);

      // Filter out the primary venue and find nearby options
      const otherVenues = scoredVenues.filter(v => v.id !== primaryVenue.id);
      console.log(`[Selection] Searching ${otherVenues.length} other venues for nearby options`);

      const nearbyVenues = findNearbyVenues(primaryVenue, otherVenues, distanceThreshold);

      console.log(`[Selection] Found ${nearbyVenues.length} venues within ${distanceThreshold} miles`);
      if (nearbyVenues.length > 0) {
        nearbyVenues.slice(0, 5).forEach(v => {
          console.log(`  - ${v.name} (${v.distance.toFixed(2)} mi away)`);
        });
      }

      // Get different category venues (if dinner, suggest bars/dessert)
      const primaryCategory = getVenueCategory(primaryVenue);
      console.log(`[Selection] Primary venue category: ${primaryCategory}`);

      const complementaryVenues = nearbyVenues
        .filter(v => {
          const category = getVenueCategory(v);
          const isComplementary = category !== primaryCategory;
          if (!isComplementary) {
            console.log(`  - Skipping ${v.name} (same category: ${category})`);
          }
          return isComplementary;
        })
        .slice(0, 3); // Maximum 3 suggestions

      console.log(`[Selection] Found ${complementaryVenues.length} complementary venues (different category from ${primaryCategory})`);

      // SIMPLIFIED OUTPUT: 1 primary venue + optional nearby suggestions
      return {
        selectedVenues: [{
          sourceType: primaryVenue.type,
          sourceId: primaryVenue.id,
        }],
        usedAI: true,
        options: [{
          optionNumber: 1,
          venues: [{
            sourceType: primaryVenue.type,
            sourceId: primaryVenue.id,
            venueName: primaryVenue.name,
            badges: [
              isFavorite ? '⭐ From Favorites' : '🤖 Agent Selected',
              ...generateVenueBadges(primaryVenue.qualityScore, primaryVenue.visitCount, primaryVenue.daysSinceLastVisit, primaryVenue.feedback)
            ],
          }],
          description: agentResult.flow || `${isFavorite ? 'From your Favorites' : 'Perfect for tonight'}`,
          nearbySuggestions: complementaryVenues.map(v => ({
            sourceType: v.type,
            sourceId: v.id,
            venueName: v.name,
            distance: v.distance,
            walkingTime: Math.round(v.distance * 20), // ~20 min per mile walking
            category: getVenueCategory(v),
            badges: [
              v.type === 'voting_event' ? '⭐ Favorite' : '💡 Nearby',
              `${v.distance.toFixed(1)} mi away`,
              ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)
            ],
            rating: v.rating,
            venueAddress: v.venueAddress,
            googleMapsUrl: generateGoogleMapsUrl(v.googlePlaceId, v.name, v.venueAddress),
          })),
        }],
      };
    } else {
      console.log('[Selection] ⚠️  Agent failed, trying fallback AI selector...');

      // Fallback to old AI selector
      const aiResult = await selectVenuesWithAI(
        scoredVenues as VenueForSelection[],
        group.name,
        new Date(),
        3
      );

      if (aiResult && aiResult.selectedVenues.length >= 2) {
        console.log(`[Selection] ✅ Fallback AI selected ${aiResult.selectedVenues.length} venues`);
        console.log(`[Selection] AI reasoning: ${aiResult.reasoning}`);

        const orderedVenues = orderVenuesLogically(aiResult.selectedVenues);

        return {
          selectedVenues: orderedVenues.map(v => ({
            sourceType: v.type,
            sourceId: v.id,
          })),
          usedAI: true,
          options: [{
            optionNumber: 1,
            venues: orderedVenues.map(v => {
              const primaryBadge = v.type === 'voting_event' ? '⭐ From Favorites' : '🤖 AI Selected';
              return {
                sourceType: v.type,
                sourceId: v.id,
                venueName: v.name,
                badges: [primaryBadge, ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)],
                rating: v.rating,
                venueAddress: v.venueAddress,
                googleMapsUrl: generateGoogleMapsUrl(v.googlePlaceId, v.name, v.venueAddress),
              };
            }),
            description: aiResult.itineraryFlow || 'AI-curated itinerary',
          }],
        };
      } else {
        console.log('[Selection] ⚠️  Both agent and AI failed, falling back to algorithmic selection');
      }
    }
  }

  // ============================================================================
  // FALLBACK: Algorithmic Selection (original logic)
  // ============================================================================

  // If we have ≥3 suitable Favorites, use ONLY Favorites (1 smart itinerary, not 3 options)
  if (suitableFavorites.length >= 3) {
    console.log(`[Selection] Using Favorites-only mode (${suitableFavorites.length} available)`);

    // Rank favorites by score
    suitableFavorites.sort((a, b) => b.score - a.score);

    // Determine optimal count based on top favorites
    const optimalCount = calculateOptimalVenueCount(suitableFavorites.slice(0, 5));
    const finalCount = Math.min(optimalCount, suitableFavorites.length);

    console.log(`[Selection] Creating 1 itinerary with ${finalCount} diverse venues from Favorites`);

    // Select diverse venues (no duplicate categories when possible)
    const selectedFavorites = selectDiverseVenues(suitableFavorites, finalCount);

    // Apply smart ordering (dinner before dessert, etc.)
    const orderedFavorites = orderVenuesLogically(selectedFavorites);

    return {
      selectedVenues: orderedFavorites.map(v => ({
        sourceType: v.type,
        sourceId: v.id,
      })),
      usedAI: false, // Algorithmic fallback
      options: [{
        optionNumber: 1,
        venues: orderedFavorites.map(v => ({
          sourceType: v.type,
          sourceId: v.id,
          venueName: v.name,
          badges: ['⭐ From Favorites', ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)],
          rating: v.rating,
          venueAddress: v.venueAddress,
          googleMapsUrl: generateGoogleMapsUrl(v.googlePlaceId, v.name, v.venueAddress),
        })),
        description: 'From your Favorites list',
      }],
    };
  }

  // If we have 1-2 suitable Favorites, create hybrid itinerary (Favorites + AI gap-fillers)
  if (suitableFavorites.length >= 1 && suitableFavorites.length < 3) {
    console.log(`[Selection] Using hybrid mode (${suitableFavorites.length} Favorites + AI gap-fillers)`);

    // Start with sorted Favorites
    suitableFavorites.sort((a, b) => b.score - a.score);

    // Take all suitable Favorites
    const selectedFavorites = suitableFavorites;

    // Get AI suggestions (activities) to fill gaps
    const activityVenues = scoredVenues.filter(v => v.type === 'activity');
    const neededCount = Math.max(0, 3 - selectedFavorites.length);
    const gapFillers = activityVenues.slice(0, neededCount);

    console.log(`[Selection] Combining ${selectedFavorites.length} Favorites + ${gapFillers.length} AI suggestions`);

    // Combine and order logically
    const hybridVenues = orderVenuesLogically([...selectedFavorites, ...gapFillers]);

    return {
      selectedVenues: hybridVenues.map(v => ({
        sourceType: v.type,
        sourceId: v.id,
      })),
      usedAI: false, // Algorithmic fallback
      options: [{
        optionNumber: 1,
        venues: hybridVenues.map(v => {
          // Different badges for Favorites vs AI suggestions
          const primaryBadge = v.type === 'voting_event' ? '⭐ From Favorites' : '✨ AI Suggestion';
          return {
            sourceType: v.type,
            sourceId: v.id,
            venueName: v.name,
            badges: [primaryBadge, ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)],
            rating: v.rating,
            venueAddress: v.venueAddress,
            googleMapsUrl: generateGoogleMapsUrl(v.googlePlaceId, v.name, v.venueAddress),
          };
        }),
        description: 'From Favorites + AI suggestions',
      }],
    };
  }

  // If 0 suitable Favorites, fall back to original 3-option flow mixing all venues
  console.log(`[Selection] Using standard 3-option mode (only ${suitableFavorites.length} suitable Favorites)`);

  // Need at least 3 venues to create meaningful options
  if (scoredVenues.length < 3) {
    console.log(`[Selection] Not enough venues for multiple options (need 3+, found ${scoredVenues.length})`);

    // Fall back: return single set of venues using smart count
    if (scoredVenues.length >= 1) {
      const count = calculateOptimalVenueCount(scoredVenues);
      const selected = scoredVenues
        .slice(0, count)
        .map(v => ({
          sourceType: v.type,
          sourceId: v.id,
        }));
      console.log(`[Selection] Fallback: Using ${count} venue(s) for single option`);
      return { selectedVenues: selected, usedAI: false };
    }

    return { usedAI: false };
  }

  // Generate up to 3 distinct itinerary options
  const options = [];

  // Option 1: Top-scoring venues (safe bet) with category diversity
  const option1Count = calculateOptimalVenueCount(scoredVenues.slice(0, 5)); // Check top 5 for category mix
  const option1VenuesRaw = selectDiverseVenues(scoredVenues, option1Count); // Ensure category diversity
  const option1Venues = orderVenuesLogically(option1VenuesRaw); // Apply smart ordering
  console.log(`[Selection] Option 1: Using ${option1Venues.length} diverse venues`);

  options.push({
    optionNumber: 1,
    venues: option1Venues.map(v => {
      const sourceBadge = v.type === 'voting_event' ? '⭐ From Favorites' : '✨ AI Suggestion';
      return {
        sourceType: v.type,
        sourceId: v.id,
        venueName: v.name,
        badges: [sourceBadge, ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)],
        rating: v.rating,
        venueAddress: v.venueAddress,
        googleMapsUrl: generateGoogleMapsUrl(v.googlePlaceId, v.name, v.venueAddress),
      };
    }),
    description: 'The usual spots - places you go to pretty often',
  });

  // Option 2: Mix of favorites and new experiences (balanced)
  const favorites = scoredVenues.filter(v => v.feedback === 'favorite' || v.qualityScore >= 2.5);
  const neverVisited = scoredVenues.filter(v => v.visitCount === 0);

  let option2Venues: ScoredVenue[] = [];
  if (favorites.length > 0 && neverVisited.length > 0) {
    // Mix favorites with new venues - build candidate pool
    const mixedCandidates = [...favorites, ...neverVisited];
    const option2Count = calculateOptimalVenueCount(mixedCandidates.slice(0, 5));

    // Select diverse venues from the mixed pool
    option2Venues = selectDiverseVenues(mixedCandidates, option2Count);
  } else {
    // Fall back to venues after Option 1
    const startIdx = option1Venues.length; // Start where Option 1 ended
    const candidates = scoredVenues.slice(startIdx, startIdx + 10);
    const option2Count = calculateOptimalVenueCount(candidates.slice(0, 5));
    option2Venues = selectDiverseVenues(candidates, option2Count);
  }

  // Apply smart ordering to Option 2
  const option2VenuesOrdered = orderVenuesLogically(option2Venues);

  console.log(`[Selection] Option 2: Using ${option2VenuesOrdered.length} venues`);

  options.push({
    optionNumber: 2,
    venues: option2VenuesOrdered.map(v => {
      const sourceBadge = v.type === 'voting_event' ? '⭐ From Favorites' : '✨ AI Suggestion';
      return {
        sourceType: v.type,
        sourceId: v.id,
        venueName: v.name,
        badges: [sourceBadge, ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)],
        rating: v.rating,
        venueAddress: v.venueAddress,
        googleMapsUrl: generateGoogleMapsUrl(v.googlePlaceId, v.name, v.venueAddress),
      };
    }),
    description: 'Some favorites mixed with a few new places',
  });

  // Option 3: Adventure option (ensure NO overlap with Option 1)
  // Track venues already used in Option 1 to prevent duplicates
  const usedVenueIds = new Set(option1Venues.map(v => v.id));

  const oldFavorites = scoredVenues.filter(v =>
    v.visitCount > 0 &&
    v.daysSinceLastVisit >= 60 &&
    v.qualityScore >= 2 &&
    !usedVenueIds.has(v.id) // CRITICAL: Skip if already in Option 1
  );

  // Get never-visited that aren't in Option 1
  const neverVisitedForOption3 = neverVisited.filter(v => !usedVenueIds.has(v.id));

  let option3Venues: ScoredVenue[] = [];
  let option3Description = '';

  if (oldFavorites.length >= 1) {
    // Revisit old favorites with category diversity
    const option3Count = calculateOptimalVenueCount(oldFavorites.slice(0, 5));
    option3Venues = selectDiverseVenues(oldFavorites, option3Count);
    option3Description = 'Places you haven\'t been to in a while';
  } else if (neverVisitedForOption3.length >= 1) {
    // New venues NOT in Option 1 with category diversity
    const option3Count = calculateOptimalVenueCount(neverVisitedForOption3.slice(0, 5));
    option3Venues = selectDiverseVenues(neverVisitedForOption3, option3Count);
    option3Description = 'All new places - haven\'t tried any of these yet';
  } else {
    // Fall back to venues way down the list (after Options 1 & 2)
    const candidates = scoredVenues.filter(v => !usedVenueIds.has(v.id)).slice(0, 10);
    if (candidates.length >= 1) {
      const option3Count = calculateOptimalVenueCount(candidates.slice(0, 5));
      option3Venues = selectDiverseVenues(candidates, option3Count);
      option3Description = 'A different mix of places';
    }
  }

  // Only add Option 3 if we found distinct venues
  if (option3Venues.length > 0) {
    // Apply smart ordering to Option 3
    const option3VenuesOrdered = orderVenuesLogically(option3Venues);

    console.log(`[Selection] Option 3: Using ${option3VenuesOrdered.length} venues (${option3Description.split(' - ')[0]})`);
    options.push({
      optionNumber: 3,
      venues: option3VenuesOrdered.map(v => {
        const sourceBadge = v.type === 'voting_event' ? '⭐ From Favorites' : '✨ AI Suggestion';
        return {
          sourceType: v.type,
          sourceId: v.id,
          venueName: v.name,
          badges: [sourceBadge, ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)],
          rating: v.rating,
          venueAddress: v.venueAddress,
          googleMapsUrl: generateGoogleMapsUrl(v.googlePlaceId, v.name, v.venueAddress),
        };
      }),
      description: option3Description,
    });
  } else {
    console.log(`[Selection] Skipping Option 3 - not enough distinct venues`);
  }

  console.log(`[Selection] Generated ${options.length} itinerary option(s)`);
  options.forEach((opt, i) => {
    console.log(`  Option ${i+1}: ${opt.description}`);
    opt.venues.forEach(v => console.log(`    - ${v.venueName} ${v.badges.join(' ')}`));
  });

  return { options, usedAI: false }; // Algorithmic fallback
}

/**
 * Calculate next event due date based on meeting frequency
 * Format: "2x week", "1x month", etc.
 * Also handles legacy formats: "weekly", "biweekly", "monthly", "1-week", "2-month"
 */
export function calculateNextEventDueDate(lastEventDate: Date, meetingFrequency: string): Date {
  // Normalize legacy formats to new format
  let normalizedFreq = meetingFrequency;
  
  if (meetingFrequency === "weekly") {
    normalizedFreq = "1x week";
  } else if (meetingFrequency === "biweekly") {
    normalizedFreq = "2x week";
  } else if (meetingFrequency === "monthly") {
    normalizedFreq = "1x month";
  } else if (meetingFrequency === "flexible") {
    normalizedFreq = "1x month";
  } else if (meetingFrequency.includes("-")) {
    // Convert old format "2-week" to new format "2x week"
    normalizedFreq = meetingFrequency.replace("-", "x ");
  }
  
  // Parse frequency format: "{number}x {unit}"
  // Examples: "1x week", "2x month", "1x day"
  const match = normalizedFreq.match(/^(\d+)x\s+(\w+)$/);
  
  if (!match) {
    // Default to 30 days if format is unexpected
    console.warn(`Unrecognized meeting frequency format: "${meetingFrequency}", defaulting to 30 days`);
    return addDays(lastEventDate, 30);
  }

  const [, countStr, unit] = match;
  const count = parseInt(countStr, 10);

  // Calculate interval in days
  let intervalDays: number;
  switch (unit) {
    case 'day':
    case 'days':
      intervalDays = 1 / count; // If "2x day", meet every 0.5 days
      break;
    case 'week':
    case 'weeks':
      intervalDays = 7 / count; // If "2x week", meet every 3.5 days
      break;
    case 'month':
    case 'months':
      intervalDays = 30 / count; // If "2x month", meet every 15 days
      break;
    case 'year':
    case 'years':
      intervalDays = 365 / count; // If "1x year", meet every 365 days
      break;
    default:
      intervalDays = 30; // Default to monthly
  }

  return addDays(lastEventDate, Math.round(intervalDays));
}

/**
 * Calculate the next N future event dates for a recurring group
 * Used to display virtual/placeholder events on the home page
 * Now with smart time selection based on group availability!
 */
export function calculateFutureEventDates(
  nextEventDueDate: Date,
  meetingFrequency: string,
  count: number,
  group?: Group
): Date[] {
  const futureDates: Date[] = [];
  let currentDate = new Date(nextEventDueDate);

  // Determine the best default time based on group availability
  const defaultHour = group ? getDefaultEventTime(group) : 19; // Default to 7 PM
  const timezone = group?.timezone || 'America/Los_Angeles'; // Default to PST

  // Log warning if timezone is missing - helps identify geocoding failures
  if (!group?.timezone) {
    console.warn(`[Auto-scheduler] Group ${group?.id || 'unknown'} has no timezone set, defaulting to America/Los_Angeles`);
  }

  for (let i = 0; i < count; i++) {
    // Create a date with just the date part (no weird times!)
    const dateOnly = new Date(currentDate);
    dateOnly.setHours(0, 0, 0, 0);

    // Set the time in the group's timezone
    const year = dateOnly.getFullYear();
    const month = dateOnly.getMonth();
    const day = dateOnly.getDate();

    // Create a date string in the group's timezone at the preferred time
    const localDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(defaultHour).padStart(2, '0')}:00:00`;

    // Convert to UTC for storage
    const utcDate = fromZonedTime(localDateString, timezone);

    futureDates.push(utcDate);

    // Calculate the next occurrence
    currentDate = calculateNextEventDueDate(currentDate, meetingFrequency);
  }

  return futureDates;
}

/**
 * Calculate cadence in days from meeting frequency string
 * Examples: "2x week" = 3.5 days, "1x month" = 30 days
 */
export function calculateCadenceInDays(meetingFrequency: string): number {
  // Normalize legacy formats to new format
  let normalizedFreq = meetingFrequency;

  if (meetingFrequency === "weekly") {
    normalizedFreq = "1x week";
  } else if (meetingFrequency === "biweekly") {
    normalizedFreq = "2x week";
  } else if (meetingFrequency === "monthly") {
    normalizedFreq = "1x month";
  } else if (meetingFrequency === "flexible") {
    normalizedFreq = "1x month";
  } else if (meetingFrequency.includes("-")) {
    normalizedFreq = meetingFrequency.replace("-", "x ");
  }

  const match = normalizedFreq.match(/^(\d+)x\s+(\w+)$/);

  if (!match) {
    return 30; // Default to 30 days
  }

  const [, countStr, unit] = match;
  const count = parseInt(countStr, 10);

  let intervalDays: number;
  switch (unit) {
    case 'day':
    case 'days':
      intervalDays = 1 / count;
      break;
    case 'week':
    case 'weeks':
      intervalDays = 7 / count;
      break;
    case 'month':
    case 'months':
      intervalDays = 30 / count;
      break;
    case 'year':
    case 'years':
      intervalDays = 365 / count;
      break;
    default:
      intervalDays = 30;
  }

  return intervalDays;
}

/**
 * Calculate the target number of future events to maintain for a group
 * based on their meeting cadence
 *
 * @param meetingFrequency - The meeting frequency string (e.g., "1x week", "2x month")
 * @returns Number of events to maintain in the pipeline (2-4)
 *
 * Strategy:
 * - High frequency (≤7 days): 2 events ahead (prevents overwhelm)
 * - Medium frequency (8-20 days): 3 events ahead (sweet spot for planning)
 * - Low frequency (21+ days): 4 events ahead (longer visibility needed)
 */
export function calculateTargetEventCount(meetingFrequency: string): number {
  const cadenceInDays = calculateCadenceInDays(meetingFrequency);

  if (cadenceInDays <= 7) {
    // High frequency: 3x week, 2x week, 1x week
    // Planning horizon: 4-14 days
    return 2;
  } else if (cadenceInDays <= 20) {
    // Medium frequency: 2x month (every 15 days)
    // Planning horizon: 24-60 days
    return 3;
  } else {
    // Low frequency: 1x month, 1x quarter
    // Planning horizon: 60-360 days
    return 4;
  }
}

/**
 * Check if a group needs auto-scheduling
 * Returns true if:
 * - Auto-schedule is enabled
 * - We're within 10 days of the next event due date
 * - No pending auto-scheduled event exists
 * - For high-cadence groups (<10 days), also checks if any proposed/scheduled events exist
 */
export async function shouldTriggerAutoSchedule(
  storage: IStorage,
  group: Group,
  hasPendingAutoEvent: boolean
): Promise<boolean> {
  if (!group.autoScheduleEnabled) {
    return false;
  }

  if (hasPendingAutoEvent) {
    return false; // Already has a pending event
  }

  if (!group.nextEventDueDate) {
    return false; // No due date set
  }

  const now = new Date();
  const dueDate = new Date(group.nextEventDueDate);
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Not yet within the 10-day window
  if (daysUntilDue > 10 || daysUntilDue < 0) {

    return false;
  }

  // REMOVED: Old high-cadence limiter that blocked pipeline maintenance
  // The maintainEventPipeline() function now properly manages event counts
  // for all cadences using targetFutureEvents

  return true;
}

/**
 * Maintain the event pipeline for a group by ensuring it has the target
 * number of future events queued up
 *
 * @param groupId - The group to maintain events for
 * @param storage - Storage instance for database operations
 * @returns The number of events created
 *
 * This function:
 * 1. Gets the target event count (from group setting or calculated from cadence)
 * 2. Counts existing future events
 * 3. Creates additional events to reach the target count
 * 4. Spaces events according to the group's meeting frequency
 */
export async function maintainEventPipeline(
  groupId: string,
  storage: IStorage
): Promise<number> {
  console.log(`[Event Pipeline] Maintaining pipeline for group ${groupId}`);

  // CRITICAL FIX 1: Acquire per-group mutex lock using PostgreSQL advisory locks
  // This prevents race conditions when multiple scheduler runs try to process the same group
  const lockId = hashStringToInt(groupId);
  const lockResult = await db.execute(sql`SELECT pg_try_advisory_lock(${lockId})`);
  const lockAcquired = lockResult.rows[0]?.pg_try_advisory_lock;

  if (!lockAcquired) {
    console.log(`[Event Pipeline] Group ${groupId} is already being processed by another worker, skipping`);
    return 0;
  }

  try {
    // Get the group
    const group = await storage.getGroup(groupId);
    if (!group) {
      console.log(`[Event Pipeline] Group ${groupId} not found`);
      return 0;
    }

    // Skip if auto-scheduling is not enabled
    if (!group.autoScheduleEnabled) {
      console.log(`[Event Pipeline] Auto-scheduling not enabled for group ${group.name}`);
      return 0;
    }

    // Skip if automation is paused
    if (group.automationPaused) {
      console.log(`[Event Pipeline] Automation is paused for group ${group.name}`);
      return 0;
    }

  // Determine target event count
  const targetCount = group.targetFutureEvents ?? calculateTargetEventCount(group.meetingFrequency);
  console.log(`[Event Pipeline] Target event count for ${group.name}: ${targetCount} (cadence: ${group.meetingFrequency})`);

  // Count existing future events
  const existingCount = await storage.countFutureEvents(groupId);
  console.log(`[Event Pipeline] Existing future events for ${group.name}: ${existingCount}`);

  // Calculate how many more events we need
  const eventsNeeded = targetCount - existingCount;
  if (eventsNeeded <= 0) {
    console.log(`[Event Pipeline] Pipeline is full for ${group.name} (${existingCount}/${targetCount})`);
    return 0;
  }

  console.log(`[Event Pipeline] Need to create ${eventsNeeded} more event(s) for ${group.name}`);

  // Get the starting date for new events
  // This should be the next due date after all existing events
  let startDate: Date;
  const now = new Date();

  if (!group.nextEventDueDate) {
    // If no next event date, calculate from last event or use now
    if (group.lastEventDate) {
      startDate = calculateNextEventDueDate(new Date(group.lastEventDate), group.meetingFrequency);
    } else {
      // First event for this group
      startDate = new Date();
      startDate.setDate(startDate.getDate() + 7); // Start 1 week from now
    }
  } else {
    // Start from the next due date, but skip ahead by existing events
    startDate = new Date(group.nextEventDueDate);
    for (let i = 0; i < existingCount; i++) {
      startDate = calculateNextEventDueDate(startDate, group.meetingFrequency);
    }
  }

  // CRITICAL: Ensure startDate is not in the past
  // If it is, advance it until we get a future date
  while (startDate < now) {
    console.log(`[Event Pipeline] Start date ${startDate.toISOString().split('T')[0]} is in the past, advancing...`);
    startDate = calculateNextEventDueDate(startDate, group.meetingFrequency);
  }

  console.log(`[Event Pipeline] Creating ${eventsNeeded} events starting from ${startDate.toISOString()}`);

  // Filter out rejected dates (only future ones matter)
  const rejectedDates = await db
    .select()
    .from(rejectedEventDates)
    .where(eq(rejectedEventDates.groupId, groupId));

  const rejectedDateStrs = new Set(
    rejectedDates
      .filter(rd => new Date(rd.rejectedDate) >= now) // Only consider future rejected dates
      .map(rd => new Date(rd.rejectedDate).toISOString().split('T')[0])
  );

  // Generate future event dates with smart time selection
  // Generate extra candidates to account for rejected dates AND existing events
  // We may need to skip several dates if they already have events
  const candidateCount = eventsNeeded * 4 + rejectedDateStrs.size;
  const allFutureDates = calculateFutureEventDates(startDate, group.meetingFrequency, candidateCount, group);

  // Filter out rejected dates but don't slice yet - we need extra candidates
  // in case some dates already have events (duplicates)
  const futureDates = allFutureDates
    .filter(date => {
      const dateStr = date.toISOString().split('T')[0];
      if (rejectedDateStrs.has(dateStr)) {
        console.log(`[Event Pipeline] Skipping rejected date ${dateStr} for group ${group.name}`);
        return false;
      }
      return true;
    });

  console.log(`[Event Pipeline] After filtering rejected dates: ${futureDates.length} candidate dates found (need ${eventsNeeded})`);

  // Create a full auto-scheduled event for each date
  // Stop when we've created enough events (eventsNeeded)
  const { itineraryOptions: itineraryOptionsTable } = await import('../shared/schema');

  let createdCount = 0;
  for (const eventDate of futureDates) {
    // Stop if we've created enough events
    if (createdCount >= eventsNeeded) {
      break;
    }

    try {
      console.log(`[Event Pipeline] Generating full event for ${group.name} on ${eventDate.toISOString()}`);

      // CRITICAL FIX 2: Timezone-aware duplicate prevention
      // Use date ranges instead of string comparison to avoid timezone issues
      const startOfDay = new Date(eventDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(eventDate);
      endOfDay.setHours(23, 59, 59, 999);

      // CRITICAL FIX 3: Check BOTH autoScheduledEvents AND itineraries tables
      // This prevents collisions between manual and auto events on the same date
      const [existingAutoEvents, existingItineraries] = await Promise.all([
        db.select()
          .from(autoScheduledEvents)
          .where(and(
            eq(autoScheduledEvents.groupId, groupId),
            gte(autoScheduledEvents.proposedDate, startOfDay),
            lte(autoScheduledEvents.proposedDate, endOfDay)
          )),
        db.select()
          .from(itineraries)
          .where(and(
            eq(itineraries.groupId, groupId),
            gte(itineraries.eventDate, startOfDay),
            lte(itineraries.eventDate, endOfDay)
          ))
      ]);

      if (existingAutoEvents.length > 0) {
        console.log(`[Event Pipeline] Auto-event already exists on ${eventDate.toISOString().split('T')[0]} for ${group.name} (Event ID: ${existingAutoEvents[0].id}), skipping duplicate creation`);
        continue;
      }

      if (existingItineraries.length > 0) {
        console.log(`[Event Pipeline] Manual itinerary already exists on ${eventDate.toISOString().split('T')[0]} for ${group.name} (Itinerary ID: ${existingItineraries[0].id}), skipping to avoid collision`);
        continue;
      }

      // Generate itinerary options for this event
      // Note: This is expensive but gives users real events with full details
      const selection = await selectBestItineraryForAutoSchedule(storage, group);

      if (selection.options && selection.options.length > 0) {
        console.log(`[Event Pipeline] Generated ${selection.options.length} itinerary options`);

        // CRITICAL FIX 4: Wrap event creation in a transaction
        // This ensures all-or-nothing: if option insertion fails, the event won't be created
        await db.transaction(async (tx) => {
          // Create auto-scheduled event with pending_approval status
          // Calculate adaptive timeline based on how far out the event is
          const now = new Date();
          const adaptiveTimeline = calculateAdaptiveTimeline(eventDate, now);
          const autoSendDate = calculateInviteSendDate(eventDate, now);

          // If invite send date would be in the past, send immediately
          if (autoSendDate < now) {
            autoSendDate.setTime(now.getTime());
          }

          console.log(`[Event Pipeline] Using ${adaptiveTimeline.timelineType} timeline: ${adaptiveTimeline.reasoning}`);

          // Validate autoSendAt is before proposedDate
          if (autoSendDate >= eventDate) {
            throw new Error(`autoSendAt (${autoSendDate.toISOString()}) must be before proposedDate (${eventDate.toISOString()})`);
          }

          const autoEvent = await storage.createAutoScheduledEvent({
            groupId: groupId,
            proposedDate: eventDate,
            status: 'pending_approval',
            confidenceScore: null,
            requiresReview: false,
            reviewReason: null,
            autoSendAt: autoSendDate,
          });

          // Store the itinerary options within the same transaction
          if (selection.options) {
            await Promise.all(
              selection.options.map(async (option) => {
                await tx.insert(itineraryOptionsTable).values({
                  autoEventId: autoEvent.id,
                  optionNumber: option.optionNumber,
                  venues: option.venues,
                  description: option.description,
                });
              })
            );
          }

          console.log(`[Event Pipeline] Created full event for ${group.name} on ${eventDate.toISOString()}`);
        });

        createdCount++;
      } else {
        console.log(`[Event Pipeline] No itinerary options generated for ${eventDate.toISOString()}, skipping`);
      }
    } catch (error) {
      console.error(`[Event Pipeline] Failed to create event for ${group.name} on ${eventDate.toISOString()}:`, error);
      // Transaction will auto-rollback on error, leaving no orphaned records
    }
  }

    console.log(`[Event Pipeline] Successfully created ${createdCount}/${eventsNeeded} events for ${group.name}`);
    return createdCount;
  } finally {
    // CRITICAL FIX 1: Always release the advisory lock, even if an error occurred
    await db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
    console.log(`[Event Pipeline] Released lock for group ${groupId}`);
  }
}
