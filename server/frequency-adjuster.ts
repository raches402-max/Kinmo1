// Auto-adjust group meeting frequency based on post-event feedback
import { db } from "./db";
import { rsvps, groups } from "@shared/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";

/**
 * Analyzes frequency feedback from recent post-event surveys
 * and auto-adjusts the group's meeting frequency if there's a clear pattern
 *
 * Logic:
 * - Looks at last 10 post-event feedbacks with frequencyPreference
 * - If 50%+ say "too_frequent" → reduce frequency (weekly → biweekly → monthly)
 * - If 50%+ say "not_frequent_enough" → increase frequency (monthly → biweekly → weekly)
 * - Returns recommendation or null if no clear pattern
 */
export async function analyzeAndAdjustFrequency(groupId: string): Promise<{
  currentFrequency: string;
  recommendedFrequency: string | null;
  applied: boolean;
  reason: string;
} | null> {
  // Get the group's current frequency
  const group = await db
    .select({ meetingFrequency: groups.meetingFrequency })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group || group.length === 0) {
    return null;
  }

  const currentFrequency = group[0].meetingFrequency;

  // Get recent post-event feedback with frequency preferences
  // We'll look at RSVPs tied to the group's itineraries
  const recentFeedback = await db
    .select({
      postEventFeedback: rsvps.postEventFeedback,
      createdAt: rsvps.createdAt,
    })
    .from(rsvps)
    .innerJoin(
      db.$with('group_itineraries').as(
        db.select({ id: groups.id })
          .from(groups)
          .where(eq(groups.id, groupId))
      ),
      // This is a simplified join - in practice we'd join through itineraries
      // For now, we'll use a different approach
    )
    .where(
      and(
        isNotNull(rsvps.postEventFeedback)
      )
    )
    .orderBy(desc(rsvps.createdAt))
    .limit(10);

  // Actually, let's simplify - we need to query through the itineraries table
  // Let me rewrite this more directly:

  const feedbackQuery = await db.execute<{
    frequency_preference: string;
  }>(
    `
    SELECT
      (r.post_event_feedback->>'frequencyPreference') as frequency_preference
    FROM rsvps r
    INNER JOIN itineraries i ON r.itinerary_id = i.id
    WHERE i.group_id = $1
      AND r.post_event_feedback IS NOT NULL
      AND r.post_event_feedback->>'frequencyPreference' IS NOT NULL
    ORDER BY r.created_at DESC
    LIMIT 10
    `,
    [groupId]
  );

  const feedbackRows = feedbackQuery.rows || [];

  if (feedbackRows.length < 3) {
    // Not enough data to make a recommendation
    return {
      currentFrequency,
      recommendedFrequency: null,
      applied: false,
      reason: `Insufficient feedback data (${feedbackRows.length} responses, need at least 3)`,
    };
  }

  // Count the feedback
  let tooFrequentCount = 0;
  let notFrequentEnoughCount = 0;
  let justRightCount = 0;

  feedbackRows.forEach((row: any) => {
    const pref = row.frequency_preference;
    if (pref === 'too_frequent') tooFrequentCount++;
    else if (pref === 'not_frequent_enough') notFrequentEnoughCount++;
    else if (pref === 'just_right') justRightCount++;
  });

  const totalResponses = feedbackRows.length;
  const tooFrequentPercent = (tooFrequentCount / totalResponses) * 100;
  const notFrequentEnoughPercent = (notFrequentEnoughCount / totalResponses) * 100;

  // Determine if we should adjust
  let recommendedFrequency: string | null = null;
  let reason = '';

  // 50%+ threshold for making a change
  if (tooFrequentPercent >= 50) {
    // Reduce frequency
    if (currentFrequency === 'weekly') {
      recommendedFrequency = 'biweekly';
      reason = `${tooFrequentCount}/${totalResponses} members said events are too frequent - reducing from weekly to biweekly`;
    } else if (currentFrequency === 'biweekly') {
      recommendedFrequency = 'monthly';
      reason = `${tooFrequentCount}/${totalResponses} members said events are too frequent - reducing from biweekly to monthly`;
    } else {
      // Already at monthly, can't reduce further
      reason = `${tooFrequentCount}/${totalResponses} members said events are too frequent, but already at minimum frequency (monthly)`;
    }
  } else if (notFrequentEnoughPercent >= 50) {
    // Increase frequency
    if (currentFrequency === 'monthly') {
      recommendedFrequency = 'biweekly';
      reason = `${notFrequentEnoughCount}/${totalResponses} members want more frequent events - increasing from monthly to biweekly`;
    } else if (currentFrequency === 'biweekly') {
      recommendedFrequency = 'weekly';
      reason = `${notFrequentEnoughCount}/${totalResponses} members want more frequent events - increasing from biweekly to weekly`;
    } else {
      // Already at weekly, can't increase further
      reason = `${notFrequentEnoughCount}/${totalResponses} members want more frequent events, but already at maximum frequency (weekly)`;
    }
  } else {
    reason = `No clear pattern (${tooFrequentCount} too frequent, ${notFrequentEnoughCount} not frequent enough, ${justRightCount} just right)`;
  }

  // Apply the change if recommended
  let applied = false;
  if (recommendedFrequency && recommendedFrequency !== currentFrequency) {
    await db
      .update(groups)
      .set({ meetingFrequency: recommendedFrequency })
      .where(eq(groups.id, groupId));
    applied = true;

    console.log(`[Frequency Adjuster] Updated group ${groupId} frequency: ${currentFrequency} → ${recommendedFrequency}`);
    console.log(`[Frequency Adjuster] Reason: ${reason}`);
  }

  return {
    currentFrequency,
    recommendedFrequency,
    applied,
    reason,
  };
}

/**
 * Helper to get frequency feedback summary for a group
 * Useful for displaying in UI or debugging
 */
export async function getFrequencyFeedbackSummary(groupId: string): Promise<{
  totalFeedback: number;
  tooFrequent: number;
  justRight: number;
  notFrequentEnough: number;
  recentFeedback: Array<{
    preference: string;
    eventDate: Date;
  }>;
}> {
  const feedbackQuery = await db.execute<{
    frequency_preference: string;
    created_at: string;
  }>(
    `
    SELECT
      (r.post_event_feedback->>'frequencyPreference') as frequency_preference,
      r.created_at
    FROM rsvps r
    INNER JOIN itineraries i ON r.itinerary_id = i.id
    WHERE i.group_id = $1
      AND r.post_event_feedback IS NOT NULL
      AND r.post_event_feedback->>'frequencyPreference' IS NOT NULL
    ORDER BY r.created_at DESC
    LIMIT 20
    `,
    [groupId]
  );

  const feedbackRows = feedbackQuery.rows || [];

  let tooFrequent = 0;
  let justRight = 0;
  let notFrequentEnough = 0;

  const recentFeedback = feedbackRows.map((row: any) => {
    const pref = row.frequency_preference;
    if (pref === 'too_frequent') tooFrequent++;
    else if (pref === 'just_right') justRight++;
    else if (pref === 'not_frequent_enough') notFrequentEnough++;

    return {
      preference: pref,
      eventDate: new Date(row.created_at),
    };
  });

  return {
    totalFeedback: feedbackRows.length,
    tooFrequent,
    justRight,
    notFrequentEnough,
    recentFeedback,
  };
}
