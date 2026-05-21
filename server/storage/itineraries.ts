import { db } from "../db";
import {
  itineraries,
  itineraryItems,
  activities,
  votingEvents,
  rsvps,
  itineraryInvites,
  type Itinerary,
  type InsertItinerary,
  type UpdateItinerary,
  type ItineraryItem,
  type InsertItineraryItem,
  type Rsvp,
} from "@shared/schema";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import { geocodeLocation } from "../google-places";
import {
  trustFieldsForSource,
  dirtyingTrustFields,
  ITINERARY_ITEM_DIRTYING_FIELDS,
  type TrustSource,
} from "../trust-state";
import { timeSlotsStorage } from "./time-slots";

export const itinerariesStorage = {
  async createItinerary(
    insertItinerary: InsertItinerary,
    userId: string,
    itemsData: Array<{ sourceType: 'activity' | 'voting_event' | 'ad_hoc' | 'google_place'; sourceId: string; adHocData?: any }>
  ): Promise<Itinerary> {
    if (insertItinerary.status === 'proposed' && !insertItinerary.eventDate) {
      throw new Error('Cannot create proposed itinerary without eventDate. Proposed itineraries must have a scheduled date.');
    }

    const results = await db
      .insert(itineraries)
      .values({ ...insertItinerary, createdBy: userId })
      .returning() as Itinerary[];
    const itinerary = results[0];

    if (itemsData.length > 0) {
      const itemsToInsert: InsertItineraryItem[] = [];

      for (let i = 0; i < itemsData.length; i++) {
        const item = itemsData[i];
        let venueName = '';
        let venueAddress = '';
        let venueType = '';
        let googlePlaceId = null;
        let rating = null;
        let photoUrl = null;
        let latitude = null;
        let longitude = null;
        let notes = null;
        let googleMapsUrl = null;
        let arrivalTime = null;
        let departureTime = null;
        let travelNotes = null;

        if (item.sourceType === 'activity') {
          const [activity] = await db.select().from(activities).where(eq(activities.id, item.sourceId));
          if (activity) {
            venueName = activity.venueName;
            venueAddress = activity.venueAddress || '';
            venueType = activity.venueType;
            googlePlaceId = activity.googlePlaceId;
            rating = activity.rating;
            photoUrl = activity.photoUrl;
          }
        } else if (item.sourceType === 'voting_event') {
          const [votingEvent] = await db.select().from(votingEvents).where(eq(votingEvents.id, item.sourceId));
          if (votingEvent) {
            venueName = votingEvent.title;
            venueAddress = votingEvent.venueAddress || '';
            venueType = votingEvent.venueType || 'venue';
            googlePlaceId = votingEvent.googlePlaceId;
            rating = votingEvent.rating;
            photoUrl = votingEvent.photoUrl;
          }
        } else if ((item.sourceType === 'ad_hoc' || item.sourceType === 'google_place') && item.adHocData) {
          venueName = item.adHocData.name;
          venueAddress = item.adHocData.address || '';
          venueType = item.adHocData.type || 'venue';
          googlePlaceId = item.adHocData.googlePlaceId || null;
          notes = item.adHocData.notes || null;
          googleMapsUrl = item.adHocData.googleMapsUrl || null;
          arrivalTime = item.adHocData.arrivalTime || null;
          departureTime = item.adHocData.departureTime || null;
          travelNotes = item.adHocData.travelNotes || null;

          if (venueAddress) {
            try {
              const geocoded = await geocodeLocation(venueAddress);
              if (geocoded) {
                latitude = geocoded.latitude.toString();
                longitude = geocoded.longitude.toString();
              }
            } catch (error) {
              console.error('[Create Itinerary] Error geocoding venue:', error);
            }
          }
        }

        itemsToInsert.push({
          itineraryId: itinerary.id,
          sourceType: item.sourceType,
          sourceId: (item.sourceType === 'ad_hoc' || item.sourceType === 'google_place') ? null : item.sourceId,
          venueName,
          venueAddress,
          venueType,
          googlePlaceId,
          rating,
          photoUrl,
          latitude,
          longitude,
          notes,
          googleMapsUrl,
          arrivalTime,
          departureTime,
          travelNotes,
          orderIndex: i,
        });
      }

      await db.insert(itineraryItems).values(itemsToInsert);
    }

    return itinerary;
  },

  async getGroupItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[]; rsvpCount: { yes: number; maybe: number; no: number; pending: number } }>> {
    const foundItineraries = await db
      .select()
      .from(itineraries)
      .where(and(
        eq(itineraries.groupId, groupId),
        eq(itineraries.isSaved, false)
      ))
      .orderBy(desc(itineraries.createdAt));

    const itineraryIds = foundItineraries.map(i => i.id);
    const rsvpCountByItinerary = new Map<string, { yes: number; maybe: number; no: number; pending: number }>();
    if (itineraryIds.length > 0) {
      const rsvpRows = await db
        .select({ itineraryId: rsvps.itineraryId, response: rsvps.response })
        .from(rsvps)
        .where(inArray(rsvps.itineraryId, itineraryIds));
      for (const row of rsvpRows) {
        const counts = rsvpCountByItinerary.get(row.itineraryId)
          ?? { yes: 0, maybe: 0, no: 0, pending: 0 };
        const r = (row.response || "").toLowerCase();
        if (r === "yes" || r === "going") counts.yes++;
        else if (r === "maybe" || r === "tentative") counts.maybe++;
        else if (r === "no" || r === "not_going") counts.no++;
        rsvpCountByItinerary.set(row.itineraryId, counts);
      }
    }

    const result = [];
    for (const itinerary of foundItineraries) {
      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itinerary.id))
        .orderBy(itineraryItems.orderIndex);
      const rsvpCount = rsvpCountByItinerary.get(itinerary.id)
        ?? { yes: 0, maybe: 0, no: 0, pending: 0 };
      result.push({ ...itinerary, items, rsvpCount });
    }
    return result;
  },

  async getItinerary(id: string): Promise<(Itinerary & { items: ItineraryItem[] }) | undefined> {
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
  },

  async updateItinerary(id: string, updates: UpdateItinerary): Promise<Itinerary> {
    const [itinerary] = await db
      .update(itineraries)
      .set(updates)
      .where(eq(itineraries.id, id))
      .returning();
    return itinerary;
  },

  async deleteItinerary(id: string): Promise<void> {
    await db.delete(itineraries).where(eq(itineraries.id, id));
  },

  async getItineraryItemById(itemId: string): Promise<any> {
    const [item] = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.id, itemId));
    return item;
  },

  async deleteItineraryItem(itemId: string): Promise<void> {
    await db
      .delete(itineraryItems)
      .where(eq(itineraryItems.id, itemId));
  },

  async addItineraryItems(itineraryId: string, items: Array<{ sourceType: 'activity' | 'voting_event'; sourceId: string }>): Promise<ItineraryItem[]> {
    const itemsToInsert: InsertItineraryItem[] = [];

    const existingItems = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, itineraryId));

    const maxOrderIndex = existingItems.length > 0
      ? Math.max(...existingItems.map(item => item.orderIndex || 0))
      : -1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let venueName = '';
      let venueAddress = '';
      let venueType = '';
      let googlePlaceId = null;
      let rating = null;
      let photoUrl = null;
      // Inherit trust from the source row — if the activity/voting_event was verified,
      // the itinerary item we copy from it is also verified.
      let sourceTrustState: 'verified' | 'needs_review' = 'needs_review';

      if (item.sourceType === 'activity') {
        const [activity] = await db.select().from(activities).where(eq(activities.id, item.sourceId));
        if (activity) {
          venueName = activity.venueName;
          venueAddress = activity.venueAddress || '';
          venueType = activity.venueType;
          googlePlaceId = activity.googlePlaceId;
          rating = activity.rating;
          photoUrl = activity.photoUrl;
          sourceTrustState = activity.trustState === 'verified' ? 'verified' : 'needs_review';
        }
      } else {
        const [votingEvent] = await db.select().from(votingEvents).where(eq(votingEvents.id, item.sourceId));
        if (votingEvent) {
          venueName = votingEvent.title;
          venueAddress = votingEvent.venueAddress || '';
          venueType = votingEvent.venueType || 'venue';
          googlePlaceId = votingEvent.googlePlaceId;
          rating = votingEvent.rating;
          photoUrl = votingEvent.photoUrl;
          sourceTrustState = votingEvent.trustState === 'verified' ? 'verified' : 'needs_review';
        }
      }

      let googleMapsUrl = null;
      if (googlePlaceId) {
        googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${googlePlaceId}`;
      } else if (venueName && venueAddress) {
        const query = encodeURIComponent(`${venueName}, ${venueAddress}`);
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      }

      const trust = trustFieldsForSource(sourceTrustState === 'verified' ? 'inherited' : 'ai_suggestion');

      itemsToInsert.push({
        itineraryId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        venueName,
        venueAddress,
        venueType,
        googlePlaceId,
        rating,
        photoUrl,
        googleMapsUrl,
        orderIndex: maxOrderIndex + 1 + i,
        ...trust,
      });
    }

    if (itemsToInsert.length > 0) {
      return await db.insert(itineraryItems).values(itemsToInsert).returning();
    }

    return [];
  },

  async addAdHocVenueToItinerary(
    itineraryId: string,
    venue: {
      venueName: string;
      venueAddress: string;
      venueType: string;
      googlePlaceId: string | null;
      latitude: string | null;
      longitude: string | null;
      notes: string | null;
      googleMapsUrl: string | null;
      arrivalTime: Date | null;
      departureTime: Date | null;
      travelNotes: string | null;
      rating: string | null;
      photoUrl: string | null;
    },
    trustSource: TrustSource = "manual"
  ): Promise<ItineraryItem> {
    if (venue.googlePlaceId && !venue.googlePlaceId.startsWith('ChIJ')) {
      console.warn('[Storage] WARNING: Non-standard Place ID format detected:', {
        venueName: venue.venueName,
        placeId: venue.googlePlaceId
      });
    }

    if (!venue.venueAddress && !venue.latitude) {
      console.warn('[Storage] WARNING: Venue has neither address nor coordinates:', {
        venueName: venue.venueName,
        placeId: venue.googlePlaceId
      });
    }

    const existingItems = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, itineraryId));

    const maxOrderIndex = existingItems.length > 0
      ? Math.max(...existingItems.map(item => item.orderIndex || 0))
      : -1;

    const trust = trustFieldsForSource(trustSource);

    const [newItem] = await db.insert(itineraryItems).values({
      itineraryId,
      sourceType: 'ad_hoc',
      sourceId: null,
      venueName: venue.venueName,
      venueAddress: venue.venueAddress,
      venueType: venue.venueType,
      googlePlaceId: venue.googlePlaceId,
      latitude: venue.latitude,
      longitude: venue.longitude,
      notes: venue.notes,
      googleMapsUrl: venue.googleMapsUrl,
      arrivalTime: venue.arrivalTime,
      departureTime: venue.departureTime,
      travelNotes: venue.travelNotes,
      rating: venue.rating,
      photoUrl: venue.photoUrl,
      orderIndex: maxOrderIndex + 1,
      ...trust,
    }).returning();

    return newItem;
  },

  async updateItineraryItem(
    itemId: string,
    updates: {
      venueName?: string;
      venueAddress?: string;
      venueType?: string;
      notes?: string;
      googleMapsUrl?: string;
      googlePlaceId?: string;
      latitude?: string;
      longitude?: string;
      rating?: string;
      photoUrl?: string;
      arrivalTime?: Date | null;
      departureTime?: Date | null;
      travelNotes?: string;
    }
  ): Promise<ItineraryItem | undefined> {
    const dirty = dirtyingTrustFields(updates as Record<string, unknown>, ITINERARY_ITEM_DIRTYING_FIELDS);
    const [updatedItem] = await db
      .update(itineraryItems)
      .set({ ...updates, ...(dirty ?? {}) })
      .where(eq(itineraryItems.id, itemId))
      .returning();

    return updatedItem;
  },

  async updateItineraryItemOrder(itineraryId: string, proposedOrder: string[]): Promise<void> {
    for (let i = 0; i < proposedOrder.length; i++) {
      await db
        .update(itineraryItems)
        .set({ orderIndex: i })
        .where(
          and(
            eq(itineraryItems.id, proposedOrder[i]),
            eq(itineraryItems.itineraryId, itineraryId)
          )
        );
    }
  },

  async getSavedItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[] }>> {
    const foundItineraries = await db
      .select()
      .from(itineraries)
      .where(and(
        eq(itineraries.groupId, groupId),
        eq(itineraries.isSaved, true)
      ))
      .orderBy(desc(itineraries.createdAt));

    const result = [];
    for (const itinerary of foundItineraries) {
      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itinerary.id))
        .orderBy(itineraryItems.orderIndex);
      result.push({ ...itinerary, items });
    }
    return result;
  },

  async getProposedItineraries(groupId: string): Promise<Array<Itinerary & { items: ItineraryItem[], rsvps: Rsvp[], proposedTimeSlots?: any[] }>> {
    const itinerariesWithInvites = await db
      .selectDistinct({ itineraryId: itineraryInvites.itineraryId })
      .from(itineraryInvites)
      .innerJoin(itineraries, eq(itineraries.id, itineraryInvites.itineraryId))
      .where(eq(itineraries.groupId, groupId));

    const itineraryIds = itinerariesWithInvites.map(i => i.itineraryId);

    if (itineraryIds.length === 0) {
      return [];
    }

    const foundItineraries = await db
      .select()
      .from(itineraries)
      .where(and(
        eq(itineraries.groupId, groupId),
        or(eq(itineraries.status, 'proposed'), eq(itineraries.status, 'scheduled')),
        inArray(itineraries.id, itineraryIds)
      ))
      .orderBy(desc(itineraries.createdAt));

    const result = [];
    for (const itinerary of foundItineraries) {
      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itinerary.id))
        .orderBy(itineraryItems.orderIndex);

      const itineraryRsvps = await db
        .select()
        .from(rsvps)
        .where(eq(rsvps.itineraryId, itinerary.id))
        .orderBy(desc(rsvps.createdAt));

      const timeSlots = await timeSlotsStorage.getItineraryTimeSlots(itinerary.id);
      const voteCounts = await timeSlotsStorage.getItineraryTimeSlotVoteCounts(itinerary.id);

      const timeSlotsWithVotes = timeSlots.map((slot) => {
        const counts = voteCounts.find(vc => vc.timeSlotId === slot.id);
        return {
          ...slot,
          yesCount: counts?.yesCount || 0,
          maybeCount: counts?.maybeCount || 0,
          noCount: counts?.noCount || 0,
          yesVoters: counts?.yesVoters || [],
          maybeVoters: counts?.maybeVoters || [],
          noVoters: counts?.noVoters || [],
        };
      });

      result.push({ ...itinerary, items, rsvps: itineraryRsvps, proposedTimeSlots: timeSlotsWithVotes });
    }
    return result;
  },
};
