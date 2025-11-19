import { db } from "./server/db";
import { itineraries, groups } from "@shared/schema";
import { eq } from "drizzle-orm";

async function checkSweatpantsEvents() {
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

  const allItineraries = await db
    .select()
    .from(itineraries)
    .where(eq(itineraries.groupId, sweatpantsGroup.id));

  console.log(`Found ${allItineraries.length} total event(s) for Sweatpants:\n`);

  allItineraries.forEach((it, idx) => {
    const dateStr = it.eventDate ? new Date(it.eventDate).toLocaleString() : 'No date';
    console.log(`${idx + 1}. ID: ${it.id}`);
    console.log(`   Name: "${it.name}"`);
    console.log(`   Date: ${dateStr}`);
    console.log(`   Status: ${it.status}`);
    console.log();
  });

  process.exit(0);
}

checkSweatpantsEvents().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
