/**
 * Group Insights System
 *
 * Generates actionable insights for organizers based on:
 * 1. Budget patterns (member concerns + actual spending)
 * 2. Availability patterns (day/time success rates)
 * 3. Activity type distribution (what they've done)
 */

import { db } from './db.js';
import {
  groups,
  members,
  itineraries,
  itineraryItems,
  rsvps
} from '../shared/schema.js';
import { eq, and, desc, gte, sql } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface BudgetInsight {
  recentAverage: number | null; // avg price of last 3 completed events (null if no data)
  membersConcerned: number; // count of members with budget concerns
  suggestion: string | null; // actionable suggestion
  dismissed: boolean; // whether organizer dismissed
}

export interface AvailabilityInsight {
  lowTurnoutDays: Array<{
    day: string; // "Thursday"
    consecutiveCount: number; // streak of low turnout
    averageAttendance: number; // avg attendance rate (0-100)
    totalEvents: number; // how many events analyzed
  }>;
  bestDays: Array<{
    day: string;
    attendanceRate: number; // 0-100
    totalEvents: number;
  }>;
  suggestion: string | null;
  dismissed: boolean;
}

export interface ActivityTypeInsight {
  distribution: Array<{
    category: string; // "Asian Food", "Bars", "Cafes"
    count: number;
    percentage: number; // 0-100
  }>;
  suggestion: string | null;
  dismissed: boolean;
}

export interface GroupInsights {
  budget: BudgetInsight;
  availability: AvailabilityInsight;
  activityTypes: ActivityTypeInsight;
  generatedAt: Date;
}

// ============================================================================
// BUDGET INSIGHTS
// ============================================================================

/**
 * Analyzes budget patterns from completed events and member constraints
 */
export async function generateBudgetInsights(groupId: string): Promise<BudgetInsight> {
  // Get members with budget concerns
  const groupMembers = await db
    .select({
      id: members.id,
      memberConstraints: members.memberConstraints,
    })
    .from(members)
    .where(eq(members.groupId, groupId));

  const membersConcerned = groupMembers.filter(m => {
    const constraints = m.memberConstraints as any;
    return constraints?.budgetConcern === true;
  }).length;

  // Get last 3 completed events with pricing data
  // We'll look at itinerary items and try to estimate cost
  const recentItineraries = await db
    .select({
      id: itineraries.id,
      eventDate: itineraries.eventDate,
    })
    .from(itineraries)
    .where(
      and(
        eq(itineraries.groupId, groupId),
        eq(itineraries.status, 'scheduled')
      )
    )
    .orderBy(desc(itineraries.eventDate))
    .limit(3);

  let recentAverage: number | null = null;

  // See TODO.md: "Price Estimation in Group Insights" for planned venue price tracking
  // For now, we'll use the group's budget range as a proxy
  // In future: parse venue data from Google Places or post-event feedback

  // Generate suggestion
  let suggestion: string | null = null;
  if (membersConcerned >= 2) {
    suggestion = `${membersConcerned} members have budget concerns. Consider venues at $ or $$ price levels.`;
  }

  return {
    recentAverage,
    membersConcerned,
    suggestion,
    dismissed: false,
  };
}

// ============================================================================
// AVAILABILITY INSIGHTS
// ============================================================================

/**
 * Analyzes day-of-week patterns from past events
 */
export async function generateAvailabilityInsights(groupId: string): Promise<AvailabilityInsight> {
  // Get last 10 events with RSVP data
  const recentEvents = await db
    .select({
      id: itineraries.id,
      eventDate: itineraries.eventDate,
    })
    .from(itineraries)
    .where(
      and(
        eq(itineraries.groupId, groupId),
        eq(itineraries.status, 'scheduled')
      )
    )
    .orderBy(desc(itineraries.eventDate))
    .limit(10);

  // Calculate attendance rate per day of week
  const dayStats: Record<string, { yesCount: number; totalRsvps: number; events: number }> = {};
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const event of recentEvents) {
    if (!event.eventDate) continue;

    const dayOfWeek = days[event.eventDate.getDay()];

    // Get RSVPs for this event
    const eventRsvps = await db
      .select({
        response: rsvps.response,
      })
      .from(rsvps)
      .where(eq(rsvps.itineraryId, event.id));

    const yesRsvps = eventRsvps.filter(r => r.response === 'yes').length;
    const totalRsvps = eventRsvps.length;

    if (!dayStats[dayOfWeek]) {
      dayStats[dayOfWeek] = { yesCount: 0, totalRsvps: 0, events: 0 };
    }

    dayStats[dayOfWeek].yesCount += yesRsvps;
    dayStats[dayOfWeek].totalRsvps += totalRsvps;
    dayStats[dayOfWeek].events += 1;
  }

  // Calculate attendance rates
  const dayResults = Object.entries(dayStats).map(([day, stats]) => ({
    day,
    attendanceRate: stats.totalRsvps > 0
      ? Math.round((stats.yesCount / stats.totalRsvps) * 100)
      : 0,
    totalEvents: stats.events,
  }));

  // Identify low turnout days (< 50% attendance, at least 2 events)
  const lowTurnoutDays = dayResults
    .filter(d => d.attendanceRate < 50 && d.totalEvents >= 2)
    .map(d => ({
      day: d.day,
      consecutiveCount: d.totalEvents, // See TODO.md: "Consecutive Streak Calculation" for planned improvement
      averageAttendance: d.attendanceRate,
      totalEvents: d.totalEvents,
    }));

  // Identify best days (> 70% attendance)
  const bestDays = dayResults
    .filter(d => d.attendanceRate > 70 && d.totalEvents >= 1)
    .sort((a, b) => b.attendanceRate - a.attendanceRate)
    .slice(0, 3);

  // Generate suggestion
  let suggestion: string | null = null;
  if (lowTurnoutDays.length > 0 && bestDays.length > 0) {
    const lowDayNames = lowTurnoutDays.map(d => d.day).join(', ');
    const bestDayNames = bestDays.slice(0, 2).map(d => d.day).join(' or ');
    suggestion = `${lowDayNames} events have low attendance. Try scheduling on ${bestDayNames} instead.`;
  }

  return {
    lowTurnoutDays,
    bestDays,
    suggestion,
    dismissed: false,
  };
}

