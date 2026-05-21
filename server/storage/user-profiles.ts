import { db } from "../db";
import { userProfiles, type UserProfile, type InsertUserProfile } from "@shared/schema";
import { eq } from "drizzle-orm";

export const userProfilesStorage = {
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return profile;
  },

  async upsertUserProfile(userId: string, profile: InsertUserProfile): Promise<UserProfile> {
    const [result] = await db
      .insert(userProfiles)
      .values({ ...profile, userId })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          ...profile,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  },
};
