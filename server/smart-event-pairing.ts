/**
 * Smart Event Pairing
 * Generates auto-schedule queue by pairing Favorites/itineraries with recurring dates
 */

import { IStorage } from "./storage";
import type { Group, Itinerary, VotingEvent } from "@shared/schema";
import { calculateFutureEventDates, calculateCadenceInDays } from "./auto-scheduler";
import { db } from "./db";
import { venueVisitHistory } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";
import { subDays, format } from "date-fns";
import { validateQueueEvent } from "./ai-event-validator";
import { suggestOptimalTime } from "./ai-time-picker";
import { inferTimePeriod, calculateDayDensity } from "./availability-utils";
import { planEventWithAgent, type VenueForAgent } from "./ai-event-agent";

interface QueueVenue {
  sourceType: 'voting_event' | 'activity';
  sourceId: string;
  venueName: string;
  venueType: string;
  venueAddress?: string | null;
  googlePlaceId?: string | null;
}

interface QueueEvent {
  id: string;
  scheduledDate: string;
  scheduledTime?: string;
  venues: QueueVenue[];
  sourceType: 'favorites' | 'itinerary';
  sourceItineraryId?: string;
  sourceItineraryName?: string;
  aiValidationScore: number;
  aiValidationReasoning: string;
  aiValidationConcerns: string[];
  aiValidationSuggestions: string[];
  regenerationCount?: number;
}

interface QueueData {
  events: QueueEvent[];
}

/**
 * Categorize venue by time of day appropriateness
 */
function categorizeVenueTimeOfDay(venueType: string): string[] {
  const type = venueType.toLowerCase();
  const suitableTimes: string[] = [];

  // Morning (8am-12pm)
  if (type.includes('coffee') || type.includes('cafe') ||
      type.includes('breakfast') || type.includes('brunch') ||
      type.includes('bakery')) {
    suitableTimes.push('morning');
  }

  // Afternoon (12pm-5pm)
  if (type.includes('lunch') || type.includes('cafe') ||
      type.includes('museum') || type.includes('park') ||
      type.includes('activity') || type.includes('shopping')) {
    suitableTimes.push('afternoon');
  }

  // Evening (5pm-10pm) - most versatile
  if (type.includes('restaurant') || type.includes('dinner') ||
      type.includes('bar') || type.includes('brewery') ||
      type.includes('pub') || type.includes('wine') ||
      type.includes('cocktail') || type.includes('nightlife')) {
    suitableTimes.push('evening');
  }

  // Night (10pm+)
  if (type.includes('bar') || type.includes('club') ||
      type.includes('nightclub') || type.includes('late')) {
    suitableTimes.push('night');
  }

  // Default to evening if unclear
  if (suitableTimes.length === 0) {
    suitableTimes.push('evening');
  }

  return suitableTimes;
}

/**
 * Get time of day preference based on group's typical event pattern
 * Analyzes: (1) availability grid, (2) past events as tie-breaker, (3) general availability text
 * Returns 'morning', 'afternoon', or 'evening'
 */
