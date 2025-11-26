import { db } from "./db";
import { itineraryInvites, rsvps, itineraries, groups } from "@shared/schema";
import { eq, isNull, isNotNull, sql } from "drizzle-orm";

async function cleanupOrphanedEvents() {
  console.log("Starting cleanup of orphaned event data...\n");

  // 1. Find itinerary invites where the group has been deleted
  console.log("1. Finding itinerary invites from deleted groups...");
  const invitesWithDeletedGroups = await db
    .select({
      inviteId: itineraryInvites.id,
      itineraryId: itineraryInvites.itineraryId,
      groupId: itineraries.groupId,
      groupName: groups.name,
    })
    .from(itineraryInvites)
    .leftJoin(itineraries, eq(itineraryInvites.itineraryId, itineraries.id))
    .leftJoin(groups, eq(itineraries.groupId, groups.id))
    .where(isNotNull(groups.deletedAt));

  console.log(`   Found ${invitesWithDeletedGroups.length} invites from deleted groups`);

  if (invitesWithDeletedGroups.length > 0) {
    console.log("   Sample deleted groups:");
    invitesWithDeletedGroups.slice(0, 5).forEach(inv => {
      console.log(`   - ${inv.groupName} (${inv.inviteId})`);
    });
  }

  // 2. Find itinerary invites where the itinerary no longer exists
  console.log("\n2. Finding itinerary invites for non-existent itineraries...");
  const invitesWithNoItinerary = await db
    .select({
      inviteId: itineraryInvites.id,
      itineraryId: itineraryInvites.itineraryId,
    })
    .from(itineraryInvites)
    .leftJoin(itineraries, eq(itineraryInvites.itineraryId, itineraries.id))
    .where(isNull(itineraries.id));

  console.log(`   Found ${invitesWithNoItinerary.length} invites for non-existent itineraries`);

  // 3. Find RSVPs where the itinerary no longer exists
  console.log("\n3. Finding RSVPs for non-existent itineraries...");
  const rsvpsWithNoItinerary = await db
    .select({
      rsvpId: rsvps.id,
      itineraryId: rsvps.itineraryId,
    })
    .from(rsvps)
    .leftJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
    .where(isNull(itineraries.id));

  console.log(`   Found ${rsvpsWithNoItinerary.length} RSVPs for non-existent itineraries`);

  // 4. Find RSVPs for itineraries in deleted groups
  console.log("\n4. Finding RSVPs for events from deleted groups...");
  const rsvpsFromDeletedGroups = await db
    .select({
      rsvpId: rsvps.id,
      itineraryId: rsvps.itineraryId,
      groupName: groups.name,
    })
    .from(rsvps)
    .leftJoin(itineraries, eq(rsvps.itineraryId, itineraries.id))
    .leftJoin(groups, eq(itineraries.groupId, groups.id))
    .where(isNotNull(groups.deletedAt));

  console.log(`   Found ${rsvpsFromDeletedGroups.length} RSVPs from deleted groups`);

  // Summary
  const totalToClean =
    invitesWithDeletedGroups.length +
    invitesWithNoItinerary.length +
    rsvpsWithNoItinerary.length +
    rsvpsFromDeletedGroups.length;

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY:");
  console.log(`  Total orphaned records found: ${totalToClean}`);
  console.log(`  - Invites from deleted groups: ${invitesWithDeletedGroups.length}`);
  console.log(`  - Invites for non-existent itineraries: ${invitesWithNoItinerary.length}`);
  console.log(`  - RSVPs for non-existent itineraries: ${rsvpsWithNoItinerary.length}`);
  console.log(`  - RSVPs from deleted groups: ${rsvpsFromDeletedGroups.length}`);
  console.log("=".repeat(60));

  if (totalToClean === 0) {
    console.log("\n✓ No orphaned data found. Database is clean!");
    return;
  }

  console.log("\nProceeding with cleanup...\n");

  // Delete orphaned data
  let deletedCount = 0;

  // Delete invites from deleted groups
  if (invitesWithDeletedGroups.length > 0) {
    const inviteIds = invitesWithDeletedGroups.map(inv => inv.inviteId);
    const result = await db
      .delete(itineraryInvites)
      .where(sql`id IN (${sql.join(inviteIds, sql`, `)})`);
    console.log(`✓ Deleted ${invitesWithDeletedGroups.length} invites from deleted groups`);
    deletedCount += invitesWithDeletedGroups.length;
  }

  // Delete invites for non-existent itineraries
  if (invitesWithNoItinerary.length > 0) {
    const inviteIds = invitesWithNoItinerary.map(inv => inv.inviteId);
    const result = await db
      .delete(itineraryInvites)
      .where(sql`id IN (${sql.join(inviteIds, sql`, `)})`);
    console.log(`✓ Deleted ${invitesWithNoItinerary.length} invites for non-existent itineraries`);
    deletedCount += invitesWithNoItinerary.length;
  }

  // Delete RSVPs for non-existent itineraries
  if (rsvpsWithNoItinerary.length > 0) {
    const rsvpIds = rsvpsWithNoItinerary.map(rsvp => rsvp.rsvpId);
    const result = await db
      .delete(rsvps)
      .where(sql`id IN (${sql.join(rsvpIds, sql`, `)})`);
    console.log(`✓ Deleted ${rsvpsWithNoItinerary.length} RSVPs for non-existent itineraries`);
    deletedCount += rsvpsWithNoItinerary.length;
  }

  // Delete RSVPs from deleted groups
  if (rsvpsFromDeletedGroups.length > 0) {
    const rsvpIds = rsvpsFromDeletedGroups.map(rsvp => rsvp.rsvpId);
    const result = await db
      .delete(rsvps)
      .where(sql`id IN (${sql.join(rsvpIds, sql`, `)})`);
    console.log(`✓ Deleted ${rsvpsFromDeletedGroups.length} RSVPs from deleted groups`);
    deletedCount += rsvpsFromDeletedGroups.length;
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✓ CLEANUP COMPLETE: Deleted ${deletedCount} orphaned records`);
  console.log("=".repeat(60));
}

cleanupOrphanedEvents()
  .then(() => {
    console.log("\nCleanup script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error during cleanup:", error);
    process.exit(1);
  });
