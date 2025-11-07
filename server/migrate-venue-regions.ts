import { db } from "./db";
import { curatedVenues } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Migration script to update venue regions from "SF Bay Area" to specific city names
 * Parses the city from each venue's address and updates the region accordingly
 */

function parseCityFromAddress(address: string): string {
  // Address format is typically: "123 Street Name, City, State ZIP"
  // Example: "848 Cole St, San Francisco, California 94117"

  const parts = address.split(',').map(part => part.trim());

  if (parts.length < 2) {
    console.warn(`Cannot parse city from address: "${address}"`);
    return 'bay_area'; // Fallback
  }

  // City is typically the second-to-last part (before state/zip)
  // parts[0] = street address
  // parts[1] = city
  // parts[2] = state/zip
  const city = parts[1];

  // Clean up the city name
  return city.trim();
}

async function migrateVenueRegions() {
  console.log('Starting venue region migration...\n');

  // Get all venues with region = "SF Bay Area"
  const venues = await db
    .select()
    .from(curatedVenues)
    .where(eq(curatedVenues.region, 'SF Bay Area'));

  console.log(`Found ${venues.length} venues with region = "SF Bay Area"\n`);

  if (venues.length === 0) {
    console.log('No venues to migrate. Exiting.');
    return;
  }

  // Track statistics
  const cityStats: Record<string, number> = {};
  let successCount = 0;
  let errorCount = 0;

  // Process each venue
  for (const venue of venues) {
    try {
      const city = parseCityFromAddress(venue.address);

      // Update the venue's region
      await db
        .update(curatedVenues)
        .set({ region: city })
        .where(eq(curatedVenues.id, venue.id));

      // Track statistics
      cityStats[city] = (cityStats[city] || 0) + 1;
      successCount++;

      if (successCount % 100 === 0) {
        console.log(`Progress: ${successCount}/${venues.length} venues updated`);
      }
    } catch (error) {
      console.error(`Error updating venue "${venue.name}":`, error);
      errorCount++;
    }
  }

  console.log('\n=== Migration Complete ===');
  console.log(`Successfully updated: ${successCount} venues`);
  console.log(`Errors: ${errorCount} venues`);
  console.log('\n=== City Distribution ===');

  // Sort cities by count (descending)
  const sortedCities = Object.entries(cityStats)
    .sort((a, b) => b[1] - a[1]);

  for (const [city, count] of sortedCities) {
    console.log(`  ${city}: ${count} venues`);
  }

  console.log('\nMigration complete! You can now test searching for venues.');
}

// Run the migration
migrateVenueRegions()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
