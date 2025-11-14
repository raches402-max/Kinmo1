import { db } from "./db";
import { activitySwipes, activities, votingEvents } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Swipe consensus thresholds
 */
export const CONSENSUS_THRESHOLDS = {
  AUTO_APPROVE: 70, // 70%+ right swipes = auto-add to Favorites
  AUTO_REJECT: 30,  // <30% right swipes = auto-mark as seen/rejected
  MIN_SWIPES: 3,    // Minimum number of swipes before calculating consensus
} as const;

/**
 * Calculate consensus percentage for an activity
 * Returns percentage (0-100) of right swipes, or null if insufficient data
 */
export async function calculateActivityConsensus(
  activityId: string
): Promise<number | null> {
  const swipes = await db
    .select({
      direction: activitySwipes.swipeDirection,
    })
    .from(activitySwipes)
    .where(eq(activitySwipes.activityId, activityId));

  if (swipes.length < CONSENSUS_THRESHOLDS.MIN_SWIPES) {
    return null; // Not enough data
  }

  const rightSwipes = swipes.filter(s => s.direction === 'right').length;
  const consensus = Math.round((rightSwipes / swipes.length) * 100);

  return consensus;
}

/**
 * Calculate consensus percentage for a voting event (Favorite)
 * Returns percentage (0-100) of right swipes, or null if insufficient data
 */
export async function calculateVotingEventConsensus(
  votingEventId: string
): Promise<number | null> {
  const swipes = await db
    .select({
      direction: activitySwipes.swipeDirection,
    })
    .from(activitySwipes)
    .where(eq(activitySwipes.votingEventId, votingEventId));

  if (swipes.length < CONSENSUS_THRESHOLDS.MIN_SWIPES) {
    return null; // Not enough data
  }

  const rightSwipes = swipes.filter(s => s.direction === 'right').length;
  const consensus = Math.round((rightSwipes / swipes.length) * 100);

  return consensus;
}

/**
 * Update the swipeConsensus field on an activity
 */
export async function updateActivityConsensus(
  activityId: string
): Promise<number | null> {
  const consensus = await calculateActivityConsensus(activityId);

  if (consensus !== null) {
    await db
      .update(activities)
      .set({ swipeConsensus: consensus })
      .where(eq(activities.id, activityId));
  }

  return consensus;
}

/**
 * Update the swipeConsensus field on a voting event
 */
export async function updateVotingEventConsensus(
  votingEventId: string
): Promise<number | null> {
  const consensus = await calculateVotingEventConsensus(votingEventId);

  if (consensus !== null) {
    await db
      .update(votingEvents)
      .set({ swipeConsensus: consensus })
      .where(eq(votingEvents.id, votingEventId));
  }

  return consensus;
}

/**
 * Get swipe statistics for an activity
 */
export async function getActivitySwipeStats(activityId: string) {
  const swipes = await db
    .select({
      direction: activitySwipes.swipeDirection,
      userId: activitySwipes.userId,
      createdAt: activitySwipes.createdAt,
    })
    .from(activitySwipes)
    .where(eq(activitySwipes.activityId, activityId));

  const rightSwipes = swipes.filter(s => s.direction === 'right').length;
  const leftSwipes = swipes.filter(s => s.direction === 'left').length;
  const total = swipes.length;
  const consensus = total >= CONSENSUS_THRESHOLDS.MIN_SWIPES
    ? Math.round((rightSwipes / total) * 100)
    : null;

  return {
    totalSwipes: total,
    rightSwipes,
    leftSwipes,
    consensus,
    hasMinimumSwipes: total >= CONSENSUS_THRESHOLDS.MIN_SWIPES,
    shouldAutoApprove: consensus !== null && consensus >= CONSENSUS_THRESHOLDS.AUTO_APPROVE,
    shouldAutoReject: consensus !== null && consensus <= CONSENSUS_THRESHOLDS.AUTO_REJECT,
  };
}

/**
 * Get swipe statistics for a voting event
 */
