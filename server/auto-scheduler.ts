import { IStorage } from "./storage";
import type { Group, Itinerary, Activity } from "@shared/schema";
import { addDays } from "date-fns";

/**
 * Smart itinerary selection for auto-scheduling
 * Priority: Saved itineraries → Favorites (high-rated activities) → AI-generated similar content
 */
export async function selectBestItineraryForAutoSchedule(
  storage: IStorage,
  group: Group
): Promise<{ itineraryId?: string; selectedVenues?: Array<{ sourceType: 'activity' | 'voting_event', sourceId: string }> }> {
  
  // 1. First priority: Use saved itineraries (organizer has already vetted these)
  const savedItineraries = await storage.getSavedItineraries(group.id);
  if (savedItineraries.length > 0) {
    // Pick the most recently saved itinerary
    const mostRecent = savedItineraries[0];
    return { itineraryId: mostRecent.id };
  }

  // 2. Second priority: Build from favorited/highly-rated activities
  const activities = await storage.getGroupActivities(group.id);
  const favorites = activities.filter(a => 
    a.feedback === 'upvote' || 
    a.feedback === 'favorite' ||
    a.feedback === 'more_like_this'
  );

  if (favorites.length >= 2) {
    // Select 2-3 top-rated favorites
    const selectedFavorites = favorites
      .sort((a, b) => {
        // Prioritize explicit favorites over upvotes
        const scoreA = a.feedback === 'favorite' ? 3 : a.feedback === 'more_like_this' ? 2 : 1;
        const scoreB = b.feedback === 'favorite' ? 3 : b.feedback === 'more_like_this' ? 2 : 1;
        return scoreB - scoreA;
      })
      .slice(0, 3)
      .map(a => ({ sourceType: 'activity' as const, sourceId: a.id }));

    return { selectedVenues: selectedFavorites };
  }

  // 3. Third priority: Use AI-generated content similar to liked activities
  if (activities.length > 0) {
    // Pick activities that match the group's preferences (not downvoted)
    const viableActivities = activities.filter(a => 
      a.feedback !== 'downvote' && 
      a.feedback !== 'not_this' &&
      a.feedback !== 'pass'
    );

    if (viableActivities.length >= 2) {
      // Select 2-3 random viable activities
      const shuffled = viableActivities.sort(() => Math.random() - 0.5);
      const selectedActivities = shuffled
        .slice(0, Math.min(3, viableActivities.length))
        .map(a => ({ sourceType: 'activity' as const, sourceId: a.id }));

      return { selectedVenues: selectedActivities };
    }
  }

  // Fallback: No good options available, return empty
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
