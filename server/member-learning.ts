/**
 * Member Learning System
 *
 * Automatically learns from member behavior and updates preferences:
 * - RSVP patterns → member constraints (budget, location, schedule)
 * - Attendance tracking → engagement scoring
 */

import { db } from './db.js';
import { members as membersTable, rsvps as rsvpsTable, itineraries } from '../shared/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

// RSVP Response Helpers (normalize legacy values)
function isPositiveRsvp(response: string | null | undefined): boolean {
  if (!response) return false;
  const r = response.toLowerCase();
  return r === 'yes' || r === 'going';
}

// ============================================================================
// TYPES
// ============================================================================

export interface MemberConstraints {
  scheduleConflicts?: string[];
  budgetConcern?: boolean;
  distanceConcern?: boolean;
  notes?: string;
}

export interface EngagementScore {
  memberId: string;
  groupId: string;
  rsvpResponseRate: number;  // 0-100: % of invites responded to
  attendanceRate: number;    // 0-100: % of "yes" RSVPs that actually attended
  lastActiveDate: Date | null;
  totalInvites: number;
  totalResponded: number;
  totalAttended: number;
  status: 'active' | 'at-risk' | 'inactive';
}

export interface RSVPPattern {
  budgetConcernCount: number;
  locationConcernCount: number;
  timeConcernCount: number;
  unavailableDays: string[];
  totalRSVPs: number;
  shouldUpdateConstraints: boolean;
}

// ============================================================================
// RSVP PATTERN ANALYSIS
// ============================================================================

/**
 * Analyzes RSVP feedback patterns to detect member preferences
 *
 * Conservative threshold: 4+ occurrences OR 50%+ of last 10 RSVPs
 *
 * @param memberId - Member to analyze
 * @param groupId - Group context
 * @returns Pattern analysis with recommendation to update constraints
 */
export async function analyzeRSVPPatterns(
  memberId: string,
  groupId: string
): Promise<RSVPPattern> {
  // Get last 10 RSVPs for this member in this group
  const recentRSVPs = await db
    .select({
      id: rsvpsTable.id,
      response: rsvpsTable.response,
      rsvpFeedback: rsvpsTable.rsvpFeedback,
      createdAt: rsvpsTable.createdAt,
    })
    .from(rsvpsTable)
    .innerJoin(itineraries, eq(rsvpsTable.itineraryId, itineraries.id))
    .where(
      and(
        eq(rsvpsTable.memberId, memberId),
        eq(itineraries.groupId, groupId)
      )
    )
    .orderBy(desc(rsvpsTable.createdAt))
    .limit(10);

  // Count pattern occurrences
  let budgetConcernCount = 0;
  let locationConcernCount = 0;
  let timeConcernCount = 0;
  const unavailableDays: string[] = [];

  for (const rsvp of recentRSVPs) {
    if (rsvp.rsvpFeedback) {
      const feedback = rsvp.rsvpFeedback as any;

      if (feedback.budgetConcern) budgetConcernCount++;
      if (feedback.locationConcern) locationConcernCount++;
      if (feedback.timeConcern) timeConcernCount++;
      if (feedback.unavailableOn) {
        unavailableDays.push(feedback.unavailableOn);
      }
    }
  }

  const totalRSVPs = recentRSVPs.length;
  const threshold = Math.max(4, Math.ceil(totalRSVPs * 0.5)); // 4+ OR 50%+

  // Determine if we should update constraints
  const shouldUpdateConstraints =
    budgetConcernCount >= threshold ||
    locationConcernCount >= threshold ||
    timeConcernCount >= threshold ||
    unavailableDays.length >= threshold;

  return {
    budgetConcernCount,
    locationConcernCount,
    timeConcernCount,
    unavailableDays,
    totalRSVPs,
    shouldUpdateConstraints,
  };
}

/**
 * Auto-updates member constraints based on RSVP patterns
 *
 * Only updates if patterns meet conservative threshold (4+ or 50%)
 * Updates silently without user confirmation
 *
 * @param memberId - Member to update
 * @param groupId - Group context
 * @returns true if constraints were updated
 */
export async function autoUpdateMemberConstraints(
  memberId: string,
  groupId: string
): Promise<boolean> {
  const patterns = await analyzeRSVPPatterns(memberId, groupId);

  if (!patterns.shouldUpdateConstraints) {
    return false; // No strong patterns detected
  }

  // Get current member data
  const member = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, memberId))
    .limit(1);

  if (member.length === 0) {
    console.error(`Member ${memberId} not found`);
    return false;
  }

  const currentConstraints = (member[0].memberConstraints || {}) as MemberConstraints;

  // Build updated constraints
  const updatedConstraints: MemberConstraints = {
    ...currentConstraints,
  };

  // Update budget concern if pattern detected
  const budgetThreshold = Math.max(4, Math.ceil(patterns.totalRSVPs * 0.5));
  if (patterns.budgetConcernCount >= budgetThreshold) {
    updatedConstraints.budgetConcern = true;
  }

  // Update distance concern if pattern detected
  const locationThreshold = Math.max(4, Math.ceil(patterns.totalRSVPs * 0.5));
  if (patterns.locationConcernCount >= locationThreshold) {
    updatedConstraints.distanceConcern = true;
  }

  // Update schedule conflicts if day patterns detected
  if (patterns.unavailableDays.length >= budgetThreshold) {
    // Extract unique days mentioned
    const daySet = new Set(patterns.unavailableDays.map(d => d.trim()));
    const existingConflicts = currentConstraints.scheduleConflicts || [];
    const mergedConflicts = Array.from(new Set([...existingConflicts, ...Array.from(daySet)]));
    updatedConstraints.scheduleConflicts = mergedConflicts;
  }

  // Add auto-learning note
  const autoNote = 'Auto-detected from RSVP patterns';
  if (currentConstraints.notes && !currentConstraints.notes.includes(autoNote)) {
    updatedConstraints.notes = `${currentConstraints.notes}; ${autoNote}`;
  } else if (!currentConstraints.notes) {
    updatedConstraints.notes = autoNote;
  }

  // Update member constraints
  await db
    .update(membersTable)
    .set({
      memberConstraints: updatedConstraints,
      updatedAt: new Date(),
    })
    .where(eq(membersTable.id, memberId));

  console.log(`✅ Auto-updated constraints for member ${memberId}:`, {
    budgetConcern: updatedConstraints.budgetConcern,
    distanceConcern: updatedConstraints.distanceConcern,
    scheduleConflicts: updatedConstraints.scheduleConflicts,
  });

  return true;
}

