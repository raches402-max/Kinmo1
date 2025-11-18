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

    // Get Favorites
    const votingEvents = await storage.getGroupVotingEvents(groupId);
    const favorites = votingEvents.filter((ve: any) => ve.netVotes >= 0);

    if (favorites.length < 2) {
      throw new Error('Not enough Favorites to regenerate. Need at least 2 favorites.');
    }

    // Determine preferred time
    const preferredTime = await inferPreferredTimeOfDay(group, storage);

    // Filter favorites appropriate for time and exclude previously shown ones
    const suitableFavorites = favorites.filter((fav: any) => {
      const times = categorizeVenueTimeOfDay(fav.category || fav.venueType || 'restaurant');
      const isTimeAppropriate = times.includes(preferredTime);
      const notExcluded = !excludeVenueIds.includes(fav.id);
      return isTimeAppropriate && notExcluded;
    });

    // Sort by upvotes
    suitableFavorites.sort((a: any, b: any) => b.upvotes - a.upvotes);

    if (suitableFavorites.length === 0) {
      throw new Error('No alternative Favorites available. Try skipping this date or adding more Favorites.');
    }

    // Pick 1-2 different venues
    const selectedFavorites = suitableFavorites.slice(0, 2);

    // Check if recently visited
    const notRecentlyVisited = [];
    for (const fav of selectedFavorites) {
      const recent = await wasVenueVisitedRecently(
        groupId,
        'voting_event',
        fav.id,
        60
      );
      if (!recent) {
        notRecentlyVisited.push(fav);
      }
    }

    // If all are recently visited, use them anyway (better than no regeneration)
    const finalVenues = notRecentlyVisited.length > 0 ? notRecentlyVisited : selectedFavorites;

    const venues: QueueVenue[] = finalVenues.map((fav: any) => ({
      sourceType: 'voting_event' as const,
      sourceId: fav.id,
      venueName: fav.title,
      venueType: fav.category || fav.venueType || 'restaurant',
      venueAddress: fav.location,
      googlePlaceId: fav.googlePlaceId,
    }));

    // Create new queue event
    const newEvent: QueueEvent = {
      id: `queue-${date.toISOString()}-favorites-regen-${Date.now()}`,
      scheduledDate: date.toISOString(),
      scheduledTime: undefined,
      venues,
      sourceType: 'favorites',
      aiValidationScore: 0,
      aiValidationReasoning: '',
      aiValidationConcerns: [],
      aiValidationSuggestions: [],
    };

    // Run AI validation and time picker
    const venuesForScheduling = venues.map(v => ({
      name: v.venueName,
      type: v.venueType,
    }));

    const [timeResult, validation] = await Promise.all([
      suggestOptimalTime({
        venues: venuesForScheduling,
        generalAvailability: group.generalAvailability,
        meetingFrequency: group.meetingFrequency || '1x month',
        location: group.location,
        currentGroupId: groupId,
      }),
      validateQueueEvent(newEvent, {
        meetingFrequency: group.meetingFrequency || '1x month',
      }),
    ]);

    newEvent.scheduledTime = timeResult.suggestedTime || format(timeResult.eventDate, 'HH:mm');
    newEvent.aiValidationScore = validation.score;
    newEvent.aiValidationReasoning = validation.reasoning;
    newEvent.aiValidationConcerns = validation.concerns;
    newEvent.aiValidationSuggestions = validation.suggestions;

    console.log(`[Smart Pairing] Regenerated event with ${venues.length} venues, score: ${validation.score}`);

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
      5 // Generate 5 future dates
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
          sourceItineraryName: itinerary.name,
          aiValidationScore: 0, // Will be set by AI validation (Session 3)
          aiValidationReasoning: '',
          aiValidationConcerns: [],
          aiValidationSuggestions: [],
        });
      }
      // Otherwise, pick 1-2 venues from Favorites with variety
      else if (favorites.length > 0) {
        // Filter favorites appropriate for preferred time
        const suitableFavorites = favorites.filter((fav: any) => {
          const times = categorizeVenueTimeOfDay(fav.category || fav.venueType || 'restaurant');
          return times.includes(preferredTime);
        });

        // Sort by upvotes and filter out already-used venues
        const availableFavorites = suitableFavorites
          .filter((fav: any) => !usedVenueIds.has(fav.id))
          .sort((a: any, b: any) => b.upvotes - a.upvotes);

        // If we've used all favorites, reset and allow reuse
        const favoritesToUse = availableFavorites.length > 0
          ? availableFavorites
          : suitableFavorites.sort((a: any, b: any) => b.upvotes - a.upvotes);

        // Pick 1-2 venues for this event
        const selectedFavorites = favoritesToUse.slice(0, 2);

        if (selectedFavorites.length > 0) {
          // Mark all selected favorites as used for variety (before checking recent visits)
          selectedFavorites.forEach((fav: any) => usedVenueIds.add(fav.id));

          // Check if recently visited
          const notRecentlyVisited = [];
          for (const fav of selectedFavorites) {
            const recent = await wasVenueVisitedRecently(
              groupId,
              'voting_event',
              fav.id,
              60 // 60-day cooldown
            );
            if (!recent) {
              notRecentlyVisited.push(fav);
            }
          }

          if (notRecentlyVisited.length > 0) {
            const venues: QueueVenue[] = notRecentlyVisited.map((fav: any) => ({
              sourceType: 'voting_event' as const,
              sourceId: fav.id,
              venueName: fav.title,
              venueType: fav.category || fav.venueType || 'restaurant',
              venueAddress: fav.location,
              googlePlaceId: fav.googlePlaceId,
            }));

            candidateEvents.push({
              id: `queue-${date.toISOString()}-favorites`,
              scheduledDate: date.toISOString(),
              scheduledTime: undefined,
              venues,
              sourceType: 'favorites',
              aiValidationScore: 0,
              aiValidationReasoning: '',
              aiValidationConcerns: [],
              aiValidationSuggestions: [],
            });
          }
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

          // Run AI time picker and validator in parallel for each event
          const [timeResult, validation] = await Promise.all([
            suggestOptimalTime({
              venues: venuesForScheduling,
              generalAvailability: group.generalAvailability,
              meetingFrequency: group.meetingFrequency || '1x month',
              location: group.location,
              currentGroupId: groupId,
            }),
            validateQueueEvent(event, {
              meetingFrequency: group.meetingFrequency || '1x month',
            }),
          ]);

          // Set the scheduled time from AI suggestion (use raw time string to preserve local timezone)
          event.scheduledTime = timeResult.suggestedTime || format(timeResult.eventDate, 'HH:mm');
          console.log(`[Smart Pairing] AI suggested time: ${event.scheduledTime}`);

          // Set validation results
          event.aiValidationScore = validation.score;
          event.aiValidationReasoning = validation.reasoning;
          event.aiValidationConcerns = validation.concerns;
          event.aiValidationSuggestions = validation.suggestions;

          console.log(`[Smart Pairing] Validation score: ${validation.score}/100 - ${validation.reasoning}`);
        } catch (error) {
          console.error('[Smart Pairing] Processing error:', error);
          // Set default time if AI fails
          event.scheduledTime = '19:00'; // Default to 7pm
          // Keep default validation values (0 score requires review)
        }
        return event;
      })
    );

    return {
      events: validatedEvents
    };

  } catch (error: any) {
    console.error('[Smart Pairing] Error generating queue:', error);
    return { events: [] };
  }
}
