import { db } from "./server/db";
import { itineraries, groups, votingEvents } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

async function findNov18Event() {
  console.log("Finding Sweatpants group...");

  const [sweatpantsGroup] = await db
    .select()
    .from(groups)
    .where(eq(groups.name, "Sweatpants"));

  if (!sweatpantsGroup) {
    console.log("❌ Sweatpants group not found");
    process.exit(1);
  }

  console.log(`✅ Found Sweatpants group: ${sweatpantsGroup.id}\n`);

  // Check all itineraries with any date
  console.log("Checking all itineraries...");
  const allItineraries = await db
    .select()
    .from(itineraries)
    .where(eq(itineraries.groupId, sweatpantsGroup.id));

  console.log(`Found ${allItineraries.length} itineraries\n`);

  // Look for anything on Nov 18 with time around 9:40pm
  const nov18Events = allItineraries.filter(it => {
    if (!it.eventDate) return false;
    const eventDate = new Date(it.eventDate);
    const month = eventDate.getMonth();
    const date = eventDate.getDate();
    const hours = eventDate.getHours();

    // Check for Nov 18 (month 10 = November, 0-indexed)
    if (month === 10 && date === 18) {
      console.log(`Found Nov 18 event:`);
      console.log(`  ID: ${it.id}`);
      console.log(`  Name: "${it.name}"`);
      console.log(`  Date: ${eventDate.toLocaleString()}`);
      console.log(`  Status: ${it.status}`);
      console.log(`  Hours: ${hours}\n`);
      return true;
    }
    return false;
  });

  // Also check voting events
  console.log("\nChecking voting events...");
  const votingEventsData = await db
    .select()
    .from(votingEvents)
    .where(eq(votingEvents.groupId, sweatpantsGroup.id));

  console.log(`Found ${votingEventsData.length} voting events\n`);

  votingEventsData.forEach(ve => {
    console.log(`Voting Event ID: ${ve.id}`);
    console.log(`  Proposed Date: ${ve.proposedDate}`);
    console.log(`  Status: ${ve.status}`);
    console.log(`  Created: ${ve.createdAt}\n`);
  });

  if (nov18Events.length > 0) {
    console.log(`\n✅ Found ${nov18Events.length} event(s) for Nov 18`);
    console.log("\nTo delete, I'll need the event ID from above.");
  } else {
    console.log("\n❌ No Nov 18 events found in itineraries");
  }

  process.exit(0);
}

findNov18Event().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
