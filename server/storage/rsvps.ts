import { db } from "../db";
import { rsvps, type Rsvp, type InsertRsvp } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const rsvpsStorage = {
  async createRsvp(rsvp: InsertRsvp): Promise<Rsvp> {
    const [createdRsvp] = await db
      .insert(rsvps)
      .values(rsvp)
      .returning();
    return createdRsvp;
  },

  async getItineraryRsvps(itineraryId: string): Promise<Rsvp[]> {
    return await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.itineraryId, itineraryId))
      .orderBy(desc(rsvps.createdAt));
  },

  async updateRsvp(id: string, updates: Partial<InsertRsvp>): Promise<Rsvp> {
    const [rsvp] = await db
      .update(rsvps)
      .set(updates)
      .where(eq(rsvps.id, id))
      .returning();
    return rsvp;
  },

  async deleteRsvp(id: string): Promise<void> {
    await db.delete(rsvps).where(eq(rsvps.id, id));
  },
};
