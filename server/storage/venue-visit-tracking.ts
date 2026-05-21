import { db } from "../db";
import {
  venueVisitHistory,
  itineraries,
  itineraryItems,
  rsvps,
  type Itinerary,
  type ItineraryItem,
  type InsertVenueVisitHistory,
} from "@shared/schema";
import { eq, and, desc, inArray, isNotNull } from "drizzle-orm";

// Local helper: inlines a getItinerary lookup so this module doesn't depend on
// the itineraries storage domain (not yet extracted).
async function fetchItineraryWithItems(id: string): Promise<(Itinerary & { items: ItineraryItem[] }) | undefined> {
  const [itinerary] = await db
    .select()
    .from(itineraries)
    .where(eq(itineraries.id, id));

  if (!itinerary) return undefined;

  const items = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.itineraryId, id))
    .orderBy(itineraryItems.orderIndex);

  return { ...itinerary, items };
}

export const venueVisitTrackingStorage = {
  async logVenueVisits(itineraryId: string, eventDate: Date): Promise<void> {
    const itinerary = await fetchItineraryWithItems(itineraryId);
    if (!itinerary) {
      console.log(`[Visit Tracking] Itinerary ${itineraryId} not found, skipping visit logging`);
      return;
    }

    if (!itinerary.groupId) {
      console.log(`[Visit Tracking] Standalone event ${itineraryId}, skipping visit logging`);
      return;
    }

    const existingVisits = await db
      .select({ id: venueVisitHistory.id })
      .from(venueVisitHistory)
      .where(eq(venueVisitHistory.itineraryId, itineraryId))
      .limit(1);

    if (existingVisits.length > 0) {
      console.log(`[Visit Tracking] Itinerary ${itineraryId} already has venue visits logged, skipping duplicate insert`);
      return;
    }

    const visits: InsertVenueVisitHistory[] = itinerary.items
      .filter(item => item.sourceType !== 'ad_hoc')
      .map(item => ({
        groupId: itinerary.groupId!,
        activityId: item.sourceType === 'activity' ? item.sourceId : null,
        votingEventId: item.sourceType === 'voting_event' ? item.sourceId : null,
        venueName: item.venueName,
        venueType: item.venueType,
        visitedAt: eventDate,
        itineraryId,
      }));

    if (visits.length > 0) {
      await db.insert(venueVisitHistory).values(visits);
      console.log(`[Visit Tracking] Logged ${visits.length} venue visit(s) for itinerary ${itineraryId} on ${eventDate.toISOString()}`);
    } else {
      console.log(`[Visit Tracking] No trackable venues in itinerary ${itineraryId}`);
    }
  },

  async getVenueVisitHistory(groupId: string): Promise<any[]> {
    const visits = await db
      .select()
      .from(venueVisitHistory)
      .where(eq(venueVisitHistory.groupId, groupId))
      .orderBy(desc(venueVisitHistory.visitedAt));

    return visits;
  },

  async getHighlyRatedVenues(groupId: string): Promise<Array<{
    venueName: string;
    venueType: string;
    avgRating: number;
    visitCount: number;
    lastVisit: Date;
    daysSinceLastVisit: number;
  }>> {
    const visitsWithRatings = await db
      .select({
        venueName: venueVisitHistory.venueName,
        venueType: venueVisitHistory.venueType,
        visitedAt: venueVisitHistory.visitedAt,
        itineraryId: venueVisitHistory.itineraryId,
      })
      .from(venueVisitHistory)
      .where(eq(venueVisitHistory.groupId, groupId))
      .orderBy(desc(venueVisitHistory.visitedAt));

    const itineraryIds = visitsWithRatings.map(v => v.itineraryId);
    if (itineraryIds.length === 0) {
      return [];
    }

    const rsvpsWithFeedback = await db
      .select({
        itineraryId: rsvps.itineraryId,
        postEventFeedback: rsvps.postEventFeedback,
      })
      .from(rsvps)
      .where(
        and(
          inArray(rsvps.itineraryId, itineraryIds),
          isNotNull(rsvps.postEventFeedback)
        )
      );

    const itineraryRatings = new Map<string, number[]>();
    for (const rsvp of rsvpsWithFeedback) {
      const feedback = rsvp.postEventFeedback as any;
      if (feedback && typeof feedback.venueRating === 'number' && feedback.venueRating >= 4) {
        if (!itineraryRatings.has(rsvp.itineraryId)) {
          itineraryRatings.set(rsvp.itineraryId, []);
        }
        itineraryRatings.get(rsvp.itineraryId)!.push(feedback.venueRating);
      }
    }

    const venueStats = new Map<string, {
      venueName: string;
      venueType: string;
      ratings: number[];
      visits: Date[];
    }>();

    for (const visit of visitsWithRatings) {
      const ratings = itineraryRatings.get(visit.itineraryId);
      if (ratings && ratings.length > 0) {
        const key = `${visit.venueName}|||${visit.venueType}`;
        if (!venueStats.has(key)) {
          venueStats.set(key, {
            venueName: visit.venueName,
            venueType: visit.venueType,
            ratings: [],
            visits: [],
          });
        }
        const stats = venueStats.get(key)!;
        stats.ratings.push(...ratings);
        stats.visits.push(new Date(visit.visitedAt));
      }
    }

    const now = new Date();
    const results = Array.from(venueStats.values())
      .map(stats => {
        const avgRating = stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length;
        const lastVisit = new Date(Math.max(...stats.visits.map(d => d.getTime())));
        const daysSinceLastVisit = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));

        return {
          venueName: stats.venueName,
          venueType: stats.venueType,
          avgRating: Math.round(avgRating * 10) / 10,
          visitCount: stats.visits.length,
          lastVisit,
          daysSinceLastVisit,
        };
      })
      .filter(v => v.daysSinceLastVisit >= 60)
      .sort((a, b) => {
        if (Math.abs(a.avgRating - b.avgRating) < 0.1) {
          return b.daysSinceLastVisit - a.daysSinceLastVisit;
        }
        return b.avgRating - a.avgRating;
      });

    return results;
  },
};
