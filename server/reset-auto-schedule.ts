/**
 * Reset Auto-Scheduled Events with Correct Spacing
 *
 * This script:
 * 1. Identifies groups with incorrectly spaced events
 * 2. Deletes all auto-scheduled events for those groups
 * 3. Cleans up associated itineraries and options
 * 4. Lets the system recreate events with proper spacing
 */

import { db } from "./db";
import { storage } from "./storage";
import { autoScheduledEvents, itineraryOptions, itineraries, itineraryItems, itineraryInvites, groups } from "@shared/schema";
import { eq, inArray, and, sql } from "drizzle-orm";
import { maintainEventPipeline } from "./auto-scheduler";

async function resetAutoSchedule() {
  console.log("🔄 Resetting Auto-Scheduled Events\n");
  console.log("=".repeat(80) + "\n");

  // Get all groups with auto-scheduling enabled
  const allGroups = await db
    .select()
    .from(groups)
    .where(eq(groups.autoScheduleEnabled, true));

  console.log(`Found ${allGroups.length} groups with auto-scheduling enabled\n`);

  const groupsToReset: string[] = [];
  let totalEventsToDelete = 0;

  // Analyze each group
  for (const group of allGroups) {
    const events = await db
      .select()
      .from(autoScheduledEvents)
      .where(eq(autoScheduledEvents.groupId, group.id))
      .orderBy(autoScheduledEvents.proposedDate);

    if (events.length < 2) {
      console.log(`✅ ${group.name}: Only ${events.length} event(s), skipping`);
      continue;
    }

    // Check spacing
    const eventDates = events.map(e => new Date(e.proposedDate));
    const spacings: number[] = [];

    for (let i = 1; i < eventDates.length; i++) {
      const diffMs = eventDates[i].getTime() - eventDates[i - 1].getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      spacings.push(days);
    }

    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const minSpacing = Math.min(...spacings);

    // Determine expected spacing
    let expectedDays = 30;
    const freq = group.meetingFrequency || '';

    if (freq.includes('week')) {
      const match = freq.match(/(\d+)/);
      const count = match ? parseInt(match[1]) : 1;
      expectedDays = freq.includes('x') ? Math.round(7 / count) : 7 * count;
    } else if (freq.includes('month')) {
      const match = freq.match(/(\d+)/);
      const count = match ? parseInt(match[1]) : 1;
      expectedDays = freq.includes('x') ? Math.round(30 / count) : 30 * count;
    }

    const needsReset = Math.abs(avgSpacing - expectedDays) > 5 || minSpacing < expectedDays / 2;

    if (needsReset) {
      console.log(`⚠️  ${group.name}:`);
      console.log(`   Expected spacing: ~${expectedDays} days`);
      console.log(`   Actual spacing: ${avgSpacing.toFixed(1)} days (min: ${minSpacing})`);
      console.log(`   Events to delete: ${events.length}`);
      groupsToReset.push(group.id);
      totalEventsToDelete += events.length;
    } else {
      console.log(`✅ ${group.name}: Spacing is correct (~${avgSpacing.toFixed(1)} days)`);
    }
  }

  if (groupsToReset.length === 0) {
    console.log("\n✅ All groups have correct event spacing!\n");
    process.exit(0);
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Groups to reset: ${groupsToReset.length}`);
  console.log(`   Total events to delete: ${totalEventsToDelete}\n`);

  console.log("🗑️  Starting cleanup...\n");

  let deletedEvents = 0;
  let deletedOptions = 0;
  let deletedItineraries = 0;
  let deletedItems = 0;
  let deletedInvites = 0;

  for (const groupId of groupsToReset) {
    const group = allGroups.find(g => g.id === groupId)!;
    console.log(`\n📦 Processing ${group.name}...`);

    // Get all auto-scheduled events for this group
    const events = await db
      .select()
      .from(autoScheduledEvents)
      .where(eq(autoScheduledEvents.groupId, groupId));

    console.log(`   Found ${events.length} events`);

    // Get all itinerary options for these events
    const eventIds = events.map(e => e.id);
    if (eventIds.length > 0) {
      const options = await db
        .select()
        .from(itineraryOptions)
        .where(inArray(itineraryOptions.autoEventId, eventIds));

      console.log(`   Found ${options.length} itinerary options`);
      deletedOptions += options.length;

      // Delete itinerary options
      if (options.length > 0) {
        await db
          .delete(itineraryOptions)
          .where(inArray(itineraryOptions.autoEventId, eventIds));
      }

      // Get itineraries that were created from these events
      const itineraryIds = events
        .map(e => e.itineraryId)
        .filter((id): id is string => id !== null);

      if (itineraryIds.length > 0) {
        console.log(`   Found ${itineraryIds.length} associated itineraries`);

        // Delete itinerary items
        const items = await db
          .select()
          .from(itineraryItems)
          .where(inArray(itineraryItems.itineraryId, itineraryIds));

        if (items.length > 0) {
          await db
            .delete(itineraryItems)
            .where(inArray(itineraryItems.itineraryId, itineraryIds));
          deletedItems += items.length;
        }

        // Delete itinerary invites
        const invites = await db
          .select()
          .from(itineraryInvites)
          .where(inArray(itineraryInvites.itineraryId, itineraryIds));

        if (invites.length > 0) {
          await db
            .delete(itineraryInvites)
            .where(inArray(itineraryInvites.itineraryId, itineraryIds));
          deletedInvites += invites.length;
        }

        // Delete itineraries
        await db
          .delete(itineraries)
          .where(inArray(itineraries.id, itineraryIds));
        deletedItineraries += itineraryIds.length;
      }

      // Delete auto-scheduled events
      await db
        .delete(autoScheduledEvents)
        .where(eq(autoScheduledEvents.groupId, groupId));
      deletedEvents += events.length;
    }

    console.log(`   ✅ Cleaned up ${group.name}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 CLEANUP RESULTS:");
  console.log(`   Deleted ${deletedEvents} auto-scheduled events`);
  console.log(`   Deleted ${deletedOptions} itinerary options`);
  console.log(`   Deleted ${deletedItineraries} itineraries`);
  console.log(`   Deleted ${deletedItems} itinerary items`);
  console.log(`   Deleted ${deletedInvites} itinerary invites`);

  console.log("\n🔄 Recreating events with correct spacing...\n");

  // Recreate events for each group
  for (const groupId of groupsToReset) {
    const group = allGroups.find(g => g.id === groupId)!;
    console.log(`\n📅 Recreating events for ${group.name}...`);

    try {
      const created = await maintainEventPipeline(groupId, storage);
      console.log(`   ✅ Created ${created} new event(s) with proper ${group.meetingFrequency} spacing`);
    } catch (error: any) {
      console.error(`   ❌ Error recreating events:`, error.message);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Reset complete!");
  console.log("=".repeat(80) + "\n");

  process.exit(0);
}

resetAutoSchedule().catch((error) => {
  console.error("❌ Error during reset:", error);
  process.exit(1);
});
