/**
 * Planning Agent Types
 *
 * Defines types for the proactive AI planning agent that observes patterns
 * and generates actionable insights for groups.
 */

// Insight types that analyzers can generate
export type InsightType =
  | 'location_fairness'    // Meeting locations favor some members over others
  | 'venue_gap'            // Upcoming event has no venue assigned
  | 'date_clustering'      // Too many events clustered together
  | 'member_inclusion'     // Member hasn't attended or has conflicts
  | 'cadence_health';      // Group not meeting at stated frequency

// How urgent/important the insight is
export type InsightSeverity = 'info' | 'suggestion' | 'action_needed';

// Who should see this insight
export type AudienceType = 'organizer' | 'member' | 'all';

// What action the agent can take
export type ActionType =
  | 'suggest_venue'        // Pre-populate venue suggestions
  | 'create_draft'         // Create a draft event
  | 'send_nudge'           // Send notification to member/organizer
  | 'adjust_cadence';      // Suggest changing meeting frequency

// Status of action taken
export type ActionStatus = 'none' | 'suggested' | 'auto_acted' | 'user_acted';

/**
 * Raw insight data from an analyzer before LLM message generation
 */
export interface RawInsight {
  type: InsightType;
  severity: InsightSeverity;
  audienceType: AudienceType;

  // Targeting
  groupId: string;
  memberId?: string; // If insight is member-specific

  // Structured data from analysis
  metadata: Record<string, any>;

  // Suggested action
  suggestedAction?: {
    type: ActionType;
    params: Record<string, any>;
  };

  // For deduplication - unique key to avoid duplicate insights
  deduplicationKey: string;

  // When this insight should expire
  expiresAt?: Date;
}

/**
 * Complete insight ready for storage/display
 */
export interface PlanningInsightData {
  groupId: string;
  memberId?: string;

  insightType: InsightType;
  severity: InsightSeverity;
  audienceType: AudienceType;

  // LLM-generated content
  title: string;
  message: string;

  // Structured data
  metadata: Record<string, any>;

  // Action details
  actionType?: ActionType;
  actionTaken: ActionStatus;
  actionDetails?: Record<string, any>;
  actionUrl?: string;
  actionLabel?: string;

  expiresAt?: Date;
}

/**
 * Location data for fairness analysis
 */
export interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  visitCount: number;
  lastVisitDate?: Date;
}

export interface MemberLocationData {
  memberId: string;
  memberName: string;
  homeLocation?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  averageDistanceToVenues: number; // miles
  totalEventsWithLocation: number;
}

/**
 * Location fairness analysis result
 */
export interface LocationFairnessAnalysis {
  // Location breakdown
  locationCounts: Record<string, number>; // area name -> visit count
  recentLocations: string[]; // Last N venues' areas

  // Member distances
  memberDistances: MemberLocationData[];

  // Identified issues
  dominantArea?: string; // If one area is overrepresented
  underservedMember?: {
    memberId: string;
    memberName: string;
    averageDistance: number;
    nearbyArea: string;
  };

  // Suggestion
  suggestedArea?: string;
}

/**
 * Venue/date gap analysis result
 */
export interface VenueDateGapAnalysis {
  // Events without venues
  eventsWithoutVenues: {
    eventId: string;
    eventName: string;
    eventDate: Date;
    daysUntil: number;
  }[];

  // Date clustering
  dateCluster?: {
    dates: Date[];
    daysSpan: number;
    eventCount: number;
  };
}

/**
 * Member inclusion analysis result
 */
export interface MemberInclusionAnalysis {
  // Members who haven't attended
  absentMembers: {
    memberId: string;
    memberName: string;
    daysSinceLastAttendance: number;
    lastEventAttended?: string;
  }[];

  // Members with recurring conflicts
  conflictingMembers: {
    memberId: string;
    memberName: string;
    conflictPattern: string; // e.g., "Tuesday evenings"
    missedEventCount: number;
  }[];
}

/**
 * Cadence health analysis result
 */
export interface CadenceHealthAnalysis {
  // Stated preference
  statedFrequency: string; // e.g., "weekly", "biweekly"
  expectedDaysBetween: number;

  // Actual behavior
  actualAverageDays: number;
  lastEventDate?: Date;

  // Gap analysis
  frequencyDrift: 'on_track' | 'too_frequent' | 'too_infrequent';
  daysOff: number; // How many days off from expected

  // Member feedback
  frequencyFeedback?: {
    tooFrequent: number;
    justRight: number;
    notEnough: number;
  };
}

/**
 * Interface that all analyzers must implement
 */
export interface Analyzer {
  name: string;
  insightType: InsightType;

  /**
   * Analyze a group and return any insights found
   */
  analyze(groupId: string): Promise<RawInsight[]>;
}

/**
 * Configuration for the planning agent
 */
export interface PlanningAgentConfig {
  // How many days of history to analyze
  lookbackDays: number;

  // Minimum events needed for pattern detection
  minEventsForAnalysis: number;

  // Location fairness thresholds
  locationDominanceThreshold: number; // % of events in one area to trigger
  distanceUnfairnessThreshold: number; // miles difference to flag

  // Date clustering thresholds
  clusterDaysThreshold: number; // How close events need to be
  clusterCountThreshold: number; // How many events in cluster

  // Member inclusion thresholds
  absentDaysThreshold: number; // Days without attendance to flag

  // Cadence drift threshold
  cadenceDriftDaysThreshold: number; // Days off from expected to flag
}

export const DEFAULT_CONFIG: PlanningAgentConfig = {
  lookbackDays: 90,
  minEventsForAnalysis: 3,
  locationDominanceThreshold: 0.6, // 60% of events in one area
  distanceUnfairnessThreshold: 5, // 5+ miles difference
  clusterDaysThreshold: 5, // Events within 5 days
  clusterCountThreshold: 3, // 3+ events in cluster
  absentDaysThreshold: 42, // 6 weeks without attendance
  cadenceDriftDaysThreshold: 7, // 1 week off from expected
};
