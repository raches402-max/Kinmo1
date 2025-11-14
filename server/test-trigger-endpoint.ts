import { storage } from "./storage";
import { pool } from "./db";

/**
 * Test the trigger-auto-schedule logic to see what error occurs
 */

async function testTriggerAutoSchedule() {
  console.log("Testing trigger-auto-schedule logic...\n");

  try {
    const groupId = "5bd9c651-3767-48c8-a160-7caf32774a4d"; // Mission Amigos

    // Step 1: Get group
    const group = await storage.getGroup(groupId);
    if (!group) {
      console.log("❌ Group not found");
      return;
    }
    console.log(`✅ Group found: ${group.name}`);

    // Step 2: Check existing pending auto-events
    const existingPendingEvents = await storage.getPendingAutoScheduledEvents(groupId);
    console.log(`   Pending auto-events: ${existingPendingEvents.length}`);

    // Step 3: Check for existing proposed/scheduled itineraries
    const existingItineraries = await storage.getGroupItineraries(groupId);
    const existingProposedOrScheduled = existingItineraries.filter(i =>
      i.status === 'proposed' || i.status === 'scheduled'
    );
    console.log(`   Proposed/scheduled itineraries: ${existingProposedOrScheduled.length}`);

    // Step 4: Import and test auto-scheduler
    const { shouldTriggerAutoSchedule, selectBestItineraryForAutoSchedule } = await import('./auto-scheduler.js');

    const hasPendingEvent = existingPendingEvents.length > 0;
    const canTrigger = await shouldTriggerAutoSchedule(storage, group, hasPendingEvent);
    console.log(`   Can trigger: ${canTrigger}`);

    if (!canTrigger && existingProposedOrScheduled.length === 0) {
      console.log("   ❌ Would return 400: Not within window and no existing events");
      return;
    }

    // Step 5: Try to select itinerary
    console.log("\nSelecting itinerary...");
    const selection = await selectBestItineraryForAutoSchedule(storage, group);

    if (!selection) {
      console.log("❌ No viable itineraries or activities");
      return;
    }

    console.log("✅ Selection made");

    // Step 6: Create itinerary
    console.log("\nCreating itinerary...");
    let itineraryId: string;

    if ('itineraryId' in selection && selection.itineraryId) {
      const originalItinerary = await storage.getItinerary(selection.itineraryId);
      if (!originalItinerary) {
        console.log("❌ Original itinerary not found");
        return;
      }

      const originalItems = await storage.getItineraryItems(selection.itineraryId);
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
      console.log(`✅ Created duplicated itinerary: ${itineraryId}`);
    } else if ('selectedVenues' in selection && selection.selectedVenues) {
      const newItinerary = await storage.createItinerary(
        {
          groupId: group.id,
          name: "Upcoming Hangout",
          status: "draft",
        },
        group.userId!,
        selection.selectedVenues.map(venue => ({
          sourceType: 'activity' as const,
          sourceId: venue.id
        }))
      );
      itineraryId = newItinerary.id;
      console.log(`✅ Created new itinerary: ${itineraryId}`);
    } else if ('options' in selection && selection.options && selection.options.length > 0) {
      // New format: Create itinerary from first option (Top Picks)
      console.log("   Using new options format");
      const topPicksOption = selection.options[0];
      const proposedOrder = topPicksOption.venues.map((v: any) => v.sourceId);
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
      console.log(`✅ Created new itinerary from options: ${itineraryId}`);
    } else {
      console.log("❌ No valid selection");
      console.log("   Selection keys:", Object.keys(selection));
      return;
    }

    // Step 7: Check if we should return multiple options
    console.log("\nChecking response format...");
    if (existingProposedOrScheduled.length > 0) {
      console.log("✅ Will return multiple options");

      // Try to get details
      const existingEventsWithItems = await Promise.all(
        existingProposedOrScheduled.map(async (event) => {
          const items = await storage.getItineraryItems(event.id);
          return {
            ...event,
            items
          };
        })
      );

      const newItinerary = await storage.getItinerary(itineraryId);
      const newItems = await storage.getItineraryItems(itineraryId);

      console.log("   Existing events:", existingEventsWithItems.length);
      console.log("   New event option:", newItinerary ? "✅" : "❌");
      console.log("\n✅ Response would include both options");
    } else {
      console.log("✅ Will create auto-scheduled event");
    }

    console.log("\n✅ Test completed successfully - no errors!");

  } catch (error: any) {
    console.error("\n❌ ERROR OCCURRED:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    await pool.end();
  }
}

testTriggerAutoSchedule();
