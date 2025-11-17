/**
 * Backfill Script: Create Itineraries for Existing Auto-Scheduled Events
 *
 * This script creates itineraries for auto-scheduled events that were created
 * before the system was updated to create itineraries upfront.
 */

import { db } from './db';
import { storage } from './storage';
import { eq, isNull, and } from 'drizzle-orm';
import { autoScheduledEvents, itineraryOptions, itineraries, itineraryInvites } from '../shared/schema';
import crypto from 'crypto';

async function backfillItineraries() {
  console.log('🔄 Starting backfill of auto-event itineraries...\n');

  try {
    // Find all auto-scheduled events without itineraries
    const eventsWithoutItineraries = await db
      .select()
      .from(autoScheduledEvents)
      .where(isNull(autoScheduledEvents.itineraryId));

    console.log(`Found ${eventsWithoutItineraries.length} auto-scheduled events without itineraries\n`);

    if (eventsWithoutItineraries.length === 0) {
      console.log('✅ No events need backfilling. All done!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each event
    for (const event of eventsWithoutItineraries) {
      try {
        console.log(`\n📝 Processing event ${event.id}...`);

        // Get the group
        const group = await storage.getGroup(event.groupId);
        if (!group) {
          console.error(`  ❌ Group not found for event ${event.id}`);
          errorCount++;
          continue;
        }

        // Get the top option for this event
        const options = await db
          .select()
          .from(itineraryOptions)
          .where(eq(itineraryOptions.autoEventId, event.id))
          .orderBy(itineraryOptions.optionNumber);

        if (options.length === 0) {
          console.error(`  ❌ No options found for event ${event.id}`);
          errorCount++;
          continue;
        }

        const topOption = options[0];
        console.log(`  ℹ️  Using option ${topOption.optionNumber} with ${(topOption.venues as any[]).length} venues`);

        // Extract venues from the option
        const venues = topOption.venues as Array<{
          sourceType: 'activity' | 'voting_event';
          sourceId: string;
          venueName: string;
        }>;

        const venueItems = venues.map(v => ({
          sourceType: v.sourceType,
          sourceId: v.sourceId,
        }));

        // Create the itinerary
        const newItinerary = await storage.createItinerary(
          {
            groupId: event.groupId,
            name: `Auto-scheduled event for ${group.name}`,
            eventDate: event.proposedDate,
            status: 'proposed',
            proposedOrder: [],
          },
          group.userId!,
          venueItems
        );

        console.log(`  ✅ Created itinerary ${newItinerary.id}`);

        // Create invites for all group members
        const members = await storage.getGroupMembers(event.groupId);
        console.log(`  👥 Creating invites for ${members.length} members...`);

        for (const member of members) {
          const inviteToken = crypto.randomUUID();
          await db.insert(itineraryInvites).values({
            itineraryId: newItinerary.id,
            memberId: member.id,
            inviteToken,
          });
        }

        // Update the auto-scheduled event with the itinerary ID
        await db
          .update(autoScheduledEvents)
          .set({ itineraryId: newItinerary.id })
          .where(eq(autoScheduledEvents.id, event.id));

        console.log(`  ✅ Updated event with itineraryId and created ${members.length} invites`);
        console.log(`  📍 Venues: ${venues.map(v => v.venueName).join(' → ')}`);

        successCount++;
      } catch (error: any) {
        console.error(`  ❌ Error processing event ${event.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKFILL COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Successfully backfilled: ${successCount} events`);
    console.log(`❌ Failed: ${errorCount} events`);
    console.log(`📝 Total processed: ${eventsWithoutItineraries.length} events\n`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Fatal error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillItineraries();
