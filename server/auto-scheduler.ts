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
 * Smart itinerary selection with visit frequency tracking
 * Scores venues based on: Quality (feedback) × Recency × Frequency
 * Ensures fair rotation through all available venues
 */
export async function selectBestItineraryForAutoSchedule(
  storage: IStorage,
  group: Group
): Promise<{ itineraryId?: string; selectedVenues?: Array<{ sourceType: 'activity' | 'voting_event', sourceId: string }> }> {

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
  };

  const scoredVenues: ScoredVenue[] = [];
  const now = Date.now();

  // Score activities
  for (const activity of activities) {
    // Skip downvoted
    if (activity.feedback === 'downvote' || activity.feedback === 'not_this' || activity.feedback === 'pass') {
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
    });
  }

  // Score voting events
  for (const votingEvent of votingEvents) {
    // Quality score (voting events are pre-vetted by group)
    const qualityScore = 2; // Default good score for voted items

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
    });
  }

  // Sort by score (highest first)
  scoredVenues.sort((a, b) => b.score - a.score);

  // Log top 5 for debugging
  console.log(`[Selection] Top 5 scored venues:`);
  scoredVenues.slice(0, 5).forEach((v, i) => {
    console.log(`  ${i+1}. ${v.name} (${v.type})`);
    console.log(`     Score: ${v.score.toFixed(2)}, Visits: ${v.visitCount}, Days since: ${v.daysSinceLastVisit.toFixed(0)}, Quality: ${v.qualityScore}`);
  });

  // Select top 2-3 venues
  if (scoredVenues.length >= 2) {
    const selected = scoredVenues
      .slice(0, Math.min(3, scoredVenues.length))
      .map(v => ({
        sourceType: v.type,
        sourceId: v.id,
      }));

    console.log(`[Selection] Selected ${selected.length} venues for event`);
    return { selectedVenues: selected };
  }

  console.log(`[Selection] Not enough viable venues (need 2+, found ${scoredVenues.length})`);
  return {};
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
 * Check if a group needs auto-scheduling
 * Returns true if:
 * - Auto-schedule is enabled
 * - We're within 10 days of the next event due date
 * - No pending auto-scheduled event exists
 */
export function shouldTriggerAutoSchedule(
  group: Group,
  hasPendingAutoEvent: boolean
): boolean {
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

  // Trigger when we're 10 days or less from the due date
  return daysUntilDue <= 10 && daysUntilDue >= 0;
}
