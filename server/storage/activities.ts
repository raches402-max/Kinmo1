import { db } from "../db";
import {
  activities,
  type Activity,
  type InsertActivity,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { trustFieldsForSource, type TrustSource } from "../trust-state";

export const activitiesStorage = {
  async getGroupActivities(groupId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(
      and(
        eq(activities.groupId, groupId),
        sql`${activities.archivedAt} IS NULL`
      )
    ).orderBy(activities.createdAt);
  },

  async getAllGroupActivities(groupId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(
      eq(activities.groupId, groupId)
    ).orderBy(activities.createdAt);
  },

  async archiveGroupActivities(groupId: string): Promise<void> {
    await db
      .update(activities)
      .set({ archivedAt: new Date() })
      .where(eq(activities.groupId, groupId));
  },

  async deleteAllGroupActivities(groupId: string): Promise<void> {
    await db
      .delete(activities)
      .where(eq(activities.groupId, groupId));
  },

  async deleteActivity(activityId: string): Promise<void> {
    await db
      .delete(activities)
      .where(eq(activities.id, activityId));
  },

  async getActivity(activityId: string): Promise<Activity | undefined> {
    const [activity] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, activityId))
      .limit(1);
    return activity;
  },

  async createActivity(
    insertActivity: InsertActivity,
    trustSource: TrustSource = "ai_suggestion"
  ): Promise<Activity> {
    const trust = trustFieldsForSource(trustSource);
    const [activity] = await db
      .insert(activities)
      .values({ ...insertActivity, ...trust })
      .returning();
    return activity;
  },

  async createActivities(
    insertActivities: InsertActivity[],
    trustSource: TrustSource = "ai_suggestion"
  ): Promise<Activity[]> {
    if (insertActivities.length === 0) return [];

    const trust = trustFieldsForSource(trustSource);
    return await db
      .insert(activities)
      .values(insertActivities.map((a) => ({ ...a, ...trust })))
      .returning();
  },

  async updateActivityFeedback(activityId: string, feedback: string): Promise<Activity> {
    const [activity] = await db
      .update(activities)
      .set({ feedback })
      .where(eq(activities.id, activityId))
      .returning();
    return activity;
  },
};
