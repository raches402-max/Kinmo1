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

// NOTE: this file used to have a CLI entrypoint here — `if (import.meta.url === file://${process.argv[1]}) { processWeeklyDigests().then(() => process.exit(0)) }`
// — intended to let it run standalone via `npx tsx server/swipe-digest-worker.ts`. That check is unsafe in bundled production code:
// esbuild rewrites both `import.meta.url` and `process.argv[1]` to the same bundle path, so the condition evaluates true on every import
// and the auto-exit fires. This was the real cause of the 2026-05-18 outage. Trigger production runs via POST /api/cron/weekly-digest only.
