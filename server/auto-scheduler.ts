import { IStorage } from "./storage";
import type { Group, Itinerary, Activity, VotingEvent } from "@shared/schema";
import { addDays } from "date-fns";
import { db } from "./db";
import { venueVisitHistory } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Get visit statistics for all venues in a group
 */
async function getVenueVisitStats(groupId: string) {
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
    badges.push('🌟 Group Favorite');
  } else if (qualityScore >= 2.5) {
    badges.push('⭐ Highly Rated');
  }

  // Visit frequency badges
  if (visitCount === 0) {
    badges.push('✨ Never Visited');
  } else if (visitCount === 1 && qualityScore >= 2) {
    badges.push('🔄 Back by Popular Demand');
  } else if (daysSinceLastVisit >= 60) {
    badges.push('📅 It\'s Been a While');
  }

  // Recency badge
  if (daysSinceLastVisit < 30 && visitCount > 0) {
    badges.push('🆕 Recent Visit');
  }

  return badges;
}

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
  options?: Array<{
    optionNumber: number;
    venues: Array<{
      sourceType: 'activity' | 'voting_event';
      sourceId: string;
      venueName: string;
      badges: string[];
    }>;
    description: string;
  }>;
}> {

  console.log(`[Selection] Starting venue selection for group ${group.name}`);

  // Get all available venues (activities + voting events)
  const activities = await storage.getGroupActivities(group.id);
  const votingEvents = await storage.getGroupVotingEvents(group.id);

  console.log(`[Selection] Found ${activities.length} activities, ${votingEvents.length} voting events`);

  // Get visit history
  const visitStats = await getVenueVisitStats(group.id);
  console.log(`[Selection] ${visitStats.length} venues have visit history`);

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
  };

  const scoredVenues: ScoredVenue[] = [];
  const now = Date.now();

  // Score activities
  for (const activity of activities) {
    // Skip downvoted
    if (activity.feedback === 'downvote' || activity.feedback === 'not_this' || activity.feedback === 'pass') {
      continue;
    }

    // Skip permanently/temporarily closed venues
    if (activity.businessStatus === 'CLOSED_PERMANENTLY' || activity.businessStatus === 'CLOSED_TEMPORARILY') {
      console.log(`[Selection] Skipping ${activity.venueName} - ${activity.businessStatus}`);
      continue;
    }

    // Quality score from feedback
    let qualityScore = 1; // neutral
    if (activity.feedback === 'favorite') qualityScore = 3;
    else if (activity.feedback === 'more_like_this') qualityScore = 2.5;
    else if (activity.feedback === 'upvote') qualityScore = 2;

    // Visit stats
    const stats = visitStats.find(v => v.activityId === activity.id);
    const visitCount = stats?.count || 0;
    const lastVisit = stats?.lastVisit ? new Date(stats.lastVisit).getTime() : 0;
    const daysSinceLastVisit = lastVisit ? (now - lastVisit) / (1000 * 60 * 60 * 24) : 999;

    // Never visited bonus
    const neverVisitedBonus = visitCount === 0 ? 3 : 1;

    // Recency bonus: more days = higher bonus (max 2x at 60+ days)
    const recencyBonus = Math.min(daysSinceLastVisit / 30, 2);

    // Frequency penalty: halve score for each visit
    const frequencyPenalty = Math.pow(0.5, visitCount);

    // Final score
    const score = qualityScore * neverVisitedBonus * recencyBonus * frequencyPenalty;

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
    const voteCount = voteCounts.find(vc => vc.id === votingEvent.id);
    const netVotes = voteCount?.netVotes || 0;
    const upvotes = voteCount?.upvotes || 0;

    // Quality score based on upvotes:
    // - Base score of 2 (venues in Favorites are already vetted)
    // - +0.5 for each net upvote (capped at +1.5 for 3+ upvotes)
    // - This makes highly upvoted favorites score up to 3.5 (better than "favorite" feedback on activities)
    const upvoteBonus = Math.min(netVotes * 0.5, 1.5);
    const qualityScore = Math.max(1, 2 + upvoteBonus); // Min 1, typical 2-3.5

    // Skip if downvoted more than upvoted
    if (netVotes < 0) {
      console.log(`[Selection] Skipping ${votingEvent.title} - net downvotes: ${netVotes}`);
      continue;
    }

    // Visit stats
    const stats = visitStats.find(v => v.votingEventId === votingEvent.id);
    const visitCount = stats?.count || 0;
    const lastVisit = stats?.lastVisit ? new Date(stats.lastVisit).getTime() : 0;
    const daysSinceLastVisit = lastVisit ? (now - lastVisit) / (1000 * 60 * 60 * 24) : 999;

    // Never visited bonus
    const neverVisitedBonus = visitCount === 0 ? 3 : 1;

    // Recency bonus
    const recencyBonus = Math.min(daysSinceLastVisit / 30, 2);

    // Frequency penalty
    const frequencyPenalty = Math.pow(0.5, visitCount);

    // Final score
    const score = qualityScore * neverVisitedBonus * recencyBonus * frequencyPenalty;

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

  // If we have ≥5 suitable Favorites, use ONLY Favorites (1 smart itinerary, not 3 options)
  if (suitableFavorites.length >= 5) {
    console.log(`[Selection] Using Favorites-only mode (${suitableFavorites.length} available)`);

    // Rank favorites by score
    suitableFavorites.sort((a, b) => b.score - a.score);

    // Determine optimal count based on top favorites
    const optimalCount = calculateOptimalVenueCount(suitableFavorites.slice(0, 5));
    const finalCount = Math.min(optimalCount, suitableFavorites.length);

    console.log(`[Selection] Creating 1 itinerary with ${finalCount} venues from Favorites`);

    const selectedFavorites = suitableFavorites.slice(0, finalCount);

    return {
      selectedVenues: selectedFavorites.map(v => ({
        sourceType: v.type,
        sourceId: v.id,
      })),
      options: [{
        optionNumber: 1,
        venues: selectedFavorites.map(v => ({
          sourceType: v.type,
          sourceId: v.id,
          venueName: v.name,
          badges: ['⭐ From Favorites', ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)],
        })),
        description: 'Created from your Favorites - venues your group already loves',
      }],
    };
  }

  // If <5 suitable Favorites, fall back to original 3-option flow mixing all venues
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
      return { selectedVenues: selected };
    }

    return {};
  }

  // Generate up to 3 distinct itinerary options
  const options = [];

  // Option 1: Top-scoring venues (safe bet)
  const option1Count = calculateOptimalVenueCount(scoredVenues.slice(0, 5)); // Check top 5 for category mix
  const option1Venues = scoredVenues.slice(0, option1Count);
  console.log(`[Selection] Option 1: Using ${option1Count} venues (smart count)`);

  options.push({
    optionNumber: 1,
    venues: option1Venues.map(v => {
      const sourceBadge = v.type === 'voting_event' ? '⭐ From Favorites' : '✨ AI Suggestion';
      return {
        sourceType: v.type,
        sourceId: v.id,
        venueName: v.name,
        badges: [sourceBadge, ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)],
      };
    }),
    description: 'Top Picks - Our highest-rated venues based on your group\'s preferences',
  });

  // Option 2: Mix of favorites and new experiences (balanced)
  const favorites = scoredVenues.filter(v => v.feedback === 'favorite' || v.qualityScore >= 2.5);
  const neverVisited = scoredVenues.filter(v => v.visitCount === 0);

  let option2Venues: ScoredVenue[] = [];
  if (favorites.length > 0 && neverVisited.length > 0) {
    // Mix favorites with new venues - take 1-2 of each
    const mixedCandidates = [
      favorites[0],
      neverVisited[0],
    ];

    // Add one more if optimal count allows
    const option2Count = calculateOptimalVenueCount(mixedCandidates);
    if (option2Count >= 2 && (favorites[1] || neverVisited[1])) {
      mixedCandidates.push(favorites[1] || neverVisited[1]);
    }

    option2Venues = mixedCandidates.slice(0, Math.min(option2Count + 1, mixedCandidates.length));
  } else {
    // Fall back to venues after Option 1
    const startIdx = option1Count; // Start where Option 1 ended
    const candidates = scoredVenues.slice(startIdx, startIdx + 5);
    const option2Count = calculateOptimalVenueCount(candidates);
    option2Venues = candidates.slice(0, option2Count);
  }

  console.log(`[Selection] Option 2: Using ${option2Venues.length} venues`);

  options.push({
    optionNumber: 2,
    venues: option2Venues.map(v => {
      const sourceBadge = v.type === 'voting_event' ? '⭐ From Favorites' : '✨ AI Suggestion';
      return {
        sourceType: v.type,
        sourceId: v.id,
        venueName: v.name,
        badges: [sourceBadge, ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)],
      };
    }),
    description: 'Balanced Mix - Familiar favorites plus exciting new spots',
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
    // Revisit old favorites
    const option3Count = calculateOptimalVenueCount(oldFavorites.slice(0, 5));
    option3Venues = oldFavorites.slice(0, option3Count);
    option3Description = 'Blast from the Past - Revisit venues you loved but haven\'t been to in a while';
  } else if (neverVisitedForOption3.length >= 1) {
    // New venues NOT in Option 1
    const option3Count = calculateOptimalVenueCount(neverVisitedForOption3.slice(0, 5));
    option3Venues = neverVisitedForOption3.slice(0, option3Count);
    option3Description = 'Adventure Mode - Brand new venues to explore';
  } else {
    // Fall back to venues way down the list (after Options 1 & 2)
    const startIdx = Math.max(option1Count + option2Venues.length, 6);
    const candidates = scoredVenues.filter(v => !usedVenueIds.has(v.id)).slice(0, 5);
    if (candidates.length >= 1) {
      const option3Count = calculateOptimalVenueCount(candidates);
      option3Venues = candidates.slice(0, option3Count);
      option3Description = 'Alternative Selection - Great options outside the usual rotation';
    }
  }

  // Only add Option 3 if we found distinct venues
  if (option3Venues.length > 0) {
    console.log(`[Selection] Option 3: Using ${option3Venues.length} venues (${option3Description.split(' - ')[0]})`);
    options.push({
      optionNumber: 3,
      venues: option3Venues.map(v => {
        const sourceBadge = v.type === 'voting_event' ? '⭐ From Favorites' : '✨ AI Suggestion';
        return {
          sourceType: v.type,
          sourceId: v.id,
          venueName: v.name,
          badges: [sourceBadge, ...generateVenueBadges(v.qualityScore, v.visitCount, v.daysSinceLastVisit, v.feedback)],
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

  return { options };
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
 */
export function calculateFutureEventDates(
  nextEventDueDate: Date,
  meetingFrequency: string,
  count: number
): Date[] {
  const futureDates: Date[] = [];
  let currentDate = new Date(nextEventDueDate);

  for (let i = 0; i < count; i++) {
    futureDates.push(new Date(currentDate));
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

  // For high-cadence groups (<10 days between events), limit to 1 event on calendar
  const cadence = calculateCadenceInDays(group.meetingFrequency);
  if (cadence < 10) {
    const hasExistingEvents = await storage.hasExistingProposedEvents(group.id);
    if (hasExistingEvents) {
      console.log(`[Auto-Schedule] Skipping high-cadence group ${group.name} (cadence: ${cadence.toFixed(1)} days) - already has proposed/scheduled event`);
      return false;
    }
  }

  return true;
}
