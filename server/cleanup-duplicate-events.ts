/**
 * Cleanup script to remove duplicate auto-scheduled events
 * Keeps the most recently created event for each date and removes older duplicates
 */

import { db } from "./db";
import { autoScheduledEvents, itineraryOptions, groups } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

interface DuplicateGroup {
  groupId: string;
  groupName: string;
  dateStr: string;
  events: Array<{
    id: number;
    createdAt: Date;
    status: string;
  }>;
}

async function cleanupDuplicateEvents() {
  console.log("🔍 Finding duplicate events...\n");

  // Get all groups with auto-scheduling enabled
  const allGroups = await db
    .select()
    .from(groups)
    .where(eq(groups.autoScheduleEnabled, true));

  console.log(`Found ${allGroups.length} groups with auto-scheduling enabled\n`);

  const duplicateGroups: DuplicateGroup[] = [];
  let totalDuplicates = 0;

  for (const group of allGroups) {
    // Get all events for this group
    const events = await db
      .select()
      .from(autoScheduledEvents)
      .where(eq(autoScheduledEvents.groupId, group.id))
      .orderBy(autoScheduledEvents.proposedDate);

    // Group events by date
    const dateMap = new Map<string, typeof events>();
    for (const event of events) {
      const dateStr = new Date(event.proposedDate).toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, []);
      }
      dateMap.get(dateStr)!.push(event);
    }

    // Find duplicates
    for (const [dateStr, eventsOnDate] of dateMap.entries()) {
      if (eventsOnDate.length > 1) {
        duplicateGroups.push({
          groupId: group.id,
          groupName: group.name,
          dateStr,
          events: eventsOnDate.map(e => ({
            id: e.id,
            createdAt: e.createdAt,
            status: e.status,
          })),
        });
        totalDuplicates += eventsOnDate.length - 1; // Count extras, not the one we'll keep
      }
    }
  }

  if (duplicateGroups.length === 0) {
    console.log("✅ No duplicate events found!\n");
    process.exit(0);
  }

  console.log(`⚠️  Found ${duplicateGroups.length} dates with duplicates`);
  console.log(`   Total duplicate events to remove: ${totalDuplicates}\n`);

  // Show summary
  console.log("📊 Duplicate Summary:");
  for (const dup of duplicateGroups.slice(0, 10)) {
    console.log(`   ${dup.groupName}: ${dup.events.length} events on ${dup.dateStr}`);
  }
  if (duplicateGroups.length > 10) {
    console.log(`   ... and ${duplicateGroups.length - 10} more dates\n`);
  } else {
    console.log();
  }

  console.log("🗑️  Starting cleanup...\n");

  let deletedCount = 0;
  let deletedItineraryCount = 0;

  for (const dup of duplicateGroups) {
    // Sort events by createdAt (most recent first)
    const sortedEvents = [...dup.events].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Keep the most recent event, delete the rest
    const toKeep = sortedEvents[0];
    const toDelete = sortedEvents.slice(1);

    console.log(`   ${dup.groupName} on ${dup.dateStr}:`);
    console.log(`     Keeping: Event #${toKeep.id} (created ${toKeep.createdAt})`);
    console.log(`     Deleting: ${toDelete.length} older event(s)`);

    // Delete itinerary options for events we're removing
    for (const event of toDelete) {
      const deletedItineraries = await db
        .delete(itineraryOptions)
        .where(eq(itineraryOptions.autoEventId, event.id));

      deletedItineraryCount++;
    }

    // Delete the duplicate events
    const eventIdsToDelete = toDelete.map(e => e.id);
    if (eventIdsToDelete.length > 0) {
      await db
        .delete(autoScheduledEvents)
        .where(inArray(autoScheduledEvents.id, eventIdsToDelete));

      deletedCount += eventIdsToDelete.length;
    }
  }

  console.log("\n✅ Cleanup complete!");
  console.log(`   Deleted ${deletedCount} duplicate events`);
  console.log(`   Deleted ${deletedItineraryCount} associated itinerary options\n`);

  // Run check again to verify
  console.log("🔍 Verifying cleanup...\n");

  let remainingDuplicates = 0;
  for (const group of allGroups) {
    const events = await db
      .select()
      .from(autoScheduledEvents)
      .where(eq(autoScheduledEvents.groupId, group.id));

    const dateMap = new Map<string, number>();
    for (const event of events) {
      const dateStr = new Date(event.proposedDate).toISOString().split('T')[0];
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    }

    for (const count of dateMap.values()) {
      if (count > 1) {
        remainingDuplicates++;
      }
    }
  }

  if (remainingDuplicates === 0) {
    console.log("✅ Verification passed! No duplicates remain.\n");
  } else {
    console.log(`⚠️  Warning: ${remainingDuplicates} duplicates still found. May need to run again.\n`);
  }

  process.exit(0);
}

cleanupDuplicateEvents().catch((error) => {
  console.error("❌ Error during cleanup:", error);
  process.exit(1);
});