async function inferPreferredTimeOfDay(group: Group, storage: IStorage): Promise<string> {
  // Strategy 1: Analyze availability grid (most accurate - shows current preferences)
  if (group.availability && typeof group.availability === 'object') {
    try {
      const grid = group.availability as any;
      let morningSlots = 0, afternoonSlots = 0, eveningSlots = 0;

      for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
        const slots = grid[day];
        if (slots?.morning) morningSlots++;
        if (slots?.afternoon) afternoonSlots++;
        if (slots?.evening) eveningSlots++;
      }

      // If there's a clear winner, return it
      const maxSlots = Math.max(morningSlots, afternoonSlots, eveningSlots);
      const winners = [];
      if (morningSlots === maxSlots) winners.push('morning');
      if (afternoonSlots === maxSlots) winners.push('afternoon');
      if (eveningSlots === maxSlots) winners.push('evening');

      // If only one winner, return it
      if (winners.length === 1) {
        console.log(`[Smart Pairing] Inferred time from availability grid: ${winners[0]} (${maxSlots} slots)`);
        return winners[0];
      }

      // If tie, use past events as tie-breaker
      if (winners.length > 1) {
        console.log(`[Smart Pairing] Availability tie between ${winners.join(', ')} (${maxSlots} slots each), checking past events...`);

        try {
          const allItineraries = await storage.getGroupItineraries(group.id);
          const pastEvents = allItineraries.filter(it =>
            it.eventDate && new Date(it.eventDate) < new Date()
          );

          if (pastEvents.length > 0) {
            const periodCounts = { morning: 0, afternoon: 0, evening: 0 };

            for (const event of pastEvents) {
              if (!event.eventDate) continue;
              const hour = new Date(event.eventDate).getHours();
              const period = inferTimePeriod(hour);
              periodCounts[period as keyof typeof periodCounts]++;
            }

            // Among the tied periods, find which has more past events
            const tieBreakerCounts = winners.map(w => ({
              period: w,
              count: periodCounts[w as keyof typeof periodCounts]
            }));
            const tieBreakerWinner = tieBreakerCounts.sort((a, b) => b.count - a.count)[0];

            console.log(`[Smart Pairing] Tie-breaker using ${pastEvents.length} past events: ${tieBreakerWinner.period}`);
            return tieBreakerWinner.period;
          }
        } catch (error) {
          console.log('[Smart Pairing] Error analyzing past events for tie-breaker:', error);
        }

        // If no past events, just return first winner
        console.log(`[Smart Pairing] No past events for tie-breaker, using: ${winners[0]}`);
        return winners[0];
      }
    } catch (error) {
      console.log('[Smart Pairing] Error analyzing availability grid:', error);
    }
  }

  // Strategy 3: Parse general availability text (fallback)
  if (group.generalAvailability) {
    const text = group.generalAvailability.toLowerCase();
    if (text.includes('morning')) {
      console.log('[Smart Pairing] Inferred time from text: morning');
      return 'morning';
    }
    if (text.includes('afternoon')) {
      console.log('[Smart Pairing] Inferred time from text: afternoon');
      return 'afternoon';
    }
    if (text.includes('evening') || text.includes('night')) {
      console.log('[Smart Pairing] Inferred time from text: evening');
      return 'evening';
    }
  }

  // Final fallback: evening (most common for social events)
  console.log('[Smart Pairing] Using default time: evening');
  return 'evening';
}

/**
 * Check if a venue was visited recently (within cooldown period)
 */
async function wasVenueVisitedRecently(
  groupId: string,
  sourceType: 'voting_event' | 'activity',
  sourceId: string,
  cooldownDays: number = 60
): Promise<boolean> {
  const cooldownDate = subDays(new Date(), cooldownDays);

  const whereClause = sourceType === 'voting_event'
    ? and(
        eq(venueVisitHistory.groupId, groupId),
        eq(venueVisitHistory.votingEventId, sourceId),
        gte(venueVisitHistory.visitedAt, cooldownDate)
      )
    : and(
        eq(venueVisitHistory.groupId, groupId),
        eq(venueVisitHistory.activityId, sourceId),
        gte(venueVisitHistory.visitedAt, cooldownDate)
      );

  const recentVisits = await db.select()
    .from(venueVisitHistory)
    .where(whereClause!)
    .limit(1);

  return recentVisits.length > 0;
}

/**
 * Regenerate a specific queue event with different venues
 * Used when organizer clicks "Try Again" to get different Favorites combination
 */
