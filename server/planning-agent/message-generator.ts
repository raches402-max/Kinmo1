/**
 * Message Generator for Planning Insights
 *
 * Uses GPT-4o-mini to generate friendly, natural insight messages
 * from structured analyzer data.
 */

import OpenAI from 'openai';
import { logApiCall, calculateOpenAICost } from '../openai';
import {
  RawInsight,
  PlanningInsightData,
  LocationFairnessAnalysis,
} from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const INSIGHT_SYSTEM_PROMPT = `You are a friendly group planning assistant. Generate brief, warm insight messages.

Rules:
- Title: 2-4 words, friendly tone (e.g., "Time to reconnect", "Mix it up?")
- Message: ONE sentence, under 20 words, warm but concise
- Sound like a thoughtful friend, not a robot
- Be encouraging, not naggy
- Skip filler like "Hey friends" or "it looks like"
- One emoji max, only if it fits naturally

Output format: JSON with "title" and "message"`;

/**
 * Build the exact chat.completions.create request body for an insight.
 * Shared by the sync path (generateInsightMessage) and the batch queue path
 * (planning-agent/batch-processor.ts) so prompt drift is impossible.
 */
export function buildInsightRequestPayload(rawInsight: RawInsight): Record<string, unknown> {
  return {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(rawInsight) },
    ],
    temperature: 0.7,
    max_tokens: 150,
    response_format: { type: 'json_object' },
  };
}

/**
 * Given the AI's response content (or null on failure) plus the original
 * rawInsight, produce the full PlanningInsightData ready for saveInsight().
 * Used by both sync and batch paths.
 */
export function hydrateInsightFromResponse(
  rawInsight: RawInsight,
  responseContent: string | null,
): PlanningInsightData {
  let parsed: { title: string; message: string };
  try {
    parsed = JSON.parse(responseContent || '{}');
    if (!parsed.title || !parsed.message) {
      throw new Error('missing title/message');
    }
  } catch {
    parsed = {
      title: getDefaultTitle(rawInsight.type),
      message: responseContent?.trim() || getDefaultMessage(rawInsight),
    };
  }

  return {
    groupId: rawInsight.groupId,
    memberId: rawInsight.memberId,
    insightType: rawInsight.type,
    severity: rawInsight.severity,
    audienceType: rawInsight.audienceType,
    title: parsed.title,
    message: parsed.message,
    metadata: {
      ...rawInsight.metadata,
      deduplicationKey: rawInsight.deduplicationKey,
    },
    actionType: rawInsight.suggestedAction?.type,
    actionTaken: 'none',
    actionDetails: rawInsight.suggestedAction?.params,
    actionUrl: buildActionUrl(rawInsight),
    actionLabel: buildActionLabel(rawInsight),
    expiresAt: rawInsight.expiresAt,
  };
}

/**
 * Generate a friendly message for an insight using LLM (synchronous path).
 * Kept as a fallback for callers that need an immediate result.
 */
export async function generateInsightMessage(
  rawInsight: RawInsight
): Promise<PlanningInsightData> {
  const startTime = Date.now();
  const payload = buildInsightRequestPayload(rawInsight);

  try {
    const response = await openai.chat.completions.create(payload as any);
    const content = response.choices[0]?.message?.content ?? null;

    await logApiCall({
      service: 'openai',
      method: 'generateInsightMessage',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs: Date.now() - startTime,
      costEstimate: calculateOpenAICost(
        'gpt-4o-mini',
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      ),
      parameters: { insightType: rawInsight.type },
    });

    return hydrateInsightFromResponse(rawInsight, content);
  } catch (error) {
    console.error('[Message Generator] LLM error, using fallback:', error);

    await logApiCall({
      service: 'openai',
      method: 'generateInsightMessage',
      cacheStatus: 'miss',
      status: 'error',
      responseTimeMs: Date.now() - startTime,
      parameters: { insightType: rawInsight.type },
    });

    return hydrateInsightFromResponse(rawInsight, null);
  }
}

/**
 * Build prompt for the LLM based on insight type
 */
