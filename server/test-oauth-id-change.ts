import { db, pool } from "./db";
import { users, groups, members } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

/**
 * Test script to verify OAuth ID change handling
 *
 * This simulates the scenario where Replit OAuth provides a different
 * subject ID for the same user across sessions.
 *
 * Expected behavior:
 * 1. User record should be UPDATED, not deleted
 * 2. Groups should remain intact (not orphaned)
 * 3. Legacy OAuth subs should be tracked
 * 4. User ID should remain stable
 */

interface TestResults {
  success: boolean;
  userPreserved: boolean;
  groupsPreserved: boolean;
  legacyOidcSubsTracked: boolean;
  userIdStable: boolean;
  details: string[];
}

async function testOAuthIdChange(): Promise<TestResults> {
  const results: TestResults = {
    success: false,
    userPreserved: false,
    groupsPreserved: false,
    legacyOidcSubsTracked: false,
    userIdStable: false,
    details: [],
  };

  console.log("=".repeat(70));
  console.log("OAUTH ID CHANGE TEST");
  console.log("=".repeat(70));
  console.log();

  try {
    // Step 1: Find a test user with groups
    console.log("Step 1: Finding test user...");
    const testUsers = await db
      .select({
        userId: users.id,
        userEmail: users.email,
        userOidcSub: users.oidcSub,
        groupId: groups.id,
        groupName: groups.name,
      })
      .from(users)
      .leftJoin(groups, eq(groups.userId, users.id))
      .where(eq(users.email, "raches402@gmail.com")) // Use the protected admin email for testing
      .limit(1);

    if (testUsers.length === 0) {
      results.details.push("❌ No test user found with groups");
      return results;
    }

    const testUser = testUsers[0];
    const originalUserId = testUser.userId!;
    const originalOidcSub = testUser.userOidcSub!;
    const userEmail = testUser.userEmail!;

    console.log(`✅ Found test user: ${userEmail}`);
    console.log(`   User ID: ${originalUserId}`);
    console.log(`   OAuth Sub: ${originalOidcSub}`);
    console.log();

    // Count groups before the change
    const groupsBefore = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.userId, originalUserId));

    console.log(`   Groups owned: ${groupsBefore.length}`);
    groupsBefore.forEach((g, i) => {
      console.log(`     ${i + 1}. ${g.name} (${g.id})`);
    });
    console.log();

    // Step 2: Simulate OAuth ID change
    console.log("Step 2: Simulating OAuth ID change...");
    const newOidcSub = `simulated-new-oauth-sub-${Date.now()}`;
    console.log(`   Old OAuth Sub: ${originalOidcSub}`);
    console.log(`   New OAuth Sub: ${newOidcSub}`);
    console.log();

    // Call upsertUser with new OAuth sub (simulating Replit returning different sub)
    await storage.upsertUser({
      id: originalUserId, // This would come from session in real scenario
      email: userEmail,
      oidcSub: newOidcSub,
      firstName: "Test",
      lastName: "User",
      profileImageUrl: null,
    } as any);

    console.log("✅ upsertUser() called with new OAuth sub\n");

    // Step 3: Verify user record still exists
    console.log("Step 3: Verifying user record...");
    const userAfter = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1);

    if (userAfter.length === 0) {
      results.details.push("❌ CRITICAL: User record was deleted!");
      console.log("❌ CRITICAL: User record was deleted!\n");
      return results;
    }

    results.userPreserved = true;
    console.log(`✅ User record preserved`);
    console.log(`   User ID: ${userAfter[0].id}`);
    console.log(`   Email: ${userAfter[0].email}`);
    console.log(`   OAuth Sub: ${userAfter[0].oidcSub}`);
    console.log(`   Legacy OAuth Subs: ${JSON.stringify(userAfter[0].legacyOidcSubs)}`);
    console.log();

    // Step 4: Verify user ID is stable
    if (userAfter[0].id === originalUserId) {
      results.userIdStable = true;
      console.log("✅ User ID remained stable (not changed)\n");
    } else {
      results.details.push(`❌ User ID changed! ${originalUserId} → ${userAfter[0].id}`);
      console.log(`❌ User ID changed! ${originalUserId} → ${userAfter[0].id}\n`);
    }

    // Step 5: Verify OAuth sub was updated
    if (userAfter[0].oidcSub === newOidcSub) {
      console.log("✅ OAuth sub was updated to new value\n");
    } else {
      results.details.push(`❌ OAuth sub not updated correctly`);
      console.log(`❌ OAuth sub not updated correctly\n`);
    }

    // Step 6: Verify legacy OAuth subs are tracked
    const legacySubs = userAfter[0].legacyOidcSubs as string[] || [];
    if (legacySubs.includes(originalOidcSub)) {
      results.legacyOidcSubsTracked = true;
      console.log("✅ Original OAuth sub tracked in legacyOidcSubs\n");
    } else {
      results.details.push(`❌ Original OAuth sub not tracked in legacyOidcSubs`);
      console.log(`❌ Original OAuth sub not tracked in legacyOidcSubs\n`);
    }

    // Step 7: Verify groups are still owned by the user
    console.log("Step 4: Verifying groups...");
    const groupsAfter = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.userId, userAfter[0].id));

    console.log(`   Groups owned after change: ${groupsAfter.length}`);
    groupsAfter.forEach((g, i) => {
      console.log(`     ${i + 1}. ${g.name} (${g.id})`);
    });
    console.log();

    if (groupsAfter.length === groupsBefore.length) {
      results.groupsPreserved = true;
      console.log("✅ All groups preserved (not orphaned)\n");
    } else {
      results.details.push(`❌ Group count mismatch! Before: ${groupsBefore.length}, After: ${groupsAfter.length}`);
      console.log(`❌ Group count mismatch! Before: ${groupsBefore.length}, After: ${groupsAfter.length}\n`);
    }

    // Step 8: Check for orphaned groups
    const orphanedGroups = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.userId, null as any));

    if (orphanedGroups.length > 0) {
      results.details.push(`⚠️  Found ${orphanedGroups.length} orphaned groups`);
      console.log(`⚠️  WARNING: Found ${orphanedGroups.length} orphaned groups:\n`);
      orphanedGroups.forEach((g, i) => {
        console.log(`     ${i + 1}. ${g.name} (${g.id})`);
      });
      console.log();
    } else {
      console.log("✅ No orphaned groups found\n");
    }

    // Step 9: Restore original OAuth sub (cleanup)
    console.log("Step 5: Restoring original OAuth sub...");
    await db
      .update(users)
      .set({
        oidcSub: originalOidcSub,
        legacyOidcSubs: null,
      })
      .where(eq(users.id, originalUserId));

    console.log("✅ Test cleanup complete\n");

    // Final result
    results.success =
      results.userPreserved &&
      results.groupsPreserved &&
      results.legacyOidcSubsTracked &&
      results.userIdStable;

    console.log("=".repeat(70));
    console.log("TEST RESULTS");
    console.log("=".repeat(70));
    console.log(`✅ User Preserved:           ${results.userPreserved ? "PASS" : "FAIL"}`);
    console.log(`✅ User ID Stable:           ${results.userIdStable ? "PASS" : "FAIL"}`);
    console.log(`✅ Groups Preserved:         ${results.groupsPreserved ? "PASS" : "FAIL"}`);
    console.log(`✅ Legacy OAuth Subs Tracked: ${results.legacyOidcSubsTracked ? "PASS" : "FAIL"}`);
    console.log(`\n${results.success ? "🎉 ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}\n`);

    if (results.details.length > 0) {
      console.log("Details:");
      results.details.forEach((d) => console.log(`  ${d}`));
      console.log();
    }

    return results;

  } catch (error) {
    console.error("❌ Test failed with error:", error);
    results.details.push(`Error: ${error}`);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test
testOAuthIdChange()
  .then((results) => {
    process.exit(results.success ? 0 : 1);
  })
  .catch((error) => {
    console.error("\n❌ Test crashed:", error);
    process.exit(1);
  });