export async function getVotingEventSwipeStats(votingEventId: string) {
  const swipes = await db
    .select({
      direction: activitySwipes.swipeDirection,
      userId: activitySwipes.userId,
      createdAt: activitySwipes.createdAt,
    })
    .from(activitySwipes)
    .where(eq(activitySwipes.votingEventId, votingEventId));

  const rightSwipes = swipes.filter(s => s.direction === 'right').length;
  const leftSwipes = swipes.filter(s => s.direction === 'left').length;
  const total = swipes.length;
  const consensus = total >= CONSENSUS_THRESHOLDS.MIN_SWIPES
    ? Math.round((rightSwipes / total) * 100)
    : null;

  return {
    totalSwipes: total,
    rightSwipes,
    leftSwipes,
    consensus,
    hasMinimumSwipes: total >= CONSENSUS_THRESHOLDS.MIN_SWIPES,
    shouldAutoApprove: consensus !== null && consensus >= CONSENSUS_THRESHOLDS.AUTO_APPROVE,
    shouldAutoReject: consensus !== null && consensus <= CONSENSUS_THRESHOLDS.AUTO_REJECT,
  };
}

/**
 * Get all swipe progress for a group
 * Returns stats for all activities/voting events with swipes
 */
export async function getGroupSwipeProgress(groupId: string) {
  // Get activities with swipes
  const activitySwipesData = await db
    .select({
      activityId: activitySwipes.activityId,
      direction: activitySwipes.swipeDirection,
    })
    .from(activitySwipes)
    .where(
      and(
        eq(activitySwipes.groupId, groupId),
        sql`${activitySwipes.activityId} IS NOT NULL`
      )
    );

  // Get voting events with swipes
  const votingEventSwipesData = await db
    .select({
      votingEventId: activitySwipes.votingEventId,
      direction: activitySwipes.swipeDirection,
    })
    .from(activitySwipes)
    .where(
      and(
        eq(activitySwipes.groupId, groupId),
        sql`${activitySwipes.votingEventId} IS NOT NULL`
      )
    );

  // Aggregate stats by activity
  const activityStats = activitySwipesData.reduce((acc, swipe) => {
    const id = swipe.activityId!;
    if (!acc[id]) {
      acc[id] = { right: 0, left: 0, total: 0 };
    }
    acc[id].total++;
    if (swipe.direction === 'right') {
      acc[id].right++;
    } else {
      acc[id].left++;
    }
    return acc;
  }, {} as Record<string, { right: number; left: number; total: number }>);

  // Aggregate stats by voting event
  const votingEventStats = votingEventSwipesData.reduce((acc, swipe) => {
    const id = swipe.votingEventId!;
    if (!acc[id]) {
      acc[id] = { right: 0, left: 0, total: 0 };
    }
    acc[id].total++;
    if (swipe.direction === 'right') {
      acc[id].right++;
    } else {
      acc[id].left++;
    }
    return acc;
  }, {} as Record<string, { right: number; left: number; total: number }>);

  return {
    activities: Object.entries(activityStats).map(([id, stats]) => ({
      activityId: id,
      totalSwipes: stats.total,
      rightSwipes: stats.right,
      leftSwipes: stats.left,
      consensus: Math.round((stats.right / stats.total) * 100),
    })),
    votingEvents: Object.entries(votingEventStats).map(([id, stats]) => ({
      votingEventId: id,
      totalSwipes: stats.total,
      rightSwipes: stats.right,
      leftSwipes: stats.left,
      consensus: Math.round((stats.right / stats.total) * 100),
    })),
  };
}

/**
 * Check if a user has already swiped on an activity
 */
export async function hasUserSwipedActivity(
  userId: string,
  activityId: string
): Promise<boolean> {
  const existingSwipe = await db
    .select()
    .from(activitySwipes)
    .where(
      and(
        eq(activitySwipes.userId, userId),
        eq(activitySwipes.activityId, activityId)
      )
    )
    .limit(1);

  return existingSwipe.length > 0;
}

/**
 * Check if a user has already swiped on a voting event
 */