function buildPrompt(insight: RawInsight): string {
  switch (insight.type) {
    case 'location_fairness': {
      const data = insight.metadata as LocationFairnessAnalysis;

      if (data.underservedMember) {
        return `Generate an insight message about location fairness.

Context:
- The group has been meeting mostly in ${data.dominantArea || 'the same area'}
- ${data.underservedMember.memberName} travels ${data.underservedMember.averageDistance.toFixed(1)} miles on average to meet up
- Other members travel much less
- ${data.underservedMember.memberName} lives near ${data.underservedMember.nearbyArea}
- Recent meeting locations: ${data.recentLocations?.slice(0, 3).join(', ') || 'various spots'}

Suggest meeting closer to ${data.underservedMember.memberName} soon.`;
      }

      if (data.dominantArea && data.suggestedArea) {
        return `Generate an insight message about meeting location variety.

Context:
- The group has met in ${data.dominantArea} for their last ${(data as any).dominantAreaCount || 'several'} meetups
- There are group members who live in other areas like ${data.suggestedArea}
- It might be nice to mix things up and meet somewhere new

Suggest trying a new area for the next meetup.`;
      }

      return `Generate an insight about location variety. The group tends to meet in the same area.`;
    }

    case 'venue_gap': {
      const data = insight.metadata as any;

      // Handle date clustering case
      if (data.reason === 'date_clustering' && data.dateCluster) {
        const cluster = data.dateCluster;
        return `Generate an insight message about events being clustered too close together.

Context:
- There are ${cluster.eventCount} events scheduled within ${cluster.daysSpan} days
- That's a lot of meetups in a short period
- Group members might have scheduling conflicts or fatigue

Gently suggest spreading events out a bit more.`;
      }

      // Handle missing venue case
      if (data.eventsWithoutVenues?.[0]) {
        const event = data.eventsWithoutVenues[0];
        const urgencyNote = event.daysUntil <= 3
          ? "This is pretty urgent!"
          : event.daysUntil <= 7
            ? "Time to pick a spot soon."
            : "";
        return `Generate an insight message about a missing venue.

Context:
- There's an event on ${new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
- It's in ${event.daysUntil} days
- No venue has been picked yet
${urgencyNote ? `- ${urgencyNote}` : ''}

Gently nudge the organizer to pick a spot.`;
      }
      return `Generate an insight about an upcoming event that needs a venue.`;
    }

    case 'member_inclusion': {
      const data = insight.metadata as any;
      if (data.absentMembers?.[0]) {
        const member = data.absentMembers[0];
        return `Generate an insight about a member who hasn't attended recently.

Context:
- ${member.memberName} hasn't joined a meetup in ${member.daysSinceLastAttendance} days
- Maybe reach out or plan something that works for them

Be warm and caring, not guilt-trippy.`;
      }
      return `Generate an insight about including a member who hasn't attended recently.`;
    }

    case 'cadence_health': {
      const data = insight.metadata as any;

      // Handle overdue case
      if (data.reason === 'overdue') {
        return `Generate an insight message about a group that's overdue for a meetup.

Context:
- The group aims to meet ${data.statedFrequency}
- They're ${data.daysOverdue} days overdue for their next event
- No upcoming events are scheduled

Gently encourage scheduling something soon. Be friendly, not guilt-trippy.`;
      }

      // Handle member feedback case
      if (data.reason === 'member_feedback') {
        const feedbackCounts = data.frequencyFeedback || {};
        if (data.frequencyDrift === 'too_frequent') {
          return `Generate an insight message about meeting too often.

Context:
- Members have been giving feedback that the group meets too frequently
- ${feedbackCounts.too_frequent || 0} members said "too frequent"
- ${feedbackCounts.just_right || 0} said "just right"
- ${feedbackCounts.not_enough || 0} said "not enough"

Suggest considering a slightly slower pace.`;
        } else {
          return `Generate an insight message about members wanting more meetups.

Context:
- Members have been giving feedback that they want to meet more often
- ${feedbackCounts.not_enough || 0} members said "not enough"
- ${feedbackCounts.just_right || 0} said "just right"
- ${feedbackCounts.too_frequent || 0} said "too frequent"

Suggest scheduling a bit more frequently.`;
        }
      }

      // Handle general frequency drift
      if (data.frequencyDrift === 'too_infrequent') {
        return `Generate an insight about meeting frequency.

Context:
- The group aims to meet ${data.statedFrequency}
- But they're actually meeting every ${data.actualAverageDays} days on average
- That's ${data.daysOff} days less frequent than intended

Gently encourage getting back on track.`;
      }

      if (data.frequencyDrift === 'too_frequent') {
        return `Generate an insight about meeting frequency.

Context:
- The group aims to meet ${data.statedFrequency}
- But they're meeting more often than that
- Members might be getting scheduling fatigue

Gently suggest pacing themselves.`;
      }

      return `Generate an insight about the group's meeting frequency.`;
    }

    default:
      return `Generate a helpful insight message for a group planning app.`;
  }
}

/**
 * Fallback titles for each insight type
 */
function getDefaultTitle(type: string): string {
  switch (type) {
    case 'location_fairness':
      return 'Location Suggestion';
    case 'venue_gap':
      return 'Venue Needed';
    case 'date_clustering':
      return 'Scheduling Note';
    case 'member_inclusion':
      return 'Member Check-in';
    case 'cadence_health':
      return 'Meeting Frequency';
    default:
      return 'Planning Insight';
  }
}

/**
 * Fallback messages for each insight type
 */
function getDefaultMessage(insight: RawInsight): string {
  const data = insight.metadata;

  switch (insight.type) {
    case 'location_fairness':
      if ((data as LocationFairnessAnalysis).underservedMember) {
        const member = (data as LocationFairnessAnalysis).underservedMember!;
        return `Consider meeting closer to ${member.memberName} - they've been traveling ${member.averageDistance.toFixed(1)} miles on average.`;
      }
      return `You've been meeting in the same area lately. Consider mixing it up!`;

    case 'venue_gap':
      return `An upcoming event needs a venue. Pick a spot soon!`;

    case 'member_inclusion':
      return `A group member hasn't joined recently. Maybe plan something that works for them?`;

    case 'cadence_health':
      return `Your meeting frequency has drifted from your goal. Time to schedule the next one?`;

    default:
      return `Something to consider for your next group planning.`;
  }
}

/**
 * Build action URL for one-click actions
 */
function buildActionUrl(insight: RawInsight): string | undefined {
  if (!insight.suggestedAction) return undefined;

  switch (insight.suggestedAction.type) {
    case 'suggest_venue':
      return `/group/${insight.groupId}?action=discover-venues`;
    case 'create_draft':
      return `/group/${insight.groupId}?action=create-event`;
    case 'send_nudge':
      return `/group/${insight.groupId}?tab=members`;
    case 'adjust_cadence':
      return `/group/${insight.groupId}?tab=settings`;
    default:
      return `/group/${insight.groupId}`;
  }
}

/**
 * Build action label for the button
 */
function buildActionLabel(insight: RawInsight): string | undefined {
  if (!insight.suggestedAction) return undefined;

  switch (insight.suggestedAction.type) {
    case 'suggest_venue':
      return 'Find Venues';
    case 'create_draft':
      return 'Create Event';
    case 'send_nudge':
      return 'View Members';
    case 'adjust_cadence':
      return 'Adjust Frequency';
    default:
      return 'Take Action';
  }
}
