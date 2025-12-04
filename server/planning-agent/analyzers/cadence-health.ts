/**
 * Cadence Health Analyzer
 *
 * Detects when a group's meeting frequency drifts from their stated goal:
 * - Meeting less often than intended
 * - Next event overdue
 * - Member feedback indicates frequency issues
 */

import { db } from '../../db';
import { eq, and, desc, sql, gt, isNotNull } from 'drizzle-orm';
import { groups, itineraries, frequencyFeedback } from '../../../shared/schema';
import {
  Analyzer,
  RawInsight,
  CadenceHealthAnalysis,
  DEFAULT_CONFIG,
} from '../types';

// Convert frequency string to expected days between events
function frequencyToDays(frequency: string): number {
  if (!frequency) return 7; // Default to weekly

  const normalized = frequency.toLowerCase().trim();

  // Handle various formats
  if (normalized.includes('week')) {
    if (normalized.includes('2x') || normalized.includes('twice')) {
      return 3.5; // Twice a week
    }
    if (normalized.includes('bi') || normalized.includes('every other') || normalized.includes('every 2')) {
      return 14; // Biweekly
    }
    return 7; // Weekly
  }

  if (normalized.includes('month')) {
    if (normalized.includes('2x') || normalized.includes('twice')) {
      return 15; // Twice a month
    }
    return 30; // Monthly
  }

  if (normalized.includes('biweekly') || normalized.includes('bi-weekly')) {
    return 14;
  }

  // Default to weekly if unknown
  return 7;
}

export class CadenceHealthAnalyzer implements Analyzer {
  name = 'CadenceHealthAnalyzer';
  insightType = 'cadence_health' as const;

