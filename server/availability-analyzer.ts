/**
 * Availability Analyzer
 *
 * Analyzes RSVP availability feedback to:
 * 1. Show organizers why people declined and when they're free
 * 2. Auto-suggest rescheduling when decliners share common availability
 * 3. Learn group-level patterns over time (best/worst days)
 * 4. Inform auto-scheduling decisions
 */

import { db } from "./db";
import { rsvps, itineraries, members } from "@shared/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

// ============================================================================
// RSVP Response Helpers (normalize legacy values)
// ============================================================================

function isPositiveRsvp(response: string | null | undefined): boolean {
  if (!response) return false;
  const r = response.toLowerCase();
  return r === 'yes' || r === 'going';
}

function isTentativeRsvp(response: string | null | undefined): boolean {
  if (!response) return false;
  return response.toLowerCase() === 'maybe';
}

function isNegativeRsvp(response: string | null | undefined): boolean {
  if (!response) return false;
  const r = response.toLowerCase();
  return r === 'no' || r === 'not_going';
}

// ============================================================================
// Types
// ============================================================================

interface AvailabilitySlot {
  morning: number;
  afternoon: number;
  evening: number;
}

interface AvailabilityHeatmap {
  Mon: AvailabilitySlot;
  Tue: AvailabilitySlot;
  Wed: AvailabilitySlot;
  Thu: AvailabilitySlot;
  Fri: AvailabilitySlot;
  Sat: AvailabilitySlot;
  Sun: AvailabilitySlot;
}

interface RescheduleSuggestion {
  suggested: boolean;
  bestSlot: string | null;
  matchCount: number;
  totalDeclined: number;
  confidence: number;
  reason: string;
}

export interface EventAvailabilityInsight {
  declinedWithAvailability: number;
  totalDeclined: number;
  totalMaybe: number;
  declinersAvailability: AvailabilityHeatmap;
  rescheduleSuggestion: RescheduleSuggestion | null;
  summary: string;
}

interface DayAttendance {
  day: string;
  avgAttendance: number;
  eventCount: number;
}

export interface GroupTimePatterns {
  bestDays: DayAttendance[];
  worstDays: DayAttendance[];
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: Date;
}

// ============================================================================
// Constants
// ============================================================================

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const TIMES = ['morning', 'afternoon', 'evening'] as const;

const DAY_NAMES: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday'
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty availability heatmap
 */
function createEmptyHeatmap(): AvailabilityHeatmap {
  const heatmap: any = {};
  for (const day of DAYS) {
    heatmap[day] = { morning: 0, afternoon: 0, evening: 0 };
  }
  return heatmap as AvailabilityHeatmap;
}

/**
 * Parse availability from rsvpFeedback JSON
 * The availability grid format is: { Mon: { morning: true, afternoon: false, evening: true }, ... }
 */
function parseAvailability(rsvpFeedback: any): Record<string, Record<string, boolean>> | null {
  if (!rsvpFeedback) return null;

  // Check for availability grid in feedback
  const availability = rsvpFeedback.availability;
  if (!availability || typeof availability !== 'object') return null;

  return availability;
}

/**
 * Get day of week abbreviation from a Date
 */
function getDayAbbrev(date: Date): string {
  const dayIndex = date.getDay(); // 0 = Sunday
  const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayMap[dayIndex];
}

// ============================================================================
// Core Analysis Functions
// ============================================================================

/**
 * Aggregate availability data from multiple RSVPs into a heatmap
 * Each slot shows how many decliners marked that time as available
 */
export function aggregateAvailabilityFromRsvps(
  rsvpList: Array<{ rsvpFeedback: any }>
): AvailabilityHeatmap {
  const heatmap = createEmptyHeatmap();

  for (const rsvp of rsvpList) {
    const availability = parseAvailability(rsvp.rsvpFeedback);
    if (!availability) continue;

    for (const day of DAYS) {
      const dayAvail = availability[day];
      if (!dayAvail) continue;

      for (const time of TIMES) {
        if (dayAvail[time]) {
          heatmap[day][time]++;
        }
      }
    }
  }

  return heatmap;
}

/**
 * Find the best reschedule time based on availability heatmap
 * Returns suggestion only if >50% of decliners agree on a slot
 */
