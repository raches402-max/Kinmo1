/**
 * Confidence Scoring System for Auto-Scheduled Events
 * Calculates confidence (0-100) based on venue quality, time consensus, engagement, pattern matching, and swipe consensus
 */

import { storage as defaultStorage, type Storage } from "./storage";

export interface ConfidenceFactors {
  venueQuality: number; // 0-100 based on ratings, feedback, visit history
  timeConsensus: number; // 0-100 based on member availability
  groupEngagement: number; // 0-100 based on RSVP/attendance rates
  patternMatch: number; // 0-100 based on how well it fits learned preferences
  swipeConsensus: number | null; // 0-100 based on recent member swipes (null if no swipe data)
}

export interface ConfidenceWeights {
  venueQuality: number; // Default: 0.25
  timeConsensus: number; // Default: 0.25
  groupEngagement: number; // Default: 0.20
  patternMatch: number; // Default: 0.20
  swipeConsensus: number; // Default: 0.10
}

export interface ConfidenceResult {
  score: number; // Overall 0-100 score
  factors: ConfidenceFactors;
  plainLanguageSummary: string; // User-friendly description
  plainLanguageReasons: string[]; // Specific reasons for low/high confidence
}

/**
 * Calculate overall confidence score for an auto-scheduled event
 */
export async function calculateEventConfidence(
  storage: Storage,
  groupId: string,
  venues: Array<{
    sourceType: string;
    sourceId: string;
    venueName: string;
  }>,
  proposedDate: Date,
  membersAvailable?: number,
  totalMembers?: number
): Promise<ConfidenceResult> {
  // Get group-specific weights (or use defaults)
  const weights = await getGroupConfidenceWeights(groupId);

  // Calculate all factors in parallel
  const [venueQuality, timeConsensus, groupEngagement, patternMatch, swipeConsensus] = await Promise.all([
    calculateVenueQuality(storage, groupId, venues),
    calculateTimeConsensus(storage, groupId, proposedDate, membersAvailable, totalMembers),
    calculateGroupEngagement(storage, groupId),
    calculatePatternMatch(storage, groupId, venues),
    calculateSwipeConsensus(groupId, venues),
  ]);

  // Calculate weighted average
  // If swipeConsensus is null, redistribute its weight proportionally to other factors
  let score: number;
  if (swipeConsensus === null) {
    // No swipe data - redistribute swipe weight proportionally
    const redistributedWeights = redistributeWeights(weights, 'swipeConsensus');
    score = Math.round(
      venueQuality * redistributedWeights.venueQuality +
      timeConsensus * redistributedWeights.timeConsensus +
      groupEngagement * redistributedWeights.groupEngagement +
      patternMatch * redistributedWeights.patternMatch
    );
  } else {
    // Have swipe data - use all factors
    score = Math.round(
      venueQuality * weights.venueQuality +
      timeConsensus * weights.timeConsensus +
      groupEngagement * weights.groupEngagement +
      patternMatch * weights.patternMatch +
      swipeConsensus * weights.swipeConsensus
    );
  }

  const factors: ConfidenceFactors = {
    venueQuality,
    timeConsensus,
    groupEngagement,
    patternMatch,
    swipeConsensus,
  };

  const { plainLanguageSummary, plainLanguageReasons } = generatePlainLanguage(score, factors);

  return {
    score,
    factors,
    plainLanguageSummary,
    plainLanguageReasons,
  };
}

/**
 * Calculate venue quality score (0-100)
 * Based on: ratings, past feedback, visit frequency, new vs familiar
 */