// ============================================================================
// ENGAGEMENT SCORING
// ============================================================================

/**
 * Calculates engagement score for a member in a group
 *
 * Metrics:
 * - RSVP response rate: % of invites that got a response
 * - Attendance rate: % of "yes" RSVPs that actually attended
 * - Status: active (≥60%), at-risk (30-60%), inactive (<30%)
 *
 * @param memberId - Member to score
 * @param groupId - Group context
 * @returns Engagement score with status
 */
export async function calculateEngagement(
  memberId: string,
  groupId: string
): Promise<EngagementScore> {
  // Get all RSVPs for this member in this group (last 50 max for performance)
  const allRSVPs = await db
    .select({
      id: rsvpsTable.id,
      response: rsvpsTable.response,
      postEventFeedback: rsvpsTable.postEventFeedback,
      createdAt: rsvpsTable.createdAt,
    })
    .from(rsvpsTable)
    .innerJoin(itineraries, eq(rsvpsTable.itineraryId, itineraries.id))
    .where(
      and(
        eq(rsvpsTable.memberId, memberId),
        eq(itineraries.groupId, groupId)
      )
    )
    .orderBy(desc(rsvpsTable.createdAt))
    .limit(50);

  const totalInvites = allRSVPs.length;

  // Count responses (any non-null response)
  const responded = allRSVPs.filter(r => r.response !== null && r.response !== undefined);
  const totalResponded = responded.length;

  // Count attendance (actually attended after saying yes)
  const yesRSVPs = allRSVPs.filter(r => isPositiveRsvp(r.response));
  const attended = allRSVPs.filter(r => {
    if (!r.postEventFeedback) return false;
    const feedback = r.postEventFeedback as any;
    return feedback.actuallyAttended === true;
  });
  const totalAttended = attended.length;

  // Calculate rates
  const rsvpResponseRate = totalInvites > 0
    ? (totalResponded / totalInvites) * 100
    : 0;

  const attendanceRate = yesRSVPs.length > 0
    ? (totalAttended / yesRSVPs.length) * 100
    : 0;

  // Determine status based on response rate
  let status: 'active' | 'at-risk' | 'inactive';
  if (rsvpResponseRate < 30) {
    status = 'inactive';
  } else if (rsvpResponseRate < 60) {
    status = 'at-risk';
  } else {
    status = 'active';
  }

  // Find last active date
  const lastActiveDate = allRSVPs.length > 0 ? allRSVPs[0].createdAt : null;

  return {
    memberId,
    groupId,
    rsvpResponseRate: Math.round(rsvpResponseRate * 10) / 10, // Round to 1 decimal
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    lastActiveDate,
    totalInvites,
    totalResponded,
    totalAttended,
    status,
  };
}

/**
 * Calculates engagement for all members in a group
 *
 * Useful for organizer dashboards and group health monitoring
 *
 * @param groupId - Group to analyze
 * @returns Array of engagement scores sorted by status (inactive first)
 */
export async function calculateGroupEngagement(
  groupId: string
): Promise<EngagementScore[]> {
  // Get all members in this group
  const groupMembers = await db
    .select({ id: membersTable.id })
    .from(membersTable)
    .where(eq(membersTable.groupId, groupId));

  // Calculate engagement for each member
  const engagementScores = await Promise.all(
    groupMembers.map(member => calculateEngagement(member.id, groupId))
  );

  // Sort by status (inactive → at-risk → active) then by response rate
  const statusOrder = { inactive: 0, 'at-risk': 1, active: 2 };
  return engagementScores.sort((a, b) => {
    if (a.status !== b.status) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.rsvpResponseRate - b.rsvpResponseRate;
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets inactive members for a group (response rate < 30%)
 *
 * @param groupId - Group to check
 * @returns Array of inactive member IDs with their engagement scores
 */
export async function getInactiveMembers(
  groupId: string
): Promise<EngagementScore[]> {
  const allEngagement = await calculateGroupEngagement(groupId);
  return allEngagement.filter(e => e.status === 'inactive');
}

/**
 * Logs engagement summary for debugging/monitoring
 *
 * @param groupId - Group to summarize
 */
export async function logEngagementSummary(groupId: string): Promise<void> {
  const scores = await calculateGroupEngagement(groupId);

  const active = scores.filter(s => s.status === 'active').length;
  const atRisk = scores.filter(s => s.status === 'at-risk').length;
  const inactive = scores.filter(s => s.status === 'inactive').length;

  console.log(`📊 Engagement Summary for Group ${groupId}:`);
  console.log(`   ✅ Active: ${active} members`);
  console.log(`   ⚠️  At-Risk: ${atRisk} members`);
  console.log(`   ❌ Inactive: ${inactive} members`);

  if (inactive > 0) {
    console.log(`\n   Inactive members:`);
    scores
      .filter(s => s.status === 'inactive')
      .forEach(s => {
        console.log(`      - ${s.memberId}: ${s.rsvpResponseRate}% response rate`);
      });
  }
}