export async function hasUserSwipedVotingEvent(
  userId: string,
  votingEventId: string
): Promise<boolean> {
  const existingSwipe = await db
    .select()
    .from(activitySwipes)
    .where(
      and(
        eq(activitySwipes.userId, userId),
        eq(activitySwipes.votingEventId, votingEventId)
      )
    )
    .limit(1);

  return existingSwipe.length > 0;
}

/**
 * Perform auto-actions based on consensus thresholds
 * Called after consensus is calculated for an activity
 */
export async function performActivityAutoActions(activityId: string): Promise<{
  action: 'promoted' | 'rejected' | 'none';
  reason: string;
} | null> {
  const stats = await getActivitySwipeStats(activityId);

  if (!stats.hasMinimumSwipes) {
    return null; // Not enough data for auto-actions
  }

  // Get activity details
  const [activity] = await db
    .select()
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);

  if (!activity) {
    return null;
  }

  // Auto-promote if consensus >= 70%
  if (stats.shouldAutoApprove && !activity.isSaved) {
    // Auto-upvote the activity
    await db
      .update(activities)
      .set({
        upvotes: sql`${activities.upvotes} + 1`,
        isSaved: true, // Mark as saved (added to Favorites)
      })
      .where(eq(activities.id, activityId));

    console.log(
      `[SwipeConsensus] Auto-promoted activity ${activityId} ` +
      `(${stats.consensus}% approval from ${stats.totalSwipes} swipes)`
    );

    return {
      action: 'promoted',
      reason: `${stats.consensus}% of members loved this venue`,
    };
  }

  // Auto-reject if consensus <= 30%
  if (stats.shouldAutoReject && !activity.isRejected) {
    await db
      .update(activities)
      .set({
        isRejected: true,
        downvotes: sql`${activities.downvotes} + 1`,
      })
      .where(eq(activities.id, activityId));

    console.log(
      `[SwipeConsensus] Auto-rejected activity ${activityId} ` +
      `(${stats.consensus}% approval from ${stats.totalSwipes} swipes)`
    );

    return {
      action: 'rejected',
      reason: `Only ${stats.consensus}% of members liked this venue`,
    };
  }

  return { action: 'none', reason: 'Consensus in neutral range' };
}

/**
 * Perform auto-actions based on consensus thresholds for voting events (Favorites)
 * Called after consensus is calculated for a voting event
 */
export async function performVotingEventAutoActions(votingEventId: string): Promise<{
  action: 'boosted' | 'demoted' | 'none';
  reason: string;
} | null> {
  const stats = await getVotingEventSwipeStats(votingEventId);

  if (!stats.hasMinimumSwipes) {
    return null; // Not enough data for auto-actions
  }

  // Get voting event details
  const [votingEvent] = await db
    .select()
    .from(votingEvents)
    .where(eq(votingEvents.id, votingEventId))
    .limit(1);

  if (!votingEvent) {
    return null;
  }

  // Auto-boost if consensus >= 70% (increase priority in Favorites)
  if (stats.shouldAutoApprove) {
    await db
      .update(votingEvents)
      .set({
        upvotes: sql`${votingEvents.upvotes} + 1`, // Boost visibility
      })
      .where(eq(votingEvents.id, votingEventId));

    console.log(
      `[SwipeConsensus] Auto-boosted favorite ${votingEventId} ` +
      `(${stats.consensus}% approval from ${stats.totalSwipes} swipes)`
    );

    return {
      action: 'boosted',
      reason: `${stats.consensus}% consensus - top choice for next event`,
    };
  }

  // Auto-demote if consensus <= 30%
  if (stats.shouldAutoReject) {
    await db
      .update(votingEvents)
      .set({
        downvotes: sql`${votingEvents.downvotes} + 1`,
      })
      .where(eq(votingEvents.id, votingEventId));

    console.log(
      `[SwipeConsensus] Auto-demoted favorite ${votingEventId} ` +
      `(${stats.consensus}% approval from ${stats.totalSwipes} swipes)`
    );

    return {
      action: 'demoted',
      reason: `Only ${stats.consensus}% approval - consider removing`,
    };
  }

  return { action: 'none', reason: 'Consensus in neutral range' };
}
