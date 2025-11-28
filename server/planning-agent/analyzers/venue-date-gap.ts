/**
 * Venue/Date Gap Analyzer
 *
 * Detects:
 * 1. Upcoming events without a venue assigned
 * 2. Events clustered too close together
 * 3. Large gaps in the event schedule
 */

import { db } from '../../db';
import { eq, and, gt, sql, inArray, count } from 'drizzle-orm';
import { itineraries, itineraryItems, groups } from '../../../shared/schema';
import {
  Analyzer,
  RawInsight,
  VenueDateGapAnalysis,
  DEFAULT_CONFIG,
} from '../types';

export class VenueDateGapAnalyzer implements Analyzer {
  name = 'VenueDateGapAnalyzer';
  insightType = 'venue_gap' as const;

  async analyze(groupId: string): Promise<RawInsight[]> {
    const insights: RawInsight[] = [];

    try {
      // Get upcoming events for this group (next 30 days)
      const upcomingEvents = await db
        .select({
          id: itineraries.id,
          name: itineraries.name,
          status: itineraries.status,
          eventDate: itineraries.eventDate,
        })
        .from(itineraries)
        .where(
          and(
            eq(itineraries.groupId, groupId),
            gt(itineraries.eventDate, new Date()),
            sql`${itineraries.eventDate} < NOW() + INTERVAL '30 days'`,
            // Only look at events that should have venues (proposed, scheduled, draft with date)
            inArray(itineraries.status, ['proposed', 'scheduled', 'draft'])
          )
        )
        .orderBy(itineraries.eventDate);

      if (upcomingEvents.length === 0) {
        return insights;
      }

      // Check each event for venue assignment
      const eventsWithoutVenues: VenueDateGapAnalysis['eventsWithoutVenues'] = [];

      for (const event of upcomingEvents) {
        // Count items for this itinerary
        const itemCount = await db
          .select({ count: count() })
          .from(itineraryItems)
          .where(eq(itineraryItems.itineraryId, event.id));

        const venueCount = itemCount[0]?.count || 0;

        if (venueCount === 0 && event.eventDate) {
          const daysUntil = Math.ceil(
            (event.eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          // Only flag if event is within 14 days and still has no venue
          if (daysUntil <= 14) {
            eventsWithoutVenues.push({
              eventId: event.id,
              eventName: event.name || `Event on ${event.eventDate.toLocaleDateString()}`,
              eventDate: event.eventDate,
              daysUntil,
            });
          }
        }
      }

      // Generate insight for events without venues
      if (eventsWithoutVenues.length > 0) {
        // Sort by urgency (soonest first)
        eventsWithoutVenues.sort((a, b) => a.daysUntil - b.daysUntil);

        const mostUrgent = eventsWithoutVenues[0];
        const severity = mostUrgent.daysUntil <= 3 ? 'action_needed' :
                        mostUrgent.daysUntil <= 7 ? 'suggestion' : 'info';

        const analysis: VenueDateGapAnalysis = {
          eventsWithoutVenues,
        };

        insights.push({
          type: 'venue_gap',
          severity,
          audienceType: 'organizer',
          groupId,
          metadata: analysis,
          suggestedAction: {
            type: 'suggest_venue',
            params: {
              eventId: mostUrgent.eventId,
              eventDate: mostUrgent.eventDate,
            },
          },
          deduplicationKey: `venue_gap_${groupId}_${mostUrgent.eventId}`,
          expiresAt: mostUrgent.eventDate, // Expires when the event happens
        });
      }

      // Check for date clustering (events too close together)
      if (upcomingEvents.length >= 2) {
        const eventsWithDates = upcomingEvents.filter(e => e.eventDate);

        for (let i = 0; i < eventsWithDates.length - 1; i++) {
          const current = eventsWithDates[i];
          const next = eventsWithDates[i + 1];

          if (current.eventDate && next.eventDate) {
            const daysBetween = Math.ceil(
              (next.eventDate.getTime() - current.eventDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Flag if events are within the cluster threshold (default 5 days)
            if (daysBetween <= DEFAULT_CONFIG.clusterDaysThreshold && daysBetween > 0) {
              // Check if we have enough events in a cluster
              let clusterCount = 2;
              const clusterDates = [current.eventDate, next.eventDate];

              // Look ahead for more clustered events
              for (let j = i + 2; j < eventsWithDates.length; j++) {
                const futureEvent = eventsWithDates[j];
                if (futureEvent.eventDate) {
                  const lastClusterDate = clusterDates[clusterDates.length - 1];
                  const daysFromLast = Math.ceil(
                    (futureEvent.eventDate.getTime() - lastClusterDate.getTime()) / (1000 * 60 * 60 * 24)
                  );

                  if (daysFromLast <= DEFAULT_CONFIG.clusterDaysThreshold) {
                    clusterCount++;
                    clusterDates.push(futureEvent.eventDate);
                  } else {
                    break;
                  }
                }
              }

              if (clusterCount >= DEFAULT_CONFIG.clusterCountThreshold) {
                const analysis: VenueDateGapAnalysis = {
                  eventsWithoutVenues: [],
                  dateCluster: {
                    dates: clusterDates,
                    daysSpan: Math.ceil(
                      (clusterDates[clusterDates.length - 1].getTime() - clusterDates[0].getTime()) /
                      (1000 * 60 * 60 * 24)
                    ),
                    eventCount: clusterCount,
                  },
                };

                insights.push({
                  type: 'venue_gap', // Using venue_gap type since date_clustering maps to it
                  severity: 'info',
                  audienceType: 'organizer',
                  groupId,
                  metadata: {
                    ...analysis,
                    reason: 'date_clustering',
                  },
                  suggestedAction: {
                    type: 'adjust_cadence',
                    params: {
                      clusterDates,
                      eventCount: clusterCount,
                    },
                  },
                  deduplicationKey: `date_cluster_${groupId}_${clusterDates[0].toISOString().split('T')[0]}`,
                  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
                });

                // Skip ahead past the cluster we just processed
                i += clusterCount - 2;
              }
            }
          }
        }
      }

      return insights;
    } catch (error) {
      console.error(`[VenueDateGapAnalyzer] Error analyzing group ${groupId}:`, error);
      throw error;
    }
  }
}
