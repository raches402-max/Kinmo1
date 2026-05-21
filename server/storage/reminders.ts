import { db } from "../db";
import { reminderLogs, type ReminderLog, type InsertReminderLog } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const remindersStorage = {
  async logReminder(log: InsertReminderLog): Promise<ReminderLog> {
    const [reminderLog] = await db
      .insert(reminderLogs)
      .values(log)
      .returning();
    return reminderLog;
  },

  async getReminderLogs(itineraryId: string): Promise<ReminderLog[]> {
    return await db
      .select()
      .from(reminderLogs)
      .where(eq(reminderLogs.itineraryId, itineraryId))
      .orderBy(desc(reminderLogs.sentAt));
  },
};
