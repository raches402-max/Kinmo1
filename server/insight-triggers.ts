/**
 * Insight Triggers
 *
 * Automatically regenerate group insights when new data comes in:
 * - After post-event feedback
 * - After RSVP patterns emerge
 * - After events complete
 * - After new members join
 */

import { generateGroupInsights, saveGroupInsights } from './group-insights';

/**
 * Triggers insight regeneration after a threshold of changes
 * Prevents excessive regeneration while keeping insights fresh
 */
export async function triggerInsightUpdate(
  groupId: string,
  trigger: 'post-event-feedback' | 'rsvp-collected' | 'event-completed' | 'member-joined'
): Promise<void> {
  try {
    console.log(`[Insight Trigger] ${trigger} for group ${groupId}`);

    // Regenerate insights (async, don't block the calling function)
    const insights = await generateGroupInsights(groupId);
    await saveGroupInsights(groupId, insights);

    console.log(`✅ [Insight Trigger] Updated insights for group ${groupId}`);
  } catch (error) {
    console.error(`[Insight Trigger] Failed to update insights for group ${groupId}:`, error);
    // Don't throw - insight updates shouldn't block main operations
  }
}

/**
 * Debounced version - only triggers if enough time has passed since last update
 * Use this for high-frequency events like RSVPs
 */
export async function triggerInsightUpdateDebounced(
  groupId: string,
  trigger: string,
  minHoursBetweenUpdates: number = 6
): Promise<void> {
  const { db } = await import('./db');
  const { groups } = await import('../shared/schema');
  const { eq } = await import('drizzle-orm');

  // Check when insights were last updated
  const group = await db
    .select({ lastInsightsUpdate: groups.lastInsightsUpdate })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group[0]) return;

  const lastUpdate = group[0].lastInsightsUpdate;
  if (lastUpdate) {
    const hoursSinceUpdate = (new Date().getTime() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);

    if (hoursSinceUpdate < minHoursBetweenUpdates) {
      console.log(`[Insight Trigger] Skipping update for group ${groupId} - updated ${Math.round(hoursSinceUpdate)}h ago`);
      return;
    }
  }

  await triggerInsightUpdate(groupId, trigger as any);
}
