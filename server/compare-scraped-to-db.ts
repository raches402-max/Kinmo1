import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db';
import { curatedVenues } from '../shared/schema';
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

function extractPlaceId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('query_place_id');
  } catch {
    return null;
  }
}

async function compareScrapedToDb() {
  const assetsDir = path.join(__dirname, '../attached_assets');
  const files = fs.readdirSync(assetsDir).filter(f =>
    f.startsWith('dataset_crawler-google-places') && f.endsWith('.json')
  );

  console.log(`\n📂 Found ${files.length} JSON files to check\n`);

  const allScrapedVenues = new Map<string, ScrapedVenue>();
  let totalScraped = 0;

  // Load all scraped venues
  for (const file of files) {
    const filePath = path.join(assetsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const venues: ScrapedVenue[] = JSON.parse(content);

    for (const venue of venues) {
      const placeId = extractPlaceId(venue.url);
      if (placeId && !allScrapedVenues.has(placeId)) {
        allScrapedVenues.set(placeId, venue);
        totalScraped++;
      }
    }
  }

  console.log(`📊 Total unique venues in scraped data: ${allScrapedVenues.size}`);

  // Get all venue place IDs from database
  const dbVenues = await db
    .select({ googlePlaceId: curatedVenues.googlePlaceId })
    .from(curatedVenues);

  const dbPlaceIds = new Set(dbVenues.map(v => v.googlePlaceId).filter(Boolean));
  console.log(`📊 Total venues in curated_venues table: ${dbPlaceIds.size}\n`);

  // Find missing venues
  const missingVenues: Array<{ placeId: string; venue: ScrapedVenue }> = [];

  for (const [placeId, venue] of allScrapedVenues.entries()) {
    if (!dbPlaceIds.has(placeId)) {
      missingVenues.push({ placeId, venue });
    }
  }

  console.log(`🔍 Venues in scraped data NOT in database: ${missingVenues.length}\n`);

  if (missingVenues.length > 0) {
    console.log('📋 Missing venues (first 20):');
    console.log('='.repeat(80));

    missingVenues.slice(0, 20).forEach((item, index) => {
      const { venue, placeId } = item;
      console.log(`\n${index + 1}. ${venue.title}`);
      console.log(`   ⭐ ${venue.totalScore} (${venue.reviewsCount} reviews)`);
      console.log(`   📍 ${venue.street}, ${venue.city}`);
      console.log(`   🏷️  ${venue.categoryName}`);
      console.log(`   🆔 ${placeId.substring(0, 20)}...`);
    });

    if (missingVenues.length > 20) {
      console.log(`\n... and ${missingVenues.length - 20} more venues not shown`);
    }
  } else {
    console.log('✅ All scraped venues are already in the database!');
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📈 Summary:`);
  console.log(`   • Scraped venues: ${allScrapedVenues.size}`);
  console.log(`   • Database venues: ${dbPlaceIds.size}`);
  console.log(`   • Missing from DB: ${missingVenues.length}`);
  console.log(`   • Coverage: ${((dbPlaceIds.size / allScrapedVenues.size) * 100).toFixed(1)}%\n`);

  process.exit(0);
}

compareScrapedToDb();
