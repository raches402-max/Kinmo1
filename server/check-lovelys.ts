import { searchPlaces } from "./google-places";

/**
 * Check if Lovely's Oakland location exists via Google Places API
 */

async function checkLovelysLocations() {
  console.log('Checking for Lovely\'s locations...\n');

  // Search for Lovely's in Oakland
  console.log('1. Searching: "Lovely\'s Oakland"');
  const oaklandResults = await searchPlaces(
    "Lovely's Oakland",
    "Oakland, CA",
    5, // 5 mile radius
    { lat: 37.8044, lng: -122.2712 }, // Oakland coordinates
    true, // skip curated
    undefined, // no venue type
    undefined, // no budget
    undefined, // no seen venues
    false, // not comprehensive
    true // user directed
  );

  console.log(`Found ${oaklandResults.length} results for Oakland search:`);
  for (const place of oaklandResults) {
    console.log(`  - ${place.name} (${place.address})`);
  }

  console.log('\n2. Searching: "Lovely\'s San Francisco"');
  const sfResults = await searchPlaces(
    "Lovely's San Francisco",
    "San Francisco, CA",
    5, // 5 mile radius
    { lat: 37.7749, lng: -122.4194 }, // SF coordinates
    true, // skip curated
    undefined,
    undefined,
    undefined,
    false,
    true
  );

  console.log(`Found ${sfResults.length} results for SF search:`);
  for (const place of sfResults) {
    console.log(`  - ${place.name} (${place.address})`);
  }

  console.log('\n3. Searching: "Lovely\'s Ice Cream"');
  const generalResults = await searchPlaces(
    "Lovely's Ice Cream",
    "Bay Area, CA",
    30, // 30 mile radius
    { lat: 37.8, lng: -122.4 }, // Bay Area center
    true, // skip curated
    undefined,
    undefined,
    undefined,
    false,
    true
  );

  console.log(`Found ${generalResults.length} results for general search:`);
  for (const place of generalResults) {
    console.log(`  - ${place.name} (${place.address}) - ${place.googlePlaceId}`);
  }

  console.log('\n=== Summary ===');
  const uniquePlaceIds = new Set([
    ...oaklandResults.map(p => p.googlePlaceId),
    ...sfResults.map(p => p.googlePlaceId),
    ...generalResults.map(p => p.googlePlaceId)
  ]);

  console.log(`Total unique Lovely's locations found: ${uniquePlaceIds.size}`);
}

// Run the check
checkLovelysLocations()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
