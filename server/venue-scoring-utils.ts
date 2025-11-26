/**
 * Venue Scoring Utilities
 *
 * Reusable functions for calculating venue quality, freshness, and overall scores.
 * Extracted from auto-scheduler.ts to support both algorithmic selection and AI agents.
 */

export interface VenueVisitStats {
  visitCount: number;
  daysSinceLastVisit: number;
}

/**
 * Calculate quality score based on user feedback
 * Higher scores for favorites, upvotes, and more_like_this
 */
export function calculateQualityScore(feedback: string | null): number {
  if (feedback === 'favorite') return 3;
  if (feedback === 'more_like_this') return 2.5;
  if (feedback === 'upvote') return 2;
  return 1; // neutral
}

/**
 * Calculate quality score for voting events based on upvotes/downvotes
 * Base score of 2 (favorites are already vetted) + bonus for net upvotes
 * PLUS +1.0 Favorites boost to prioritize group-validated venues
 */
export function calculateVotingEventQuality(upvotes: number, downvotes: number): number {
  const netVotes = upvotes - downvotes;

  // Skip if more downvotes than upvotes
  if (netVotes < 0) {
    return -1; // Signal to skip this venue
  }

  // +0.5 for each net upvote (capped at +1.5 for 3+ upvotes)
  const upvoteBonus = Math.min(netVotes * 0.5, 1.5);
  const baseScore = Math.max(1, 2 + upvoteBonus); // Min 1, typical 2-3.5

  // +1.0 boost for being a Favorite (group-validated venue)
  return baseScore + 1.0; // Now min 2, typical 3-4.5
}

/**
 * Calculate bonus for never-visited venues
 * Never visited = 3x multiplier to encourage trying new places
 */
export function calculateNeverVisitedBonus(visitCount: number): number {
  return visitCount === 0 ? 3 : 1;
}

/**
 * Calculate recency bonus based on days since last visit
 * More days = higher bonus (max 2x at 60+ days)
 */
export function calculateRecencyBonus(daysSinceLastVisit: number): number {
  return Math.min(daysSinceLastVisit / 30, 2);
}

/**
 * Calculate frequency penalty for repeatedly visited venues
 * Halve score for each visit to encourage variety
 */
export function calculateFrequencyPenalty(visitCount: number): number {
  return Math.pow(0.5, visitCount);
}

/**
 * Calculate days since last visit from timestamp
 */
export function calculateDaysSinceVisit(lastVisitTimestamp: number | null): number {
  if (!lastVisitTimestamp) return 999; // Never visited

  const now = Date.now();
  return (now - lastVisitTimestamp) / (1000 * 60 * 60 * 24);
}

/**
 * Calculate overall venue score combining all factors
 */
export function calculateVenueScore(
  qualityScore: number,
  visitCount: number,
  daysSinceLastVisit: number
): number {
  const neverVisitedBonus = calculateNeverVisitedBonus(visitCount);
  const recencyBonus = calculateRecencyBonus(daysSinceLastVisit);
  const frequencyPenalty = calculateFrequencyPenalty(visitCount);

  return qualityScore * neverVisitedBonus * recencyBonus * frequencyPenalty;
}

/**
 * Check if venue should be skipped (closed or downvoted)
 */
export function shouldSkipVenue(
  businessStatus: string | null,
  feedback: string | null,
  netVotes?: number
): boolean {
  // Skip closed venues
  if (businessStatus === 'CLOSED_PERMANENTLY' || businessStatus === 'CLOSED_TEMPORARILY') {
    return true;
  }

  // Skip downvoted activities
  if (feedback === 'downvote' || feedback === 'not_this' || feedback === 'pass') {
    return true;
  }

  // Skip voting events with net downvotes
  if (netVotes !== undefined && netVotes < 0) {
    return true;
  }

  return false;
}

/**
 * Calculate visit statistics from raw data
 */
export function getVisitStats(
  stats: { count: number; lastVisit: Date | string } | undefined
): VenueVisitStats {
  const visitCount = stats?.count || 0;
  const lastVisit = stats?.lastVisit ? new Date(stats.lastVisit).getTime() : 0;
  const daysSinceLastVisit = calculateDaysSinceVisit(lastVisit || null);

  return { visitCount, daysSinceLastVisit };
}