async function calculateVenueQuality(
  storage: Storage,
  groupId: string,
  venues: Array<{ sourceType: string; sourceId: string; venueName: string }>
): Promise<number> {
  const scores: number[] = [];

  for (const venue of venues) {
    let venueScore = 50; // Start at neutral

    // Check if venue is from an activity
    if (venue.sourceType === 'activity' && venue.sourceId) {
      const activity = await storage.getActivity(venue.sourceId);

      if (activity) {
        // High rating bonus
        const rating = activity.rating ? parseFloat(activity.rating) : 0;
        if (rating >= 4.5) venueScore += 20;
        else if (rating >= 4.0) venueScore += 10;
        else if (rating >= 3.5) venueScore += 5;

        // Upvote/downvote ratio
        const totalVotes = (activity.upvotes || 0) + (activity.downvotes || 0);
        if (totalVotes > 0) {
          const upvoteRatio = (activity.upvotes || 0) / totalVotes;
          venueScore += Math.round(upvoteRatio * 20);
        }

        // Saved status (favorite)
        if (activity.isSaved) venueScore += 15;
      }
    }

    // Check visit history
    const visitHistory = await storage.getVenueVisitHistory(groupId);
    const venueVisits = visitHistory.filter((v: any) =>
      v.venueName?.toLowerCase() === venue.venueName?.toLowerCase()
    );

    if (venueVisits.length > 0) {
      // Familiar venue - check if recent
      const mostRecentVisit = new Date(Math.max(...venueVisits.map((v: any) => new Date(v.visitDate).getTime())));
      const daysSinceVisit = Math.floor((Date.now() - mostRecentVisit.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceVisit < 30) {
        venueScore -= 20; // Too recent, lower confidence
      } else if (daysSinceVisit > 60) {
        venueScore += 10; // Good rotation timing
      }
    } else {
      // New venue - slightly lower confidence
      venueScore -= 5;
    }

    scores.push(Math.max(0, Math.min(100, venueScore)));
  }

  return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;
}

/**
 * Calculate time consensus score (0-100)
 * Based on: member availability, scheduling density, day of week patterns
 */
async function calculateTimeConsensus(
  storage: Storage,
  groupId: string,
  proposedDate: Date,
  membersAvailable?: number,
  totalMembers?: number
): Promise<number> {
  let score = 50; // Start at neutral

  // If we have availability data
  if (membersAvailable !== undefined && totalMembers !== undefined && totalMembers > 0) {
    const availabilityPercent = (membersAvailable / totalMembers) * 100;

    if (availabilityPercent >= 80) score += 40;
    else if (availabilityPercent >= 70) score += 30;
    else if (availabilityPercent >= 60) score += 20;
    else if (availabilityPercent >= 50) score += 10;
    else score -= 20; // Low availability is a red flag
  }

  // Check for existing nearby events (avoid over-scheduling)
  const group = await storage.getGroup(groupId);
  if (group) {
    const existingEvents = await storage.getUserUpcomingEventsWithTimeSlots(group.userId);

    // Count events within 7 days of proposed date
    const proposedTime = proposedDate.getTime();
    const nearbyEvents = existingEvents.filter((event: any) => {
      const eventTime = new Date(event.eventDate).getTime();
      const daysDiff = Math.abs((eventTime - proposedTime) / (1000 * 60 * 60 * 24));
      return daysDiff <= 7;
    });

    if (nearbyEvents.length >= 2) {
      score -= 15; // Too many events close together
    } else if (nearbyEvents.length === 1) {
      score -= 5; // One nearby event is OK but note it
    } else {
      score += 10; // Good spacing
    }
  }

  // Day of week bonus (weekends generally better)
  const dayOfWeek = proposedDate.getDay();
  if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday or Saturday
    score += 10;
  } else if (dayOfWeek === 0) { // Sunday
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate group engagement score (0-100)
 * Based on: RSVP response rates, attendance rates, recent activity
 */
async function calculateGroupEngagement(
  storage: Storage,
  groupId: string
): Promise<number> {
  const members = await storage.getMembers(groupId);

  if (members.length === 0) return 50; // Neutral for new groups

  let totalResponseRate = 0;
  let totalAttendanceRate = 0;
  let membersWithData = 0;

  for (const member of members) {
    const rsvps = await storage.getMemberRSVPs(member.id);

    if (rsvps.length > 0) {
      membersWithData++;

      // Response rate: how often they respond to invites
      const responseRate = rsvps.length > 0 ? 100 : 0;
      totalResponseRate += responseRate;

      // Attendance rate: how often "yes" RSVPs result in actual attendance
      const yesRsvps = rsvps.filter((r: any) => r.response === 'yes');
      const attended = yesRsvps.filter((r: any) => r.attended === true);
      const attendanceRate = yesRsvps.length > 0
        ? (attended.length / yesRsvps.length) * 100
        : 50;
      totalAttendanceRate += attendanceRate;
    }
  }

  if (membersWithData === 0) return 50; // Neutral for no historical data

  const avgResponseRate = totalResponseRate / membersWithData;
  const avgAttendanceRate = totalAttendanceRate / membersWithData;

  // Weight: 40% response rate, 60% attendance rate
  const score = Math.round(avgResponseRate * 0.4 + avgAttendanceRate * 0.6);

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate pattern match score (0-100)
 * Based on: venue type preferences, budget alignment, location preferences
 */
async function calculatePatternMatch(
  storage: Storage,
  groupId: string,
  venues: Array<{ sourceType: string; sourceId: string; venueName: string }>
): Promise<number> {
  let score = 50; // Start at neutral

  const group = await storage.getGroup(groupId);
  if (!group) return score;

  // Check if venue types are enabled
  const venueTypes = new Set<string>();
  for (const venue of venues) {
    if (venue.sourceType === 'activity' && venue.sourceId) {
      const activity = await storage.getActivity(venue.sourceId);
      if (activity?.venueType) {
        venueTypes.add(activity.venueType);
      }
    }
  }

  // Check if all venue types are enabled in group settings
  const typeEnabled = {
    'Meal': group.mealEnabled,
    'Drinks': group.drinksEnabled,
    'Cafe': group.cafeEnabled,
    'Dessert': group.dessertEnabled,
    'Experience': group.experiencesEnabled,
  };

  for (const type of venueTypes) {
    const enabled = typeEnabled[type as keyof typeof typeEnabled];
    if (enabled === false) {
      score -= 20; // Suggesting disabled venue type is bad
    } else if (enabled === true) {
      score += 10; // Matching enabled types is good
    }
  }

  // Check visit history to see if these types have been popular
  const visitHistory = await storage.getVenueVisitHistory(groupId);
  const recentVisits = visitHistory.slice(-10); // Last 10 visits

  if (recentVisits.length > 0) {
    const recentTypes = new Set(recentVisits.map((v: any) => v.venueType).filter(Boolean));
    for (const type of venueTypes) {
      if (recentTypes.has(type)) {
        score += 5; // Matches recent patterns
      }
    }
  }

  // Check if venues match group location preferences
  const members = await storage.getMembers(groupId);
  const locationPrefs = members
    .map((m: any) => m.memberLocation)
    .filter(Boolean);

  if (locationPrefs.length > 0) {
    // If group has location preferences, slight bonus for now
    // (Could be enhanced with actual distance checking)
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate plain language summary and reasons based on score and factors
 */
function generatePlainLanguage(
  score: number,
  factors: ConfidenceFactors
): { plainLanguageSummary: string; plainLanguageReasons: string[] } {
  const reasons: string[] = [];

  // Analyze venue quality
  if (factors.venueQuality < 50) {
    reasons.push("Trying a new type of venue for your group");
  } else if (factors.venueQuality >= 80) {
    reasons.push("High-rated venues your group loves");
  }

  // Analyze time consensus
  if (factors.timeConsensus < 50) {
    reasons.push("Limited availability data for this time slot");
  } else if (factors.timeConsensus >= 80) {
    reasons.push("Great time slot with high member availability");
  }

  // Analyze engagement
  if (factors.groupEngagement < 50) {
    reasons.push("Some members have been less responsive lately");
  } else if (factors.groupEngagement >= 80) {
    reasons.push("Group is highly engaged and active");
  }

  // Analyze pattern match
  if (factors.patternMatch < 50) {
    reasons.push("Venue type doesn't match usual group preferences");
  } else if (factors.patternMatch >= 80) {
    reasons.push("Perfect match for your group's preferences");
  }

  // Analyze swipe consensus (if available)
  if (factors.swipeConsensus !== null) {
    if (factors.swipeConsensus < 40) {
      reasons.push("Members swiped left on similar venues");
    } else if (factors.swipeConsensus >= 70) {
      reasons.push("Members loved similar venues in swipe votes");
    }
  }

  // Generate summary
  let summary: string;
  if (score >= 85) {
    summary = "Great fit for your group";
  } else if (score >= 70) {
    summary = "Good match with minor uncertainties";
  } else if (score >= 50) {
    summary = "Decent option but worth reviewing";
  } else {
    summary = "Uncertain - your review recommended";
  }

  return { plainLanguageSummary: summary, plainLanguageReasons: reasons };
}

/**
 * Determine if event should be flagged for review based on confidence and group settings
 */
export function shouldRequireReview(
  score: number,
  group: {
    automationLevel: string;
    confidenceThreshold: number;
    automationPaused: boolean;
    reviewEveryNthEvent: number | null;
    eventCountSinceLastReview: number;
  }
): { requiresReview: boolean; reason: string | null } {
  // Always review if automation is paused
  if (group.automationPaused) {
    return { requiresReview: true, reason: 'automation_paused' };
  }

  // Check review sampling (every Nth event)
  if (group.reviewEveryNthEvent && group.eventCountSinceLastReview >= group.reviewEveryNthEvent - 1) {
    return { requiresReview: true, reason: 'scheduled_review' };
  }

  // Suggest-only mode always requires review
  if (group.automationLevel === 'suggest_only') {
    return { requiresReview: true, reason: 'suggest_only_mode' };
  }

  // Full-auto mode never requires review (unless paused or sampling)
  if (group.automationLevel === 'full_auto') {
    return { requiresReview: false, reason: null };
  }

  // Smart mode: check confidence threshold
  if (group.automationLevel === 'smart') {
    if (score < group.confidenceThreshold) {
      return { requiresReview: true, reason: 'low_confidence' };
    }
  }

  return { requiresReview: false, reason: null };
}

/**
 * Get group-specific confidence weights or return defaults
 * Exported for use by calibration system
 */
export async function getGroupConfidenceWeights(groupId: string): Promise<ConfidenceWeights> {
  const { db } = await import('./db');
  const { groupConfidenceWeights } = await import('../shared/schema');
  const { eq } = await import('drizzle-orm');

  // Try to get existing weights
  const existingWeights = await db
    .select()
    .from(groupConfidenceWeights)
    .where(eq(groupConfidenceWeights.groupId, groupId))
    .limit(1);

  if (existingWeights.length > 0) {
    const w = existingWeights[0];
    return {
      venueQuality: w.venueQualityWeight,
      timeConsensus: w.timeConsensusWeight,
      groupEngagement: w.groupEngagementWeight,
      patternMatch: w.patternMatchWeight,
      swipeConsensus: w.swipeConsensusWeight,
    };
  }

  // Create default weights for this group
  const defaultWeights: ConfidenceWeights = {
    venueQuality: 0.25,
    timeConsensus: 0.25,
    groupEngagement: 0.20,
    patternMatch: 0.20,
    swipeConsensus: 0.10,
  };

  await db
    .insert(groupConfidenceWeights)
    .values({
      groupId,
      venueQualityWeight: defaultWeights.venueQuality,
      timeConsensusWeight: defaultWeights.timeConsensus,
      groupEngagementWeight: defaultWeights.groupEngagement,
      patternMatchWeight: defaultWeights.patternMatch,
      swipeConsensusWeight: defaultWeights.swipeConsensus,
    })
    .onConflictDoNothing(); // Handle race condition if multiple requests create at once

  return defaultWeights;
}

/**
 * Redistribute weights when a factor is missing (e.g., no swipe data yet)
 */
function redistributeWeights(
  weights: ConfidenceWeights,
  excludeFactor: keyof ConfidenceWeights
): ConfidenceWeights {
  const excludedWeight = weights[excludeFactor];
  const remainingWeight = 1 - excludedWeight;

  if (remainingWeight === 0) {
    // Shouldn't happen, but handle gracefully
    return weights;
  }

  // Calculate redistribution factor
  const redistributionFactor = 1 / remainingWeight;

  const redistributed: ConfidenceWeights = {
    venueQuality: weights.venueQuality * redistributionFactor,
    timeConsensus: weights.timeConsensus * redistributionFactor,
    groupEngagement: weights.groupEngagement * redistributionFactor,
    patternMatch: weights.patternMatch * redistributionFactor,
    swipeConsensus: 0,
  };

  // Zero out the excluded factor
  redistributed[excludeFactor] = 0;

  return redistributed;
}

/**
 * Calculate swipe consensus score (0-100) based on recent member swipes on similar venues
 * Returns null if no swipe data is available for these venues
 */
async function calculateSwipeConsensus(
  groupId: string,
  venues: Array<{ sourceType: string; sourceId: string; venueName: string }>
): Promise<number | null> {
  const { db } = await import('./db');
  const { activities, votingEvents } = await import('../shared/schema');
  const { eq, and, inArray } = await import('drizzle-orm');

  // Collect venue IDs based on sourceType
  const activityIds: string[] = [];
  const votingEventIds: string[] = [];

  for (const venue of venues) {
    if (venue.sourceType === 'activity') {
      activityIds.push(venue.sourceId);
    } else if (venue.sourceType === 'voting_event') {
      votingEventIds.push(venue.sourceId);
    }
  }

  const consensusScores: number[] = [];

  // Get consensus for activities
  if (activityIds.length > 0) {
    const activityData = await db
      .select({ swipeConsensus: activities.swipeConsensus })
      .from(activities)
      .where(
        and(
          eq(activities.groupId, groupId),
          inArray(activities.id, activityIds)
        )
      );

    for (const activity of activityData) {
      if (activity.swipeConsensus !== null) {
        consensusScores.push(activity.swipeConsensus);
      }
    }
  }

  // Get consensus for voting events
  if (votingEventIds.length > 0) {
    const votingEventData = await db
      .select({ swipeConsensus: votingEvents.swipeConsensus })
      .from(votingEvents)
      .where(
        and(
          eq(votingEvents.groupId, groupId),
          inArray(votingEvents.id, votingEventIds)
        )
      );

    for (const event of votingEventData) {
      if (event.swipeConsensus !== null) {
        consensusScores.push(event.swipeConsensus);
      }
    }
  }

  // If no swipe data, return null
  if (consensusScores.length === 0) {
    return null;
  }

  // Calculate average consensus
  const avgConsensus = consensusScores.reduce((sum, score) => sum + score, 0) / consensusScores.length;

  // Return score 0-100 (consensus is already 0-100)
  return Math.round(avgConsensus);
}

/**
 * Log a confidence prediction for later calibration
 * Should be called whenever confidence is calculated for an event
 */
export async function logConfidencePrediction(
  groupId: string,
  autoEventId: string | null,
  swipeSessionId: string | null,
  confidenceResult: ConfidenceResult,
  weights: ConfidenceWeights
): Promise<string> {
  const { db } = await import('./db');
  const { confidencePredictions } = await import('../shared/schema');

  const [prediction] = await db
    .insert(confidencePredictions)
    .values({
      groupId,
      autoEventId,
      swipeSessionId,
      predictedConfidence: confidenceResult.score,
      predictedFactors: confidenceResult.factors,
      factorWeights: weights,
      validationSource: null,
      actualConsensus: null,
      predictionError: null,
      wasAccurate: null,
      validatedAt: null,
    })
    .returning();

  return prediction.id;
}

/**
 * Update a confidence prediction with actual results (from swipe session or RSVP data)
 * This completes the feedback loop for calibration
 */
export async function validateConfidencePrediction(
  predictionId: string,
  actualConsensus: number,
  validationSource: 'swipe_session' | 'rsvp_rate' | 'attendance_rate'
): Promise<void> {
  const { db } = await import('./db');
  const { confidencePredictions } = await import('../shared/schema');
  const { eq } = await import('drizzle-orm');

  // Get the prediction to calculate error
  const [prediction] = await db
    .select()
    .from(confidencePredictions)
    .where(eq(confidencePredictions.id, predictionId))
    .limit(1);

  if (!prediction) {
    console.error(`[ConfidencePrediction] Prediction ${predictionId} not found`);
    return;
  }

  const predictionError = Math.abs(prediction.predictedConfidence - actualConsensus);
  const wasAccurate = predictionError <= 15; // Within 15 points = accurate

  await db
    .update(confidencePredictions)
    .set({
      actualConsensus,
      validationSource,
      predictionError,
      wasAccurate,
      validatedAt: new Date(),
    })
    .where(eq(confidencePredictions.id, predictionId));

  console.log(
    `[ConfidencePrediction] Validated prediction ${predictionId}: ` +
    `predicted=${prediction.predictedConfidence}, actual=${actualConsensus}, ` +
    `error=${predictionError}, accurate=${wasAccurate}`
  );

  // Check if we should trigger calibration for this group
  const { shouldTriggerCalibration, calibrateGroupWeights } = await import('./confidence-calibration');

  if (await shouldTriggerCalibration(prediction.groupId)) {
    console.log(`[ConfidencePrediction] Triggering calibration for group ${prediction.groupId}`);

    // Run calibration asynchronously (don't block validation)
    calibrateGroupWeights(prediction.groupId).catch((error) => {
      console.error(`[ConfidencePrediction] Calibration error for group ${prediction.groupId}:`, error);
    });
  }
}