export function findOptimalRescheduleTimes(
  heatmap: AvailabilityHeatmap,
  totalDeclined: number,
  declinedWithAvailability: number,
  currentEventDay?: string
): RescheduleSuggestion {
  // Need at least 2 people with availability to make meaningful suggestion
  if (declinedWithAvailability < 2) {
    return {
      suggested: false,
      bestSlot: null,
      matchCount: 0,
      totalDeclined,
      confidence: 0,
      reason: "Not enough availability data to suggest reschedule"
    };
  }

  // Find the slot with most availability
  let bestSlot: { day: string; time: string; count: number } | null = null;

  for (const day of DAYS) {
    for (const time of TIMES) {
      const count = heatmap[day][time];
      if (count > 0 && (!bestSlot || count > bestSlot.count)) {
        bestSlot = { day, time, count };
      }
    }
  }

  if (!bestSlot) {
    return {
      suggested: false,
      bestSlot: null,
      matchCount: 0,
      totalDeclined,
      confidence: 0,
      reason: "No common availability found"
    };
  }

  // Calculate confidence: what % of decliners with availability are free at this time
  const confidence = Math.round((bestSlot.count / declinedWithAvailability) * 100);

  // Only suggest if at least 50% match
  const shouldSuggest = confidence >= 50;

  const dayName = DAY_NAMES[bestSlot.day];
  const slotName = `${dayName} ${bestSlot.time}`;

  // Skip if suggestion is same as current event day
  if (currentEventDay && bestSlot.day === currentEventDay) {
    return {
      suggested: false,
      bestSlot: slotName,
      matchCount: bestSlot.count,
      totalDeclined,
      confidence,
      reason: `Best availability is already on ${dayName}`
    };
  }

  return {
    suggested: shouldSuggest,
    bestSlot: slotName,
    matchCount: bestSlot.count,
    totalDeclined,
    confidence,
    reason: shouldSuggest
      ? `${bestSlot.count} of ${totalDeclined} people who can't make it are free ${slotName}`
      : `Only ${bestSlot.count} of ${declinedWithAvailability} decliners are free at the same time`
  };
}

/**
 * Analyze availability insights for a specific event
 */
export async function analyzeEventAvailability(
  itineraryId: string
): Promise<EventAvailabilityInsight> {
  console.log(`[Availability Analyzer] Analyzing event ${itineraryId}`);

  // Get all RSVPs for this event
  const eventRsvps = await db
    .select()
    .from(rsvps)
    .where(eq(rsvps.itineraryId, itineraryId));

  // Filter declined (no) and maybe responses
  const declinedRsvps = eventRsvps.filter(r => isNegativeRsvp(r.response));
  const maybeRsvps = eventRsvps.filter(r => isTentativeRsvp(r.response));
  const nonYesRsvps = [...declinedRsvps, ...maybeRsvps];

  // Count how many provided availability
  const rsvpsWithAvailability = nonYesRsvps.filter(r => {
    const avail = parseAvailability(r.rsvpFeedback);
    return avail !== null;
  });

  // Get current event date to determine day
  const itinerary = await db
    .select()
    .from(itineraries)
    .where(eq(itineraries.id, itineraryId))
    .limit(1);

  const currentEventDay = itinerary[0]?.eventDate
    ? getDayAbbrev(new Date(itinerary[0].eventDate))
    : undefined;

  // Aggregate availability from all decliners
  const heatmap = aggregateAvailabilityFromRsvps(rsvpsWithAvailability);

  // Find optimal reschedule suggestion
  const suggestion = findOptimalRescheduleTimes(
    heatmap,
    nonYesRsvps.length,
    rsvpsWithAvailability.length,
    currentEventDay
  );

  // Build summary
  let summary = '';
  if (nonYesRsvps.length === 0) {
    summary = "Everyone is attending!";
  } else if (rsvpsWithAvailability.length === 0) {
    summary = `${nonYesRsvps.length} ${nonYesRsvps.length === 1 ? 'person' : 'people'} responded "No" or "Maybe"`;
  } else {
    summary = `${nonYesRsvps.length} ${nonYesRsvps.length === 1 ? 'person' : 'people'} responded "No" or "Maybe". ${rsvpsWithAvailability.length} shared availability.`;
  }

  console.log(`[Availability Analyzer] Found ${nonYesRsvps.length} non-yes, ${rsvpsWithAvailability.length} with availability`);

  return {
    declinedWithAvailability: rsvpsWithAvailability.length,
    totalDeclined: declinedRsvps.length,
    totalMaybe: maybeRsvps.length,
    declinersAvailability: heatmap,
    rescheduleSuggestion: suggestion.suggested ? suggestion : null,
    summary
  };
}

