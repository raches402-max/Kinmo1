import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db';
import { curatedVenues } from '../shared/schema';

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

function categorizeVenue(categoryName: string): 'food' | 'drinks' | 'activities' | 'other' {
  const lower = categoryName.toLowerCase();

  // Food categories
  if (
    lower.includes('restaurant') || lower.includes('food') || lower.includes('cuisine') ||
    lower.includes('dining') || lower.includes('eatery') || lower.includes('grill') ||
    lower.includes('kitchen') || lower.includes('bistro') || lower.includes('diner') ||
    lower.includes('pizza') || lower.includes('burger') || lower.includes('taco') ||
    lower.includes('sushi') || lower.includes('ramen') || lower.includes('noodle') ||
    lower.includes('dumpling') || lower.includes('bbq') || lower.includes('steakhouse') ||
    lower.includes('deli') || lower.includes('sandwich') || lower.includes('cafe') ||
    lower.includes('bakery') || lower.includes('pastry') || lower.includes('caterer') ||
    lower.includes('taqueria') || lower.includes('seafood')
  ) {
    return 'food';
  }

  // Drinks categories
  if (
    lower.includes('bar') || lower.includes('cocktail') || lower.includes('brewery') ||
    lower.includes('wine') || lower.includes('pub') || lower.includes('lounge') ||
    lower.includes('coffee') || lower.includes('tea')
  ) {
    return 'drinks';
  }

  // Activities/experiences
  if (
    lower.includes('museum') || lower.includes('gallery') || lower.includes('theater') ||
    lower.includes('cinema') || lower.includes('park') || lower.includes('gym') ||
    lower.includes('spa') || lower.includes('store') || lower.includes('shop')
  ) {
    return 'activities';
  }

  // Everything else
  return 'other';
}

async function analyzeMissingVenues() {
  const assetsDir = path.join(__dirname, '../attached_assets');
  const files = fs.readdirSync(assetsDir).filter(f =>
    f.startsWith('dataset_crawler-google-places') && f.endsWith('.json')
  );

  const allScrapedVenues = new Map<string, ScrapedVenue>();

  // Load all scraped venues
  for (const file of files) {
    const filePath = path.join(assetsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const venues: ScrapedVenue[] = JSON.parse(content);

    for (const venue of venues) {
      const placeId = extractPlaceId(venue.url);
      if (placeId && !allScrapedVenues.has(placeId)) {
        allScrapedVenues.set(placeId, venue);
      }
    }
  }

  // Get all venue place IDs from database
  const dbVenues = await db
    .select({ googlePlaceId: curatedVenues.googlePlaceId })
    .from(curatedVenues);

  const dbPlaceIds = new Set(dbVenues.map(v => v.googlePlaceId).filter(Boolean));

  // Find missing venues and categorize them
  const missingVenues: Array<{ placeId: string; venue: ScrapedVenue }> = [];
  const categoryBreakdown: Record<string, number> = {
    food: 0,
    drinks: 0,
    activities: 0,
    other: 0,
  };
  const categoryExamples: Record<string, string[]> = {
    food: [],
    drinks: [],
    activities: [],
    other: [],
  };

  for (const [placeId, venue] of allScrapedVenues.entries()) {
    if (!dbPlaceIds.has(placeId)) {
      missingVenues.push({ placeId, venue });

      const category = categorizeVenue(venue.categoryName);
      categoryBreakdown[category]++;

      if (categoryExamples[category].length < 10) {
        categoryExamples[category].push(`${venue.title} (${venue.categoryName})`);
      }
    }
  }

  console.log('\n📊 Analysis of 610 Missing Venues\n');
  console.log('='.repeat(80));

  // Show breakdown
  console.log('\n🏷️  Category Breakdown:\n');

  const total = missingVenues.length;

  console.log(`🍽️  FOOD: ${categoryBreakdown.food} venues (${(categoryBreakdown.food/total*100).toFixed(1)}%)`);
  console.log('   Examples:', categoryExamples.food.slice(0, 5).join(', '));

  console.log(`\n🍷 DRINKS: ${categoryBreakdown.drinks} venues (${(categoryBreakdown.drinks/total*100).toFixed(1)}%)`);
  console.log('   Examples:', categoryExamples.drinks.slice(0, 5).join(', '));

  console.log(`\n🎭 ACTIVITIES/SHOPS: ${categoryBreakdown.activities} venues (${(categoryBreakdown.activities/total*100).toFixed(1)}%)`);
  console.log('   Examples:', categoryExamples.activities.slice(0, 5).join(', '));

  console.log(`\n❓ OTHER (probably not relevant): ${categoryBreakdown.other} venues (${(categoryBreakdown.other/total*100).toFixed(1)}%)`);
  console.log('   Examples:', categoryExamples.other.slice(0, 10).join(', '));

  // Show all "other" category items
  console.log('\n\n📋 All "OTHER" category venues (not food/drinks/activities):\n');
  console.log('='.repeat(80));

  const otherVenues = missingVenues.filter(item =>
    categorizeVenue(item.venue.categoryName) === 'other'
  );

  otherVenues.forEach((item, index) => {
    const { venue } = item;
    console.log(`${index + 1}. ${venue.title}`);
    console.log(`   🏷️  ${venue.categoryName}`);
    console.log(`   ⭐ ${venue.totalScore} (${venue.reviewsCount} reviews)`);
  });

  console.log('\n' + '='.repeat(80));
  console.log(`\n📈 Recommendation:`);
  console.log(`   • Import FOOD venues: ${categoryBreakdown.food} (relevant for meals)`);
  console.log(`   • Import DRINKS venues: ${categoryBreakdown.drinks} (relevant for drinks/cafes)`);
  console.log(`   • Import ACTIVITIES: ${categoryBreakdown.activities} (may be relevant for experiences)`);
  console.log(`   • Skip OTHER: ${categoryBreakdown.other} (probably not relevant)`);
  console.log(`\n   Total relevant: ${categoryBreakdown.food + categoryBreakdown.drinks + categoryBreakdown.activities} out of ${total}\n`);

  process.exit(0);
}

analyzeMissingVenues();
