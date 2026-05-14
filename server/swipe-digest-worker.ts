/**
 * Background worker for weekly swipe digests
 * Runs once a week to trigger swipe sessions for active groups
 */

import { db } from "./db";
import { groups } from "../shared/schema";
import { eq } from "drizzle-orm";
import { triggerSwipeSession } from "./swipe-trigger-manager";

/**
 * Process weekly digests for all active groups
 * Call this from a cron job or scheduled task
 */
export async function processWeeklyDigests(): Promise<void> {
  console.log('[WeeklyDigest] Starting weekly digest processing...');

  try {
    // Get all active groups
    const activeGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.autoScheduleEnabled, true));

    console.log(`[WeeklyDigest] Found ${activeGroups.length} active groups`);

    let triggered = 0;
    let skipped = 0;

    for (const group of activeGroups) {
      try {
        const result = await triggerSwipeSession({
          groupId: group.id,
          triggerType: 'weekly_digest',
        });

        if (result.triggered) {
          console.log(`[WeeklyDigest] ✅ ${group.name}: ${result.reason}`);
          triggered++;
        } else {
          console.log(`[WeeklyDigest] ⏭️  ${group.name}: ${result.skippedReason}`);
          skipped++;
        }
      } catch (error) {
        console.error(`[WeeklyDigest] ❌ Error for group ${group.name}:`, error);
      }
    }

    console.log(`[WeeklyDigest] Complete: ${triggered} triggered, ${skipped} skipped`);
  } catch (error) {
    console.error('[WeeklyDigest] Fatal error:', error);
  }
}

// If running directly (e.g., via cron: `npx tsx server/swipe-digest-worker.ts`)
if (import.meta.url === `file://${process.argv[1]}`) {
  processWeeklyDigests()
    .then(() => {
      console.log('[WeeklyDigest] Job complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[WeeklyDigest] Job failed:', error);
      process.exit(1);
    });
}