// ============================================================================
// Group-Level Pattern Learning
// ============================================================================

/**
 * Analyze historical attendance patterns by day-of-week for a group
 * Returns best/worst days based on RSVP response rates
 */
export async function analyzeGroupTimePatterns(
  groupId: string
): Promise<GroupTimePatterns> {
  console.log(`[Availability Analyzer] Analyzing group ${groupId} time patterns`);

  // Get all past itineraries for this group with their RSVPs
  const pastEvents = await db
    .select({
      itineraryId: itineraries.id,
      eventDate: itineraries.eventDate,
      response: rsvps.response
    })
    .from(itineraries)
    .leftJoin(rsvps, eq(rsvps.itineraryId, itineraries.id))
    .where(
      and(
        eq(itineraries.groupId, groupId),
        sql`${itineraries.eventDate} IS NOT NULL`,
        sql`${itineraries.eventDate} < NOW()` // Only past events
      )
    );

  // Group by event and calculate attendance
  const eventMap = new Map<string, { date: Date; yesCount: number; totalCount: number }>();

  for (const row of pastEvents) {
    if (!row.eventDate) continue;

    const key = row.itineraryId;
    if (!eventMap.has(key)) {
      eventMap.set(key, {
        date: new Date(row.eventDate),
        yesCount: 0,
        totalCount: 0
      });
    }

    const event = eventMap.get(key)!;
    if (row.response) {
      event.totalCount++;
      if (isPositiveRsvp(row.response)) {
        event.yesCount++;
      }
    }
  }

  // Calculate attendance rate by day of week
  const dayStats: Record<string, { total: number; sum: number; eventCount: number }> = {};
  for (const day of DAYS) {
    dayStats[day] = { total: 0, sum: 0, eventCount: 0 };
  }

  for (const event of eventMap.values()) {
    if (event.totalCount === 0) continue;

    const dayAbbrev = getDayAbbrev(event.date);
    const attendanceRate = (event.yesCount / event.totalCount) * 100;

    dayStats[dayAbbrev].sum += attendanceRate;
    dayStats[dayAbbrev].eventCount++;
  }

  // Calculate averages and sort
  const dayAttendance: DayAttendance[] = [];
  for (const day of DAYS) {
    if (dayStats[day].eventCount > 0) {
      dayAttendance.push({
        day: DAY_NAMES[day],
        avgAttendance: Math.round(dayStats[day].sum / dayStats[day].eventCount),
        eventCount: dayStats[day].eventCount
      });
    }
  }

  // Sort by attendance
  dayAttendance.sort((a, b) => b.avgAttendance - a.avgAttendance);

  const sampleSize = eventMap.size;

  // Determine confidence based on sample size
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (sampleSize >= 10) {
    confidence = 'high';
  } else if (sampleSize >= 5) {
    confidence = 'medium';
  }

  // Get best and worst days (top/bottom 2)
  const bestDays = dayAttendance.slice(0, 2).filter(d => d.avgAttendance >= 50);
  const worstDays = dayAttendance.slice(-2).reverse().filter(d => d.avgAttendance < 70);

  console.log(`[Availability Analyzer] Group ${groupId}: ${sampleSize} events, best: ${bestDays.map(d => d.day).join(', ')}`);

  return {
    bestDays,
    worstDays,
    sampleSize,
    confidence,
    lastUpdated: new Date()
  };
}

/**
 * Get recommended day-of-week for scheduling based on learned patterns
 * Returns array of days sorted by preference (best first)
 */
export async function getRecommendedDays(groupId: string): Promise<string[]> {
  const patterns = await analyzeGroupTimePatterns(groupId);

  // If low confidence, don't make recommendations
  if (patterns.confidence === 'low') {
    return [];
  }

  // Return best days as recommendations
  return patterns.bestDays.map(d => d.day);
}

/**
 * Get days to avoid for scheduling based on learned patterns
 */
export async function getDaysToAvoid(groupId: string): Promise<string[]> {
  const patterns = await analyzeGroupTimePatterns(groupId);

  // If low confidence, don't make recommendations
  if (patterns.confidence === 'low') {
    return [];
  }

  // Return worst days (those with <50% attendance)
  return patterns.worstDays.filter(d => d.avgAttendance < 50).map(d => d.day);
}
