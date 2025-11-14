import { db, pool } from "./db";
import { groups, members, users } from "@shared/schema";
import { eq, isNull, and, sql } from "drizzle-orm";

/**
 * Data Recovery Script for Orphaned Groups
 *
 * This script finds groups where userId has been set to NULL due to the
 * authentication bug (unstable Replit OAuth IDs causing user record deletion).
 *
 * Recovery Strategy:
 * 1. Find all groups where userId IS NULL
 * 2. For each orphaned group, find members who are organizers
 * 3. Match organizer members to current active users by email
 * 4. Update group.userId to the correct current user ID
 */

interface OrphanedGroup {
  id: string;
  name: string;
  userId: string | null;
}

interface RecoveryResult {
  groupId: string;
  groupName: string;
  recoveredUserId: string;
  userEmail: string;
  method: string;
}

async function recoverOrphanedGroups(): Promise<RecoveryResult[]> {
  console.log("=".repeat(60));
  console.log("ORPHANED GROUPS RECOVERY SCRIPT");
  console.log("=".repeat(60));
  console.log();

  const results: RecoveryResult[] = [];

  try {
    // Step 1: Find all orphaned groups
    console.log("Step 1: Finding orphaned groups (userId IS NULL)...");
    const orphanedGroups = await db
      .select({
        id: groups.id,
        name: groups.name,
        userId: groups.userId,
      })
      .from(groups)
      .where(isNull(groups.userId));

    console.log(`Found ${orphanedGroups.length} orphaned groups\n`);

    if (orphanedGroups.length === 0) {
      console.log("✅ No orphaned groups found! Database is healthy.");
      return results;
    }

    // Step 2: For each orphaned group, find the owner
    for (const group of orphanedGroups) {
      console.log(`\nProcessing group: "${group.name}" (${group.id})`);
      console.log("-".repeat(60));

      // Strategy 1: Find members with isOrganizer = true
      const organizers = await db
        .select({
          memberId: members.id,
          userId: members.userId,
          userName: members.userName,
          isOrganizer: members.isOrganizer,
        })
        .from(members)
        .where(
          and(
            eq(members.groupId, group.id),
            eq(members.isOrganizer, true)
          )
        );

      console.log(`  Found ${organizers.length} organizer member(s)`);

      if (organizers.length === 0) {
        console.log(`  ⚠️  No organizers found for this group. Skipping.`);
        continue;
      }

      // Get the first organizer's user ID
      const organizerMemberId = organizers[0].userId;

      if (!organizerMemberId) {
        console.log(`  ⚠️  Organizer member has null userId. Trying to find by email...`);

        // Strategy 2: Try to find user by member's userName (which might be email)
        // This is a fallback if the member.userId is also null
        const memberUserName = organizers[0].userName;

        // Check if userName looks like an email
        if (memberUserName && memberUserName.includes('@')) {
          const userByEmail = await db
            .select({
              id: users.id,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
            })
            .from(users)
            .where(eq(users.email, memberUserName))
            .limit(1);

          if (userByEmail.length > 0) {
            const recoveredUser = userByEmail[0];
            console.log(`  ✅ Found user by email: ${recoveredUser.email} (${recoveredUser.id})`);

            // Update the group
            await db
              .update(groups)
              .set({ userId: recoveredUser.id })
              .where(eq(groups.id, group.id));

            console.log(`  ✅ Updated group.userId to ${recoveredUser.id}`);

            results.push({
              groupId: group.id,
              groupName: group.name,
              recoveredUserId: recoveredUser.id,
              userEmail: recoveredUser.email || 'unknown',
              method: 'email-lookup',
            });
            continue;
          }
        }

        console.log(`  ❌ Could not find user by email. Skipping this group.`);
        continue;
      }

      // Strategy 3: Use the organizer's userId directly (normal case)
      const user = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, organizerMemberId))
        .limit(1);

      if (user.length === 0) {
        console.log(`  ⚠️  User ${organizerMemberId} not found in users table. Skipping.`);
        continue;
      }

      const recoveredUser = user[0];
      console.log(`  ✅ Found organizer user: ${recoveredUser.email} (${recoveredUser.id})`);

      // Update the group
      await db
        .update(groups)
        .set({ userId: recoveredUser.id })
        .where(eq(groups.id, group.id));

      console.log(`  ✅ Updated group.userId to ${recoveredUser.id}`);

      results.push({
        groupId: group.id,
        groupName: group.name,
        recoveredUserId: recoveredUser.id,
        userEmail: recoveredUser.email || 'unknown',
        method: 'organizer-lookup',
      });
    }

    // Step 3: Summary
    console.log("\n" + "=".repeat(60));
    console.log("RECOVERY SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total orphaned groups: ${orphanedGroups.length}`);
    console.log(`Successfully recovered: ${results.length}`);
    console.log(`Failed to recover: ${orphanedGroups.length - results.length}\n`);

    if (results.length > 0) {
      console.log("Recovered groups:");
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. "${r.groupName}" → ${r.userEmail} (${r.method})`);
      });
    }

    console.log();
    return results;

  } catch (error) {
    console.error("❌ Error during recovery:", error);
    throw error;
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the script
recoverOrphanedGroups()
  .then((results) => {
    console.log(`\n✅ Recovery complete! ${results.length} groups recovered.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Recovery failed:", error);
    process.exit(1);
  });
