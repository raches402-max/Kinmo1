/**
 * Migration Script: Update Event Timing
 * Updates existing auto-scheduled events and itineraries to use new timeline:
 * - Auto-send: 21 days before event (was 3 days)
 * - RSVP deadline: 7 days before event (was 3 days)
 */

import { db } from './db';
import { addDays } from 'date-fns';
import { sql } from 'drizzle-orm';

async function migrateEventTiming() {
  console.log('🔄 Starting event timing migration...\n');

  try {
    // 1. Update auto_scheduled_events
    console.log('📅 Updating auto-scheduled events...');

    const autoEvents = await db.execute<{
      id: string;
      proposed_date: Date;
      auto_send_at: Date;
      status: string;
    }>(
      sql`SELECT id, proposed_date, auto_send_at, status
          FROM auto_scheduled_events
          WHERE status IN ('pending_approval', 'approved')
          AND proposed_date > NOW()
          ORDER BY proposed_date`
    );

    console.log(`Found ${autoEvents.rows.length} future auto-scheduled events\n`);

    for (const event of autoEvents.rows) {
      const proposedDate = new Date(event.proposed_date);
      const newAutoSendAt = addDays(proposedDate, -21);
      const now = new Date();

      // If the event is within 21 days, set autoSendAt to now
      const finalAutoSendAt = newAutoSendAt < now ? now : newAutoSendAt;

      await db.execute(
        sql`UPDATE auto_scheduled_events
            SET auto_send_at = ${finalAutoSendAt}
            WHERE id = ${event.id}`
      );

      console.log(`✓ Event ${event.id.substring(0, 8)}...`);
      console.log(`  Proposed: ${proposedDate.toLocaleDateString()}`);
      console.log(`  Old autoSendAt: ${new Date(event.auto_send_at).toLocaleDateString()}`);
      console.log(`  New autoSendAt: ${finalAutoSendAt.toLocaleDateString()}\n`);
    }

    // 2. Update itineraries
    console.log('\n📋 Updating proposed itineraries...');

    const itineraries = await db.execute<{
      id: string;
      event_date: Date;
      rsvp_deadline: Date | null;
      status: string;
      name: string | null;
    }>(
      sql`SELECT id, event_date, rsvp_deadline, status, name
          FROM itineraries
          WHERE status = 'proposed'
          AND event_date > NOW()
          ORDER BY event_date`
    );

    console.log(`Found ${itineraries.rows.length} future proposed itineraries\n`);

    for (const itinerary of itineraries.rows) {
      const eventDate = new Date(itinerary.event_date);
      const newRsvpDeadline = addDays(eventDate, -7);

      await db.execute(
        sql`UPDATE itineraries
            SET rsvp_deadline = ${newRsvpDeadline}
            WHERE id = ${itinerary.id}`
      );

      console.log(`✓ Itinerary: ${itinerary.name || itinerary.id.substring(0, 8)}`);
      console.log(`  Event: ${eventDate.toLocaleDateString()}`);
      console.log(`  Old RSVP deadline: ${itinerary.rsvp_deadline ? new Date(itinerary.rsvp_deadline).toLocaleDateString() : 'none'}`);
      console.log(`  New RSVP deadline: ${newRsvpDeadline.toLocaleDateString()}\n`);
    }

    console.log('✅ Migration complete!');
    console.log(`Updated ${autoEvents.rows.length} auto-scheduled events`);
    console.log(`Updated ${itineraries.rows.length} proposed itineraries`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
migrateEventTiming()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
