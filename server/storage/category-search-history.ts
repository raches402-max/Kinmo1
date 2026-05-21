import { db } from "../db";
import { categorySearchHistory, type CategorySearchHistory, type InsertCategorySearchHistory } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const categorySearchHistoryStorage = {
  async saveCategorySearch(search: InsertCategorySearchHistory): Promise<CategorySearchHistory> {
    const [result] = await db
      .insert(categorySearchHistory)
      .values(search)
      .returning();
    return result;
  },

  async getRecentCategorySearches(groupId: string, limit: number = 5): Promise<CategorySearchHistory[]> {
    return await db
      .select()
      .from(categorySearchHistory)
      .where(eq(categorySearchHistory.groupId, groupId))
      .orderBy(desc(categorySearchHistory.createdAt))
      .limit(limit);
  },
};
