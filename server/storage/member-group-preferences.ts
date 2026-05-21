import { db } from "../db";
import {
  memberGroupPreferences,
  type MemberGroupPreferences,
  type InsertMemberGroupPreferences,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export const memberGroupPreferencesStorage = {
  async getMemberGroupPreferences(
    userId: string,
    groupId: string
  ): Promise<MemberGroupPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(memberGroupPreferences)
      .where(
        and(
          eq(memberGroupPreferences.userId, userId),
          eq(memberGroupPreferences.groupId, groupId)
        )
      );
    return preferences || undefined;
  },

  async upsertMemberGroupPreferences(
    userId: string,
    groupId: string,
    preferences: Partial<InsertMemberGroupPreferences>
  ): Promise<MemberGroupPreferences> {
    const existing = await memberGroupPreferencesStorage.getMemberGroupPreferences(
      userId,
      groupId
    );

    if (existing) {
      const [updated] = await db
        .update(memberGroupPreferences)
        .set({
          ...preferences,
          updatedAt: new Date(),
        })
        .where(eq(memberGroupPreferences.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(memberGroupPreferences)
        .values({
          userId,
          groupId,
          ...preferences,
        })
        .returning();
      return created;
    }
  },
};
