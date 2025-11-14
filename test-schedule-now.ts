import { storage } from "./server/storage";
import { pool } from "./server/db";

/**
 * Simulate clicking Schedule Now for Mission Amigos to see the exact error
 */

async function testScheduleNow() {
  console.log("Testing Schedule Now for Mission Amigos...\n");

  try {
    const groupId = "5bd9c651-3767-48c8-a160-7caf32774a4d";

    // Get group
    const group = await storage.getGroup(groupId);
    if (!group) {
      console.log("❌ Group not found");
      return;
    }
    console.log(`✅ Group: ${group.name}`);

    // Import auto-scheduler
    const { shouldTriggerAutoSchedule, selectBestItineraryForAutoSchedule } = await import('./server/auto-scheduler.js');

    // Check existing events
    const existingPendingEvents = await storage.getPendingAutoScheduledEvents(groupId);
    const existingItineraries = await storage.getGroupItineraries(groupId);
    const existingProposedOrScheduled = existingItineraries.filter(i =>
      i.status === 'proposed' || i.status === 'scheduled'
    );

    console.log(`   Pending auto-events: ${existingPendingEvents.length}`);
    console.log(`   Proposed/scheduled: ${existingProposedOrScheduled.length}`);

    // Check if can trigger
    const hasPendingEvent = existingPendingEvents.length > 0;
    const canTrigger = await shouldTriggerAutoSchedule(storage, group, hasPendingEvent);
    console.log(`   Can trigger: ${canTrigger}`);

    if (!canTrigger && existingProposedOrScheduled.length === 0) {
      console.log("❌ Would return 400: Not within window");
      return;
    }

    // Try to select itinerary
    console.log("\n🔍 Selecting itinerary...");
    const selection = await selectBestItineraryForAutoSchedule(storage, group);

    if (!selection) {
      console.log("❌ No viable itineraries");
      return;
    }

    console.log("✅ Selection made");
    console.log("   Selection keys:", Object.keys(selection));

    // Create itinerary based on selection format
    let itineraryId: string;

    if ('itineraryId' in selection && selection.itineraryId) {
      console.log("\n📋 Using existing itinerary format");
      const originalItinerary = await storage.getItinerary(selection.itineraryId);
      if (!originalItinerary) {
        console.log("❌ Original itinerary not found");
        return;
      }

      const originalItems = originalItinerary.items;
      const duplicatedItinerary = await storage.createItinerary(
        {
          groupId: group.id,
          name: `${originalItinerary.name} (Auto-Scheduled)`,
          status: "draft",
        },
        group.userId!,
        originalItems.map(item => ({
          sourceType: item.sourceType,
          sourceId: item.sourceId
        }))
      );
      itineraryId = duplicatedItinerary.id;
      console.log(`✅ Created itinerary: ${itineraryId}`);
    } else if ('options' in selection && selection.options && selection.options.length > 0) {
      console.log("\n📋 Using options format");
      const topPicksOption = selection.options[0];
      console.log(`   Option has ${topPicksOption.venues?.length || 0} venues`);

      if (!topPicksOption.venues || topPicksOption.venues.length === 0) {
        console.log("❌ No venues in top picks option");
        return;
      }

      const proposedOrder = topPicksOption.venues.map((v: any) => {
        console.log(`     Venue keys: ${Object.keys(v).join(', ')}`);
        return v.sourceId;
      });

      console.log(`   Proposed order: ${proposedOrder.join(', ')}`);

      const newItinerary = await storage.createItinerary(
        {
          groupId: group.id,
          name: "Upcoming Hangout",
          status: "draft",
          proposedOrder,
        },
        group.userId!,
        topPicksOption.venues.map((venue: any) => ({
          sourceType: venue.sourceType,
          sourceId: venue.sourceId
        }))
      );
      itineraryId = newItinerary.id;
      console.log(`✅ Created itinerary: ${itineraryId}`);
    } else {
      console.log("❌ Unknown selection format");
      console.log("   Selection:", JSON.stringify(selection, null, 2));
      return;
    }

    console.log("\n✅ Test completed successfully!");

  } catch (error: any) {
    console.error("\n❌ ERROR:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    await pool.end();
  }
}

testScheduleNow();
