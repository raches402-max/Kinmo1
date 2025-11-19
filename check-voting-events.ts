import { db } from "./server/db";
import { votingEvents, votingTimeSlots, groups } from "@shared/schema";
import { eq } from "drizzle-orm";

async function checkVotingEvents() {
  const [sweatpantsGroup] = await db
    .select()
    .from(groups)
    .where(eq(groups.name, "Sweatpants"));

  if (!sweatpantsGroup) {
    console.log("❌ Sweatpants group not found");
    process.exit(1);
  }

  console.log(`✅ Sweatpants group: ${sweatpantsGroup.id}\n`);

  // Get all voting events for Sweatpants
  const events = await db
    .select()
    .from(votingEvents)
    .where(eq(votingEvents.groupId, sweatpantsGroup.id));

  console.log(`Found ${events.length} voting events\n`);

  // Check each voting event for time slots
  for (const event of events) {
    const timeSlots = await db
      .select()
      .from(votingTimeSlots)
      .where(eq(votingTimeSlots.votingEventId, event.id));

    // Check if any time slot is Nov 18 at 9:40pm
    const nov18Slot = timeSlots.find(slot => {
      const slotDate = new Date(slot.proposedDateTime);
      return slotDate.getMonth() === 10 && // November (0-indexed)
             slotDate.getDate() === 18 &&
             slotDate.getHours() === 21 && // 9pm in 24-hour
             slotDate.getMinutes() === 40;
    });

    if (nov18Slot) {
      console.log(`🎯 FOUND Nov 18, 9:40pm EVENT!`);
      console.log(`Voting Event ID: ${event.id}`);
      console.log(`Status: ${event.status}`);
      console.log(`Created: ${event.createdAt}`);
      console.log(`\nTime Slots for this event:`);
      timeSlots.forEach(slot => {
        const date = new Date(slot.proposedDateTime);
        console.log(`  - ${date.toLocaleString()} (Slot ID: ${slot.id})`);
      });
      console.log(`\n✅ This is the event to delete!`);
      console.log(`Delete command: Voting Event ID = ${event.id}\n`);
    }
  }

  process.exit(0);
}

checkVotingEvents().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
