import { db } from './db';
import { curatedVenues } from '../shared/schema';
import { like, or } from 'drizzle-orm';

async function checkVenues() {
  // Check for all variants of Supreme Dumpling
  const supreme = await db
    .select()
    .from(curatedVenues)
    .where(
      or(
        like(curatedVenues.name, '%Supreme Dumpling%'),
        like(curatedVenues.name, '%supreme dumpling%')
      )
    );

  console.log('\n🔍 Searching for "Supreme Dumpling" (any variant)...');
  console.log('Found:', supreme.length, 'venue(s)\n');

  supreme.forEach(venue => {
    console.log('✅', venue.name);
    console.log('   📍 Address:', venue.address);
    console.log('   ⭐ Rating:', venue.rating, `(${venue.reviewCount} reviews)`);
    console.log('   🏷️  Category:', venue.category);
    console.log('   🆔 Place ID:', venue.googlePlaceId);
    console.log('');
  });

  // Check for NoodlePanda
  const noodlePanda = await db
    .select()
    .from(curatedVenues)
    .where(
      or(
        like(curatedVenues.name, '%NoodlePanda%'),
        like(curatedVenues.name, '%Noodle Panda%')
      )
    );

  console.log('🔍 Searching for "NoodlePanda" (any variant)...');
  console.log('Found:', noodlePanda.length, 'venue(s)\n');

  noodlePanda.forEach(venue => {
    console.log('✅', venue.name);
    console.log('   📍 Address:', venue.address);
    console.log('   ⭐ Rating:', venue.rating, `(${venue.reviewCount} reviews)`);
    console.log('   🏷️  Category:', venue.category);
    console.log('   🆔 Place ID:', venue.googlePlaceId);
    console.log('');
  });

  process.exit(0);
}

checkVenues();
