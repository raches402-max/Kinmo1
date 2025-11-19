import { db } from "./server/db";
import { itineraries, groups } from "@shared/schema";
import { eq } from "drizzle-orm";
import { format } from "date-fns";

async function checkTimezones() {
  // Find a recent itinerary with an event date
  const [itinerary] = await db
    .select({
      id: itineraries.id,
      name: itineraries.name,
      eventDate: itineraries.eventDate,
    })
    .from(itineraries)
    .where(eq(itineraries.groupId, "8883c08b-3027-49ed-8c23-57c5b982d707")) // Sweatpants
    .limit(1);

  if (!itinerary || !itinerary.eventDate) {
    console.log("No itinerary found with event date");
    process.exit(0);
  }

  console.log("\n=== Timezone Analysis ===\n");
  console.log("Itinerary:", itinerary.name);
  console.log("ID:", itinerary.id);
  console.log("\n--- Raw Database Value ---");
  console.log("eventDate (raw):", itinerary.eventDate);
  console.log("Type:", typeof itinerary.eventDate);

  console.log("\n--- JavaScript Date Object ---");
  const dateObj = new Date(itinerary.eventDate);
  console.log("new Date(eventDate):", dateObj);
  console.log("toISOString():", dateObj.toISOString());
  console.log("toLocaleString():", dateObj.toLocaleString());

  console.log("\n--- Formatted Dates ---");
  console.log("Dashboard format (MMM d, h:mm a):", format(dateObj, "MMM d, h:mm a"));
  console.log("Event details format (EEEE, MMMM d, yyyy • h:mm a):", format(dateObj, "EEEE, MMMM d, yyyy • h:mm a"));

  console.log("\n--- Time Components ---");
  console.log("getHours():", dateObj.getHours());
  console.log("getMinutes():", dateObj.getMinutes());
  console.log("getTimezoneOffset():", dateObj.getTimezoneOffset(), "minutes");

  console.log("\n--- Environment ---");
  console.log("Server timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log("TZ env variable:", process.env.TZ || "not set");

  process.exit(0);
}

checkTimezones().catch(console.error);
