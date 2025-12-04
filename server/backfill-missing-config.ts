/**
 * Backfill Script: Add autoScheduleConfig to existing itineraries that are missing it
 *
 * This is a one-time fix for itineraries created before the bug was fixed.
 */

import { db } from './db';
import { storage } from './storage';
import { eq, and, isNull, gt, or } from 'drizzle-orm';
import { itineraries, groups as groupsTable } from '../shared/schema';
import { calculateAdaptiveTimeline, calculateRsvpDeadline } from './adaptive-timeline';
import { sendInitialInvites } from './reminder-scheduler';

async function backfillMissingConfig() {
  console.log('🔄 Backfilling missing autoScheduleConfig for existing itineraries...\n');

  try {
    // Find all proposed/scheduled itineraries without autoScheduleConfig and with future event dates
    const itinerariesNeedingConfig = await db
      .select({
        itinerary: itineraries,
        group: groupsTable,
      })
      .from(itineraries)
      .innerJoin(groupsTable, eq(itineraries.groupId, groupsTable.id))
      .where(
        and(
          or(
            eq(itineraries.status, 'proposed'),
            eq(itineraries.status, 'scheduled')
          ),
          isNull(itineraries.autoScheduleConfig),
          isNull(itineraries.inviteSentAt),
          gt(itineraries.eventDate, new Date())
        )
      );

    console.log(`Found ${itinerariesNeedingConfig.length} itineraries needing backfill\n`);

    if (itinerariesNeedingConfig.length === 0) {
      console.log('✅ No itineraries need backfilling. All done!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const { itinerary, group } of itinerariesNeedingConfig) {
      try {
        console.log(`\n📝 Processing itinerary ${itinerary.id} for ${group.name}...`);
        console.log(`   Event date: ${itinerary.eventDate}`);

        if (!itinerary.eventDate) {
          console.log(`   ⚠️ Skipping - no event date`);
          continue;
        }

        // Calculate adaptive timeline
        const eventDate = new Date(itinerary.eventDate);
        const now = new Date();
        const adaptiveConfig = calculateAdaptiveTimeline(eventDate, now);
        const rsvpDeadline = calculateRsvpDeadline(eventDate, adaptiveConfig);

        console.log(`   ⏰ Using ${adaptiveConfig.timelineType} timeline: ${adaptiveConfig.reasoning}`);

        // Update itinerary with config
        await db
          .update(itineraries)
          .set({
            autoScheduleConfig: adaptiveConfig,
            rsvpDeadline,
          })
          .where(eq(itineraries.id, itinerary.id));

        // Fetch fresh itinerary and send invites
        const updatedItinerary = await storage.getItinerary(itinerary.id);
        if (updatedItinerary) {
          console.log(`   📧 Sending invites to group...`);
          await sendInitialInvites(updatedItinerary, group);
          console.log(`   ✅ Done!`);
        }

        successCount++;
      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKFILL COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

  } catch (error: any) {
    console.error('Fatal error during backfill:', error);
  }

  process.exit(0);
}

backfillMissingConfig();
