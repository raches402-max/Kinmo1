/**
 * Cleanup orphaned itineraries left from duplicate auto-scheduled events
 * Keeps the most recent itinerary for each group/date combination
 */

import { db } from "./db";
import { itineraries, itineraryItems, itineraryInvites, groups } from "@shared/schema";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";

async function cleanupOrphanedItineraries() {
  console.log("🔍 Finding orphaned itineraries...\n");

  // Get all groups
  const allGroups = await db
    .select()
    .from(groups)
    .where(isNull(groups.deletedAt));

  console.log(`Found ${allGroups.length} groups\n`);

  let totalDuplicates = 0;
  let deletedItineraries = 0;
  let deletedItems = 0;
  let deletedInvites = 0;

  for (const group of allGroups) {
    // Get all itineraries for this group
    const groupItineraries = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.groupId, group.id))
      .orderBy(itineraries.eventDate, itineraries.createdAt);

    if (groupItineraries.length === 0) continue;

    // Group by eventDate
    const dateMap = new Map<string, typeof groupItineraries>();
    for (const itin of groupItineraries) {
      if (!itin.eventDate) continue;
      const dateStr = new Date(itin.eventDate).toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, []);
      }
      dateMap.get(dateStr)!.push(itin);
    }

    // Find dates with duplicates
    for (const [dateStr, itins] of dateMap.entries()) {
      if (itins.length > 1) {
        console.log(`\n📊 ${group.name} on ${dateStr}:`);
        console.log(`   Found ${itins.length} itineraries for this date`);
        totalDuplicates += itins.length - 1;

        // Sort by status priority first, then by createdAt (OLDEST first)
        // Priority: auto_approved > auto_sent > finalized > proposed
        // For same status: keep the OLDEST one (what user saw first)
        const sorted = [...itins].sort((a, b) => {
          // First prioritize by status
          const statusPriority: Record<string, number> = {
            'auto_approved': 4,
            'auto_sent': 3,
            'finalized': 2,
            'proposed': 1,
          };
          const aPriority = statusPriority[a.status] || 0;
          const bPriority = statusPriority[b.status] || 0;

          if (aPriority !== bPriority) {
            return bPriority - aPriority; // Higher priority first
          }

          // If same status, sort by createdAt (OLDEST first - what user saw first)
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        const toKeep = sorted[0];
        const toDelete = sorted.slice(1);

        console.log(`   Keeping: ${toKeep.id.substring(0, 8)}... (Status: ${toKeep.status}, Created: ${new Date(toKeep.createdAt).toISOString()})`);
        console.log(`   Deleting ${toDelete.length} orphaned itinerary(ies)`);

        for (const itin of toDelete) {
          console.log(`      - ${itin.id.substring(0, 8)}... (Status: ${itin.status}, Created: ${new Date(itin.createdAt).toISOString()})`);

          // Delete itinerary items
          await db
            .delete(itineraryItems)
            .where(eq(itineraryItems.itineraryId, itin.id));
          deletedItems++;

          // Delete itinerary invites
          await db
            .delete(itineraryInvites)
            .where(eq(itineraryInvites.itineraryId, itin.id));
          deletedInvites++;

          // Delete the itinerary itself
          await db
            .delete(itineraries)
            .where(eq(itineraries.id, itin.id));
          deletedItineraries++;
        }
      }
    }
  }

  console.log("\n\n✅ Cleanup complete!");
  console.log(`   Total duplicate itineraries found: ${totalDuplicates}`);
  console.log(`   Deleted ${deletedItineraries} orphaned itineraries`);
  console.log(`   Deleted ${deletedItems} associated itinerary items`);
  console.log(`   Deleted ${deletedInvites} associated itinerary invites\n`);

  // Verification
  console.log("🔍 Verifying cleanup...\n");

  let remainingDuplicates = 0;
  for (const group of allGroups) {
    const groupItineraries = await db
      .select()
      .from(itineraries)
      .where(eq(itineraries.groupId, group.id));

    const dateMap = new Map<string, number>();
    for (const itin of groupItineraries) {
      if (!itin.eventDate) continue;
      const dateStr = new Date(itin.eventDate).toISOString().split('T')[0];
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    }

    for (const [dateStr, count] of dateMap.entries()) {
      if (count > 1) {
        console.log(`   ⚠️  ${group.name} still has ${count} itineraries on ${dateStr}`);
        remainingDuplicates++;
      }
    }
  }

  if (remainingDuplicates === 0) {
    console.log("✅ Verification passed! No duplicate itineraries remain.\n");
  } else {
    console.log(`⚠️  Warning: ${remainingDuplicates} duplicate dates still found.\n`);
  }

  process.exit(0);
}

cleanupOrphanedItineraries().catch((error) => {
  console.error("❌ Error during cleanup:", error);
  process.exit(1);
});