export async function regenerateQueueEvent(
  groupId: string,
  eventId: string,
  excludeVenueIds: string[],
  storage: IStorage
): Promise<QueueEvent | null> {
  try {
    console.log(`[Smart Pairing] Regenerating event ${eventId} for group ${groupId}`);

    // Parse date from eventId (format: queue-{date}-favorites or queue-{date}-itinerary-{id})
    const match = eventId.match(/queue-(.+?)-(favorites|itinerary)/);
    if (!match) {
      throw new Error('Invalid eventId format');
    }

    const dateStr = match[1];
    const date = new Date(dateStr);

    console.log(`[Smart Pairing] Regenerating for date: ${date.toISOString()}`);

    // Get group info
    const group = await storage.getGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Get Favorites and activities
    const votingEvents = await storage.getGroupVotingEvents(groupId);
    const activities = await storage.getGroupActivities(groupId);
    const favorites = votingEvents.filter((ve: any) => ve.netVotes >= 0);

    if (favorites.length < 2 && activities.length < 2) {
      throw new Error('Not enough venues to regenerate. Need at least 2 favorites or activities.');
    }

    // Convert to VenueForAgent format for agent selection
    const venuesForAgent: VenueForAgent[] = [];

    // Add favorites (voting events)
    for (const fav of favorites) {
      if (excludeVenueIds.includes(fav.id)) continue; // Skip excluded venues

      const recentlyVisited = await wasVenueVisitedRecently(groupId, 'voting_event', fav.id, 60);

      venuesForAgent.push({
        type: 'voting_event',
        id: fav.id,
        name: fav.title,
        score: 10, // Base score for favorites
        visitCount: recentlyVisited ? 1 : 0,
        daysSinceLastVisit: recentlyVisited ? 30 : 999,
        qualityScore: 5, // Base quality for favorites
        feedback: 'favorite',
        category: fav.venueType || null,
        venueType: fav.venueType || 'restaurant',
        rating: fav.rating,
        venueAddress: fav.venueAddress,
        googlePlaceId: fav.googlePlaceId,
        latitude: null,
        longitude: null,
      });
    }

    // Add activities (if needed for diversity)
    for (const activity of activities) {
      if (excludeVenueIds.includes(activity.id)) continue;
      if (activity.businessStatus === 'CLOSED_PERMANENTLY' || activity.businessStatus === 'CLOSED_TEMPORARILY') continue;
      if (activity.feedback === 'thumbs_down' || activity.feedback === 'never_again') continue;

      const recentlyVisited = await wasVenueVisitedRecently(groupId, 'activity', activity.id, 60);

      venuesForAgent.push({
        type: 'activity',
        id: activity.id,
        name: activity.venueName,
        score: activity.feedback === 'favorite' ? 80 : 50,
        visitCount: recentlyVisited ? 1 : 0,
        daysSinceLastVisit: recentlyVisited ? 30 : 999,
        qualityScore: activity.feedback === 'favorite' ? 9 : 7,
        feedback: activity.feedback,
        category: activity.category,
        venueType: activity.venueType,
        rating: activity.rating,
        venueAddress: activity.venueAddress,
        googlePlaceId: activity.googlePlaceId,
        latitude: activity.latitude,
        longitude: activity.longitude,
      });
    }

    if (venuesForAgent.length < 2) {
      throw new Error('No alternative venues available after filtering. Try skipping this date or adding more Favorites.');
    }

    console.log(`[Smart Pairing Regeneration] Using AI agent to select from ${venuesForAgent.length} available venues`);

    // Use AI Event Planning Agent for intelligent venue selection
    const agentResult = await planEventWithAgent({
      group,
      eventDate: date,
      availableVenues: venuesForAgent,
      constraints: {
        desiredVenueCount: 2,
        maxDistanceMiles: group.searchRadius || 5,
      },
    });

    if (!agentResult || agentResult.selectedVenues.length === 0) {
      // Fallback: simple selection if agent fails
      console.log('[Smart Pairing Regeneration] Agent failed, using fallback selection');
      const fallbackVenues = venuesForAgent
        .filter(v => !excludeVenueIds.includes(v.id))
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      if (fallbackVenues.length === 0) {
        throw new Error('No venues available for regeneration');
      }

      const venues: QueueVenue[] = fallbackVenues.map(v => ({
        sourceType: v.type,
        sourceId: v.id,
        venueName: v.name,
        venueType: v.venueType || 'restaurant',
        venueAddress: v.venueAddress,
        googlePlaceId: v.googlePlaceId,
      }));

      const newEvent: QueueEvent = {
        id: `queue-${date.toISOString()}-favorites-regen-${Date.now()}`,
        scheduledDate: date.toISOString(),
        scheduledTime: undefined,
        venues,
        sourceType: 'favorites',
        aiValidationScore: 0,
        aiValidationReasoning: 'Fallback selection (agent unavailable)',
        aiValidationConcerns: [],
        aiValidationSuggestions: [],
      };

      return newEvent;
    }

    console.log(`[Smart Pairing Regeneration] Agent selected ${agentResult.selectedVenues.length} venues`);
    console.log(`[Smart Pairing Regeneration] Agent reasoning: ${agentResult.reasoning}`);
    console.log(`[Smart Pairing Regeneration] Agent confidence: ${agentResult.confidence}%`);

    const finalVenues = agentResult.selectedVenues;

    const venues: QueueVenue[] = finalVenues.map((venue: VenueForAgent) => ({
      sourceType: venue.type,
      sourceId: venue.id,
      venueName: venue.name,
      venueType: venue.venueType || 'restaurant',
      venueAddress: venue.venueAddress,
      googlePlaceId: venue.googlePlaceId,
    }));

    // Create new queue event with agent's reasoning
    const newEvent: QueueEvent = {
      id: `queue-${date.toISOString()}-favorites-regen-${Date.now()}`,
      scheduledDate: date.toISOString(),
      scheduledTime: undefined,
      venues,
      sourceType: 'favorites',
      aiValidationScore: agentResult.confidence,
      aiValidationReasoning: `Agent: ${agentResult.reasoning} | Flow: ${agentResult.flow}`,
      aiValidationConcerns: agentResult.warnings || [],
      aiValidationSuggestions: [],
    };

    // Run AI time picker (agent doesn't pick time, only venues)
    const venuesForScheduling = venues.map(v => ({
      name: v.venueName,
      type: v.venueType,
    }));

    const timeResult = await suggestOptimalTime({
      venues: venuesForScheduling,
      generalAvailability: group.generalAvailability ?? undefined,
      meetingFrequency: group.meetingFrequency || '1x month',
      location: group.locationBase,
      currentGroupId: groupId,
    });

    newEvent.scheduledTime = timeResult.suggestedTime || format(timeResult.eventDate, 'HH:mm');

    console.log(`[Smart Pairing] Regenerated event with ${venues.length} venues, confidence: ${agentResult.confidence}%`);

    return newEvent;
  } catch (error: any) {
    console.error('[Smart Pairing] Error regenerating event:', error);
    throw error;
  }
}

