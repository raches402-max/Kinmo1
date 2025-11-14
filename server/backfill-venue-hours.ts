/**
 * Backfill script to populate opening hours and business status for existing venues
 *
 * Usage: npx tsx server/backfill-venue-hours.ts
 *
 * This script:
 * 1. Collects all unique googlePlaceId values from activities and curatedVenues
 * 2. Fetches hours data from Google Places API for each venue
 * 3. Updates both tables with the new data
 * 4. Tracks progress and costs
 */

import { db } from "./db";
import { activities, curatedVenues } from "@shared/schema";
import { eq } from "drizzle-orm";

// Rate limiting: 50 requests per second max for Google Places API
const REQUESTS_PER_SECOND = 10; // Conservative limit
const DELAY_MS = 1000 / REQUESTS_PER_SECOND;

interface BackfillStats {
  totalVenues: number;
  activitiesCount: number;
  curatedVenuesCount: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedVenues: number;
  estimatedCost: number;
}

/**
 * Fetch venue details including hours from Google Places API
 */
async function fetchVenueDetails(placeId: string, apiKey: string): Promise<{
  openingHours: any;
  businessStatus: string | null;
} | null> {
  try {
    const endpoint = 'https://places.googleapis.com/v1/places/' + placeId;
    const fieldMask = [
      'id',
      'currentOpeningHours',
      'businessStatus',
    ].join(',');

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  ❌ API Error for ${placeId}: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();

    return {
      openingHours: data.currentOpeningHours || null,
      businessStatus: data.businessStatus || null,
    };
  } catch (error) {
    console.error(`  ❌ Fetch error for ${placeId}:`, error);
    return null;
  }
}

/**
 * Add delay for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main backfill function
 */
