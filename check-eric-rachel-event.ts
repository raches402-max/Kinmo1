import { db } from "./server/db";
import { itineraries, groups } from "@shared/schema";
import { eq, like } from "drizzle-orm";
import { format } from "date-fns";

async function checkEricRachelEvent() {
  // Find Eric + Rachel group
  const [group] = await db
    .select()
    .from(groups)
    .where(like(groups.name, "%Eric%Rachel%"));

  if (!group) {
    console.log("Eric + Rachel group not found");
    process.exit(0);
  }

  console.log("Group:", group.name, group.id);

  // Find itineraries for this group
  const events = await db
    .select()
    .from(itineraries)
    .where(eq(itineraries.groupId, group.id));

  console.log(`\nFound ${events.length} events:\n`);

  events.forEach(event => {
    if (event.eventDate) {
      const dateObj = new Date(event.eventDate);
      console.log("Event:", event.name || "Unnamed");
      console.log("  Database value:", event.eventDate);
      console.log("  ISO String:", dateObj.toISOString());
      console.log("  Dashboard format:", format(dateObj, "MMM d, h:mm a"));
      console.log("  Event details format:", format(dateObj, "EEEE, MMMM d, yyyy • h:mm a"));
      console.log("  UTC hours:", dateObj.getUTCHours(), "minutes:", dateObj.getUTCMinutes());
      console.log("  Local hours:", dateObj.getHours(), "minutes:", dateObj.getMinutes());
      console.log();
    }
  });

  process.exit(0);
}

checkEricRachelEvent().catch(console.error);
