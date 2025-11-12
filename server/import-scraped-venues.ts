import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db';
import { curatedVenues } from '../shared/schema';
import { getPlaceDetails } from './google-places';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ScrapedVenue {
  title: string;
  totalScore: number;
  reviewsCount: number;
  street: string;
  city: string;
  state: string;
  countryCode: string;
  website: string | null;
  phone: string | null;
  categoryName: string;
  url: string;
}

// Extract place ID from Google Maps URL
function extractPlaceId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('query_place_id');
  } catch {
    return null;
  }
}

// Check if venue is food/drinks related (returns true if relevant)
function isFoodOrDrinks(categoryName: string): boolean {
  const lower = categoryName.toLowerCase();

  // Food & drinks keywords
  const relevantKeywords = [
    'restaurant', 'cafe', 'coffee', 'bar', 'pub', 'lounge', 'brewery', 'winery',
    'food', 'cuisine', 'dining', 'eatery', 'grill', 'kitchen', 'bistro', 'diner',
    'pizza', 'burger', 'taco', 'sushi', 'ramen', 'noodle', 'dumpling', 'bbq',
    'steakhouse', 'bakery', 'dessert', 'ice cream', 'donut', 'pastry',
    'sandwich', 'deli', 'brunch', 'breakfast', 'lunch', 'dinner',
    'wine', 'cocktail', 'beer', 'tea', 'juice', 'smoothie', 'bubble tea'
  ];

  return relevantKeywords.some(keyword => lower.includes(keyword));
}

// Map scraped category to our category system
function mapCategory(categoryName: string): string {
  const lower = categoryName.toLowerCase();

  if (lower.includes('bar') || lower.includes('cocktail') || lower.includes('brewery') ||
      lower.includes('wine') || lower.includes('pub') || lower.includes('lounge')) {
    return 'drinks';
  }

  if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('tea')) {
    return 'cafes';
  }

  if (lower.includes('dessert') || lower.includes('ice cream') || lower.includes('bakery') ||
      lower.includes('donut') || lower.includes('pastry')) {
    return 'dessert';
  }

  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('cuisine') ||
      lower.includes('dining') || lower.includes('eatery') || lower.includes('grill') ||
      lower.includes('kitchen') || lower.includes('bistro') || lower.includes('diner') ||
      lower.includes('pizza') || lower.includes('burger') || lower.includes('taco') ||
      lower.includes('sushi') || lower.includes('ramen') || lower.includes('noodle') ||
      lower.includes('dumpling') || lower.includes('bbq') || lower.includes('steakhouse')) {
    return 'meal';
  }

  // Default to experiences for everything else
  return 'experiences';
}

// Determine region from city/state
function determineRegion(city: string, state: string): string {
  const cityLower = city.toLowerCase();
  const stateLower = state.toLowerCase();

  if ((stateLower === 'california' || stateLower === 'ca') &&
      (cityLower.includes('san francisco') || cityLower.includes('oakland') ||
       cityLower.includes('san jose') || cityLower.includes('berkeley') ||
       cityLower.includes('palo alto') || cityLower.includes('mountain view'))) {
    return 'bay_area';
  }

  // Default to bay_area for now since that's what we scraped
  return 'bay_area';
}

async function importScrapedVenues() {
  const assetsDir = path.join(__dirname, '../attached_assets');
  const files = fs.readdirSync(assetsDir).filter(f =>
    f.startsWith('dataset_crawler-google-places') && f.endsWith('.json')
  );

  console.log(`Found ${files.length} JSON files to import`);

  let totalVenues = 0;
  let importedVenues = 0;
  let skippedVenues = 0;
  let skippedNonFood = 0;
  let errorVenues = 0;

  for (const file of files) {
    console.log(`\nProcessing ${file}...`);
    const filePath = path.join(assetsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const venues: ScrapedVenue[] = JSON.parse(content);

    console.log(`  Found ${venues.length} venues in file`);
    totalVenues += venues.length;

    for (const venue of venues) {
      try {
        // Filter: Skip non-food/drinks venues
        if (!isFoodOrDrinks(venue.categoryName)) {
          console.log(`  🚫 Skipping "${venue.title}" - not food/drinks (${venue.categoryName})`);
          skippedNonFood++;
          continue;
        }

        // Extract place ID
        const placeId = extractPlaceId(venue.url);
        if (!placeId) {
          console.log(`  ⚠️  Skipping "${venue.title}" - no place ID in URL`);
          skippedVenues++;
          continue;
        }

        // Check if already exists
        const existing = await db
          .select()
          .from(curatedVenues)
          .where(eq(curatedVenues.googlePlaceId, placeId))
          .limit(1);

        if (existing.length > 0) {
          console.log(`  ⏭️  Skipping "${venue.title}" - already in database`);
          skippedVenues++;
          continue;
        }

        // Fetch full details from Google Places API to get coordinates and photo
        console.log(`  📍 Fetching details for "${venue.title}" (${placeId})...`);
        const placeDetails = await getPlaceDetails(placeId);

        if (!placeDetails || !placeDetails.location) {
          console.log(`  ❌ Failed to fetch details for "${venue.title}"`);
          errorVenues++;
          continue;
        }

        // Map data to our schema
        const category = mapCategory(venue.categoryName);
        const region = determineRegion(venue.city, venue.state);
        const address = `${venue.street}, ${venue.city}, ${venue.state}`;

        // Insert into database
        await db.insert(curatedVenues).values({
          name: venue.title,
          address: placeDetails.address || address,
          latitude: placeDetails.location.lat.toString(),
          longitude: placeDetails.location.lng.toString(),
          category,
          rating: venue.totalScore.toString(),
          reviewCount: venue.reviewsCount,
          priceLevel: placeDetails.priceLevel ? parsePriceLevel(placeDetails.priceLevel) : null,
          photoUrl: placeDetails.photoUrl || null,
          googlePlaceId: placeId,
          description: null,
          tags: [venue.categoryName.toLowerCase()],
          region,
          isActive: true,
          source: 'api_scrape',
          suggestedBy: null,
        });

        console.log(`  ✅ Imported "${venue.title}" (${category})`);
        importedVenues++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`  ❌ Error importing "${venue.title}":`, error.message);
        errorVenues++;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Import Summary:`);
  console.log(`  Total venues found: ${totalVenues}`);
  console.log(`  Successfully imported: ${importedVenues}`);
  console.log(`  Skipped (non-food/drinks): ${skippedNonFood}`);
  console.log(`  Skipped (duplicates): ${skippedVenues}`);
  console.log(`  Errors: ${errorVenues}`);
  console.log(`${'='.repeat(60)}\n`);
}

// Convert price level string to number
function parsePriceLevel(priceLevel: string): number | null {
  if (priceLevel === '$') return 1;
  if (priceLevel === '$$') return 2;
  if (priceLevel === '$$$') return 3;
  if (priceLevel === '$$$$') return 4;
  return null;
}

// Run the import
importScrapedVenues()
  .then(() => {
    console.log('✅ Import complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
