import { db } from "./db";
import { groups, activities } from "@shared/schema";
import { like, eq } from "drizzle-orm";

async function testSweatpants() {
  console.log("=".repeat(60));
  console.log("Testing Venue Hours Data");
  console.log("=".repeat(60));

  // List all groups
  const allGroups = await db.select().from(groups).limit(10);
  console.log(`\nFound ${allGroups.length} groups:`);
  for (const group of allGroups) {
    console.log(`  - ${group.name} (ID: ${group.id})`);
  }

  // Find Sweatpants group
  const sweatpantsGroups = await db
    .select()
    .from(groups)
    .where(like(groups.name, "%sweatpants%"))
    .limit(5);

  if (sweatpantsGroups.length === 0) {
    console.log("\nNo 'Sweatpants' group found. Checking venues mentioned by user...");

    // Check for venues mentioned by user
    const venueNames = ["Taniku", "Mr Tipple", "Deliboard"];
    for (const venueName of venueNames) {
      const venueActivities = await db
        .select()
        .from(activities)
        .where(like(activities.venueName, `%${venueName}%`))
        .limit(5);

      if (venueActivities.length > 0) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`Found ${venueActivities.length} activities matching "${venueName}":`);
        for (const activity of venueActivities) {
          console.log(`\n  ${activity.venueName} (${activity.venueType})`);
          console.log(`    Google Place ID: ${activity.googlePlaceId}`);
          console.log(`    Business Status: ${activity.businessStatus || "Not set"}`);

          if (activity.openingHours) {
            const hours = activity.openingHours as any;
            if (hours.weekdayDescriptions) {
              console.log(`    Hours:`);
              for (const dayHours of hours.weekdayDescriptions) {
                console.log(`      ${dayHours}`);
              }
            }
          } else {
            console.log(`    Hours: Not available`);
          }
        }
      }
    }
    return;
  }

  console.log(`\nFound ${sweatpantsGroups.length} matching group(s):`);
  for (const group of sweatpantsGroups) {
    console.log(`  - ${group.name} (ID: ${group.id})`);
    console.log(`    Auto-schedule: ${group.autoScheduleEnabled}`);
    console.log(`    Meeting frequency: ${group.meetingFrequency}`);
    console.log(`    Timezone: ${group.timezone}`);
  }

  // Get activities for the first group
  const group = sweatpantsGroups[0];
  const groupActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.groupId, group.id));

  console.log(`\n\nActivities for ${group.name}:`);
  console.log("=".repeat(60));

  for (const activity of groupActivities) {
    console.log(`\n${activity.venueName} (${activity.venueType})`);
    console.log(`  Google Place ID: ${activity.googlePlaceId}`);
    console.log(`  Business Status: ${activity.businessStatus || "Not set"}`);

    if (activity.openingHours) {
      const hours = activity.openingHours as any;
      if (hours.weekdayDescriptions) {
        console.log(`  Hours:`);
        for (const dayHours of hours.weekdayDescriptions) {
          console.log(`    ${dayHours}`);
        }
      } else {
        console.log(`  Hours: Available but no weekday descriptions`);
      }
    } else {
      console.log(`  Hours: Not available`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

testSweatpants().catch(console.error).finally(() => process.exit(0));
