import { storage } from "./server/storage";
import { pool } from "./server/db";

/**
 * Test the schedule-next-event endpoint logic to see the exact error
 */

async function testScheduleNextEvent() {
  console.log("Testing schedule-next-event endpoint...\n");

  try {
    const groupId = "5bd9c651-3767-48c8-a160-7caf32774a4d"; // Mission Amigos
    const userId = "47724077";

    // Step 1: Get group
    const group = await storage.getGroup(groupId);
    if (!group) {
      console.log("❌ Group not found");
      return;
    }
    console.log(`✅ Group found: ${group.name}`);

    // Step 2: Check ownership
    if (group.userId !== userId) {
      console.log("❌ Not owner");
      return;
    }
    console.log(`✅ User is owner`);

    // Step 3: Check for existing pending auto event
    console.log("\n🔍 Checking for existing pending event...");
    console.log("   Calling: storage.getPendingAutoScheduledEvent()");

    const existingEvent = await storage.getPendingAutoScheduledEvent(groupId);
    console.log(`   Result: ${existingEvent ? 'Found existing event' : 'No existing event'}`);

    if (existingEvent && existingEvent.status === 'pending_approval') {
      console.log("❌ Would return 400: Already has pending event");
      console.log("   Event ID:", existingEvent.id);
      console.log("   Event status:", existingEvent.status);
      return;
    }

    // Step 4: Generate 3 itinerary options
    console.log("\n🔍 Generating itinerary options...");
    const { selectBestItineraryForAutoSchedule } = await import('./server/auto-scheduler.js');
    const result = await selectBestItineraryForAutoSchedule(storage, group);

    if (!result.options || result.options.length === 0) {
      console.log("❌ Would return 400: No options generated");
      return;
    }

    console.log(`✅ Generated ${result.options.length} options`);
    result.options.forEach((opt: any, i: number) => {
      console.log(`   Option ${i + 1}: ${opt.label || 'Untitled'}`);
      console.log(`     Venues: ${opt.venues?.length || 0}`);
    });

    // Step 5: Create auto-scheduled event
    console.log("\n🔍 Creating auto-scheduled event...");

    const { addDays } = await import('date-fns');
    const allowMemberVoting = false; // Default from frontend
    const proposedDate = group.nextEventDueDate ? new Date(group.nextEventDueDate) : addDays(new Date(), 7);
    const autoSendAt = addDays(proposedDate, -3);

    const autoEvent = await storage.createAutoScheduledEvent({
      groupId: group.id,
      proposedDate,
      autoSendAt,
      status: 'pending_approval',
      allowMemberVoting,
    });

    console.log(`✅ Created auto event: ${autoEvent.id}`);

    // Step 6: Store itinerary options
    console.log("\n🔍 Storing itinerary options...");

    for (let i = 0; i < result.options.length; i++) {
      const option = result.options[i];
      console.log(`   Storing option ${i + 1}...`);

      const itinerary = await storage.createItinerary(
        {
          groupId: group.id,
          name: option.label || `Option ${i + 1}`,
          status: 'draft',
          proposedOrder: option.venues.map((v: any) => v.sourceId),
        },
        userId,
        option.venues.map((v: any) => ({
          sourceType: v.sourceType,
          sourceId: v.sourceId,
        }))
      );

      await storage.linkItineraryToAutoEvent(autoEvent.id, itinerary.id, i);
      console.log(`     ✅ Created and linked itinerary: ${itinerary.id}`);
    }

    console.log("\n✅ SUCCESS! Endpoint would return 200 with event data");

  } catch (error: any) {
    console.error("\n❌ ERROR OCCURRED:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    await pool.end();
  }
}

testScheduleNextEvent();
