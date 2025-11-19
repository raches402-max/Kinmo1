import { db } from "./server/db";
import { itineraries, itineraryInvites, itineraryItems, rsvps, groups } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function deleteSweatpantsNov18Event() {
  console.log("Finding Sweatpants group...");

  // Find Sweatpants group
  const [sweatpantsGroup] = await db
    .select()
    .from(groups)
    .where(eq(groups.name, "Sweatpants"));

  if (!sweatpantsGroup) {
    console.log("❌ Sweatpants group not found");
    process.exit(1);
  }

  console.log(`✅ Found Sweatpants group: ${sweatpantsGroup.id}`);

  // Find itineraries for Nov 18, 2025
  console.log("\nFinding itineraries for Nov 18, 2025...");
  const allItineraries = await db
    .select()
    .from(itineraries)
    .where(eq(itineraries.groupId, sweatpantsGroup.id));

  const nov18Itineraries = allItineraries.filter(it => {
    if (!it.eventDate) return false;
    const eventDate = new Date(it.eventDate);
    return eventDate.getFullYear() === 2025 &&
           eventDate.getMonth() === 10 && // November is month 10 (0-indexed)
           eventDate.getDate() === 18;
  });

  console.log(`Found ${nov18Itineraries.length} itinerary/itineraries for Nov 18:`);
  nov18Itineraries.forEach(it => {
    console.log(`  - ${it.id}: "${it.name}" on ${it.eventDate}`);
  });

  if (nov18Itineraries.length === 0) {
    console.log("\n❌ No Nov 18 events found to delete");
    process.exit(0);
  }

  // Delete each itinerary and related data
  for (const itinerary of nov18Itineraries) {
    console.log(`\nDeleting itinerary ${itinerary.id}: "${itinerary.name}"...`);

    // Delete RSVPs
    const deletedRsvps = await db
      .delete(rsvps)
      .where(eq(rsvps.itineraryId, itinerary.id));
    console.log(`  ✅ Deleted RSVPs`);

    // Delete itinerary items
    const deletedItems = await db
      .delete(itineraryItems)
      .where(eq(itineraryItems.itineraryId, itinerary.id));
    console.log(`  ✅ Deleted itinerary items`);

    // Delete invites
    const deletedInvites = await db
      .delete(itineraryInvites)
      .where(eq(itineraryInvites.itineraryId, itinerary.id));
    console.log(`  ✅ Deleted invites`);

    // Delete itinerary
    await db
      .delete(itineraries)
      .where(eq(itineraries.id, itinerary.id));
    console.log(`  ✅ Deleted itinerary`);
  }

  console.log(`\n✅ Successfully deleted ${nov18Itineraries.length} Sweatpants event(s) for Nov 18!`);
  process.exit(0);
}

deleteSweatpantsNov18Event().catch((error) => {
  console.error("❌ Error deleting event:", error);
  process.exit(1);
});