async function backfillVenueHours() {
  console.log('🚀 Starting venue hours backfill...\n');

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_API_KEY_2;
  if (!apiKey) {
    console.error('❌ Error: GOOGLE_PLACES_API_KEY or GOOGLE_PLACES_API_KEY_2 must be set');
    process.exit(1);
  }

  const stats: BackfillStats = {
    totalVenues: 0,
    activitiesCount: 0,
    curatedVenuesCount: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    skippedVenues: 0,
    estimatedCost: 0,
  };

  // Step 1: Collect all unique Place IDs from activities
  console.log('📋 Step 1: Collecting Place IDs from activities table...');
  const activitiesWithPlaceIds = await db
    .select({
      id: activities.id,
      googlePlaceId: activities.googlePlaceId,
      venueName: activities.venueName,
    })
    .from(activities)
    .where(eq(activities.googlePlaceId, activities.googlePlaceId)); // Filter out null

  const activityPlaceIds = new Map<string, Array<{ id: string; name: string }>>();
  for (const activity of activitiesWithPlaceIds) {
    if (!activity.googlePlaceId) continue;

    if (!activityPlaceIds.has(activity.googlePlaceId)) {
      activityPlaceIds.set(activity.googlePlaceId, []);
    }
    activityPlaceIds.get(activity.googlePlaceId)!.push({
      id: activity.id,
      name: activity.venueName,
    });
  }

  stats.activitiesCount = activityPlaceIds.size;
  console.log(`  ✓ Found ${activityPlaceIds.size} unique Place IDs in activities`);

  // Step 2: Collect all unique Place IDs from curatedVenues
  console.log('\n📋 Step 2: Collecting Place IDs from curatedVenues table...');
  const curatedWithPlaceIds = await db
    .select({
      id: curatedVenues.id,
      googlePlaceId: curatedVenues.googlePlaceId,
      name: curatedVenues.name,
    })
    .from(curatedVenues);

  const curatedPlaceIds = new Map<string, Array<{ id: string; name: string }>>();
  for (const venue of curatedWithPlaceIds) {
    if (!venue.googlePlaceId) continue;

    if (!curatedPlaceIds.has(venue.googlePlaceId)) {
      curatedPlaceIds.set(venue.googlePlaceId, []);
    }
    curatedPlaceIds.get(venue.googlePlaceId)!.push({
      id: venue.id,
      name: venue.name,
    });
  }

  stats.curatedVenuesCount = curatedPlaceIds.size;
  console.log(`  ✓ Found ${curatedPlaceIds.size} unique Place IDs in curatedVenues`);

  // Step 3: Deduplicate and combine
  const allPlaceIds = new Set([...activityPlaceIds.keys(), ...curatedPlaceIds.keys()]);
  stats.totalVenues = allPlaceIds.size;

  console.log(`\n📊 Total unique venues to backfill: ${stats.totalVenues}`);
  console.log(`💰 Estimated cost: $${(stats.totalVenues * 0.003).toFixed(2)} (@ $0.003 per venue)\n`);

  // Confirm before proceeding
  console.log('⏸️  Press Ctrl+C to cancel, or waiting 5 seconds to proceed...');
  await delay(5000);

  // Step 4: Fetch and update hours for each venue
  console.log('\n🔄 Step 4: Fetching and updating venue hours...\n');

  let processed = 0;
  for (const placeId of allPlaceIds) {
    processed++;
    const activityRecords = activityPlaceIds.get(placeId) || [];
    const curatedRecords = curatedPlaceIds.get(placeId) || [];
    const venueName = activityRecords[0]?.name || curatedRecords[0]?.name || placeId;

    console.log(`[${processed}/${stats.totalVenues}] Processing: ${venueName} (${placeId})`);

    // Fetch hours from Google Places API
    const venueData = await fetchVenueDetails(placeId, apiKey);
    stats.estimatedCost += 0.003;

    if (!venueData) {
      console.log(`  ⚠️  Skipping - API fetch failed`);
      stats.failedUpdates++;
      await delay(DELAY_MS);
      continue;
    }

    if (!venueData.openingHours && !venueData.businessStatus) {
      console.log(`  ⚠️  Skipping - No hours or status data available`);
      stats.skippedVenues++;
      await delay(DELAY_MS);
      continue;
    }

    // Update activities table
    for (const record of activityRecords) {
      try {
        await db
          .update(activities)
          .set({
            openingHours: venueData.openingHours,
            businessStatus: venueData.businessStatus,
          })
          .where(eq(activities.id, record.id));
      } catch (error) {
        console.error(`  ❌ Failed to update activity ${record.id}:`, error);
        stats.failedUpdates++;
      }
    }

    // Update curatedVenues table
    for (const record of curatedRecords) {
      try {
        await db
          .update(curatedVenues)
          .set({
            openingHours: venueData.openingHours,
            businessStatus: venueData.businessStatus,
            lastRefreshed: new Date(),
          })
          .where(eq(curatedVenues.id, record.id));
      } catch (error) {
        console.error(`  ❌ Failed to update curated venue ${record.id}:`, error);
        stats.failedUpdates++;
      }
    }

    const status = venueData.businessStatus || 'OPERATIONAL';
    const hasHours = venueData.openingHours ? '✓ hours' : '✗ no hours';
    console.log(`  ✅ Updated (${status}, ${hasHours}) - ${activityRecords.length} activities, ${curatedRecords.length} curated`);
    stats.successfulUpdates++;

    // Rate limiting
    await delay(DELAY_MS);
  }

  // Step 5: Report final stats
  console.log('\n' + '='.repeat(60));
  console.log('✅ Backfill Complete!\n');
  console.log('📊 Final Statistics:');
  console.log(`  Total unique venues processed: ${stats.totalVenues}`);
  console.log(`  Activities Place IDs: ${stats.activitiesCount}`);
  console.log(`  CuratedVenues Place IDs: ${stats.curatedVenuesCount}`);
  console.log(`  Successful updates: ${stats.successfulUpdates}`);
  console.log(`  Failed updates: ${stats.failedUpdates}`);
  console.log(`  Skipped (no data): ${stats.skippedVenues}`);
  console.log(`\n💰 Actual cost: $${stats.estimatedCost.toFixed(2)}`);
  console.log('='.repeat(60));

  process.exit(0);
}

// Run the backfill
backfillVenueHours().catch((error) => {
  console.error('\n❌ Backfill failed with error:', error);
  process.exit(1);
});