/**
 * Generate auto-schedule queue for a group
 */
export async function generateAutoScheduleQueue(
  groupId: string,
  storage: IStorage
): Promise<QueueData> {
  try {
    console.log(`[Smart Pairing] Generating queue for group ${groupId}`);

    // 1. Get group info
    const group = await storage.getGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // 2. Calculate next 3-5 due dates based on meeting frequency
    const nextDates = calculateFutureEventDates(
      new Date(),
      group.meetingFrequency || '1x month',
      5, // Generate 5 future dates
      group // Pass group for smart time selection
    );
    console.log(`[Smart Pairing] Next ${nextDates.length} dates:`, nextDates.map(d => d.toISOString()));

    // 3. Get available sources: Favorites (voting events) and saved itineraries
    const votingEvents = await storage.getGroupVotingEvents(groupId);
    const itineraries = await storage.getGroupItineraries(groupId);

    // Filter to saved/template itineraries only
    const savedItineraries = itineraries.filter((it: Itinerary) => it.isSaved);

    // Filter favorites with positive net votes
    const favorites = votingEvents.filter((ve: any) => ve.netVotes >= 0);

    console.log(`[Smart Pairing] Found ${savedItineraries.length} saved itineraries, ${favorites.length} favorites`);

    // 4. Determine preferred time of day based on past events and availability
    const preferredTime = await inferPreferredTimeOfDay(group, storage);

    // 5. Generate candidate events
    const candidateEvents: QueueEvent[] = [];
    const usedVenueIds = new Set<string>(); // Track used venues for variety

    for (let i = 0; i < nextDates.length; i++) {
      const date = nextDates[i];

      // Try to use a saved itinerary first (pre-validated combos)
      if (savedItineraries.length > 0) {
        const itinerary = savedItineraries[i % savedItineraries.length];

        // Convert itinerary items to queue venues
        const venues: QueueVenue[] = (itinerary.items || []).map((item: any) => ({
          sourceType: 'voting_event' as const, // See TODO.md: "Flexible Source Types in Smart Event Pairing"
          sourceId: item.id || `custom-${item.venueName}`,
          venueName: item.venueName,
          venueType: item.venueType || 'restaurant',
          venueAddress: item.venueAddress,
          googlePlaceId: item.googlePlaceId,
        }));

        candidateEvents.push({
          id: `queue-${date.toISOString()}-itinerary-${itinerary.id}`,
          scheduledDate: date.toISOString(),
          scheduledTime: undefined, // Will be set by AI validation
          venues,
          sourceType: 'itinerary',
          sourceItineraryId: itinerary.id,
          sourceItineraryName: itinerary.name ?? undefined,
          aiValidationScore: 0, // Will be set by AI validation (Session 3)
          aiValidationReasoning: '',
          aiValidationConcerns: [],
          aiValidationSuggestions: [],
        });
      }
      // Otherwise, use AI agent to intelligently select venues from Favorites
      else if (favorites.length > 0) {
        // Get activities for diversity
        const activities = await storage.getGroupActivities(groupId);

        // Convert to VenueForAgent format
        const venuesForAgent: VenueForAgent[] = [];

        // Add favorites (voting events)
        for (const fav of favorites) {
          if (usedVenueIds.has(fav.id)) continue; // Skip already used

          const recentlyVisited = await wasVenueVisitedRecently(groupId, 'voting_event', fav.id, 60);
          if (recentlyVisited) continue; // Skip recently visited

          venuesForAgent.push({
            type: 'voting_event',
            id: fav.id,
            name: fav.title,
            score: 10,
            visitCount: 0,
            daysSinceLastVisit: 999,
            qualityScore: 5,
            feedback: 'favorite',
            category: fav.venueType || null,
            venueType: fav.venueType || 'restaurant',
            rating: fav.rating,
            venueAddress: fav.venueAddress,
            googlePlaceId: fav.googlePlaceId,
            latitude: null,
            longitude: null,
          });
        }

        // Add activities for diversity
        for (const activity of activities) {
          if (usedVenueIds.has(activity.id)) continue;
          if (activity.businessStatus === 'CLOSED_PERMANENTLY' || activity.businessStatus === 'CLOSED_TEMPORARILY') continue;
          if (activity.feedback === 'thumbs_down' || activity.feedback === 'never_again') continue;

          const recentlyVisited = await wasVenueVisitedRecently(groupId, 'activity', activity.id, 60);
          if (recentlyVisited) continue;

          venuesForAgent.push({
            type: 'activity',
            id: activity.id,
            name: activity.venueName,
            score: activity.feedback === 'favorite' ? 80 : 50,
            visitCount: 0,
            daysSinceLastVisit: 999,
            qualityScore: activity.feedback === 'favorite' ? 9 : 7,
            feedback: activity.feedback,
            category: activity.category,
            venueType: activity.venueType,
            rating: activity.rating,
            venueAddress: activity.venueAddress,
            googlePlaceId: activity.googlePlaceId,
            latitude: activity.latitude,
            longitude: activity.longitude,
          });
        }

        if (venuesForAgent.length >= 2) {
          console.log(`[Smart Pairing Queue] Using AI agent to select venues for ${date.toISOString()}`);

          // Use AI Event Planning Agent
          const agentResult = await planEventWithAgent({
            group,
            eventDate: date,
            availableVenues: venuesForAgent,
            constraints: {
              desiredVenueCount: 2,
              maxDistanceMiles: group.searchRadius || 5,
            },
          });

          if (agentResult && agentResult.selectedVenues.length > 0) {
            // Mark venues as used
            agentResult.selectedVenues.forEach(v => usedVenueIds.add(v.id));

            const venues: QueueVenue[] = agentResult.selectedVenues.map((venue: VenueForAgent) => ({
              sourceType: venue.type,
              sourceId: venue.id,
              venueName: venue.name,
              venueType: venue.venueType || 'restaurant',
              venueAddress: venue.venueAddress,
              googlePlaceId: venue.googlePlaceId,
            }));

            candidateEvents.push({
              id: `queue-${date.toISOString()}-favorites`,
              scheduledDate: date.toISOString(),
              scheduledTime: undefined,
              venues,
              sourceType: 'favorites',
              aiValidationScore: agentResult.confidence,
              aiValidationReasoning: `Agent: ${agentResult.reasoning} | Flow: ${agentResult.flow}`,
              aiValidationConcerns: agentResult.warnings || [],
              aiValidationSuggestions: [],
            });

            console.log(`[Smart Pairing Queue] Agent selected ${venues.length} venues, confidence: ${agentResult.confidence}%`);
          } else {
            console.log(`[Smart Pairing Queue] Agent failed for ${date.toISOString()}, skipping this date`);
          }
        } else {
          console.log(`[Smart Pairing Queue] Not enough venues available for ${date.toISOString()}`);
        }
      }
    }

    // 6. Add AI time suggestions and validate each event (parallelized for performance)
    const eventsToValidate = candidateEvents.slice(0, 5);
    console.log(`[Smart Pairing] Processing ${eventsToValidate.length} events in parallel...`);

    // Process all events in parallel using Promise.all
    const validatedEvents = await Promise.all(
      eventsToValidate.map(async (event) => {
        try {
          console.log(`[Smart Pairing] Processing event: ${event.id}`);

          // Convert venues to scheduling format
          const venuesForScheduling = event.venues.map(v => ({
            name: v.venueName,
            type: v.venueType,
          }));

          // Check if event was already validated by agent (confidence > 0)
          const needsValidation = event.aiValidationScore === 0;

          if (needsValidation) {
            // Run AI time picker and validator in parallel for non-agent events
            const [timeResult, validation] = await Promise.all([
              suggestOptimalTime({
                venues: venuesForScheduling,
                generalAvailability: group.generalAvailability ?? undefined,
                meetingFrequency: group.meetingFrequency || '1x month',
                location: group.locationBase,
                currentGroupId: groupId,
              }),
              validateQueueEvent(event, {
                meetingFrequency: group.meetingFrequency || '1x month',
              }),
            ]);

            event.scheduledTime = timeResult.suggestedTime || format(timeResult.eventDate, 'HH:mm');
            event.aiValidationScore = validation.score;
            event.aiValidationReasoning = validation.reasoning;
            event.aiValidationConcerns = validation.concerns;
            event.aiValidationSuggestions = validation.suggestions;

            console.log(`[Smart Pairing] Validated with legacy AI, score: ${validation.score}`);
          } else {
            // Agent-selected event, only need time picker
            const timeResult = await suggestOptimalTime({
              venues: venuesForScheduling,
              generalAvailability: group.generalAvailability ?? undefined,
              meetingFrequency: group.meetingFrequency || '1x month',
              location: group.locationBase,
              currentGroupId: groupId,
            });

            event.scheduledTime = timeResult.suggestedTime || format(timeResult.eventDate, 'HH:mm');

            console.log(`[Smart Pairing] Agent-validated event, confidence: ${event.aiValidationScore}%`);
          }

          console.log(`[Smart Pairing] AI suggested time: ${event.scheduledTime}`);
        } catch (error) {
          console.error('[Smart Pairing] Processing error:', error);
          // Set default time if AI fails
          event.scheduledTime = '19:00'; // Default to 7pm
          // Keep default validation values (0 score requires review)
        }
        return event;
      })
    );

    // Fetch regeneration counts for all events
    const { queueEventMetadata } = await import('../shared/schema');
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');

    const metadata = await db
      .select()
      .from(queueEventMetadata)
      .where(eq(queueEventMetadata.groupId, groupId));

    // Create a map of eventId -> regenerationCount
    const regenerationCounts = new Map<string, number>();
    metadata.forEach(m => {
      regenerationCounts.set(m.eventId, m.regenerationCount);
    });

    // Add regeneration counts to events
    const eventsWithCounts = validatedEvents.map(event => ({
      ...event,
      regenerationCount: regenerationCounts.get(event.id) || 0,
    }));

    return {
      events: eventsWithCounts
    };

  } catch (error: any) {
    console.error('[Smart Pairing] Error generating queue:', error);
    return { events: [] };
  }
}
