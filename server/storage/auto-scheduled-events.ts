import { db } from "../db";
import {
  autoScheduledEvents,
  itineraries,
  itineraryItems,
  itineraryOptions,
  groups,
  type AutoScheduledEvent,
  type InsertAutoScheduledEvent,
  type Itinerary,
  type ItineraryItem,
} from "@shared/schema";
import { eq, and, or, desc, asc, inArray, isNull, gte, sql } from "drizzle-orm";
import { itinerariesStorage } from "./itineraries";

export const autoScheduledEventsStorage = {
  async createAutoScheduledEvent(event: InsertAutoScheduledEvent): Promise<AutoScheduledEvent> {
    const [autoEvent] = await db
      .insert(autoScheduledEvents)
      .values(event)
      .returning();
    return autoEvent;
  },

  async getPendingAutoScheduledEvent(groupId: string): Promise<AutoScheduledEvent | undefined> {
    const [event] = await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.groupId, groupId),
        eq(autoScheduledEvents.status, 'pending_approval')
      ))
      .orderBy(desc(autoScheduledEvents.createdAt))
      .limit(1);
    return event;
  },

  async getPendingAutoScheduledEvents(groupId: string): Promise<Array<AutoScheduledEvent & { itinerary?: Itinerary & { items: ItineraryItem[] } }>> {
    // Include pending_approval, auto_approved, and approved events
    // These are all events that are waiting to be sent or have been auto-approved
    const events = await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.groupId, groupId),
        inArray(autoScheduledEvents.status, ['pending_approval', 'auto_approved', 'approved'])
      ))
      .orderBy(desc(autoScheduledEvents.createdAt));

    const eventsWithItineraries = await Promise.all(
      events.map(async (event) => {
        if (!event.itineraryId) {
          return { ...event, itinerary: undefined };
        }

        const itinerary = await itinerariesStorage.getItinerary(event.itineraryId);
        return { ...event, itinerary };
      })
    );

    return eventsWithItineraries;
  },

  async getAutoScheduledEvent(id: string): Promise<AutoScheduledEvent | undefined> {
    const [event] = await db
      .select()
      .from(autoScheduledEvents)
      .where(eq(autoScheduledEvents.id, id));
    return event;
  },

  async updateAutoScheduledEventStatus(id: string, status: string): Promise<AutoScheduledEvent> {
    const [event] = await db
      .update(autoScheduledEvents)
      .set({ status })
      .where(eq(autoScheduledEvents.id, id))
      .returning();
    return event;
  },

  async updateAutoScheduledEvent(id: string, updates: Partial<InsertAutoScheduledEvent>): Promise<AutoScheduledEvent> {
    const [event] = await db
      .update(autoScheduledEvents)
      .set(updates)
      .where(eq(autoScheduledEvents.id, id))
      .returning();
    return event;
  },

  async getAutoScheduledEventsReadyForAutoSend(): Promise<AutoScheduledEvent[]> {
    const now = new Date();
    return await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.status, 'pending_approval'),
        sql`${autoScheduledEvents.autoSendAt} <= ${now}`
      ));
  },

  async hasExistingProposedEvents(groupId: string): Promise<boolean> {
    const pendingAutoEvents = await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.groupId, groupId),
        eq(autoScheduledEvents.status, 'pending_approval')
      ))
      .limit(1);

    if (pendingAutoEvents.length > 0) {
      return true;
    }

    const proposedItineraries = await db
      .select()
      .from(itineraries)
      .where(and(
        eq(itineraries.groupId, groupId),
        or(
          eq(itineraries.status, 'proposed'),
          eq(itineraries.status, 'scheduled')
        )
      ))
      .limit(1);

    return proposedItineraries.length > 0;
  },

  async countFutureEvents(groupId: string): Promise<number> {
    const now = new Date();

    const autoEvents = await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.groupId, groupId),
        inArray(autoScheduledEvents.status, [
          'pending_approval',
          'auto_approved',
          'approved',
          'auto_sent',
          'scheduled'
        ]),
        gte(autoScheduledEvents.proposedDate, now)
      ));

    return autoEvents.length;
  },

  async deletePendingAutoEvents(groupId: string): Promise<number> {
    // Delete all pending auto-scheduled events (not yet finalized/scheduled)
    // This allows organizers to clear the pipeline and regenerate
    const eventsToDelete = await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.groupId, groupId),
        inArray(autoScheduledEvents.status, [
          'pending_approval',
          'auto_approved',
          'approved',
          'auto_sent'
        ])
        // Note: 'scheduled' status events are NOT deleted as they are finalized
      ));

    if (eventsToDelete.length === 0) {
      return 0;
    }

    const eventIds = eventsToDelete.map(e => e.id);

    // Delete associated itinerary options first (foreign key constraint)
    await db
      .delete(itineraryOptions)
      .where(inArray(itineraryOptions.autoEventId, eventIds));

    await db
      .delete(autoScheduledEvents)
      .where(inArray(autoScheduledEvents.id, eventIds));

    console.log(`[Storage] Deleted ${eventsToDelete.length} pending auto-scheduled events for group ${groupId}`);
    return eventsToDelete.length;
  },

  async skipAutoScheduledEvent(eventId: string): Promise<{ groupId: string }> {
    const event = await autoScheduledEventsStorage.getAutoScheduledEvent(eventId);

    if (!event) {
      throw new Error("Auto-scheduled event not found");
    }

    if (event.status === 'scheduled') {
      throw new Error("Cannot skip a finalized event");
    }

    await db
      .update(autoScheduledEvents)
      .set({ status: 'rejected' })
      .where(eq(autoScheduledEvents.id, eventId));

    console.log(`[Storage] Skipped auto-scheduled event ${eventId} for group ${event.groupId}`);

    return { groupId: event.groupId };
  },

  async deleteAutoScheduledEvent(eventId: string): Promise<{ groupId: string }> {
    const event = await autoScheduledEventsStorage.getAutoScheduledEvent(eventId);

    if (!event) {
      throw new Error("Auto-scheduled event not found");
    }

    if (event.status === 'scheduled') {
      throw new Error("Cannot delete a finalized event");
    }

    await db
      .delete(itineraryOptions)
      .where(eq(itineraryOptions.autoEventId, eventId));

    await db
      .delete(autoScheduledEvents)
      .where(eq(autoScheduledEvents.id, eventId));

    console.log(`[Storage] Deleted auto-scheduled event ${eventId} for group ${event.groupId}`);

    return { groupId: event.groupId };
  },

  async getAutoScheduledEventsTimeline(groupId: string): Promise<Array<AutoScheduledEvent & {
    itineraryOptions?: Array<{
      id: string;
      optionNumber: number;
      venues: any;
      description?: string | null;
    }>;
    itinerary?: Itinerary & { items: ItineraryItem[] };
  }>> {
    // Get events from last 90 days and all future events
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const events = await db
      .select()
      .from(autoScheduledEvents)
      .where(and(
        eq(autoScheduledEvents.groupId, groupId),
        or(
          gte(autoScheduledEvents.proposedDate, ninetyDaysAgo),
          isNull(autoScheduledEvents.proposedDate)
        )
      ))
      .orderBy(asc(autoScheduledEvents.proposedDate));

    const eventsWithOptions = await Promise.all(
      events.map(async (event) => {
        const options = await db
          .select()
          .from(itineraryOptions)
          .where(eq(itineraryOptions.autoEventId, event.id));

        let itinerary = undefined;
        if (event.itineraryId) {
          itinerary = await itinerariesStorage.getItinerary(event.itineraryId);
        }

        return {
          ...event,
          itineraryOptions: options,
          itinerary
        };
      })
    );

    return eventsWithOptions;
  },

  async getUserUpcomingEventsWithTimeSlots(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{
    groupId: string;
    groupName: string;
    eventDate: Date;
    timePeriod: 'morning' | 'afternoon' | 'evening';
  }>> {
    const { inferTimePeriod } = await import('../availability-utils.js');
    const results: Array<{
      groupId: string;
      groupName: string;
      eventDate: Date;
      timePeriod: 'morning' | 'afternoon' | 'evening';
    }> = [];

    const now = startDate || new Date();
    const futureLimit = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days from now

    const userGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.userId, userId));

    for (const group of userGroups) {
      const itins = await db
        .select()
        .from(itineraries)
        .where(and(
          eq(itineraries.groupId, group.id),
          or(
            eq(itineraries.status, 'proposed'),
            eq(itineraries.status, 'scheduled')
          ),
          sql`${itineraries.eventDate} IS NOT NULL`,
          sql`${itineraries.eventDate} >= ${now}`,
          sql`${itineraries.eventDate} <= ${futureLimit}`
        ));

      for (const itin of itins) {
        if (itin.eventDate) {
          const date = new Date(itin.eventDate);
          const timePeriod = inferTimePeriod(date.getHours());
          results.push({
            groupId: group.id,
            groupName: group.name,
            eventDate: date,
            timePeriod,
          });
        }
      }

      const autoEvents = await db
        .select()
        .from(autoScheduledEvents)
        .where(and(
          eq(autoScheduledEvents.groupId, group.id),
          or(
            eq(autoScheduledEvents.status, 'pending_approval'),
            eq(autoScheduledEvents.status, 'approved'),
            eq(autoScheduledEvents.status, 'auto_approved'),
            eq(autoScheduledEvents.status, 'auto_sent'),
            eq(autoScheduledEvents.status, 'sent')
          ),
          sql`${autoScheduledEvents.proposedDate} IS NOT NULL`,
          sql`${autoScheduledEvents.proposedDate} >= ${now}`,
          sql`${autoScheduledEvents.proposedDate} <= ${futureLimit}`
        ));

      for (const autoEvent of autoEvents) {
        if (autoEvent.proposedDate) {
          const date = new Date(autoEvent.proposedDate);
          const timePeriod = inferTimePeriod(date.getHours());
          results.push({
            groupId: group.id,
            groupName: group.name,
            eventDate: date,
            timePeriod,
          });
        }
      }
    }

    results.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

    return results;
  },
};
