import { db } from "../db";
import { frequencyFeedback, type FrequencyFeedback, type InsertFrequencyFeedback } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const frequencyFeedbackStorage = {
  async createFrequencyFeedback(feedback: InsertFrequencyFeedback): Promise<FrequencyFeedback> {
    const [created] = await db
      .insert(frequencyFeedback)
      .values(feedback)
      .returning();
    return created;
  },

  async getGroupFrequencyFeedback(groupId: string): Promise<FrequencyFeedback[]> {
    return await db
      .select()
      .from(frequencyFeedback)
      .where(eq(frequencyFeedback.groupId, groupId))
      .orderBy(desc(frequencyFeedback.createdAt));
  },
};
