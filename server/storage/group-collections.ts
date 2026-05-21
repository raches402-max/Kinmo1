import { db } from "../db";
import {
  groupCollections,
  groups,
  type GroupCollection,
  type InsertGroupCollection,
  type UpdateGroupCollection,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export const groupCollectionsStorage = {
  async createGroupCollection(userId: string, collection: Omit<InsertGroupCollection, 'userId'>): Promise<GroupCollection> {
    const [result] = await db.insert(groupCollections).values({
      ...collection,
      userId,
    }).returning();
    return result;
  },

  async getUserGroupCollections(userId: string): Promise<GroupCollection[]> {
    return await db
      .select()
      .from(groupCollections)
      .where(eq(groupCollections.userId, userId))
      .orderBy(groupCollections.orderIndex);
  },

  async updateGroupCollection(id: string, updates: UpdateGroupCollection): Promise<GroupCollection> {
    const [result] = await db
      .update(groupCollections)
      .set(updates)
      .where(eq(groupCollections.id, id))
      .returning();
    return result;
  },

  async deleteGroupCollection(id: string): Promise<void> {
    // When a collection is deleted, set all groups' collectionId to null
    await db
      .update(groups)
      .set({ collectionId: null })
      .where(eq(groups.collectionId, id));

    // Then delete the collection
    await db.delete(groupCollections).where(eq(groupCollections.id, id));
  },

  async reorderGroupCollections(collectionOrders: Array<{ id: string; orderIndex: number }>): Promise<void> {
    for (const { id, orderIndex } of collectionOrders) {
      await db
        .update(groupCollections)
        .set({ orderIndex })
        .where(eq(groupCollections.id, id));
    }
  },

  async updateGroupCollectionAssignment(groupId: string, collectionId: string | null, orderIndex: number): Promise<void> {
    await db
      .update(groups)
      .set({
        collectionId,
        orderIndex
      })
      .where(eq(groups.id, groupId));
  },

  async reorderGroupsInCollection(groupOrders: Array<{ id: string; orderIndex: number }>): Promise<void> {
    for (const { id, orderIndex } of groupOrders) {
      await db
        .update(groups)
        .set({ orderIndex })
        .where(eq(groups.id, id));
    }
  },
};
