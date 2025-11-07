import { db } from "./db";
import { curatedVenues } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * Clean up region data - standardize to title case city names
 * Fix all the garbage values from the previous migration
 */

async function cleanupRegions() {
  console.log('Cleaning up region data...\n');

  // Get all venues with their current regions
  const venues = await db
    .select({
      id: curatedVenues.id,
      name: curatedVenues.name,
      address: curatedVenues.address,
      region: curatedVenues.region
    })
    .from(curatedVenues);

  console.log(`Found ${venues.length} total venues\n`);

  // Track statistics
  const regionCounts: Record<string, number> = {};
  let updateCount = 0;

  for (const venue of venues) {
    let newRegion: string | null = null;
    const currentRegion = venue.region || '';

    // Standardize common regions
    const regionLower = currentRegion.toLowerCase();

    if (regionLower.includes('san francisco') || regionLower === 'san_francisco') {
      newRegion = 'San Francisco';
    } else if (regionLower.includes('oakland')) {
      newRegion = 'Oakland';
    } else if (regionLower.includes('san jose') || regionLower === 'san_jose') {
      newRegion = 'San Jose';
    } else if (regionLower.includes('san mateo') || regionLower === 'san_mateo') {
      newRegion = 'San Mateo';
    } else if (regionLower === 'bay_area' || regionLower === 'sf bay area') {
      newRegion = 'Bay Area';
    } else if (regionLower.includes('daly city')) {
      newRegion = 'Daly City';
    } else if (regionLower.includes('burlingame')) {
      newRegion = 'Burlingame';
    } else if (regionLower.includes('berkeley')) {
      newRegion = 'Berkeley';
    } else if (regionLower.includes('palo alto')) {
      newRegion = 'Palo Alto';
    } else if (regionLower.includes('redwood city')) {
      newRegion = 'Redwood City';
    } else if (regionLower.includes('mountain view')) {
      newRegion = 'Mountain View';
    } else if (regionLower.includes('sunnyvale')) {
      newRegion = 'Sunnyvale';
    } else if (regionLower.includes('fremont')) {
      newRegion = 'Fremont';
    } else if (regionLower.includes('hayward')) {
      newRegion = 'Hayward';
    } else if (regionLower.includes('alameda')) {
      newRegion = 'Alameda';
    } else if (regionLower.includes('pacifica')) {
      newRegion = 'Pacifica';
    } else if (regionLower.includes('colma')) {
      newRegion = 'Colma';
    } else if (regionLower.includes('foster city')) {
      newRegion = 'Foster City';
    } else {
      // Check if it's a garbage value (address, building name, etc.)
      // These typically have numbers, special chars, or are very short
      const isGarbage = (
        /\d/.test(currentRegion) || // Contains numbers
        currentRegion.length <= 2 || // Too short
        currentRegion.includes('St') ||
        currentRegion.includes('Ave') ||
        currentRegion.includes('Blvd') ||
        currentRegion.includes('Building') ||
        currentRegion.includes('Store') ||
        currentRegion.includes('Ferry') ||
        currentRegion.includes('Embarcadero') ||
        currentRegion.includes('Plaza') ||
        currentRegion.includes('Center') ||
        currentRegion.includes('Ctr')
      );

      if (isGarbage) {
        // Parse city from address as fallback
        const addressParts = venue.address.split(',').map(p => p.trim());
        if (addressParts.length >= 2) {
          newRegion = addressParts[1]; // City is typically second part
        } else {
          newRegion = 'Bay Area'; // Ultimate fallback
        }
        console.log(`  Fixing garbage region "${currentRegion}" → "${newRegion}" for ${venue.name}`);
      } else {
        // Keep as-is but title case it if it's not already
        newRegion = currentRegion.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
    }

    // Update if changed
    if (newRegion && newRegion !== currentRegion) {
      await db
        .update(curatedVenues)
        .set({ region: newRegion })
        .where(sql`${curatedVenues.id} = ${venue.id}`);

      updateCount++;

      if (updateCount % 100 === 0) {
        console.log(`Progress: ${updateCount} venues updated`);
      }
    }

    // Track final region distribution
    regionCounts[newRegion || currentRegion] = (regionCounts[newRegion || currentRegion] || 0) + 1;
  }

  console.log('\n=== Cleanup Complete ===');
  console.log(`Updated: ${updateCount} venues`);
  console.log(`\n=== Final Region Distribution ===`);

  // Sort by count descending
  const sortedRegions = Object.entries(regionCounts)
    .sort((a, b) => b[1] - a[1]);

  for (const [region, count] of sortedRegions) {
    console.log(`  ${region}: ${count} venues`);
  }
}

// Run the cleanup
cleanupRegions()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
