import { db } from "../db";
import { curatedVenues } from "@shared/schema";
import { eq } from "drizzle-orm";

export const curatedVenuesStorage = {
  async getAllCuratedVenues(): Promise<Array<{ id: string; name: string; category: string; tags: string[] | null }>> {
    const venues = await db
      .select({
        id: curatedVenues.id,
        name: curatedVenues.name,
        category: curatedVenues.category,
        tags: curatedVenues.tags
      })
      .from(curatedVenues)
      .where(eq(curatedVenues.isActive, true));

    return venues;
  },

  async updateVenueCategory(id: string, category: string): Promise<void> {
    await db
      .update(curatedVenues)
      .set({ category })
      .where(eq(curatedVenues.id, id));
  },
};
