/**
 * Swipe Session Manager
 *
 * Handles the lifecycle of swipe sessions for async, non-blocking preference gathering.
 * Enables democratic curation through group swiping without blocking event creation.
 */

import { db } from "./db";
import { swipeSessions, activitySwipes, groups, members } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { calculateActivityConsensus, calculateVotingEventConsensus } from "./swipe-consensus";

export type SwipeSessionType =
  | "itinerary_validation"  // Members vote on auto-generated itinerary options
  | "activity_curation"      // Filter AI-generated activities before adding to Favorites
  | "favorites_triage"       // Narrow down 20+ Favorites to shortlist
  | "discovery"              // Post-event "find more like this" exploration
  | "weekly_digest";         // Regular preference check-in

export type SwipeSessionTrigger =
  | "auto_scheduler"   // Triggered by auto-scheduler creating event
  | "ai_generation"    // Triggered after AI generates new activities
  | "manual"           // Manually triggered by organizer
  | "weekly_job"       // Scheduled weekly engagement job
  | "post_event";      // Triggered after event with high rating

export interface SwipeSessionConfig {
  groupId: string;
  sessionType: SwipeSessionType;
  triggeredBy: SwipeSessionTrigger;
  isBlocking?: boolean;          // Default: false (async)
  targetSwipeCount?: number;     // Default: 5 items to swipe
  expiresInHours?: number;       // Default: 48 hours
  autoEventId?: string;          // If validating auto-scheduled event
}

export interface SwipeSessionResult {
  sessionId: string;
  status: "active" | "completed" | "expired";
  participantCount: number;
  totalSwipes: number;
  averageConsensus: number | null;
  consensusResults: Record<string, { approval: number; totalSwipes: number }> | null;
}

/**
 * Create a new swipe session for a group
 */
export async function createSwipeSession(config: SwipeSessionConfig): Promise<string> {
  const {
    groupId,
    sessionType,
    triggeredBy,
    isBlocking = false,
    targetSwipeCount = 5,
    expiresInHours = 48,
    autoEventId,
  } = config;

  // Get member count for participation tracking
  const memberCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members)
    .where(eq(members.groupId, groupId))
    .then((res: Array<{ count: number }>) => res[0]?.count || 0);

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  // Create session
  const [session] = await db
    .insert(swipeSessions)
    .values({
      groupId,
      sessionType,
      isBlocking,
      autoEventId,
      triggeredBy,
      status: "active",
      targetSwipeCount,
      expiresAt,
      memberCount,
      participantCount: 0,
      totalSwipes: 0,
    })
    .returning();

  console.log(
    `[SwipeSession] Created ${sessionType} session ${session.id} for group ${groupId} ` +
    `(${memberCount} members, expires in ${expiresInHours}h)`
  );

  return session.id;
}

/**
 * Record a swipe action and update session participation
 * Returns true if this is a new participant (first swipe in session)
 */
export async function recordSwipeInSession(
  sessionId: string,
  memberId: string,
  userId: string
): Promise<boolean> {
  // Check if this member has already participated in this session
  const existingSwipes = await db
    .select()
    .from(activitySwipes)
    .where(
      and(
        eq(activitySwipes.swipeSessionId, sessionId),
        eq(activitySwipes.memberId, memberId)
      )
    )
    .limit(1);

  const isNewParticipant = existingSwipes.length === 0;

  // Update session participation stats
  if (isNewParticipant) {
    await db
      .update(swipeSessions)
      .set({
        participantCount: sql`${swipeSessions.participantCount} + 1`,
        totalSwipes: sql`${swipeSessions.totalSwipes} + 1`,
      })
      .where(eq(swipeSessions.id, sessionId));
  } else {
    await db
      .update(swipeSessions)
      .set({
        totalSwipes: sql`${swipeSessions.totalSwipes} + 1`,
      })
      .where(eq(swipeSessions.id, sessionId));
  }

  return isNewParticipant;
}

/**
 * Calculate and store consensus results for a swipe session
 */
export async function calculateSessionConsensus(sessionId: string): Promise<void> {
  // Get all swipes for this session
  const swipes = await db
    .select()
    .from(activitySwipes)
    .where(eq(activitySwipes.swipeSessionId, sessionId));

  if (swipes.length === 0) {
    console.log(`[SwipeSession] No swipes found for session ${sessionId}`);
    return;
  }

  // Group swipes by item (activity or voting event)
  const itemSwipes: Record<string, { right: number; left: number; itemId: string; type: "activity" | "voting_event" }> = {};

  for (const swipe of swipes) {
    const itemId = swipe.activityId || swipe.votingEventId;
    if (!itemId) continue;

    const itemType = swipe.activityId ? "activity" : "voting_event";

    if (!itemSwipes[itemId]) {
      itemSwipes[itemId] = { right: 0, left: 0, itemId, type: itemType };
    }

    if (swipe.swipeDirection === "right") {
      itemSwipes[itemId].right++;
    } else {
      itemSwipes[itemId].left++;
    }
  }

  // Calculate consensus for each item
  const consensusResults: Record<string, { approval: number; totalSwipes: number }> = {};
  let totalApproval = 0;
  let itemCount = 0;

  for (const [itemId, counts] of Object.entries(itemSwipes)) {
    const totalSwipes = counts.right + counts.left;
    const approval = totalSwipes > 0 ? counts.right / totalSwipes : 0;

    consensusResults[itemId] = {
      approval: Math.round(approval * 100) / 100, // Round to 2 decimals
      totalSwipes,
    };

    totalApproval += approval;
    itemCount++;

    // Update consensus on the item itself
    if (counts.type === "activity") {
      await calculateActivityConsensus(itemId);
    } else {
      await calculateVotingEventConsensus(itemId);
    }
  }

  // Calculate average consensus across all items
  const averageConsensus = itemCount > 0 ? Math.round((totalApproval / itemCount) * 100) : null;

  // Update session with results
  await db
    .update(swipeSessions)
    .set({
      consensusResults,
      averageConsensus,
    })
    .where(eq(swipeSessions.id, sessionId));

  console.log(
    `[SwipeSession] Calculated consensus for session ${sessionId}: ` +
    `${itemCount} items, avg approval: ${averageConsensus}%`
  );
}

