/**
 * Itinerary Deduplication Utilities
 *
 * Shared logic to prevent duplicate itineraries when users
 * submit event creation forms multiple times.
 */

import { db } from "./db";
import { itineraries, itineraryItems, proposedTimeSlots } from "@shared/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { format } from 'date-fns';

/**
 * Delete existing proposed itineraries for a specific date
 * Used by: Quick AI Plan, Queue Event Approval
 */
export async function deduplicateByDate(
  groupId: string,
  eventDate: Date,
  logPrefix: string
): Promise<void> {
  const existingItineraries = await db
    .select()
    .from(itineraries)
    .where(and(
      eq(itineraries.groupId, groupId),
      eq(itineraries.status, 'proposed'),
      sql`DATE(${itineraries.eventDate}) = ${format(eventDate, 'yyyy-MM-dd')}`
    ));

  if (existingItineraries.length > 0) {
    console.log(`[${logPrefix}] Found ${existingItineraries.length} existing proposed itinerary(ies) for ${format(eventDate, 'yyyy-MM-dd')}, removing them...`);

    for (const existing of existingItineraries) {
      await deleteItineraryWithRelations(existing.id);
      console.log(`[${logPrefix}] Deleted existing proposed itinerary ${existing.id}`);
    }
  }
}

/**
 * Delete existing unsent draft itineraries for a group
 * Used by: Build Custom
 */
export async function deduplicateUnsentDrafts(
  groupId: string,
  logPrefix: string
): Promise<void> {
  const existingDrafts = await db
    .select()
    .from(itineraries)
    .where(and(
      eq(itineraries.groupId, groupId),
      eq(itineraries.status, 'proposed'),
      isNull(itineraries.inviteSentAt) // Only delete unsent drafts
    ));

  if (existingDrafts.length > 0) {
    console.log(`[${logPrefix}] Found ${existingDrafts.length} unsent draft itinerary(ies), removing them...`);

    for (const draft of existingDrafts) {
      await deleteItineraryWithRelations(draft.id);
      console.log(`[${logPrefix}] Deleted draft itinerary ${draft.id}`);
    }
  }
}

/**
 * Delete an itinerary and all its related data (items, time slots)
 */
async function deleteItineraryWithRelations(itineraryId: string): Promise<void> {
  // Delete associated items and time slots first (foreign key constraints)
  await db.delete(itineraryItems).where(eq(itineraryItems.itineraryId, itineraryId));
  await db.delete(proposedTimeSlots).where(eq(proposedTimeSlots.itineraryId, itineraryId));
  await db.delete(itineraries).where(eq(itineraries.id, itineraryId));
}
