import { storage } from "./storage";
import { pool } from "./db";

/**
 * Debug script to test auto-schedule trigger for Mission Amigos group
 */

async function testMissionAmigosSchedule() {
  console.log("=".repeat(70));
  console.log("TESTING AUTO-SCHEDULE FOR MISSION AMIGOS");
  console.log("=".repeat(70));
  console.log();

  try {
    // Step 1: Find Mission Amigos group
    console.log("Step 1: Finding Mission Amigos group...");
    const groups = await storage.getUserGroups("47724077"); // Your user ID
    const missionAmigos = groups.find(g => g.name === "Mission Amigos");

    if (!missionAmigos) {
      console.log("❌ Mission Amigos group not found!");
      console.log("Available groups:");
      groups.forEach(g => console.log(`  - ${g.name} (${g.id})`));
      return;
    }

    console.log(`✅ Found group: ${missionAmigos.name}`);
    console.log(`   ID: ${missionAmigos.id}`);
    console.log(`   Auto-schedule enabled: ${missionAmigos.autoScheduleEnabled}`);
    console.log(`   Next event due: ${missionAmigos.nextEventDueDate}`);
    console.log();

    // Step 2: Check if auto-schedule is enabled
    if (!missionAmigos.autoScheduleEnabled) {
      console.log("❌ Auto-scheduling is not enabled for this group");
      return;
    }

    // Step 3: Check for existing pending events
    console.log("Step 2: Checking for existing pending events...");
    const existingPendingEvents = await storage.getPendingAutoScheduledEvents(missionAmigos.id);
    console.log(`   Pending events: ${existingPendingEvents.length}`);
    if (existingPendingEvents.length > 0) {
      console.log(`   ⚠️  Found existing pending event:`);
      existingPendingEvents.forEach(e => {
        console.log(`     - ID: ${e.id}`);
        console.log(`     - Proposed Date: ${e.proposedDate}`);
        console.log(`     - Status: ${e.status}`);
      });
    }
    console.log();

    // Step 4: Check if we should trigger (within 10-day window)
    console.log("Step 3: Checking trigger conditions...");
    const { shouldTriggerAutoSchedule } = await import('./auto-scheduler.js');
    const hasPendingEvent = existingPendingEvents.length > 0;

    const shouldTrigger = await shouldTriggerAutoSchedule(storage, missionAmigos, hasPendingEvent);
    console.log(`   Should trigger: ${shouldTrigger}`);

    if (!shouldTrigger) {
      const now = new Date();
      const dueDate = missionAmigos.nextEventDueDate ? new Date(missionAmigos.nextEventDueDate) : null;
      if (dueDate) {
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   Days until due: ${daysUntilDue}`);
        console.log(`   (Trigger window: 0-10 days before due date)`);
      }
      console.log();
    }

    // Step 5: Try to select best itinerary
    console.log("Step 4: Selecting best itinerary...");
    const { selectBestItineraryForAutoSchedule } = await import('./auto-scheduler.js');

    try {
      const selection = await selectBestItineraryForAutoSchedule(storage, missionAmigos);

      if (!selection) {
        console.log("❌ No viable itineraries or activities to schedule");
        return;
      }

      console.log("✅ Selection made:");
      if ('itineraryId' in selection && selection.itineraryId) {
        console.log(`   Type: Existing itinerary`);
        console.log(`   Itinerary ID: ${selection.itineraryId}`);
      } else if ('selectedVenues' in selection && selection.selectedVenues) {
        console.log(`   Type: Selected venues`);
        console.log(`   Venues: ${selection.selectedVenues.length}`);
        selection.selectedVenues.forEach((v, i) => {
          console.log(`     ${i + 1}. ${v.sourceType} - ${v.sourceId}`);
        });
      }
      console.log();

      // Step 6: Test AI time suggestion
      console.log("Step 5: Testing AI time suggestion...");
      const { suggestOptimalTime } = await import('./ai-time-picker.js');
      const { aggregateMemberAvailability, convertAvailabilityToText } = await import('./availability-utils');

      const aggregatedAvailability = await aggregateMemberAvailability(missionAmigos.id, storage);
      console.log(`   Aggregated availability from ${aggregatedAvailability.memberCount} members`);

      const availabilityString = convertAvailabilityToText(
        aggregatedAvailability.grid,
        aggregatedAvailability.conflicts,
        aggregatedAvailability.memberCount
      );
      console.log(`   Availability string: "${availabilityString}"`);

      // Mock venues for testing
      const testVenues = [
        { name: "Test Restaurant", type: "restaurant" },
        { name: "Test Bar", type: "bar" }
      ];

      try {
        const timeResult = await suggestOptimalTime({
          generalAvailability: availabilityString,
          venues: testVenues,
          location: missionAmigos.locationBase,
          meetingFrequency: missionAmigos.meetingFrequency || undefined,
          timezone: missionAmigos.timezone || undefined,
        });

        console.log(`✅ AI suggested time: ${timeResult.eventDate.toISOString()}`);
        console.log(`   Reasoning: ${timeResult.reasoning}`);
      } catch (aiError: any) {
        console.log(`❌ AI time suggestion failed:`);
        console.log(`   Error: ${aiError.message}`);
        console.log(`   Stack: ${aiError.stack}`);
      }

    } catch (selectionError: any) {
      console.log(`❌ Selection failed:`);
      console.log(`   Error: ${selectionError.message}`);
      console.log(`   Stack: ${selectionError.stack}`);
    }

    console.log();
    console.log("=".repeat(70));
    console.log("TEST COMPLETE");
    console.log("=".repeat(70));

  } catch (error: any) {
    console.error("❌ Test failed:", error);
    console.error("Stack trace:", error.stack);
  } finally {
    await pool.end();
  }
}

// Run the test
testMissionAmigosSchedule()
  .then(() => {
    console.log("\n✅ Test finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test crashed:", error);
    process.exit(1);
  });
