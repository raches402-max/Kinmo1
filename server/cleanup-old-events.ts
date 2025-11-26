/**
 * Cleanup old/orphaned events and itineraries
 */

import { db } from "./db";
import { itineraries, itineraryItems, itineraryInvites, autoScheduledEvents, itineraryOptions } from "@shared/schema";
import { lt, isNull, and, or, sql, inArray } from "drizzle-orm";

async function cleanupOldEvents() {
  console.log("🔍 Analyzing events in the system...\n");
  console.log("=".repeat(80) + "\n");

  const now = new Date();

  // Check for orphaned itineraries (no invites, status = proposed, created over a week ago)
  const orphanedItineraries = await db
    .select()
    .from(itineraries)
    .where(and(
      sql`${itineraries.status} = 'proposed'`,
      sql`${itineraries.createdAt} < NOW() - INTERVAL '7 days'`
    ));

  console.log(`📋 Orphaned Itineraries (proposed, >7 days old):`);
  console.log(`   Found: ${orphanedItineraries.length}`);

  if (orphanedItineraries.length > 0) {
    console.log(`   Sample:`);
    for (const itin of orphanedItineraries.slice(0, 5)) {
      const dateStr = itin.eventDate ? new Date(itin.eventDate).toISOString().split('T')[0] : 'no date';
      console.log(`      - ${itin.name} (${dateStr}) - Created ${new Date(itin.createdAt).toISOString().split('T')[0]}`);
    }
  }

  // Check for itineraries with no invites
  const allItineraries = await db.select().from(itineraries);
  const itinerariesWithNoInvites: typeof allItineraries = [];

  for (const itin of allItineraries) {
    const invites = await db
      .select()
      .from(itineraryInvites)
      .where(sql`${itineraryInvites.itineraryId} = ${itin.id}`);

    if (invites.length === 0) {
      itinerariesWithNoInvites.push(itin);
    }
  }

  console.log(`\n📭 Itineraries with NO invites:`);
  console.log(`   Found: ${itinerariesWithNoInvites.length}`);

  if (itinerariesWithNoInvites.length > 0) {
    console.log(`   Sample:`);
    for (const itin of itinerariesWithNoInvites.slice(0, 5)) {
      const dateStr = itin.eventDate ? new Date(itin.eventDate).toISOString().split('T')[0] : 'no date';
      console.log(`      - ${itin.name} (${dateStr}) - Status: ${itin.status}`);
    }
  }

  // Check for past events that are still in proposed/draft status
  const pastProposedEvents = await db
    .select()
    .from(itineraries)
    .where(and(
      sql`${itineraries.eventDate} < NOW()`,
      or(
        sql`${itineraries.status} = 'proposed'`,
        sql`${itineraries.status} = 'draft'`
      )
    ));

  console.log(`\n📆 Past Events (still in proposed/draft):`);
  console.log(`   Found: ${pastProposedEvents.length}`);

  if (pastProposedEvents.length > 0) {
    console.log(`   Sample:`);
    for (const itin of pastProposedEvents.slice(0, 5)) {
      const dateStr = itin.eventDate ? new Date(itin.eventDate).toISOString().split('T')[0] : 'no date';
      console.log(`      - ${itin.name} (${dateStr}) - Status: ${itin.status}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("\n📊 CLEANUP SUMMARY:");
  console.log(`   Orphaned itineraries (proposed, >7 days): ${orphanedItineraries.length}`);
  console.log(`   Itineraries with no invites: ${itinerariesWithNoInvites.length}`);
  console.log(`   Past events (still proposed/draft): ${pastProposedEvents.length}`);

  const totalToCleanup = new Set([
    ...orphanedItineraries.map(i => i.id),
    ...itinerariesWithNoInvites.map(i => i.id),
    ...pastProposedEvents.map(i => i.id)
  ]).size;

  console.log(`   Total unique itineraries to cleanup: ${totalToCleanup}\n`);

  if (totalToCleanup === 0) {
    console.log("✅ No cleanup needed!\n");
    process.exit(0);
  }

  console.log("🗑️  Starting cleanup...\n");

  const itinerariesToDelete = new Set([
    ...orphanedItineraries.map(i => i.id),
    ...itinerariesWithNoInvites.map(i => i.id),
    ...pastProposedEvents.map(i => i.id)
  ]);

  const itineraryIdsArray = Array.from(itinerariesToDelete);

  let deletedItems = 0;
  let deletedInvites = 0;
  let deletedItineraries = 0;

  if (itineraryIdsArray.length > 0) {
    // Delete itinerary items
    const items = await db
      .select()
      .from(itineraryItems)
      .where(inArray(itineraryItems.itineraryId, itineraryIdsArray));

    if (items.length > 0) {
      await db
        .delete(itineraryItems)
        .where(inArray(itineraryItems.itineraryId, itineraryIdsArray));
      deletedItems = items.length;
    }

    // Delete itinerary invites
    const invites = await db
      .select()
      .from(itineraryInvites)
      .where(inArray(itineraryInvites.itineraryId, itineraryIdsArray));

    if (invites.length > 0) {
      await db
        .delete(itineraryInvites)
        .where(inArray(itineraryInvites.itineraryId, itineraryIdsArray));
      deletedInvites = invites.length;
    }

    // Delete itineraries
    await db
      .delete(itineraries)
      .where(inArray(itineraries.id, itineraryIdsArray));
    deletedItineraries = itineraryIdsArray.length;
  }

  console.log("=".repeat(80));
  console.log("\n✅ CLEANUP COMPLETE!");
  console.log(`   Deleted ${deletedItineraries} itineraries`);
  console.log(`   Deleted ${deletedItems} itinerary items`);
  console.log(`   Deleted ${deletedInvites} itinerary invites\n`);

  process.exit(0);
}

cleanupOldEvents().catch((error) => {
  console.error("❌ Error during cleanup:", error);
  process.exit(1);
});
