import { db } from "./db";
import { curatedVenues } from "@shared/schema";
import { searchPlaces } from "./google-places";

/**
 * Add Oakland Lovely's location to curated_venues database
 */

async function addOaklandLovelys() {
  console.log('Adding Oakland Lovely\'s to database...\n');

  // Search for Oakland Lovely's
  const results = await searchPlaces(
    "Lovely's Oakland",
    "Oakland, CA",
    5,
    { lat: 37.8044, lng: -122.2712 },
    true, // skip curated
    undefined,
    undefined,
    undefined,
    false,
    true
  );

  if (results.length === 0) {
    console.log('❌ Could not find Oakland Lovely\'s');
    return;
  }

  const lovely = results[0];
  console.log(`Found: ${lovely.name}`);
  console.log(`Address: ${lovely.address}`);
  console.log(`Rating: ${lovely.rating} (${lovely.reviewCount} reviews)`);
  console.log(`Price Level: ${lovely.priceLevel || 'N/A'}`);
  console.log(`Location: ${JSON.stringify(lovely.location)}`);

  if (!lovely.location) {
    console.log('❌ No location coordinates found');
    return;
  }

  // Use city from parsed address or default to Oakland
  const city = lovely.city || 'Oakland';

  // Convert price level string ("$", "$$", "$$$", "$$$$") to integer (1-4)
  let priceLevelNum = 2; // Default to $$
  if (lovely.priceLevel) {
    const dollarSigns = lovely.priceLevel.match(/\$/g);
    priceLevelNum = dollarSigns ? dollarSigns.length : 2;
  }

  console.log(`\nInserting into curated_venues...`);

  try {
    await db.insert(curatedVenues).values({
      name: lovely.name,
      address: lovely.address,
      latitude: lovely.location.lat.toString(),
      longitude: lovely.location.lng.toString(),
      category: 'dessert', // Ice cream shop
      rating: lovely.rating || '0',
      reviewCount: lovely.reviewCount || 0,
      priceLevel: priceLevelNum,
      photoUrl: lovely.photoUrl,
      googlePlaceId: lovely.placeId,
      description: 'Ice cream shop in Oakland',
      tags: ['dessert', 'ice cream', 'casual'],
      region: city, // Should be "Oakland"
      isActive: true,
      source: 'manual',
    });

    console.log(`✅ Successfully added ${lovely.name} to database!`);
    console.log(`Region set to: "${city}"`);
  } catch (error) {
    console.error('❌ Error inserting venue:', error);
    throw error;
  }
}

// Run the script
addOaklandLovelys()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
