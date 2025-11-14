/**
 * Smart swipe trigger system
 * Prompts members to swipe at strategic moments to increase engagement and calibration data
 */

import { db } from "./db";
import { groups, swipeSessions, activities, activitySwipes, members } from "../shared/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { createSwipeSession, SwipeSessionType, SwipeSessionTrigger } from "./swipe-session-manager";

export interface SwipeTriggerConfig {
  groupId: string;
  triggerType: 'post_ai' | 'favorites_overflow' | 'weekly_digest' | 'manual';
  activityIds?: string[];
  reason?: string;
  expiresInHours?: number;
}

export interface TriggerResult {
  triggered: boolean;
  sessionId?: string;
  reason?: string;
  skippedReason?: string;
}

// Frequency caps to prevent notification fatigue
const TRIGGER_COOLDOWNS = {
  post_ai: 12 * 60 * 60 * 1000,         // 12 hours between post-AI triggers
  favorites_overflow: 24 * 60 * 60 * 1000, // 24 hours between favorites triggers
  weekly_digest: 7 * 24 * 60 * 60 * 1000,  // 7 days (enforced by name)
  manual: 0,                              // No cooldown for manual triggers
};

const TRIGGER_THRESHOLDS = {
  favorites_overflow: 15,  // Trigger when 15+ saved venues
  post_ai_min_venues: 3,   // Only trigger if AI generated 3+ venues
  weekly_digest_min: 5,    // Need 5+ new/upcoming venues for digest
};

/**
 * Check if group is currently on cooldown for a trigger type
 */
async function isOnCooldown(groupId: string, triggerType: string): Promise<boolean> {
  const cooldownMs = TRIGGER_COOLDOWNS[triggerType as keyof typeof TRIGGER_COOLDOWNS] || 0;
  if (cooldownMs === 0) return false;

  const recentSession = await db
    .select()
    .from(swipeSessions)
    .where(
      and(
        eq(swipeSessions.groupId, groupId),
        gte(swipeSessions.createdAt, new Date(Date.now() - cooldownMs))
      )
    )
    .orderBy(desc(swipeSessions.createdAt))
    .limit(1);

  return recentSession.length > 0;
}

/**
 * Post-AI generation trigger
 * Fires after auto-scheduler creates an event with AI-generated venues
 */
export async function triggerPostAISwipe(config: SwipeTriggerConfig): Promise<TriggerResult> {
  const { groupId, activityIds = [] } = config;

  // Check cooldown
  if (await isOnCooldown(groupId, 'post_ai')) {
    return {
      triggered: false,
      skippedReason: 'Recently triggered (12hr cooldown)',
    };
  }

  // Check if we have enough venues
  if (activityIds.length < TRIGGER_THRESHOLDS.post_ai_min_venues) {
    return {
      triggered: false,
      skippedReason: `Only ${activityIds.length} venues (need ${TRIGGER_THRESHOLDS.post_ai_min_venues}+)`,
    };
  }

  // Create swipe session
  const sessionId = await createSwipeSession({
    groupId,
    sessionType: 'activity_curation' as SwipeSessionType,
    triggeredBy: 'ai_generation' as SwipeSessionTrigger,
    isBlocking: false,
    targetSwipeCount: 5,
    expiresInHours: config.expiresInHours || 48,
  });

  return {
    triggered: true,
    sessionId,
    reason: `🎯 ${activityIds.length} new AI-generated venues ready to swipe`,
  };
}

/**
 * Favorites overflow trigger
 * Fires when group has many activities that need feedback
 */
export async function triggerFavoritesOverflow(groupId: string): Promise<TriggerResult> {
  // Check cooldown
  if (await isOnCooldown(groupId, 'favorites_overflow')) {
    return {
      triggered: false,
      skippedReason: 'Recently triggered (24hr cooldown)',
    };
  }

  // Get activities with consensus data (have been swiped)
  const activitiesWithConsensus = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.groupId, groupId),
        sql`${activities.swipeConsensus} IS NOT NULL`
      )
    );

  if (activitiesWithConsensus.length < TRIGGER_THRESHOLDS.favorites_overflow) {
    return {
      triggered: false,
      skippedReason: `Only ${activitiesWithConsensus.length} venues with feedback (threshold: ${TRIGGER_THRESHOLDS.favorites_overflow})`,
    };
  }

  // Create swipe session
  const sessionId = await createSwipeSession({
    groupId,
    sessionType: 'favorites_triage' as SwipeSessionType,
    triggeredBy: 'manual' as SwipeSessionTrigger,
    isBlocking: false,
    targetSwipeCount: 10, // More swipes since it's curation
    expiresInHours: 72, // 3 days
  });

  return {
    triggered: true,
    sessionId,
    reason: `📚 ${activitiesWithConsensus.length} venues to curate!`,
  };
}