// ============================================================================
// ACTIVITY TYPE INSIGHTS
// ============================================================================

/**
 * Analyzes distribution of activity types from past events
 */
export async function generateActivityTypeInsights(groupId: string): Promise<ActivityTypeInsight> {
  // Get all completed/scheduled itineraries
  const pastItineraries = await db
    .select({ id: itineraries.id })
    .from(itineraries)
    .where(
      and(
        eq(itineraries.groupId, groupId),
        sql`${itineraries.status} IN ('scheduled', 'saved')`
      )
    )
    .limit(20); // Last 20 events

  // Get all itinerary items from these events
  const itineraryIds = pastItineraries.map(i => i.id);

  if (itineraryIds.length === 0) {
    return {
      distribution: [],
      suggestion: 'Not enough event history yet. Check back after a few events!',
      dismissed: false,
    };
  }

  const items = await db
    .select({
      venueType: itineraryItems.venueType,
      venueName: itineraryItems.venueName,
    })
    .from(itineraryItems)
    .where(sql`${itineraryItems.itineraryId} = ANY(${itineraryIds})`);

  // Count by category (simplify venue types into broad categories)
  const categoryCounts: Record<string, number> = {};
  const categoryMapping: Record<string, string> = {
    'restaurant': 'Restaurants',
    'meal': 'Restaurants',
    'cafe': 'Cafes',
    'coffee': 'Cafes',
    'bar': 'Bars & Drinks',
    'drinks': 'Bars & Drinks',
    'wine': 'Bars & Drinks',
    'dessert': 'Desserts',
    'experience': 'Experiences',
    'activity': 'Experiences',
  };

  for (const item of items) {
    const venueType = item.venueType?.toLowerCase() || 'other';

    // Map to category
    let category = 'Other';
    for (const [key, cat] of Object.entries(categoryMapping)) {
      if (venueType.includes(key)) {
        category = cat;
        break;
      }
    }

    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }

  const totalItems = items.length;

  // Convert to distribution array
  const distribution = Object.entries(categoryCounts)
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / totalItems) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Generate suggestion (if one category dominates > 40%)
  let suggestion: string | null = null;
  const dominantCategory = distribution[0];
  if (dominantCategory && dominantCategory.percentage > 40) {
    suggestion = `You've done a lot of ${dominantCategory.category} (${dominantCategory.percentage}%). Consider branching out to other activity types.`;
  }

  return {
    distribution,
    suggestion,
    dismissed: false,
  };
}

// ============================================================================
// MAIN INSIGHTS GENERATOR
// ============================================================================

/**
 * Generates all insights for a group
 */
export async function generateGroupInsights(groupId: string): Promise<GroupInsights> {
  const [budget, availability, activityTypes] = await Promise.all([
    generateBudgetInsights(groupId),
    generateAvailabilityInsights(groupId),
    generateActivityTypeInsights(groupId),
  ]);

  return {
    budget,
    availability,
    activityTypes,
    generatedAt: new Date(),
  };
}

/**
 * Saves insights to the database
 */
export async function saveGroupInsights(groupId: string, insights: GroupInsights): Promise<void> {
  await db
    .update(groups)
    .set({
      preferenceInsights: insights as any,
      lastInsightsUpdate: new Date(),
    })
    .where(eq(groups.id, groupId));
}

/**
 * Dismisses a specific insight
 */
export async function dismissInsight(
  groupId: string,
  insightType: 'budget' | 'availability' | 'activityTypes'
): Promise<void> {
  // Get current insights
  const group = await db
    .select({ preferenceInsights: groups.preferenceInsights })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group[0] || !group[0].preferenceInsights) return;

  const insights = group[0].preferenceInsights as GroupInsights;
  insights[insightType].dismissed = true;

  await saveGroupInsights(groupId, insights);
}

/**
 * Edits an insight suggestion
 */
export async function editInsightSuggestion(
  groupId: string,
  insightType: 'budget' | 'availability' | 'activityTypes',
  newSuggestion: string
): Promise<void> {
  const group = await db
    .select({ preferenceInsights: groups.preferenceInsights })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group[0] || !group[0].preferenceInsights) return;

  const insights = group[0].preferenceInsights as GroupInsights;
  insights[insightType].suggestion = newSuggestion;

  await saveGroupInsights(groupId, insights);
}
