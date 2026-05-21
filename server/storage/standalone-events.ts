import { db } from "../db";
import {
  itineraries,
  itineraryItems,
  standaloneEventInvitees,
  users,
  type Itinerary,
  type InsertItinerary,
  type UpdateItinerary,
  type ItineraryItem,
  type StandaloneEventInvitee,
  type InsertStandaloneEventInvitee,
} from "@shared/schema";
import { eq, and, or, desc, inArray, isNotNull } from "drizzle-orm";
import { randomBytes } from "crypto";

export const standaloneEventsStorage = {
  // Standalone Events
  async createStandaloneEvent(
    eventData: Omit<InsertItinerary, 'groupId'> & { name: string },
    userId: string
  ): Promise<Itinerary> {
    const [itinerary] = await db
      .insert(itineraries)
      .values({
        ...eventData,
        groupId: null,
        isStandalone: true,
        organizerId: userId,
        createdBy: userId,
        proposedOrder: eventData.proposedOrder || [],
      })
      .returning();
    return itinerary;
  },

  async getUserStandaloneEvents(userId: string): Promise<Itinerary[]> {
    return await db
      .select()
      .from(itineraries)
      .where(
        and(
          eq(itineraries.isStandalone, true),
          eq(itineraries.organizerId, userId)
        )
      )
      .orderBy(desc(itineraries.createdAt));
  },

  /**
   * Get standalone events where the user was invited AND responded (RSVP'd)
   * This allows invitees to see past standalone events they participated in
   */
  async getStandaloneEventsUserRespondedTo(userId: string): Promise<Itinerary[]> {
    // Inline user-email lookup so this module doesn't depend on the user-operations domain
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return [];

    const invitedEventIds = await db
      .selectDistinct({ itineraryId: standaloneEventInvitees.itineraryId })
      .from(standaloneEventInvitees)
      .where(
        and(
          isNotNull(standaloneEventInvitees.rsvpStatus),
          or(
            eq(standaloneEventInvitees.userId, userId),
            eq(standaloneEventInvitees.inviteeEmail, user.email)
          )
        )
      );

    if (invitedEventIds.length === 0) return [];

    const eventIds = invitedEventIds.map(e => e.itineraryId);
    return await db
      .select()
      .from(itineraries)
      .where(
        and(
          eq(itineraries.isStandalone, true),
          inArray(itineraries.id, eventIds)
        )
      )
      .orderBy(desc(itineraries.createdAt));
  },

  async getStandaloneEvent(id: string): Promise<(Itinerary & { items: ItineraryItem[]; invitees: StandaloneEventInvitee[] }) | undefined> {
    const [itinerary] = await db
      .select()
      .from(itineraries)
      .where(
        and(
          eq(itineraries.id, id),
          eq(itineraries.isStandalone, true)
        )
      );

    if (!itinerary) return undefined;

    const items = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, id))
      .orderBy(itineraryItems.orderIndex);

    const invitees = await db
      .select()
      .from(standaloneEventInvitees)
      .where(eq(standaloneEventInvitees.itineraryId, id))
      .orderBy(standaloneEventInvitees.createdAt);

    return { ...itinerary, items, invitees };
  },

  async updateStandaloneEvent(id: string, updates: Partial<UpdateItinerary>): Promise<Itinerary> {
    const [itinerary] = await db
      .update(itineraries)
      .set(updates)
      .where(
        and(
          eq(itineraries.id, id),
          eq(itineraries.isStandalone, true)
        )
      )
      .returning();
    return itinerary;
  },

  async deleteStandaloneEvent(id: string): Promise<void> {
    await db
      .delete(itineraries)
      .where(
        and(
          eq(itineraries.id, id),
          eq(itineraries.isStandalone, true)
        )
      );
  },

  // Standalone Event Invitees
  async addStandaloneEventInvitee(data: InsertStandaloneEventInvitee): Promise<StandaloneEventInvitee> {
    const inviteToken = randomBytes(16).toString('hex');
    const [invitee] = await db
      .insert(standaloneEventInvitees)
      .values({ ...data, inviteToken })
      .returning();
    return invitee;
  },

  async getStandaloneEventInvitees(itineraryId: string): Promise<StandaloneEventInvitee[]> {
    return await db
      .select()
      .from(standaloneEventInvitees)
      .where(eq(standaloneEventInvitees.itineraryId, itineraryId))
      .orderBy(standaloneEventInvitees.createdAt);
  },

  async removeStandaloneEventInvitee(inviteeId: string): Promise<void> {
    await db
      .delete(standaloneEventInvitees)
      .where(eq(standaloneEventInvitees.id, inviteeId));
  },

  async updateStandaloneEventInviteeRsvp(inviteToken: string, rsvpStatus: 'yes' | 'maybe' | 'no'): Promise<StandaloneEventInvitee | undefined> {
    const [invitee] = await db
      .update(standaloneEventInvitees)
      .set({ rsvpStatus })
      .where(eq(standaloneEventInvitees.inviteToken, inviteToken))
      .returning();
    return invitee;
  },

  async getStandaloneEventByInviteToken(inviteToken: string): Promise<{ invitee: StandaloneEventInvitee; event: Itinerary } | undefined> {
    const [invitee] = await db
      .select()
      .from(standaloneEventInvitees)
      .where(eq(standaloneEventInvitees.inviteToken, inviteToken));

    if (!invitee) return undefined;

    const [event] = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.id, invitee.itineraryId));

    if (!event) return undefined;

    return { invitee, event };
  },
};
