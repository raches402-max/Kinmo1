import { db } from "../db";
import {
  preferenceSignals,
  type PreferenceSignal,
  type InsertPreferenceSignal,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const preferenceSignalsStorage = {
  async createPreferenceSignal(signal: InsertPreferenceSignal): Promise<PreferenceSignal> {
    const [preferenceSignal] = await db
      .insert(preferenceSignals)
      .values(signal)
      .returning();
    return preferenceSignal;
  },

  async getGroupPreferenceSignals(groupId: string): Promise<PreferenceSignal[]> {
    return await db
      .select()
      .from(preferenceSignals)
      .where(eq(preferenceSignals.groupId, groupId))
      .orderBy(desc(preferenceSignals.createdAt));
  },
};
