import { db } from "./db";
import { itineraryInvites, members, groups, itineraries } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function cleanupDuplicateInvites() {
  console.log("Starting cleanup of duplicate itinerary invites...\n");

  // Find all invites grouped by itineraryId and user
  // A user can have an invite as an organizer (memberId = null) or as a member
  const allInvites = await db
    .select({
      inviteId: itineraryInvites.id,
      itineraryId: itineraryInvites.itineraryId,
      memberId: itineraryInvites.memberId,
      inviteToken: itineraryInvites.inviteToken,
      groupId: itineraries.groupId,
      groupUserId: groups.userId,
    })
    .from(itineraryInvites)
    .leftJoin(itineraries, eq(itineraryInvites.itineraryId, itineraries.id))
    .leftJoin(groups, eq(itineraries.groupId, groups.id));

  console.log(`Found ${allInvites.length} total invites`);

  // Get member userId mapping
  const allMembers = await db.select().from(members);
  const memberUserIdMap = new Map<string, string | null>();
  for (const member of allMembers) {
    memberUserIdMap.set(member.id, member.userId);
  }

  // Group invites by (itineraryId, userId) to find duplicates
  const invitesByItineraryAndUser = new Map<string, typeof allInvites>();

  for (const invite of allInvites) {
    if (!invite.itineraryId) continue;

    // Determine the userId for this invite
    let userId: string | null = null;

    if (invite.memberId) {
      // Member invite - get userId from member
      userId = memberUserIdMap.get(invite.memberId) || null;
    } else {
      // Organizer invite - userId is from group
      userId = invite.groupUserId;
    }

    if (!userId) continue;

    const key = `${invite.itineraryId}:${userId}`;

    if (!invitesByItineraryAndUser.has(key)) {
      invitesByItineraryAndUser.set(key, []);
    }
    invitesByItineraryAndUser.get(key)!.push(invite);
  }

  // Find duplicates (where same user has multiple invites for same itinerary)
  const duplicateGroups = [];
  for (const [key, invites] of invitesByItineraryAndUser.entries()) {
    if (invites.length > 1) {
      duplicateGroups.push({ key, invites });
    }
  }

  console.log(`\nFound ${duplicateGroups.length} itinerary/user combinations with duplicate invites`);

  if (duplicateGroups.length === 0) {
    console.log("✓ No duplicate invites found. Database is clean!");
    return;
  }

  console.log("\nDuplicate details:");
  for (const group of duplicateGroups.slice(0, 10)) {
    const [itineraryId, userId] = group.key.split(":");
    console.log(`  - Itinerary ${itineraryId.substring(0, 8)}... for user ${userId}: ${group.invites.length} invites`);
    group.invites.forEach((inv, idx) => {
      console.log(`    ${idx + 1}. Invite ${inv.inviteId.substring(0, 8)}... (memberId: ${inv.memberId || 'null/organizer'})`);
    });
  }

  if (duplicateGroups.length > 10) {
    console.log(`  ... and ${duplicateGroups.length - 10} more`);
  }

  // For each duplicate group, keep ONE invite and delete the rest
  // Priority: keep organizer invite (memberId = null) if it exists, otherwise keep first one
  let totalDeleted = 0;
  const invitesToDelete: string[] = [];

  for (const group of duplicateGroups) {
    // Sort: organizer invites (memberId = null) first
    const sorted = [...group.invites].sort((a, b) => {
      if (a.memberId === null && b.memberId !== null) return -1;
      if (a.memberId !== null && b.memberId === null) return 1;
      return 0;
    });

    // Keep first one, delete the rest
    const toKeep = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`  Keeping invite ${toKeep.inviteId.substring(0, 8)}... (memberId: ${toKeep.memberId || 'organizer'})`);
    console.log(`  Deleting ${toDelete.length} duplicate(s)`);

    for (const inv of toDelete) {
      invitesToDelete.push(inv.inviteId);
    }
    totalDeleted += toDelete.length;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`SUMMARY: Will delete ${totalDeleted} duplicate invite(s)`);
  console.log("=".repeat(60));
  console.log("\nProceeding with deletion...\n");

  // Delete duplicate invites in batches
  if (invitesToDelete.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < invitesToDelete.length; i += batchSize) {
      const batch = invitesToDelete.slice(i, i + batchSize);
      await db
        .delete(itineraryInvites)
        .where(sql`id IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`);
      console.log(`✓ Deleted batch ${Math.floor(i / batchSize) + 1} (${batch.length} invites)`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✓ CLEANUP COMPLETE: Deleted ${totalDeleted} duplicate invites`);
  console.log("=".repeat(60));
}

cleanupDuplicateInvites()
  .then(() => {
    console.log("\nCleanup script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error during cleanup:", error);
    process.exit(1);
  });
