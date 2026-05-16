/**
 * Insight Renderer
 *
 * Pure render functions: derive display content (title, message, action URL,
 * action label) from `insightType` + `metadata` + `actionType` at read time.
 * No LLM, no I/O.
 *
 * History: this used to call gpt-4o-mini per insight and persist the
 * generated text as DB columns. Copy and URL changes then required a
 * backfill of every existing row. Replaced with templates so changes
 * take effect on next page load.
 */

import {
  RawInsight,
  PlanningInsightData,
  LocationFairnessAnalysis,
} from './types';

export function renderInsightTitle(insightType: string): string {
  switch (insightType) {
    case 'location_fairness': return 'Location Suggestion';
    case 'venue_gap': return 'Venue Needed';
    case 'date_clustering': return 'Scheduling Note';
    case 'member_inclusion': return 'Member Check-in';
    case 'cadence_health': return 'Meeting Frequency';
    default: return 'Planning Insight';
  }
}

export function renderInsightMessage(insightType: string, metadata: unknown): string {
  const data = metadata as Record<string, any> | null | undefined;

  switch (insightType) {
    case 'location_fairness': {
      const fairness = data as LocationFairnessAnalysis | undefined;
      if (fairness?.underservedMember) {
        const m = fairness.underservedMember;
        return `Want to meet closer to ${m.memberName} next time? They've been traveling about ${m.averageDistance.toFixed(1)} miles on average.`;
      }
      return `You've been meeting in the same area lately. Could be fun to mix it up.`;
    }

    case 'venue_gap': {
      if (data?.reason === 'date_clustering' && data.dateCluster) {
        const c = data.dateCluster;
        return `You've got ${c.eventCount} events within ${c.daysSpan} days. Might be worth spreading them out a bit.`;
      }
      const event = data?.eventsWithoutVenues?.[0];
      if (event?.eventDate) {
        const date = new Date(event.eventDate).toLocaleDateString('en-US', {
          weekday: 'long', month: 'short', day: 'numeric',
        });
        return `Heads up — ${date} is coming up in ${event.daysUntil} days and there's no venue yet. Want to pick one?`;
      }
      return `An upcoming event needs a venue. Pick a spot when you have a sec.`;
    }

    case 'member_inclusion': {
      const m = data?.absentMembers?.[0];
      if (m?.memberName) {
        return `${m.memberName} hasn't joined a meetup in a while. Want to plan something that works for them?`;
      }
      return `A group member hasn't joined recently. Maybe plan something that works for them?`;
    }

    case 'cadence_health': {
      if (data?.frequencyDrift === 'too_frequent') {
        return `You've been meeting more often than usual lately. No pressure to keep that pace if it's a lot.`;
      }
      return `It might have been a while since last time you met. Is it time to schedule the next one?`;
    }

    default:
      return `Something to consider for your next group planning.`;
  }
}

export function renderActionUrl(
  actionType: string | null | undefined,
  groupId: string,
): string | undefined {
  if (!actionType) return undefined;
  switch (actionType) {
    case 'suggest_venue': return `/group/${groupId}?action=discover`;
    case 'create_draft': return `/group/${groupId}?action=schedule`;
    case 'send_nudge': return `/group/${groupId}?tab=members`;
    case 'adjust_cadence': return `/group/${groupId}?tab=settings`;
    default: return `/group/${groupId}`;
  }
}

export function renderActionLabel(actionType: string | null | undefined): string | undefined {
  if (!actionType) return undefined;
  switch (actionType) {
    case 'suggest_venue': return 'Find Venues';
    case 'create_draft': return 'Create Event';
    case 'send_nudge': return 'View Members';
    case 'adjust_cadence': return 'Adjust Frequency';
    default: return 'Take Action';
  }
}

/**
 * Shape a raw insight for persistence. Only the structural fields are
 * stored — display content is rendered fresh on every read.
 */
export function generateInsightMessage(rawInsight: RawInsight): PlanningInsightData {
  return {
    groupId: rawInsight.groupId,
    memberId: rawInsight.memberId,
    insightType: rawInsight.type,
    severity: rawInsight.severity,
    audienceType: rawInsight.audienceType,
    metadata: {
      ...(rawInsight.metadata as Record<string, unknown>),
      deduplicationKey: rawInsight.deduplicationKey,
    },
    actionType: rawInsight.suggestedAction?.type,
    actionTaken: 'none',
    actionDetails: rawInsight.suggestedAction?.params,
    expiresAt: rawInsight.expiresAt,
  };
}
