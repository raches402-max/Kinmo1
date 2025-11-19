import { db } from "./server/db";
import { itineraries, itineraryInvites, itineraryItems, rsvps, groups } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

async function deleteBuggyEvents() {
  const [sweatpantsGroup] = await db
    .select()
    .from(groups)
    .where(eq(groups.name, "Sweatpants"));

  if (!sweatpantsGroup) {
    console.log("❌ Sweatpants group not found");
    process.exit(1);
  }

  console.log(`✅ Sweatpants group: ${sweatpantsGroup.id}\n`);

  // Find all proposed itineraries with null names for Sweatpants
  const buggyEvents = await db
    .select()
    .from(itineraries)
    .where(
      and(
        eq(itineraries.groupId, sweatpantsGroup.id),
        eq(itineraries.status, "proposed"),
        isNull(itineraries.name)
      )
    );

  console.log(`Found ${buggyEvents.length} buggy proposed events with null names\n`);

  if (buggyEvents.length === 0) {
    console.log("No buggy events to delete");
    process.exit(0);
  }

  // Delete each buggy event
  for (const event of buggyEvents) {
    console.log(`Deleting event ${event.id}...`);

    // Delete RSVPs
    await db.delete(rsvps).where(eq(rsvps.itineraryId, event.id));
    console.log(`  ✅ Deleted RSVPs`);

    // Delete itinerary items
    await db.delete(itineraryItems).where(eq(itineraryItems.itineraryId, event.id));
    console.log(`  ✅ Deleted items`);

    // Delete invites
    await db.delete(itineraryInvites).where(eq(itineraryInvites.itineraryId, event.id));
    console.log(`  ✅ Deleted invites`);

    // Delete itinerary
    await db.delete(itineraries).where(eq(itineraries.id, event.id));
    console.log(`  ✅ Deleted itinerary\n`);
  }

  console.log(`✅ Successfully deleted ${buggyEvents.length} buggy event(s)!`);
  process.exit(0);
}

deleteBuggyEvents().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