/**
 * Complete a swipe session (either manually or when target reached)
 */
export async function completeSwipeSession(sessionId: string): Promise<void> {
  // Calculate final consensus
  await calculateSessionConsensus(sessionId);

  // Get session data to check for prediction validation
  const [session] = await db
    .select()
    .from(swipeSessions)
    .where(eq(swipeSessions.id, sessionId));

  if (!session) {
    console.error(`[SwipeSession] Session ${sessionId} not found during completion`);
    return;
  }

  // Mark session as completed
  await db
    .update(swipeSessions)
    .set({
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(swipeSessions.id, sessionId));

  console.log(`[SwipeSession] Completed session ${sessionId}`);

  // If this session was for an auto-scheduled event, validate the confidence prediction
  if (session.autoEventId && session.averageConsensus !== null) {
    try {
      // Find the prediction for this event
      const { confidencePredictions } = await import('../shared/schema');
      const { isNull } = await import('drizzle-orm');

      const [prediction] = await db
        .select()
        .from(confidencePredictions)
        .where(
          and(
            eq(confidencePredictions.swipeSessionId, sessionId),
            isNull(confidencePredictions.validatedAt) // Not yet validated
          )
        )
        .limit(1);

      if (prediction) {
        const { validateConfidencePrediction } = await import('./confidence-scoring');
        await validateConfidencePrediction(
          prediction.id,
          session.averageConsensus,
          'swipe_session'
        );
      }
    } catch (error) {
      console.error(`[SwipeSession] Error validating prediction for session ${sessionId}:`, error);
    }
  }
}

/**
 * Expire stale swipe sessions (called by cron job)
 */
export async function expireStaleSwipeSessions(): Promise<number> {
  const now = new Date();

  // Find active sessions past expiration
  const staleSessions = await db
    .select()
    .from(swipeSessions)
    .where(
      and(
        eq(swipeSessions.status, "active"),
        sql`${swipeSessions.expiresAt} < ${now}`
      )
    );

  if (staleSessions.length === 0) {
    return 0;
  }

  // Calculate consensus and mark as expired
  for (const session of staleSessions) {
    await calculateSessionConsensus(session.id);

    await db
      .update(swipeSessions)
      .set({
        status: "expired",
        completedAt: now,
      })
      .where(eq(swipeSessions.id, session.id));
  }

  console.log(`[SwipeSession] Expired ${staleSessions.length} stale sessions`);
  return staleSessions.length;
}

/**
 * Get swipe session result
 */
export async function getSwipeSessionResult(sessionId: string): Promise<SwipeSessionResult | null> {
  const [session] = await db
    .select()
    .from(swipeSessions)
    .where(eq(swipeSessions.id, sessionId));

  if (!session) {
    return null;
  }

  return {
    sessionId: session.id,
    status: session.status as "active" | "completed" | "expired",
    participantCount: session.participantCount,
    totalSwipes: session.totalSwipes,
    averageConsensus: session.averageConsensus,
    consensusResults: session.consensusResults as Record<string, { approval: number; totalSwipes: number }> | null,
  };
}

/**
 * Get active swipe sessions for a group
 */
export async function getActiveSwipeSessions(groupId: string): Promise<SwipeSessionResult[]> {
  const sessions = await db
    .select()
    .from(swipeSessions)
    .where(
      and(
        eq(swipeSessions.groupId, groupId),
        eq(swipeSessions.status, "active")
      )
    );

  return sessions.map((session: typeof swipeSessions.$inferSelect) => ({
    sessionId: session.id,
    status: session.status as "active" | "completed" | "expired",
    participantCount: session.participantCount,
    totalSwipes: session.totalSwipes,
    averageConsensus: session.averageConsensus,
    consensusResults: session.consensusResults as Record<string, { approval: number; totalSwipes: number }> | null,
  }));
}

/**
 * Check if session should auto-complete (e.g., all members participated)
 */
export async function checkAndAutoCompleteSession(sessionId: string): Promise<boolean> {
  const [session] = await db
    .select()
    .from(swipeSessions)
    .where(eq(swipeSessions.id, sessionId));

  if (!session || session.status !== "active") {
    return false;
  }

  // Auto-complete if all members have participated
  if (session.participantCount >= session.memberCount && session.memberCount > 0) {
    await completeSwipeSession(sessionId);
    console.log(`[SwipeSession] Auto-completed session ${sessionId} (all ${session.memberCount} members participated)`);
    return true;
  }

  // Auto-complete if participation is high enough (80%+) and session has been active for 24+ hours
  const hoursActive = (Date.now() - session.createdAt.getTime()) / (1000 * 60 * 60);
  const participationRate = session.memberCount > 0 ? session.participantCount / session.memberCount : 0;

  if (hoursActive >= 24 && participationRate >= 0.8) {
    await completeSwipeSession(sessionId);
    console.log(
      `[SwipeSession] Auto-completed session ${sessionId} ` +
      `(${Math.round(participationRate * 100)}% participation after ${Math.round(hoursActive)}h)`
    );
    return true;
  }

  return false;
}