/**
 * Weekly digest trigger
 * Fires once a week to get member feedback on upcoming/new venues
 */
export async function triggerWeeklyDigest(groupId: string): Promise<TriggerResult> {
  // Check cooldown (7 days)
  if (await isOnCooldown(groupId, 'weekly_digest')) {
    return {
      triggered: false,
      skippedReason: 'Already triggered this week',
    };
  }

  // Get activities from last 7 days that haven't been swiped much
  const recentActivities = await db
    .select({
      id: activities.id,
      venueName: activities.venueName,
      swipeCount: sql<number>`
        (SELECT COUNT(*) FROM ${activitySwipes}
         WHERE ${activitySwipes.activityId} = ${activities.id})::int
      `,
    })
    .from(activities)
    .where(
      and(
        eq(activities.groupId, groupId),
        gte(activities.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      )
    )
    .orderBy(desc(activities.createdAt))
    .limit(20);

  // Filter to activities with < 3 swipes
  const needFeedback = recentActivities.filter(a => a.swipeCount < 3);

  if (needFeedback.length < TRIGGER_THRESHOLDS.weekly_digest_min) {
    return {
      triggered: false,
      skippedReason: `Only ${needFeedback.length} venues need feedback (need ${TRIGGER_THRESHOLDS.weekly_digest_min}+)`,
    };
  }

  // Create swipe session
  const sessionId = await createSwipeSession({
    groupId,
    sessionType: 'weekly_digest' as SwipeSessionType,
    triggeredBy: 'manual' as SwipeSessionTrigger,
    isBlocking: false,
    targetSwipeCount: 5,
    expiresInHours: 168, // Full week
  });

  return {
    triggered: true,
    sessionId,
    reason: `📅 Weekly digest: ${needFeedback.length} venues to rate`,
  };
}

/**
 * Manual trigger
 * Organizer-initiated swipe session (no restrictions)
 */
export async function triggerManualSwipe(config: SwipeTriggerConfig): Promise<TriggerResult> {
  const { groupId, activityIds = [], reason, expiresInHours = 72 } = config;

  if (activityIds.length === 0) {
    return {
      triggered: false,
      skippedReason: 'No activities specified',
    };
  }

  // Create swipe session
  const sessionId = await createSwipeSession({
    groupId,
    sessionType: 'activity_curation' as SwipeSessionType,
    triggeredBy: 'manual' as SwipeSessionTrigger,
    isBlocking: false,
    targetSwipeCount: 5,
    expiresInHours,
  });

  return {
    triggered: true,
    sessionId,
    reason: reason || `Manual swipe session created`,
  };
}

/**
 * Smart trigger router
 * Routes to appropriate trigger based on type
 */
export async function triggerSwipeSession(config: SwipeTriggerConfig): Promise<TriggerResult> {
  switch (config.triggerType) {
    case 'post_ai':
      return triggerPostAISwipe(config);
    case 'favorites_overflow':
      return triggerFavoritesOverflow(config.groupId);
    case 'weekly_digest':
      return triggerWeeklyDigest(config.groupId);
    case 'manual':
      return triggerManualSwipe(config);
    default:
      return {
        triggered: false,
        skippedReason: 'Unknown trigger type',
      };
  }
}

/**
 * Check all trigger conditions for a group
 * Returns list of available triggers (for UI display)
 */
export async function checkTriggerOpportunities(groupId: string): Promise<{
  postAI: { available: boolean; reason: string };
  favoritesOverflow: { available: boolean; reason: string };
  weeklyDigest: { available: boolean; reason: string };
}> {
  const [postAICooldown, favoritesCooldown, digestCooldown] = await Promise.all([
    isOnCooldown(groupId, 'post_ai'),
    isOnCooldown(groupId, 'favorites_overflow'),
    isOnCooldown(groupId, 'weekly_digest'),
  ]);

  // Check activities with consensus
  const consensusCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activities)
    .where(
      and(
        eq(activities.groupId, groupId),
        sql`${activities.swipeConsensus} IS NOT NULL`
      )
    );

  return {
    postAI: {
      available: !postAICooldown,
      reason: postAICooldown ? '12hr cooldown active' : 'Ready to trigger after AI generation',
    },
    favoritesOverflow: {
      available: !favoritesCooldown && consensusCount[0].count >= TRIGGER_THRESHOLDS.favorites_overflow,
      reason: favoritesCooldown
        ? '24hr cooldown active'
        : consensusCount[0].count >= TRIGGER_THRESHOLDS.favorites_overflow
        ? `${consensusCount[0].count} venues with feedback - ready to curate`
        : `${consensusCount[0].count}/${TRIGGER_THRESHOLDS.favorites_overflow} venues with feedback`,
    },
    weeklyDigest: {
      available: !digestCooldown,
      reason: digestCooldown ? 'Already sent this week' : 'Ready for weekly digest',
    },
  };
}