  async analyze(groupId: string): Promise<RawInsight[]> {
    const insights: RawInsight[] = [];

    try {
      // Get group info
      const groupResult = await db
        .select({
          meetingFrequency: groups.meetingFrequency,
          lastEventDate: groups.lastEventDate,
          nextEventDueDate: groups.nextEventDueDate,
          name: groups.name,
        })
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1);

      if (groupResult.length === 0) {
        return insights;
      }

      const group = groupResult[0];
      const expectedDays = frequencyToDays(group.meetingFrequency);

      // Get recent completed events to calculate actual frequency
      const recentEvents = await db
        .select({
          eventDate: itineraries.eventDate,
        })
        .from(itineraries)
        .where(
          and(
            eq(itineraries.groupId, groupId),
            eq(itineraries.status, 'scheduled'),
            isNotNull(itineraries.eventDate),
            sql`${itineraries.eventDate} < NOW()` // Past events
          )
        )
        .orderBy(desc(itineraries.eventDate))
        .limit(10);

      // Calculate actual average days between events
      let actualAverageDays: number | null = null;
      let lastEventDate: Date | null = group.lastEventDate;

      if (recentEvents.length >= 2) {
        const dates = recentEvents
          .filter(e => e.eventDate)
          .map(e => e.eventDate!.getTime())
          .sort((a, b) => b - a); // Most recent first

        if (dates.length >= 2) {
          let totalGap = 0;
          for (let i = 0; i < dates.length - 1; i++) {
            totalGap += dates[i] - dates[i + 1];
          }
          actualAverageDays = Math.round(totalGap / (dates.length - 1) / (1000 * 60 * 60 * 24));
          lastEventDate = new Date(dates[0]);
        }
      }

      // Check for frequency drift (meeting less often than intended)
      if (actualAverageDays !== null) {
        const daysOff = actualAverageDays - expectedDays;

        // Flag if meeting significantly less often than intended (threshold from config)
        if (daysOff > DEFAULT_CONFIG.cadenceDriftDaysThreshold) {
          const analysis: CadenceHealthAnalysis = {
            statedFrequency: group.meetingFrequency,
            expectedDaysBetween: expectedDays,
            actualAverageDays,
            lastEventDate: lastEventDate || undefined,
            frequencyDrift: 'too_infrequent',
            daysOff,
          };

          insights.push({
            type: 'cadence_health',
            severity: daysOff > expectedDays ? 'suggestion' : 'info',
            audienceType: 'organizer',
            groupId,
            metadata: analysis,
            suggestedAction: {
              type: 'create_draft',
              params: {
                reason: 'cadence_drift',
                suggestedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
            },
            deduplicationKey: `cadence_drift_${groupId}_${Math.floor(actualAverageDays / 7)}w`,
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          });
        }
      }

      // Check if next event is overdue
      if (group.nextEventDueDate && group.nextEventDueDate < new Date()) {
        const daysOverdue = Math.ceil(
          (Date.now() - group.nextEventDueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Only flag if significantly overdue (more than threshold)
        if (daysOverdue > DEFAULT_CONFIG.cadenceDriftDaysThreshold) {
          // Check if there's already an upcoming event scheduled
          const upcomingEvents = await db
            .select({ id: itineraries.id })
            .from(itineraries)
            .where(
              and(
                eq(itineraries.groupId, groupId),
                gt(itineraries.eventDate, new Date()),
                sql`${itineraries.status} IN ('proposed', 'scheduled')`
              )
            )
            .limit(1);

          // Only alert if no upcoming events
          if (upcomingEvents.length === 0) {
            const analysis: CadenceHealthAnalysis = {
              statedFrequency: group.meetingFrequency,
              expectedDaysBetween: expectedDays,
              actualAverageDays: actualAverageDays || expectedDays + daysOverdue,
              lastEventDate: lastEventDate || undefined,
              frequencyDrift: 'too_infrequent',
              daysOff: daysOverdue,
            };

            insights.push({
              type: 'cadence_health',
              severity: daysOverdue > 14 ? 'action_needed' : 'suggestion',
              audienceType: 'organizer',
              groupId,
              metadata: {
                ...analysis,
                reason: 'overdue',
                daysOverdue,
              },
              suggestedAction: {
                type: 'create_draft',
                params: {
                  reason: 'overdue',
                  daysOverdue,
                },
              },
              deduplicationKey: `cadence_overdue_${groupId}`,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            });
          }
        }
      }

      // Check member frequency feedback (simplified)
      try {
        const feedbackResults = await db
          .select({
            feedback: frequencyFeedback.feedback,
          })
          .from(frequencyFeedback)
          .where(
            and(
              eq(frequencyFeedback.groupId, groupId),
              sql`${frequencyFeedback.createdAt} > NOW() - INTERVAL '90 days'`
            )
          );

        if (feedbackResults && feedbackResults.length >= 3) {
          const counts = {
            tooFrequent: 0,
            justRight: 0,
            notEnough: 0,
          };

          for (const f of feedbackResults) {
            if (f.feedback === 'less_often') counts.tooFrequent++;
            else if (f.feedback === 'just_right') counts.justRight++;
            else if (f.feedback === 'more_often') counts.notEnough++;
          }

          const total = counts.tooFrequent + counts.justRight + counts.notEnough;

          // If majority says not enough, suggest more frequent meetings
          if (total > 0 && counts.notEnough / total > 0.5) {
            const analysis: CadenceHealthAnalysis = {
              statedFrequency: group.meetingFrequency,
              expectedDaysBetween: expectedDays,
              actualAverageDays: actualAverageDays || expectedDays,
              frequencyDrift: 'too_infrequent',
              daysOff: 0,
              frequencyFeedback: counts,
            };

            insights.push({
              type: 'cadence_health',
              severity: 'info',
              audienceType: 'organizer',
              groupId,
              metadata: {
                ...analysis,
                reason: 'member_feedback',
              },
              suggestedAction: {
                type: 'adjust_cadence',
                params: {
                  currentFrequency: group.meetingFrequency,
                  suggestion: 'more_frequent',
                  feedbackSummary: counts,
                },
              },
              deduplicationKey: `cadence_feedback_${groupId}_more`,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
          }

          // If majority says too frequent, suggest less frequent meetings
          if (total > 0 && counts.tooFrequent / total > 0.5) {
            const analysis: CadenceHealthAnalysis = {
              statedFrequency: group.meetingFrequency,
              expectedDaysBetween: expectedDays,
              actualAverageDays: actualAverageDays || expectedDays,
              frequencyDrift: 'too_frequent',
              daysOff: 0,
              frequencyFeedback: counts,
            };

            insights.push({
              type: 'cadence_health',
              severity: 'info',
              audienceType: 'organizer',
              groupId,
              metadata: {
                ...analysis,
                reason: 'member_feedback',
              },
              suggestedAction: {
                type: 'adjust_cadence',
                params: {
                  currentFrequency: group.meetingFrequency,
                  suggestion: 'less_frequent',
                  feedbackSummary: counts,
                },
              },
              deduplicationKey: `cadence_feedback_${groupId}_less`,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
          }
        }
      } catch (feedbackError) {
        // Feedback query failed, but continue with other analysis
        console.error(`[CadenceHealthAnalyzer] Feedback query failed for ${groupId}:`, feedbackError);
      }

      return insights;
    } catch (error) {
      console.error(`[CadenceHealthAnalyzer] Error analyzing group ${groupId}:`, error);
      throw error;
    }
  }
}
