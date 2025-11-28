/**
 * Planning Agent - Main Orchestrator
 *
 * Proactive AI that observes group patterns and generates actionable insights.
 * Runs on a schedule to analyze all groups and create/update insights.
 */

import { db } from '../db';
import { eq, and, isNull, gt, or, sql } from 'drizzle-orm';
import { groups, planningInsights, members } from '../../shared/schema';
import {
  RawInsight,
  PlanningInsightData,
  Analyzer,
  DEFAULT_CONFIG,
  PlanningAgentConfig,
} from './types';
import { LocationFairnessAnalyzer } from './analyzers/location-fairness';
import { VenueDateGapAnalyzer } from './analyzers/venue-date-gap';
import { CadenceHealthAnalyzer } from './analyzers/cadence-health';
import { generateInsightMessage } from './message-generator';

// Registry of all analyzers
const ANALYZERS: Analyzer[] = [
  new LocationFairnessAnalyzer(),
  new VenueDateGapAnalyzer(),
  new CadenceHealthAnalyzer(),
  // Future: MemberInclusionAnalyzer
];

/**
 * Run the planning agent for all groups
 */
export async function runPlanningAgent(config: PlanningAgentConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('[Planning Agent] Starting analysis run...');

  try {
    // Get all groups with auto-scheduling enabled (these are the ones that want AI help)
    const activeGroups = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.autoScheduleEnabled, true));

    console.log(`[Planning Agent] Analyzing ${activeGroups.length} groups`);

    let totalInsights = 0;

    for (const group of activeGroups) {
      try {
        const insightCount = await analyzeGroup(group.id, config);
        totalInsights += insightCount;
        if (insightCount > 0) {
          console.log(`[Planning Agent] Generated ${insightCount} insights for "${group.name}"`);
        }
      } catch (error) {
        console.error(`[Planning Agent] Error analyzing group ${group.id}:`, error);
      }
    }

    // Clean up expired insights
    await cleanupExpiredInsights();

    console.log(`[Planning Agent] Completed. Generated ${totalInsights} total insights.`);
  } catch (error) {
    console.error('[Planning Agent] Fatal error:', error);
    throw error;
  }
}

/**
 * Analyze a single group and generate insights
 */
export async function analyzeGroup(
  groupId: string,
  config: PlanningAgentConfig = DEFAULT_CONFIG
): Promise<number> {
  const allInsights: RawInsight[] = [];

  // Run all analyzers
  for (const analyzer of ANALYZERS) {
    try {
      const insights = await analyzer.analyze(groupId);
      allInsights.push(...insights);
    } catch (error) {
      console.error(`[Planning Agent] ${analyzer.name} failed for group ${groupId}:`, error);
    }
  }

  if (allInsights.length === 0) {
    return 0;
  }

  // Deduplicate against existing insights
  const newInsights = await deduplicateInsights(groupId, allInsights);

  if (newInsights.length === 0) {
    return 0;
  }

  // Generate LLM messages and save insights
  for (const rawInsight of newInsights) {
    try {
      const insightData = await generateInsightMessage(rawInsight);
      await saveInsight(insightData);
    } catch (error) {
      console.error(`[Planning Agent] Error saving insight:`, error);
    }
  }

  return newInsights.length;
}

/**
 * Filter out insights that already exist (based on deduplication key)
 */
async function deduplicateInsights(
  groupId: string,
  rawInsights: RawInsight[]
): Promise<RawInsight[]> {
  // Get existing active insights for this group
  const existingInsights = await db
    .select({ metadata: planningInsights.metadata })
    .from(planningInsights)
    .where(
      and(
        eq(planningInsights.groupId, groupId),
        isNull(planningInsights.dismissedAt),
        or(
          isNull(planningInsights.expiresAt),
          gt(planningInsights.expiresAt, new Date())
        )
      )
    );

  // Extract existing deduplication keys
  const existingKeys = new Set(
    existingInsights
      .map((i) => (i.metadata as any)?.deduplicationKey)
      .filter(Boolean)
  );

  // Filter to only new insights
  return rawInsights.filter(
    (insight) => !existingKeys.has(insight.deduplicationKey)
  );
}

/**
 * Save an insight to the database
 */
async function saveInsight(insightData: PlanningInsightData): Promise<void> {
  await db.insert(planningInsights).values({
    groupId: insightData.groupId,
    memberId: insightData.memberId,
    insightType: insightData.insightType,
    severity: insightData.severity,
    audienceType: insightData.audienceType,
    title: insightData.title,
    message: insightData.message,
    metadata: insightData.metadata,
    actionType: insightData.actionType,
    actionTaken: insightData.actionTaken,
    actionDetails: insightData.actionDetails,
    actionUrl: insightData.actionUrl,
    actionLabel: insightData.actionLabel,
    expiresAt: insightData.expiresAt,
  });
}

/**
 * Clean up expired insights
 */
async function cleanupExpiredInsights(): Promise<void> {
  const result = await db
    .delete(planningInsights)
    .where(
      and(
        sql`${planningInsights.expiresAt} IS NOT NULL`,
        sql`${planningInsights.expiresAt} < NOW()`
      )
    );

  // Note: Drizzle doesn't return count for delete, so we just log
  console.log('[Planning Agent] Cleaned up expired insights');
}

/**
 * Get active insights for a group
 */
export async function getGroupInsights(groupId: string, userId?: string): Promise<any[]> {
  // Get the member ID for this user in this group (if any)
  let memberId: string | undefined;
  if (userId) {
    const memberResult = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.groupId, groupId), eq(members.userId, userId)))
      .limit(1);

    memberId = memberResult[0]?.id;
  }

  // Get group owner
  const groupResult = await db
    .select({ userId: groups.userId })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  const isOrganizer = groupResult[0]?.userId === userId;

  // Build query for active insights
  const insights = await db
    .select()
    .from(planningInsights)
    .where(
      and(
        eq(planningInsights.groupId, groupId),
        isNull(planningInsights.dismissedAt),
        or(
          isNull(planningInsights.expiresAt),
          gt(planningInsights.expiresAt, new Date())
        )
      )
    )
    .orderBy(planningInsights.createdAt);

  // Filter by audience
  return insights.filter((insight) => {
    if (insight.audienceType === 'all') return true;
    if (insight.audienceType === 'organizer' && isOrganizer) return true;
    if (insight.audienceType === 'member' && insight.memberId === memberId) return true;
    return false;
  });
}

/**
 * Dismiss an insight
 */
export async function dismissInsight(insightId: string, userId: string): Promise<void> {
  await db
    .update(planningInsights)
    .set({
      dismissedAt: new Date(),
      dismissedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(planningInsights.id, insightId));
}

/**
 * Mark an insight as acted upon
 */
export async function markInsightActed(
  insightId: string,
  actionStatus: 'suggested' | 'auto_acted' | 'user_acted',
  actionDetails?: Record<string, any>
): Promise<void> {
  await db
    .update(planningInsights)
    .set({
      actionTaken: actionStatus,
      actionDetails: actionDetails,
      updatedAt: new Date(),
    })
    .where(eq(planningInsights.id, insightId));
}
