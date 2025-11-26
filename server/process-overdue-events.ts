/**
 * Process Overdue Auto-Scheduled Events
 * Finds events where auto_send_at has passed and triggers auto-approval
 */

import { db } from './db';
import { autoScheduledEvents } from '../shared/schema';
import { sql, lt, eq } from 'drizzle-orm';
import { approveAndCreateItinerary } from './auto-approval';

async function processOverdueEvents() {
  console.log('🔄 Processing overdue auto-scheduled events...\n');

  try {
    // Find overdue events
    const overdueEvents = await db
      .select()
      .from(autoScheduledEvents)
      .where(
        sql`${autoScheduledEvents.status} = 'pending_approval' AND ${autoScheduledEvents.autoSendAt} < NOW()`
      );

    console.log(`Found ${overdueEvents.length} overdue events\n`);

    if (overdueEvents.length === 0) {
      console.log('✅ No overdue events to process');
      return;
    }

    // Process each overdue event
    for (const event of overdueEvents) {
      console.log(`\n📅 Processing event ${event.id.substring(0, 8)}...`);
      console.log(`   Proposed date: ${event.proposedDate}`);
      console.log(`   Auto-send deadline: ${event.autoSendAt}`);
      console.log(`   Status: ${event.status}`);

      try {
        // Auto-approve the event (will select best option automatically)
        const result = await approveAndCreateItinerary(
          event.id,
          null, // Let it choose best option
          'auto' // Mark as auto-approved
        );

        if (result.success) {
          console.log(`   ✅ Successfully approved and created itinerary: ${result.itinerary?.name}`);
        } else {
          console.error(`   ❌ Failed to approve: ${result.error}`);
        }
      } catch (error) {
        console.error(`   ❌ Error processing event:`, error);
      }
    }

    console.log('\n✅ Finished processing overdue events');
  } catch (error) {
    console.error('❌ Failed to process overdue events:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the processor
processOverdueEvents();
