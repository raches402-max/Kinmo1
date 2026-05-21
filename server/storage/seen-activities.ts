import { db } from "../db";
import { seenActivities } from "@shared/schema";
import { eq } from "drizzle-orm";

export const seenActivitiesStorage = {
  async markVenuesAsSeen(groupId: string, venues: Array<{ venueName: string; googlePlaceId?: string; category: string }>): Promise<void> {
    if (venues.length === 0) return;

    const values = venues.map(v => ({
      groupId,
      venueName: v.venueName,
      googlePlaceId: v.googlePlaceId || null,
      category: v.category
    }));

    await db.insert(seenActivities).values(values).onConflictDoNothing();
  },

  async getSeenVenues(groupId: string): Promise<Array<{ venueName: string; googlePlaceId?: string; category: string }>> {
    const seen = await db
      .select({
        venueName: seenActivities.venueName,
        googlePlaceId: seenActivities.googlePlaceId,
        category: seenActivities.category
      })
      .from(seenActivities)
      .where(eq(seenActivities.groupId, groupId));

    return seen.map(s => ({
      venueName: s.venueName,
      googlePlaceId: s.googlePlaceId || undefined,
      category: s.category
    }));
  },
};
