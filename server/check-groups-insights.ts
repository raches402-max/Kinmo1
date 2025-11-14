/**
 * Check which groups have learning insights data
 */

import { db } from './db';
import { groups, members, rsvps as rsvpsTable, itineraries } from '@shared/schema';
import { isNotNull, sql, eq } from 'drizzle-orm';

async function checkGroupsWithInsights() {
  try {
    console.log('🔍 Checking groups for learning insights data...\n');

    // Get all active groups
    const allGroups = await db
      .select()
      .from(groups)
      .where(sql`deleted_at IS NULL`)
      .orderBy(sql`created_at DESC`);

    console.log(`Found ${allGroups.length} active groups\n`);

    for (const group of allGroups) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 ${group.emoji || '🎉'} ${group.name} (ID: ${group.id})`);
      console.log(`${'='.repeat(60)}`);

      // Check rejected venues
      const rejectedVenues = group.rejectedVenues || [];
      console.log(`\n  🚫 Auto-Blacklisted Venues: ${rejectedVenues.length}`);
      if (rejectedVenues.length > 0) {
        rejectedVenues.forEach(v => console.log(`     - ${v}`));
      }

      // Check member constraints
      const groupMembers = await db
        .select()
        .from(members)
        .where(eq(members.groupId, group.id));

      const membersWithConstraints = groupMembers.filter(m => {
        const constraints = m.memberConstraints as any;
        return constraints && (
          constraints.budgetConcern ||
          constraints.distanceConcern ||
          (constraints.scheduleConflicts && constraints.scheduleConflicts.length > 0)
        );
      });

      console.log(`\n  👥 Member Constraints: ${membersWithConstraints.length}/${groupMembers.length} members`);
      if (membersWithConstraints.length > 0) {
        membersWithConstraints.forEach(m => {
          const constraints = m.memberConstraints as any;
          const types = [];
          if (constraints.budgetConcern) types.push('budget');
          if (constraints.distanceConcern) types.push('distance');
          if (constraints.scheduleConflicts?.length) types.push('schedule');
          console.log(`     - ${m.name}: ${types.join(', ')}`);
        });
      }

      // Check RSVP history for engagement
      const groupItineraries = await db
        .select({ id: itineraries.id })
        .from(itineraries)
        .where(eq(itineraries.groupId, group.id));

      const itineraryIds = groupItineraries.map(i => i.id);

      let rsvpCount = 0;
      if (itineraryIds.length > 0) {
        const rsvps = await db
          .select()
          .from(rsvpsTable)
          .where(sql`itinerary_id IN (${sql.join(itineraryIds.map(id => sql`${id}`), sql`, `)})`);
        rsvpCount = rsvps.length;
      }

      console.log(`\n  📈 Engagement Data: ${rsvpCount} RSVPs from ${groupItineraries.length} itineraries`);

      // Check frequency feedback
      console.log(`\n  📅 Meeting Frequency: ${group.meetingFrequency || 'monthly'}`);

      // Summary
      const hasInsights =
        rejectedVenues.length > 0 ||
        membersWithConstraints.length > 0 ||
        rsvpCount > 0;

      if (hasInsights) {
        console.log(`\n  ✅ HAS INSIGHTS TO DISPLAY`);
      } else {
        console.log(`\n  ⚪ No insights data yet (new group or no activity)`);
      }
    }

    console.log(`\n${'='.repeat(60)}\n`);
    console.log('✨ Check complete!');

  } catch (error) {
    console.error('Error checking groups:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkGroupsWithInsights();
