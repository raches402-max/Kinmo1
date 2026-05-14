// Reference: javascript_log_in_with_replit blueprint
import { safeError } from "./lib/safe-error";
import type { Express } from "express";
import { createServer, type Server } from "http";
import * as Sentry from "@sentry/node";
import { storage } from "./storage";
import { insertGroupSchema, insertMemberSchema, updateGroupSchema, updateMemberSchema, insertVotingEventSchema, updateVotingEventSchema, insertItinerarySchema, updateItinerarySchema, updateUserProfileSchema, activities as activitiesTable, groups as groupsTable, members as membersTable, itineraryInvites, guestInvites, rsvps as rsvpsTable, itineraries, itineraryItems, proposedTimeSlots, users, userProfiles, photosCache, geocodingCache, hostAssignments, curatedVenues, votingEvents as votingEventsTable, activitySwipes, activities, votingEvents, swipeSessions, venueVisitHistory, autoScheduledEvents, rejectedEventDates, userSavedPlaces, groupSavedPlaces, standaloneEventInvitees, type UpdateItinerary, type ItineraryItem } from "@shared/schema";
import { generateActivitySuggestions, generateSwipeConcepts, categorizeByTime, categorizeVenue, categorizeVenuesBatch, analyzePreferencePatterns, parseSchedulingPrompt, parseSchedulingPromptWithHistory, detectCategory, getPromptCacheStats, validateVenueForCategory, type SchedulingParams } from "./openai";
import { searchPlaces, searchNearbyPlaces, geocodeLocation, clearPlacesCache, getCacheStats, getPlaceDetails, detectAndParseGoogleMapsUrl, getBestVenueType, getBestVenueTypeSync } from "./google-places";
import { planEventWithAgent, type VenueForAgent } from "./ai-event-agent";
import { setupAuth, isAuthenticated } from "./googleAuth";
import {
  requireGroupOwnership,
  requireGroupAccess,
  requireItineraryAccess,
  requireVotingEventAccess,
  requireCollectionOwnership,
  requireMemberAccess,
  requireAdmin,
  getUserId,
  userOwnsGroup,
  userIsMemberOfGroup,
  getAdminEmails
} from "./authorization";
import { validateItinerary } from "./itinerary-validation";
import { sendMemberWelcome, type EmailRecipient, type MemberWelcomeData } from "./email-service";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  notifyEventInvite,
} from "./notifications";
import { autoUpdateMemberConstraints, calculateEngagement, analyzeRSVPPatterns } from "./member-learning";
import { analyzeEventAvailability, analyzeGroupTimePatterns } from "./availability-analyzer";
import { generateGroupInsights, saveGroupInsights, dismissInsight, editInsightSuggestion } from "./group-insights";
import { triggerInsightUpdate, triggerInsightUpdateDebounced } from "./insight-triggers";
import { db } from "./db";
import { eq, sql, and, or, gte, desc, isNotNull, isNull } from "drizzle-orm";
import { format } from 'date-fns';
import pLimit from 'p-limit';
import { validate, safeParse } from './validation-middleware';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getJobHealthStatus } from "./lib/job-tracker";
import { withTimeout } from "./lib/retry";
import {
  createGroupSchema,
  createRsvpSchema,
  sendItinerarySchema,
  generateCategorySchema,
  regenerateCategorySchema,
  postEventFeedbackSchema,
  switchUserSchema,
  importVenuesSchema,
  joinGroupSchema,
  updateGroupRadiusSchema,
  updateAutomationSchema,
  updateActivityFeedbackSchema,
  castVoteSchema,
  addItineraryItemsSchema,
  saveItinerarySchema,
  organizerRsvpSchema,
  createItineraryRsvpSchema,
  addAdHocVenueSchema,
  updateItineraryItemSchema,
  updateUserPreferencesSchema,
  updateMemberConstraintsActionSchema,
  updateMemberGroupPreferencesSchema,
  pauseAutomationSchema,
  updateRsvpResponseSchema,
  createCollectionSchema,
  updateCollectionSchema,
  reorderCollectionsSchema,
} from './validation-schemas';

/**
 * Normalize RSVP response values to standard format.
 * Handles legacy values like 'going' -> 'yes', 'not_going' -> 'no'
 */
function normalizeRsvpResponse(response: string | null | undefined): 'yes' | 'maybe' | 'no' | null {
  if (!response) return null;
  const r = response.toLowerCase();
  if (r === 'yes' || r === 'going') return 'yes';
  if (r === 'maybe') return 'maybe';
  if (r === 'no' || r === 'not_going') return 'no';
  return null; // Unknown response type
}

/**
 * Check if a response is a positive RSVP (yes/going)
 */
function isPositiveRsvp(response: string | null | undefined): boolean {
  const normalized = normalizeRsvpResponse(response);
  return normalized === 'yes';
}

/**
 * Check if a response is a tentative RSVP (maybe)
 */
function isTentativeRsvp(response: string | null | undefined): boolean {
  const normalized = normalizeRsvpResponse(response);
  return normalized === 'maybe';
}

/**
 * Check if a response is a negative RSVP (no/not_going)
 */
function isNegativeRsvp(response: string | null | undefined): boolean {
  const normalized = normalizeRsvpResponse(response);
  return normalized === 'no';
}

// San Francisco neighborhood coordinate boundaries for accurate geographic filtering
// Each boundary defines a rectangular region with min/max latitude and longitude
const SF_NEIGHBORHOOD_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  'mission': { minLat: 37.747, maxLat: 37.766, minLng: -122.427, maxLng: -122.409 },
  'castro': { minLat: 37.755, maxLat: 37.765, minLng: -122.441, maxLng: -122.428 },
  'haight': { minLat: 37.767, maxLat: 37.775, minLng: -122.454, maxLng: -122.430 },
  'soma': { minLat: 37.770, maxLat: 37.785, minLng: -122.408, maxLng: -122.390 },
  'nob hill': { minLat: 37.790, maxLat: 37.797, minLng: -122.419, maxLng: -122.407 },
  'russian hill': { minLat: 37.798, maxLat: 37.806, minLng: -122.424, maxLng: -122.410 },
  'marina': { minLat: 37.797, maxLat: 37.808, minLng: -122.448, maxLng: -122.428 },
  'pacific heights': { minLat: 37.788, maxLat: 37.798, minLng: -122.443, maxLng: -122.420 },
  'richmond': { minLat: 37.775, maxLat: 37.783, minLng: -122.500, maxLng: -122.450 },
  'sunset': { minLat: 37.750, maxLat: 37.770, minLng: -122.510, maxLng: -122.470 },
  'north beach': { minLat: 37.798, maxLat: 37.808, minLng: -122.413, maxLng: -122.404 },
  'chinatown': { minLat: 37.793, maxLat: 37.798, minLng: -122.411, maxLng: -122.403 },
  'financial district': { minLat: 37.790, maxLat: 37.797, minLng: -122.404, maxLng: -122.395 },
  'potrero hill': { minLat: 37.755, maxLat: 37.765, minLng: -122.404, maxLng: -122.390 },
  'dogpatch': { minLat: 37.755, maxLat: 37.762, minLng: -122.395, maxLng: -122.385 },
  'hayes valley': { minLat: 37.773, maxLat: 37.778, minLng: -122.426, maxLng: -122.419 },
  'lower haight': { minLat: 37.770, maxLat: 37.774, minLng: -122.434, maxLng: -122.426 },
  'fillmore': { minLat: 37.783, maxLat: 37.792, minLng: -122.437, maxLng: -122.428 },
  'presidio': { minLat: 37.793, maxLat: 37.808, minLng: -122.475, maxLng: -122.438 },
  'embarcadero': { minLat: 37.791, maxLat: 37.810, minLng: -122.398, maxLng: -122.387 },
};

/**
 * Check if a coordinate is within neighborhood boundaries
 * @param lat Latitude
 * @param lng Longitude
 * @param neighborhood Neighborhood name (must match keys in SF_NEIGHBORHOOD_BOUNDS)
 * @returns true if coordinate is within the neighborhood boundary
 */
function isInNeighborhood(lat: number, lng: number, neighborhood: string): boolean {
  const bounds = SF_NEIGHBORHOOD_BOUNDS[neighborhood];
  if (!bounds) return false;

  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lng >= bounds.minLng && lng <= bounds.maxLng;
}

/**
 * Get group members including the organizer as an implicit member.
 * The organizer is always first in the list with isOrganizer: true.
 * Filters out any duplicate member entries where the organizer added themselves.
 */
async function getGroupMembersWithOrganizer(groupId: string, organizerUserId: string) {
  // Get the organizer's info
  const [organizerInfo] = await db
    .select({
      displayName: userProfiles.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, organizerUserId));

  const organizerName = organizerInfo?.displayName ||
    (organizerInfo?.firstName && organizerInfo?.lastName
      ? `${organizerInfo.firstName} ${organizerInfo.lastName}`
      : organizerInfo?.firstName || organizerInfo?.email?.split('@')[0] || 'Organizer');
  const organizerEmail = organizerInfo?.email || null;

  // Get regular members
  const regularMembers = await db
    .select({
      id: membersTable.id,
      name: membersTable.name,
      email: membersTable.email,
      openToHosting: membersTable.openToHosting,
      userId: membersTable.userId,
      isGuest: membersTable.isGuest,
    })
    .from(membersTable)
    .where(eq(membersTable.groupId, groupId));

  // Find if organizer has a real member record in this group
  const organizerMemberRecord = regularMembers.find(m =>
    m.userId === organizerUserId ||
    (organizerEmail && m.email && m.email.toLowerCase() === organizerEmail.toLowerCase())
  );

  // Filter out the organizer's member record (we'll add it back with isOrganizer flag)
  const filteredMembers = regularMembers.filter(m => {
    // If member has userId and it matches organizer, exclude (will be re-added as organizer)
    if (m.userId === organizerUserId) return false;
    // If member email matches organizer email (case insensitive), exclude (will be re-added as organizer)
    if (organizerEmail && m.email && m.email.toLowerCase() === organizerEmail.toLowerCase()) return false;
    return true;
  });

  // Build the organizer entry - use real member ID if available, otherwise virtual ID
  const organizer = {
    id: organizerMemberRecord?.id || `organizer-${organizerUserId}`, // Use real ID if available
    name: organizerMemberRecord?.name || organizerName,
    email: organizerMemberRecord?.email || organizerEmail,
    openToHosting: organizerMemberRecord?.openToHosting || false,
    isOrganizer: true,
    isGuest: false,
    userId: organizerUserId,
  };

  return [
    organizer,
    ...filteredMembers.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      openToHosting: m.openToHosting || false,
      isOrganizer: false,
      isGuest: m.isGuest || false,
      userId: m.userId || null,
    })),
  ];
}

/**
 * Calculate similarity score between two strings (0 = no match, 1 = exact match)
 * Uses normalized comparison, word overlap, and substring matching
 */
function calculateNameSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) => s.toLowerCase().trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
  
  const a = normalize(str1);
  const b = normalize(str2);
  
  // Exact match
  if (a === b) return 1.0;
  
  // One contains the other
  if (a.includes(b) || b.includes(a)) return 0.9;
  
  // Word overlap scoring
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  const jaccardScore = intersection.size / union.size;
  
  // Levenshtein-like penalty for length difference
  const lengthPenalty = 1 - Math.abs(a.length - b.length) / Math.max(a.length, b.length);
  
  // Combined score
  return (jaccardScore * 0.7) + (lengthPenalty * 0.3);
}

/**
 * Get consistent quality thresholds based on search radius
 * Consolidates all rating/review filtering logic into one authoritative source
 */
function getQualityThresholds(searchRadius: number): { minRating: number; minReviews: number } {
  if (searchRadius <= 2) {
    // Very local (2-mile radius) - moderate standards
    return { minRating: 3.5, minReviews: 10 };
  } else if (searchRadius <= 10) {
    // Citywide (10-mile radius) - slightly stricter
    return { minRating: 3.5, minReviews: 15 };
  } else {
    // Regional (30-50 mile radius) - more lenient for wider search
    return { minRating: 3.3, minReviews: 15 };
  }
}

/**
 * Parse Google Places price level (handles both enum strings and legacy numbers)
 * Google's new API returns: "PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", etc.
 * Legacy API returned: 0, 1, 2, 3, 4
 * @returns number 0-4, or null if unavailable
 */
function parsePriceLevel(priceLevel: string | number | null | undefined): number | null {
  if (!priceLevel) return null;

  // If it's already a number, return it
  if (typeof priceLevel === 'number') return priceLevel;

  // Parse Google's enum strings
  const priceLevelStr = priceLevel.toString().toUpperCase();

  if (priceLevelStr.includes('FREE')) return 0;
  if (priceLevelStr.includes('INEXPENSIVE')) return 1;
  if (priceLevelStr.includes('MODERATE')) return 2;
  if (priceLevelStr.includes('EXPENSIVE')) return 3;
  if (priceLevelStr.includes('VERY_EXPENSIVE')) return 4;

  // Try parsing as number for legacy data
  const parsed = parseInt(priceLevelStr);
  return isNaN(parsed) ? null : parsed;
}

async function trackFeedbackAndMaybeAnalyze(groupId: string) {
  try {
    const [updatedGroup] = await db
      .update(groupsTable)
      .set({
        feedbackCount: sql`COALESCE(${groupsTable.feedbackCount}, 0) + 1`
      })
      .where(eq(groupsTable.id, groupId))
      .returning();

    if (!updatedGroup) {
      console.error(`Group ${groupId} not found when tracking feedback`);
      return;
    }

    const newCount = updatedGroup.feedbackCount || 0;

    if (newCount > 0 && newCount % 15 === 0) {

      setImmediate(async () => {
        try {
          const activities = await storage.getGroupActivities(groupId);
          const votingEvents = await storage.getGroupVotingEvents(groupId);
          const preferenceSignals = await storage.getGroupPreferenceSignals(groupId);

          const notThisFeedback = activities
            .filter(a => a.feedback === 'less')
            .map(a => ({
              venueName: a.venueName,
              venueType: a.venueType,
              feedback: a.feedback as string,
            }));

          const votingFeedback = votingEvents.map(event => ({
            venueName: event.title,
            venueType: event.venueType || 'event',
            upvotes: event.upvotes,
            downvotes: event.downvotes,
            netVotes: event.netVotes,
            description: event.description || ''
          }));

          const likedConcepts = preferenceSignals
            .filter(s => s.feedback === 'like')
            .map(s => s.conceptDescription);

          const passedConcepts = preferenceSignals
            .filter(s => s.feedback === 'pass')
            .map(s => s.conceptDescription);

          const patterns = await analyzePreferencePatterns({
            notThisFeedback: notThisFeedback.map(f => ({ ...f, description: '' })),
            votingFeedback,
            likedConcepts,
            passedConcepts
          });

          await db
            .update(groupsTable)
            .set({
              preferenceInsights: patterns,
              lastInsightsUpdate: sql`NOW()`
            })
            .where(eq(groupsTable.id, groupId));

        } catch (error) {
          console.error(`[Feedback Tracking] Background insights analysis failed:`, error);
        }
      });
    }
  } catch (error) {
    console.error(`[Feedback Tracking] Error tracking feedback for group ${groupId}:`, error);
  }
}

// Color palette for group visual identity
const GROUP_COLOR_PALETTE = [
  '#60A5FA', // Soft Blue
  '#2DD4BF', // Teal
  '#34D399', // Green
  '#A3E635', // Lime
  '#FBBF24', // Amber
  '#FB923C', // Orange
  '#FB7185', // Rose
  '#F472B6', // Pink
  '#C084FC', // Purple
  '#818CF8', // Indigo
  '#94A3B8', // Slate
  '#22D3EE', // Cyan
];

// Auto-assign color to group based on ID (deterministic)
function assignGroupColor(groupId: string): string {
  // Use hash of group ID to consistently pick from palette
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = ((hash << 5) - hash) + groupId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % GROUP_COLOR_PALETTE.length;
  return GROUP_COLOR_PALETTE[index];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication (Google OAuth)
  await setupAuth(app);

  // Register all extracted route modules.
  // Express matches handlers in registration order, so sub-routers win over
  // the inline app.get/post/... handlers below.
  //
  // ROUTE SPLIT STATUS (audited 2026-05-11 via `node scripts/audit-route-split.mjs`):
  //   - 30 sub-router modules under server/routes/ — see ./routes/index.ts
  //   - 186 inline handlers below are now dead-code duplicates of sub-router routes
  //   - 71 routes have already been removed from this file and exist only in sub-routers
  //   - 0 routes remain exclusively in this monolith
  const { registerSubRoutes } = await import("./routes/index");
  registerSubRoutes(app);

  // Rate limiting for public endpoints to prevent scraping and abuse
  const publicEndpointLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });





  // Get user's events (all itinerary invites for this user)











  // ===== SWIPE SESSION MANAGEMENT =====





  // ===== SWIPE RECORDING =====








  // Get individual member by ID (public for event invite flow)
  // Returns only safe, non-sensitive fields for public access



  // Member Group Preferences Routes




  // Member RSVP Routes







  // Member Favorite Venues Routes




  // Event Hosting Routes




  // Rotating Host Assignment Routes





  // Authenticated Member Claim Routes





  // Get member's events (pending invitations, upcoming, past)

  // RSVP Routes (for itinerary invites)









  // Voting Events Routes



  // Delete a voting event (authenticated)





  // ARCHIVED: General AI activity generation (Nov 2025)
  // This endpoint is kept for backward compatibility but is no longer used in the UI.
  // The app now uses category-specific generation (/generate-category) instead.




  // Helper function to intelligently infer time preferences and day constraints from activity type
  function inferTimeFromActivity(params: SchedulingParams): {
    timePreference: 'morning' | 'afternoon' | 'evening' | 'night',
    dayConstraints: 'weekday' | 'weekend' | 'any',
    appliedInferences: string[]
  } {
    const activityLower = params.activityType.toLowerCase();
    const appliedInferences: string[] = [];

    // Start with provided values or defaults
    let timePreference = params.timePreference || 'evening';
    let dayConstraints = params.dayConstraints || 'any';

    // Activity-specific time and day inference
    if (activityLower.includes('brunch')) {
      if (!params.timePreference) {
        timePreference = 'morning';
        appliedInferences.push('Set to morning for brunch');
      }
      if (!params.dayConstraints) {
        dayConstraints = 'weekend';
        appliedInferences.push('Set to weekend for brunch');
      }
    } else if (activityLower.includes('breakfast')) {
      if (!params.timePreference) {
        timePreference = 'morning';
        appliedInferences.push('Set to morning for breakfast');
      }
    } else if (activityLower.includes('lunch')) {
      if (!params.timePreference) {
        timePreference = 'afternoon';
        appliedInferences.push('Set to afternoon for lunch');
      }
    } else if (activityLower.includes('happy hour')) {
      if (!params.timePreference) {
        timePreference = 'afternoon';
        appliedInferences.push('Set to afternoon for happy hour (4-7 PM)');
      }
      if (!params.dayConstraints) {
        dayConstraints = 'weekday';
        appliedInferences.push('Set to weekday for happy hour');
      }
    } else if (activityLower.includes('coffee') || activityLower.includes('cafe')) {
      if (!params.timePreference) {
        timePreference = 'morning';
        appliedInferences.push('Set to morning for coffee');
      }
    } else if (activityLower.includes('dessert') || activityLower.includes('ice cream')) {
      if (!params.timePreference) {
        timePreference = 'night';
        appliedInferences.push('Set to evening for dessert');
      }
    } else if (activityLower.includes('drinks') || activityLower.includes('bar')) {
      if (!params.timePreference) {
        timePreference = 'evening';
        appliedInferences.push('Set to evening for drinks');
      }
    } else if (activityLower.includes('dinner')) {
      if (!params.timePreference) {
        timePreference = 'evening';
        appliedInferences.push('Set to evening for dinner');
      }
    }

    // Parse weeknight constraint (overrides default dayConstraints)
    if (activityLower.includes('weeknight') || activityLower.includes('week night')) {
      dayConstraints = 'weekday'; // Monday-Friday
      appliedInferences.push('Set to weekday for weeknight activity');
      console.log('[Infer Time] Detected weeknight constraint - setting to weekday');
    }

    return { timePreference, dayConstraints, appliedInferences };
  }

  // Helper function to generate time options based on natural language timeframe
  function generateTimeOptions(
    timeframe: string,
    dayConstraints: 'weekday' | 'weekend' | 'any',
    timePreference?: 'morning' | 'afternoon' | 'evening' | 'night',
    timezone: string = 'America/Los_Angeles'
  ): Array<{ eventDate: string; dayLabel: string; timeLabel: string }> {
    const options: Array<{ eventDate: string; dayLabel: string; timeLabel: string }> = [];
    const now = new Date();
    
    // Determine time of day based on preference
    let hour = 19; // Default to 7 PM
    let timeLabel = 'Evening';
    if (timePreference === 'morning') {
      hour = 10;
      timeLabel = 'Morning';
    } else if (timePreference === 'afternoon') {
      hour = 14;
      timeLabel = 'Afternoon';
    } else if (timePreference === 'night') {
      hour = 20;
      timeLabel = 'Night';
    }
    
    // Parse timeframe to determine dates
    const timeframeLower = timeframe.toLowerCase();
    let startDate = new Date(now);
    let daysToCheck = 14; // Default to checking next 2 weeks
    
    if (timeframeLower.includes('tomorrow')) {
      startDate.setDate(now.getDate() + 1);
      daysToCheck = 1;
    } else if (timeframeLower.includes('this week')) {
      startDate.setDate(now.getDate() + 1);
      daysToCheck = 7;
    } else if (timeframeLower.includes('next week')) {
      startDate.setDate(now.getDate() + 7);
      daysToCheck = 7;
    } else if (timeframeLower.includes('this weekend')) {
      // Find next Saturday
      const dayOfWeek = now.getDay();
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
      startDate.setDate(now.getDate() + daysUntilSaturday);
      daysToCheck = 2;
    }
    
    // Generate 2-3 options based on day constraints
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let foundOptions = 0;
    
    for (let i = 0; i < daysToCheck && foundOptions < 3; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() + i);
      const dayOfWeek = checkDate.getDay();
      
      // Apply day constraints
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (
        (dayConstraints === 'weekday' && !isWeekday) ||
        (dayConstraints === 'weekend' && !isWeekend)
      ) {
        continue;
      }
      
      // Create event date
      const eventDate = new Date(checkDate);
      eventDate.setHours(hour, 0, 0, 0);
      
      options.push({
        eventDate: eventDate.toISOString(),
        dayLabel: `${daysOfWeek[dayOfWeek]}, ${format(eventDate, 'MMM d')}`,
        timeLabel: `${timeLabel} (${format(eventDate, 'h:mm a')})`,
      });
      
      foundOptions++;
    }
    
    // If we don't have enough options, generate at least 2
    if (options.length < 2) {
      const fallbackDate = new Date(startDate);
      fallbackDate.setDate(startDate.getDate() + 7);
      fallbackDate.setHours(hour, 0, 0, 0);
      
      options.push({
        eventDate: fallbackDate.toISOString(),
        dayLabel: `${daysOfWeek[fallbackDate.getDay()]}, ${format(fallbackDate, 'MMM d')}`,
        timeLabel: `${timeLabel} (${format(fallbackDate, 'h:mm a')})`,
      });
    }
    
    return options;
  }





















  // ============================================================================
  // AI Suggestions for Event Editing
  // ============================================================================

  /**
   * Get AI-powered venue suggestions for an event
   * - alternatives: Better venues to replace a current one
   * - complements: Venues that pair well with existing itinerary
   */

  // AI Chat for conversational event planning
  // ============================================================================

  // Rate limiter for AI chat (10 requests per minute per user)
  const aiChatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    // Use user ID if authenticated, otherwise skip rate limiting for this endpoint
    // (the isAuthenticated middleware will reject unauthenticated requests anyway)
    skip: (req: any) => !req.user?.id,
    message: { error: "Too many requests. Please wait a moment before sending more messages." }
  });

  /**
   * Conversational AI assistant for event planning
   * Supports streaming responses via SSE
   */



  // ========== TIME SLOT MANAGEMENT ==========

  
  
  
  






  // Helper function to analyze RSVP feedback and trigger auto-reschedule
  async function checkAndReschedule(itineraryId: string) {
    try {

      // Get itinerary
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.eventDate || !itinerary.groupId) {

        return;
      }

      // Check if already exceeded max reschedule attempts
      const rescheduleAttempts = itinerary.rescheduleAttempts || 0;
      if (rescheduleAttempts >= 2) {

        return;
      }

      // Get all RSVPs (exclude guests - only member feedback affects reschedule decisions)
      const rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${itineraryId} AND (is_guest IS NULL OR is_guest = false)`);

      if (rsvps.length === 0) {

        return;
      }

      // Count responses (normalize for legacy values like 'going', 'not_going')
      const yesCount = rsvps.filter(r => isPositiveRsvp(r.response)).length;
      const maybeCount = rsvps.filter(r => isTentativeRsvp(r.response)).length;
      const noCount = rsvps.filter(r => isNegativeRsvp(r.response)).length;
      const totalResponses = rsvps.length;

      // Trigger reschedule if:
      // 1. More than 50% said "no" or "maybe"
      // 2. At least 3 people responded (to avoid premature rescheduling)
      const negativeResponses = noCount + maybeCount;
      const shouldReschedule = totalResponses >= 3 && (negativeResponses / totalResponses) > 0.5;

      if (!shouldReschedule) {

        return;
      }

      // ATOMIC: Try to acquire reschedule lock
      // Only proceed if we successfully set the flag from false to true
      const lockAcquired = await db
        .update(itineraries)
        .set({
          autoScheduleConfig: sql`
            CASE 
              WHEN (auto_schedule_config->>'rescheduleInProgress')::boolean IS NOT TRUE
              THEN jsonb_set(COALESCE(auto_schedule_config, '{}'::jsonb), '{rescheduleInProgress}', 'true'::jsonb)
              ELSE auto_schedule_config
            END
          `,
        })
        .where(sql`
          id = ${itineraryId} 
          AND (auto_schedule_config->>'rescheduleInProgress')::boolean IS NOT TRUE
        `)
        .returning();

      if (lockAcquired.length === 0) {

        return;
      }

      // Analyze feedback patterns
      interface RsvpFeedback {
        tryEarlier?: boolean;
        tryLater?: boolean;
        notThisWeek?: boolean;
        unavailableOn?: string[];
      }
      const feedback = rsvps
        .map(r => r.rsvpFeedback as RsvpFeedback | null)
        .filter((f): f is RsvpFeedback => f != null);

      const constraints = {
        avoidDays: [] as string[],
        preferEarlier: 0,
        preferLater: 0,
        avoidThisWeek: false,
      };

      for (const f of feedback) {
        if (f.tryEarlier) constraints.preferEarlier++;
        if (f.tryLater) constraints.preferLater++;
        if (f.notThisWeek) constraints.avoidThisWeek = true;
        if (f.unavailableOn && Array.isArray(f.unavailableOn)) {
          constraints.avoidDays.push(...f.unavailableOn);
        }
      }

      // Get group and venue info for AI
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {

        return;
      }

      const venueInfo = itinerary.items.map((item: any) => ({
        name: item.venueName,
        type: item.venueType,
      }));

      // Call AI time picker with feedback constraints
      const { generateOptimalTime } = await import('./ai-time-picker');
      let result;
      
      try {
        result = await generateOptimalTime(
          venueInfo,
          group.availability || {},
          {
            avoidDays: constraints.avoidDays,
            preferEarlier: constraints.preferEarlier > constraints.preferLater,
            preferLater: constraints.preferLater > constraints.preferEarlier,
            avoidThisWeek: constraints.avoidThisWeek,
          },
          group.locationBase // Pass location for timezone detection
        );
      } catch (aiError) {
        console.error(`[Auto-Reschedule] AI time picker failed:`, aiError);
        
        // Clear in-progress flag on failure
        await storage.updateItinerary(itineraryId, {
          autoScheduleConfig: {
            ...(itinerary.autoScheduleConfig as object || {}),
            rescheduleInProgress: false,
          },
        });
        
        return;
      }

      if (!result.suggestedTime) {

        // Clear in-progress flag
        await storage.updateItinerary(itineraryId, {
          autoScheduleConfig: {
            ...(itinerary.autoScheduleConfig as object || {}),
            rescheduleInProgress: false,
          },
        });
        
        return;
      }

      // Update itinerary with new time and clear in-progress flag
      const newEventDate = new Date(result.suggestedTime);
      await storage.updateItinerary(itineraryId, {
        eventDate: newEventDate,
        rescheduleAttempts: rescheduleAttempts + 1,
        autoScheduleConfig: {
          ...(itinerary.autoScheduleConfig as object || {}),
          lastRescheduleReason: result.reasoning,
          rescheduleInProgress: false,
        },
      });

      // Clear all existing RSVPs so stale responses don't affect next reschedule check
      await db
        .delete(rsvpsTable)
        .where(sql`itinerary_id = ${itineraryId}`);

      // Get all members
      const members = await storage.getGroupMembers(group.id);

      // Delete old invite tokens
      await db
        .delete(itineraryInvites)
        .where(sql`itinerary_id = ${itineraryId}`);

      // Create new invite tokens for each member
      const memberInvites = new Map<string, string>();
      for (const member of members) {
        const inviteToken = crypto.randomUUID();
        
        await db.insert(itineraryInvites).values({
          itineraryId,
          memberId: member.id,
          inviteToken,
        });
        
        memberInvites.set(member.id, inviteToken);
      }

      // Send reschedule emails to all members
      for (const member of members) {
        if (!member.email) continue;
        
        const inviteToken = memberInvites.get(member.id);
        if (!inviteToken) continue;

        try {
          // Use kinmo.ai as primary domain for all user-facing links
          const primaryDomain = 'kinmo.ai';
          const rsvpLink = `https://${primaryDomain}/rsvp/${itineraryId}/${inviteToken}`;
          
          const { sendItineraryReschedule } = await import('./email-service');
          
          await sendItineraryReschedule(
            { email: member.email, name: member.name || 'Member' },
            {
              groupName: group.name,
              eventDate: newEventDate.toLocaleDateString(),
              eventTime: newEventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              venues: itinerary.items.map((item: ItineraryItem) => ({
                name: item.venueName || 'Venue',
                type: item.venueType || 'Activity',
              })),
              reason: result.reasoning,
              rsvpLink,
            }
          );

        } catch (emailError) {
          console.error(`[Auto-Reschedule] Failed to send email to ${member.email}:`, emailError);
        }
      }

    } catch (error) {
      console.error(`[Auto-Reschedule] Error:`, error);
    }
  }











  // Phase 1: Event invite RSVP (public endpoint - no auth required)





  // Get shareable invite token for an itinerary (public - for group chat links)

  // Get guest list (RSVPs with names) for an itinerary (public - for RSVP page)


  // Get availability insights for an event (organizer only)

  // Create guest invite for an itinerary
  app.post("/api/itineraries/:itineraryId/guest-invites", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { itineraryId } = req.params;
      const { guestName } = req.body;

      if (!guestName || !guestName.trim()) {
        return res.status(400).json({ message: "Guest name is required" });
      }

      // Verify itinerary exists and user is authorized (group owner)
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Event not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only the group owner can invite guests" });
      }

      // Generate unique token for guest link
      const guestToken = `guest_${crypto.randomUUID()}`;

      // Create guest invite
      const [guestInvite] = await db
        .insert(guestInvites)
        .values({
          itineraryId,
          guestName: guestName.trim(),
          guestToken,
          createdBy: userId,
        })
        .returning();

      res.json(guestInvite);
    } catch (error: any) {
      res.status(500).json({ message: safeError(error) });
    }
  });

  // Get all guest invites for an itinerary
  app.get("/api/itineraries/:itineraryId/guest-invites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { itineraryId } = req.params;

      // Verify itinerary exists and user is authorized
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Event not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get all guest invites
      const invites = await db
        .select()
        .from(guestInvites)
        .where(eq(guestInvites.itineraryId, itineraryId));

      res.json(invites);
    } catch (error: any) {
      res.status(500).json({ message: safeError(error) });
    }
  });

  // Update a guest invite (edit name)
  app.patch("/api/itineraries/:itineraryId/guest-invites/:guestId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { itineraryId, guestId } = req.params;
      const { guestName } = req.body;

      if (!guestName || !guestName.trim()) {
        return res.status(400).json({ message: "Guest name is required" });
      }

      // Verify itinerary exists and user is authorized (group owner)
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Event not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only the group owner can edit guests" });
      }

      // Update the guest invite
      const [updated] = await db
        .update(guestInvites)
        .set({ guestName: guestName.trim() })
        .where(and(
          eq(guestInvites.id, guestId),
          eq(guestInvites.itineraryId, itineraryId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Guest not found" });
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: safeError(error) });
    }
  });

  // Delete a guest invite
  app.delete("/api/itineraries/:itineraryId/guest-invites/:guestId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { itineraryId, guestId } = req.params;

      // Verify itinerary exists and user is authorized (group owner)
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Event not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only the group owner can remove guests" });
      }

      // Delete the guest invite
      const [deleted] = await db
        .delete(guestInvites)
        .where(and(
          eq(guestInvites.id, guestId),
          eq(guestInvites.itineraryId, itineraryId)
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Guest not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: safeError(error) });
    }
  });






  // ===== CONFIDENCE CALIBRATION ENDPOINTS =====













  // Admin endpoint to backfill coordinates for existing groups

  // Admin endpoint to get platform statistics





  // Admin endpoint to get list of test accounts

  // Admin endpoint to switch to a test account




















  // ============================================================================
  // NOTIFICATION ENDPOINTS
  // ============================================================================






  const httpServer = createServer(app);

  return httpServer;
}

// Helper function to generate and store activities
// Exported so it can be used by background workers (auto-refresh, etc.)
export async function generateAndStoreActivities(groupId: string, groupData: any) {
  try {
    // Update status to generating
    await storage.updateGroupStatus(groupId, "generating");

    // OPTIMIZED: Query only venue names (not full objects) to avoid loading large activity records
    const venueNamesQuery = await db
      .select({
        aiSuggestedName: activitiesTable.aiSuggestedName,
        venueName: activitiesTable.venueName,
        complementaryPlaceName: activitiesTable.complementaryPlaceName,
        complementaryPlaceName2: activitiesTable.complementaryPlaceName2,
      })
      .from(activitiesTable)
      .where(eq(activitiesTable.groupId, groupId));

    // Track BOTH AI suggested types AND actual Google business names to prevent duplicates
    const previouslySuggestedVenues = [
      // AI suggested types (e.g., "Dessert Shop", "Public Park")
      ...venueNamesQuery
        .filter(a => a.aiSuggestedName)
        .map(a => a.aiSuggestedName!),
      // Actual Google business names (e.g., "Sweet Indulgence", "Central Park")
      ...venueNamesQuery
        .filter(a => a.venueName)
        .map(a => a.venueName),
      // Complementary food place names (prevent duplicate dessert/food suggestions)
      ...venueNamesQuery
        .filter(a => a.complementaryPlaceName)
        .map(a => a.complementaryPlaceName!),
      ...venueNamesQuery
        .filter(a => a.complementaryPlaceName2)
        .map(a => a.complementaryPlaceName2!)
    ].filter((name, index, self) => name && self.indexOf(name) === index); // Remove nulls and duplicates

    // Get existing (non-archived) activities with feedback for this group
    const existingActivities = await storage.getGroupActivities(groupId);
    const previousFeedback = existingActivities
      .filter(a => a.feedback)
      .map(a => ({
        venueName: a.venueName,
        venueType: a.venueType,
        feedback: a.feedback!,
        description: a.description
      }));

    // Get voting events (Favorites list) with vote counts to incorporate into AI
    const votingEvents = await storage.getGroupVotingEvents(groupId);
    const votingFeedback = votingEvents
      .filter(e => e.netVotes !== 0 && e.venueType) // Only include events with votes and valid venue type
      .map(e => ({
        venueName: e.title,
        venueType: e.venueType!,
        upvotes: e.upvotes,
        downvotes: e.downvotes,
        netVotes: e.netVotes,
        description: e.description || ''
      }));

    // Get preference signals from swipe sessions
    const preferenceSignals = await storage.getGroupPreferenceSignals(groupId);
    const likedConcepts = preferenceSignals
      .filter(s => s.feedback === 'like')
      .map(s => s.conceptDescription);
    const passedConcepts = preferenceSignals
      .filter(s => s.feedback === 'pass')
      .map(s => s.conceptDescription);

    // Get member constraints from RSVP feedback
    const groupMembers = await storage.getGroupMembers(groupId);
    const memberConstraints = groupMembers
      .filter(m => m.memberConstraints)
      .map(m => m.memberConstraints as { scheduleConflicts?: string[]; budgetConcern?: boolean; distanceConcern?: boolean; notes?: string });

    // Fetch seen venues from database to prevent repetitive suggestions
    const seenVenuesFromDB = await storage.getSeenVenues(groupId);
    const seenVenueNames = seenVenuesFromDB.map(v => v.venueName);

    // Fetch highly-rated venues ready to revisit (proven winners from post-event feedback)
    const provenWinners = await storage.getHighlyRatedVenues(groupId);

    // Archive old activities before generating new ones (preserves feedback for AI)
    await storage.archiveGroupActivities(groupId);

    // Track all unique activities across retries
    const allUniqueActivities: any[] = [];
    const seenVenues = new Set<string>(); // Track across all attempts
    let attempt = 0;
    const maxAttempts = 5; // Try up to 5 times to ensure exactly 3 cards per category
    let targetCategories: string[] | undefined = undefined; // For targeted retry

    // Helper function to check if we have exactly 3 cards per ENABLED category
    const hasBalancedDistribution = (activities: any[]): boolean => {
      const categoryCounts: Record<string, number> = {
        meal: 0,
        cafes: 0,
        drinks: 0,
        dessert: 0,
        experiences: 0
      };

      for (const activity of activities) {
        if (activity.category) {
          categoryCounts[activity.category] = (categoryCounts[activity.category] || 0) + 1;
        }
      }

      // Only ENABLED categories must have at least 3 cards
      const enabledCategories = [];
      if (groupData.mealEnabled ?? true) enabledCategories.push('meal');
      if (groupData.cafeEnabled ?? true) enabledCategories.push('cafes');
      if (groupData.drinksEnabled ?? true) enabledCategories.push('drinks');
      if (groupData.dessertEnabled ?? true) enabledCategories.push('dessert');
      if (groupData.experiencesEnabled ?? true) enabledCategories.push('experiences');

      // All ENABLED categories must have at least 3 cards
      return enabledCategories.every(cat => categoryCounts[cat] >= 3);
    };

    while (!hasBalancedDistribution(allUniqueActivities) && attempt < maxAttempts) {
      attempt++;
      const attemptStart = Date.now();
      const needed = 20 - allUniqueActivities.length;

      // Refresh group data to get latest rejected venues
      const refreshedGroup = await storage.getGroup(groupId);
      if (!refreshedGroup) {
        throw new Error("Group not found during generation");
      }
      const rejectedVenues = refreshedGroup.rejectedVenues || [];
      const rejectedSet = new Set(rejectedVenues.map(v => v.toLowerCase()));

      // Get group insights for AI context
      const groupInsights = refreshedGroup.preferenceInsights || undefined;

      // Update progress in database so frontend can display it
      await storage.updateGroupStatus(groupId, "generating", `Generating suggestions (attempt ${attempt} of ${maxAttempts})`);

      // Generate AI suggestions with feedback and list of venues to avoid
      // Use 90-second timeout to prevent infinite hanging (background task, can be longer)
      const aiPromptStart = Date.now();
      const suggestions = await withTimeout(
        generateActivitySuggestions({
          locationBase: groupData.locationBase,
          budgetMin: groupData.budgetMin,
          budgetMax: groupData.budgetMax,
          meetingFrequency: groupData.meetingFrequency,
          availability: groupData.availability,
          closenessLevel: groupData.closenessLevel,
          noveltyPreference: groupData.noveltyPreference,
          activityCategories: groupData.activityCategories,
          pastPreferences: groupData.pastPreferences,
          additionalInstructions: groupData.additionalInstructions,
          searchRadius: groupData.searchRadius, // Pass search radius to AI
          previousFeedback: previousFeedback.length > 0 ? previousFeedback : undefined,
          votingFeedback: votingFeedback.length > 0 ? votingFeedback : undefined,
          provenWinners: provenWinners.length > 0 ? provenWinners : undefined, // Pass highly-rated venues ready to revisit
          likedConcepts: likedConcepts.length > 0 ? likedConcepts : undefined,
          passedConcepts: passedConcepts.length > 0 ? passedConcepts : undefined,
          previouslySuggestedVenues: [...(previouslySuggestedVenues.length > 0 ? previouslySuggestedVenues : []), ...seenVenueNames],
          targetCategories: targetCategories, // Pass underrepresented categories on retry
          memberConstraints: memberConstraints.length > 0 ? memberConstraints : undefined, // Pass member RSVP constraints
          rejectedVenues: rejectedVenues, // Pass rejected venues blacklist
          seenVenues: seenVenueNames.length > 0 ? seenVenueNames : undefined, // Pass seen venues to exclude
          groupInsights: groupInsights, // Pass learned group preferences to guide suggestions
          mealEnabled: groupData.mealEnabled ?? true,
          cafeEnabled: groupData.cafeEnabled ?? true,
          drinksEnabled: groupData.drinksEnabled ?? true,
          dessertEnabled: groupData.dessertEnabled ?? true,
          experiencesEnabled: groupData.experiencesEnabled ?? true,
        }),
        90000, // 90 second timeout
        'AI activity generation timed out'
      );

      const aiPromptEnd = Date.now();

      // Filter out rejected venues AND disabled categories BEFORE calling Google Places
      // (Duplicate checking happens after Google Places returns actual venue names)

      const filteredSuggestions = suggestions.filter(s => {
        const normalized = s.venueName.trim().toLowerCase();
        
        // Skip blacklisted venues
        if (rejectedSet.has(normalized)) {

          return false;
        }
        
        // CRITICAL: Skip disabled categories to save API quota
        // Detect category using keyword matching on venue name/type
        const detectedCategory = detectCategory(s.venueName, s.venueType);

        // Check if this category is disabled
        const categoryEnabled = 
          (detectedCategory === 'meal' && (groupData.mealEnabled ?? true)) ||
          (detectedCategory === 'cafes' && (groupData.cafeEnabled ?? true)) ||
          (detectedCategory === 'drinks' && (groupData.drinksEnabled ?? true)) ||
          (detectedCategory === 'dessert' && (groupData.dessertEnabled ?? true)) ||
          (detectedCategory === 'experiences' && (groupData.experiencesEnabled ?? true));

        if (!categoryEnabled) {

          return false;
        }

        return true;
      });

      const googleSearchStart = Date.now();
      // For each suggestion, search Google Places with group's search radius
      const coordinates = groupData.latitude && groupData.longitude 
        ? { lat: parseFloat(groupData.latitude), lng: parseFloat(groupData.longitude) }
        : undefined;
      
      // Process all suggestions in parallel (30 at once for maximum speed)
      const batchSize = 30;
      const activitiesData: any[] = [];
      
      for (let i = 0; i < filteredSuggestions.length; i += batchSize) {
        const batch = filteredSuggestions.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (suggestion) => {
            const places = await searchPlaces(
              suggestion.searchQuery,
              groupData.locationBase,
              groupData.searchRadius || 2,
              coordinates,
              false, // skipCurated
              suggestion.venueType, // Pass venueType for better cache matching
              groupData.budgetMax, // Pass budget for filtering
              seenVenueNames, // Pass seen venues for variety
              false, // forceComprehensiveSearch
              true // userDirected - skip strict 50+ review filter, use our own quality filter
            );

          // If Google Places returns NO results at all, this is likely a fake/non-existent venue
          if (places.length === 0) {

            await storage.addRejectedVenue(groupId, suggestion.venueName);
            return null;
          }

          // Apply quality filtering based on search radius
          const searchRadius = groupData.searchRadius || 2;
          const { minRating, minReviews } = getQualityThresholds(searchRadius);

          const qualityFiltered = places.filter(place => {
            const rating = parseFloat(place.rating || '0');
            const reviewCount = place.reviewCount || 0;
            return rating >= minRating && reviewCount >= minReviews;
          });

          // Budget filtering now handled by searchPlaces itself
          const budgetFiltered = qualityFiltered;

          // Apply drinks category post-filter to reject restaurants and sushi bars
          const detectedCategory = detectCategory(suggestion.venueName, suggestion.venueType);
          let drinksFiltered = budgetFiltered;
          
          if (detectedCategory === 'drinks') {
            // For drinks category, explicitly reject venues with restaurant types
            const restaurantTypes = ['restaurant', 'food', 'meal_takeaway', 'meal_delivery', 'sushi_restaurant'];
            const barTypes = ['bar', 'night_club', 'liquor_store'];
            
            drinksFiltered = budgetFiltered.filter(place => {
              const types = place.types || [];
              const typesLower = types.map(t => t.toLowerCase());
              
              // Check if has restaurant type
              const hasRestaurantType = types.some(type => 
                restaurantTypes.includes(type) || type.toLowerCase().includes('restaurant')
              );
              
              // Check if has both bar AND restaurant types - force to meal category
              const hasBarType = typesLower.some(t => barTypes.includes(t) || t.includes('bar'));
              const hasBothBarAndRestaurant = hasBarType && hasRestaurantType;
              
              if (hasBothBarAndRestaurant) {

                return false;
              }
              
              if (hasRestaurantType) {

                return false;
              }
              return true;
            });
            
            if (drinksFiltered.length < budgetFiltered.length) {

            }
          }
          
          // Only use venues that meet quality AND budget standards
          let finalPlaces = drinksFiltered;

          // Check if we have curated venues - ONLY use if name matches well
          let useCuratedVenue = false;
          let curatedPlace = null;

          if (finalPlaces.length > 0) {
            // CRITICAL FIX: Only use curated venues if name similarity is above threshold
            // TYPE-BASED matching was causing data corruption (e.g., "Baklavastory" getting "The Native Experience" data)

            const rankedPlaces = finalPlaces.map(place => ({
              place,
              similarity: calculateNameSimilarity(suggestion.venueName, place.name)
            })).sort((a, b) => b.similarity - a.similarity);

            const bestMatch = rankedPlaces[0];
            const SIMILARITY_THRESHOLD = 0.6;

            // ONLY use curated venue if name similarity is good enough
            if (bestMatch.similarity >= SIMILARITY_THRESHOLD) {
              console.log(`[Venue Matching] ✅ Matched "${bestMatch.place.name}" to AI suggestion "${suggestion.venueName}" with ${(bestMatch.similarity * 100).toFixed(0)}% similarity`);
              curatedPlace = bestMatch.place;
              useCuratedVenue = true;
            } else {
              // No good name match - DO NOT fall back to TYPE-BASED matching!
              // This was causing venues like "Baklavastory" to get data from "The Native Experience"
              // Instead, fall through to the API search below
              console.log(`[Venue Matching] ❌ No good name match for "${suggestion.venueName}" in curated venues (best: "${bestMatch.place.name}" at ${(bestMatch.similarity * 100).toFixed(0)}%) - falling back to API`);
              useCuratedVenue = false;
            }
          }

          if (useCuratedVenue && curatedPlace) {
            // CRITICAL: Only include venues with verified Google Places data
            // Note: photoUrl is optional - we can fetch it later on-demand
            if (!curatedPlace.rating || !curatedPlace.address) {

              return null;
            }
            
            return {
              groupId,
              aiSuggestedName: suggestion.venueName, // Store what AI originally suggested
              venueName: curatedPlace.name,
              venueAddress: curatedPlace.address,
              venueType: suggestion.venueType,
              description: suggestion.description,
              googlePlaceId: curatedPlace.placeId,
              latitude: curatedPlace.location?.lat?.toString() || null,
              longitude: curatedPlace.location?.lng?.toString() || null,
              rating: curatedPlace.rating,
              reviewCount: curatedPlace.reviewCount || null,
              priceLevel: curatedPlace.priceLevel,
              photoUrl: curatedPlace.photoUrl,
              googleReview: curatedPlace.review || null, // Add positive review from Google
              aiReasoning: suggestion.reasoning,
              suggestedDate: null,
              suggestedTime: null,
              priceEstimate: suggestion.priceEstimate || null,
              timeConstraints: suggestion.timeConstraints || null,
              timeCategory: categorizeByTime(suggestion.venueType), // Categorize by time commitment
              complementaryPlaceName: null,
              complementaryPlaceAddress: null,
              complementaryPlaceId: null,
              complementaryPlacePhotoUrl: null,
              complementaryPlaceRating: null,
              complementaryPlaceName2: null,
              complementaryPlaceAddress2: null,
              complementaryPlaceId2: null,
              complementaryPlacePhotoUrl2: null,
              complementaryPlaceRating2: null,
            };
          } else {
            // If we reach here, either:
            // 1. No curated venues found at all, OR
            // 2. Curated venues filtered out by quality/budget/drinks, OR
            // 3. Curated venues had low name similarity (<60%)
            // In all cases, fall back to Google Places API for fresh results

            const apiPlaces = await searchPlaces(
              suggestion.searchQuery,
              groupData.locationBase,
              groupData.searchRadius || 2,
              coordinates,
              true, // skipCurated = true (force fresh API call)
              suggestion.venueType, // Pass venueType for better cache matching
              groupData.budgetMax, // Pass budget for filtering
              seenVenueNames, // Pass seen venues for variety
              false, // forceComprehensiveSearch
              true // userDirected - skip strict 50+ review filter, use our own quality filter
            );
            
            // If API also returns no results, this is likely a fake venue
            if (apiPlaces.length === 0) {

              await storage.addRejectedVenue(groupId, suggestion.venueName);
              return null;
            }
            
            // First, filter out obviously wrong venue types using Google place types (more reliable than name matching)
            const blockedPlaceTypes = [
              // Professional services
              'accounting', 'lawyer', 'insurance_agency', 'real_estate_agency',
              // Medical/health
              'dentist', 'doctor', 'hospital', 'pharmacy', 'physiotherapist',
              // Financial
              'atm', 'bank',
              // Personal care (non-social)
              'hair_care', 'beauty_salon', 'spa',
              // Auto/repair
              'car_dealer', 'car_rental', 'car_repair', 'car_wash', 'gas_station',
              // Storage/logistics
              'storage', 'moving_company', 'parking',
              // Government/civic
              'city_hall', 'courthouse', 'embassy', 'fire_station', 'police', 'post_office',
              // Religious (unless specifically requested)
              'church', 'hindu_temple', 'mosque', 'synagogue',
              // Education (unless specifically requested)
              'school', 'university', 'library',
              // Lodging (not social venues)
              'campground', 'rv_park',
              // Other non-social
              'funeral_home', 'cemetery', 'veterinary_care', 'pet_store',
              'hardware_store', 'home_goods_store', 'electronics_store'
            ];
            
            const relevantPlaces = apiPlaces.filter(place => {
              const types = (place.types || []).map(t => t.toLowerCase());
              
              // Check if any of the place's types are blocked
              const hasBlockedType = types.some(type => blockedPlaceTypes.includes(type));
              
              if (hasBlockedType) {
                console.log(`[Relevance Filter] ❌ REJECTED "${place.name}" - has blocked type: ${types.join(', ')}`);
                return false;
              }
              
              // Also check name for obvious recruiting/staffing keywords (word boundaries only)
              const nameLower = place.name.toLowerCase();
              const strictBlockedWords = ['recruiting', 'staffing', 'employment agency'];
              const hasBlockedWord = strictBlockedWords.some(word => {
                const regex = new RegExp(`\\b${word}\\b`, 'i');
                return regex.test(nameLower);
              });
              
              if (hasBlockedWord) {
                console.log(`[Relevance Filter] ❌ REJECTED "${place.name}" - name contains blocked word (recruiting/staffing)`);
                return false;
              }
              
              return true;
            });

            // Apply quality filters using consolidated thresholds
            const { minRating, minReviews } = getQualityThresholds(searchRadius);

            const apiQualityFiltered = relevantPlaces.filter(place => {
              const rating = parseFloat(place.rating || '0');
              const reviewCount = place.reviewCount || 0;
              const passed = rating >= minRating && reviewCount >= minReviews;

              if (!passed) {
                console.log(`[Quality Filter] ❌ REJECTED "${place.name}" - rating: ${rating} (min: ${minRating}), reviews: ${reviewCount} (min: ${minReviews})`);
              }

              return passed;
            });

            const apiBudgetFiltered = apiQualityFiltered.filter(place => {
              const priceLevel = parsePriceLevel(place.priceLevel);
              const budgetMax = groupData.budgetMax;

              // If price data unavailable, accept for high budgets ($100+), reject for low budgets
              if (priceLevel === null) {
                const passed = budgetMax >= 100;
                if (!passed) {
                  console.log(`[Budget Filter] ❌ REJECTED "${place.name}" - missing price data (budget: $${budgetMax} requires price info)`);
                }
                return passed;
              }
              
              let maxPrice = 4;
              if (budgetMax < 50) {
                maxPrice = 1;
              } else if (budgetMax < 100) {
                maxPrice = 2;
              } else if (budgetMax < 200) {
                maxPrice = 3;
              } else {
                maxPrice = 4;
              }
              
              const passed = priceLevel <= maxPrice;
              if (!passed) {
                console.log(`[Budget Filter] ❌ REJECTED "${place.name}" - price level: ${priceLevel} (max: ${maxPrice}, budget: $${budgetMax})`);
              }
              
              return passed;
            });

            // Apply drinks filter to API results too
            let apiDrinksFiltered = apiBudgetFiltered;
            if (detectedCategory === 'drinks') {

              const restaurantTypes = ['restaurant', 'food', 'meal_takeaway', 'meal_delivery', 'sushi_restaurant'];
              const barTypes = ['bar', 'night_club', 'liquor_store'];
              
              apiDrinksFiltered = apiBudgetFiltered.filter(place => {
                const types = place.types || [];
                const typesLower = types.map(t => t.toLowerCase());
                
                const hasRestaurantType = types.some(type => 
                  restaurantTypes.includes(type) || type.toLowerCase().includes('restaurant')
                );
                
                const hasBarType = typesLower.some(t => barTypes.includes(t) || t.includes('bar'));
                const hasBothBarAndRestaurant = hasBarType && hasRestaurantType;
                
                if (hasBothBarAndRestaurant || hasRestaurantType) {

                  return false;
                }
                return true;
              });

            }
            
            if (apiDrinksFiltered.length === 0) {

              return null;
            }

            // NEW: Rank API results by name similarity to ensure we get the venue AI intended
            // Prevents accepting generic venues like "Olive Garden" when AI suggested "Pasta House"
            const rankedByName = apiDrinksFiltered.map(place => ({
              place,
              similarity: calculateNameSimilarity(suggestion.venueName, place.name)
            })).sort((a, b) => b.similarity - a.similarity);

            const bestMatch = rankedByName[0];
            const SIMILARITY_THRESHOLD = 0.6;

            // Reject if best match doesn't meet similarity threshold
            if (bestMatch.similarity < SIMILARITY_THRESHOLD) {

              return null;
            }

            const apiPlace = bestMatch.place;

            // CRITICAL: Only include venues with verified Google Places data
            // Note: photoUrl is optional - we can fetch it later on-demand
            if (!apiPlace.rating || !apiPlace.address) {

              return null;
            }
            
            return {
              groupId,
              aiSuggestedName: suggestion.venueName,
              venueName: apiPlace.name,
              venueAddress: apiPlace.address,
              city: apiPlace.city || null,
              venueType: suggestion.venueType,
              description: suggestion.description,
              googlePlaceId: apiPlace.placeId,
              latitude: apiPlace.location?.lat?.toString() || null,
              longitude: apiPlace.location?.lng?.toString() || null,
              rating: apiPlace.rating,
              reviewCount: apiPlace.reviewCount || null,
              priceLevel: apiPlace.priceLevel,
              photoUrl: apiPlace.photoUrl,
              googleReview: apiPlace.review || null,
              aiReasoning: suggestion.reasoning,
              suggestedDate: null,
              suggestedTime: null,
              priceEstimate: suggestion.priceEstimate || null,
              timeConstraints: suggestion.timeConstraints || null,
              timeCategory: categorizeByTime(suggestion.venueType),
              complementaryPlaceName: null,
              complementaryPlaceAddress: null,
              complementaryPlaceId: null,
              complementaryPlacePhotoUrl: null,
              complementaryPlaceRating: null,
              complementaryPlaceName2: null,
              complementaryPlaceAddress2: null,
              complementaryPlaceId2: null,
              complementaryPlacePhotoUrl2: null,
              complementaryPlaceRating2: null,
            };
          }
          })
        );
        activitiesData.push(...batchResults);
      }

      const googleSearchEnd = Date.now();

      // Filter out null activities (from failed Google Places searches)
      const validActivities = activitiesData.filter((a: any) => a !== null);

      // First, categorize all new activities using batch categorization (MUCH faster!)
      const categorizationStart = Date.now();
      const uncategorized = validActivities.filter((a: any) => !a.category);

      if (uncategorized.length > 0) {
        // Batch categorize all venues in a single API call (or very few calls)
        const venuesToCategorize = uncategorized.map((a: any) => ({
          venueName: a.venueName,
          venueType: a.venueType,
          googleTypes: a.tags || [] // Use Google types if available
        }));

        const categorizations = await categorizeVenuesBatch(venuesToCategorize);

        // Apply categorizations to activities
        uncategorized.forEach((activity: any) => {
          const cacheKey = `${activity.venueName.toLowerCase()}::${activity.venueType.toLowerCase()}`;
          const category = categorizations.get(cacheKey);
          if (category) {
            activity.category = category;
          } else {
            console.warn(`[AI Generation] No category found for ${activity.venueName}, defaulting to 'meal'`);
            activity.category = 'meal'; // Safe default
          }
        });
      }

      const categorizationEnd = Date.now();

      // CRITICAL: Filter out disabled categories AFTER AI categorization
      // The AI may categorize venues differently than our keyword detector, so we need to filter again
      const beforeCategoryFilter = validActivities.length;
      const categoryFilteredActivities = validActivities.filter((activity: any) => {
        const category = activity.category;
        const categoryEnabled = 
          (category === 'meal' && (groupData.mealEnabled ?? true)) ||
          (category === 'cafes' && (groupData.cafeEnabled ?? true)) ||
          (category === 'drinks' && (groupData.drinksEnabled ?? true)) ||
          (category === 'dessert' && (groupData.dessertEnabled ?? true)) ||
          (category === 'experiences' && (groupData.experiencesEnabled ?? true));
        
        if (!categoryEnabled) {
          console.log(`[Post-AI Filter] ❌ REMOVING: ${activity.venueName} - AI categorized as "${category}" which is disabled`);
          return false;
        }
        return true;
      });
      
      if (categoryFilteredActivities.length < beforeCategoryFilter) {
        console.log(`[Post-AI Filter] Filtered out ${beforeCategoryFilter - categoryFilteredActivities.length} venues in disabled categories after AI categorization`);
      }
      
      // Replace validActivities with the filtered list
      validActivities.length = 0;
      validActivities.push(...categoryFilteredActivities);

      // Count current category distribution
      const currentCategoryCounts: Record<string, number> = {
        meal: 0,
        cafes: 0,
        drinks: 0,
        dessert: 0,
        experiences: 0
      };

      for (const activity of allUniqueActivities) {
        if (activity.category) {
          currentCategoryCounts[activity.category] = (currentCategoryCounts[activity.category] || 0) + 1;
        }
      }

      // Add new unique activities from this batch, respecting category limits (max 3 per category)
      for (const activity of validActivities) {
        // Create a unique key based on Google Place ID (if available) or venue name
        const venueKey = activity.googlePlaceId || activity.venueName.toLowerCase();
        const category = activity.category;

        if (!seenVenues.has(venueKey) && category && currentCategoryCounts[category] < 3) {
          seenVenues.add(venueKey);
          allUniqueActivities.push(activity);
          currentCategoryCounts[category]++;

        } else if (seenVenues.has(venueKey)) {

        } else if (category && currentCategoryCounts[category] >= 3) {

        }
      }

      // After each attempt, check category distribution if we aren't done yet
      if (!hasBalancedDistribution(allUniqueActivities) && attempt < maxAttempts) {
        // Count by category
        const categoryCounts: Record<string, number> = {
          meal: 0,
          cafes: 0,
          drinks: 0,
          dessert: 0,
          experiences: 0
        };

        for (const activity of allUniqueActivities) {
          if (activity.category) {
            categoryCounts[activity.category] = (categoryCounts[activity.category] || 0) + 1;
          }
        }

        // Identify underrepresented ENABLED categories (less than 3)
        const enabledCategoriesForRetry = [];
        if (groupData.mealEnabled ?? true) enabledCategoriesForRetry.push('meal');
        if (groupData.cafeEnabled ?? true) enabledCategoriesForRetry.push('cafes');
        if (groupData.drinksEnabled ?? true) enabledCategoriesForRetry.push('drinks');
        if (groupData.dessertEnabled ?? true) enabledCategoriesForRetry.push('dessert');
        if (groupData.experiencesEnabled ?? true) enabledCategoriesForRetry.push('experiences');

        const underrepresentedCategories = enabledCategoriesForRetry
          .filter(category => categoryCounts[category] < 3);

        if (underrepresentedCategories.length > 0) {

          // Set target categories for next attempt
          targetCategories = underrepresentedCategories;

        } else {

        }
      }

      const attemptEnd = Date.now();

    }

    // Store the unique activities (up to 15)
    if (allUniqueActivities.length > 0) {

      // Batch categorize any activities without categories
      const uncategorizedFinal = allUniqueActivities.filter((a: any) => !a.category);

      if (uncategorizedFinal.length > 0) {
        const venuesToCategorize = uncategorizedFinal.map((a: any) => ({
          venueName: a.venueName,
          venueType: a.venueType,
          googleTypes: a.tags || []
        }));

        const categorizations = await categorizeVenuesBatch(venuesToCategorize);

        uncategorizedFinal.forEach((activity: any) => {
          const cacheKey = `${activity.venueName.toLowerCase()}::${activity.venueType.toLowerCase()}`;
          const category = categorizations.get(cacheKey);
          if (category) {
            activity.category = category;
          } else {
            console.warn(`[AI Generation] No category found for ${activity.venueName}, defaulting to 'meal'`);
            activity.category = 'meal';
          }
        });
      }

      // Final category distribution logging
      const finalCategoryCounts: Record<string, number> = {
        meal: 0,
        cafes: 0,
        drinks: 0,
        dessert: 0,
        experiences: 0
      };

      for (const activity of allUniqueActivities) {
        if (activity.category) {
          finalCategoryCounts[activity.category] = (finalCategoryCounts[activity.category] || 0) + 1;
        }
      }

      await storage.createActivities(allUniqueActivities);
      
      // Mark venues as seen in the database to prevent repetitive suggestions
      const venuesToMark = allUniqueActivities.map(a => ({
        venueName: a.venueName,
        googlePlaceId: a.googlePlaceId || undefined,
        category: a.category
      }));
      await storage.markVenuesAsSeen(groupId, venuesToMark);

    } else {
      console.warn(`[AI Generation] WARNING: No unique activities generated after ${maxAttempts} attempts`);
    }

    // Log cache stats to show optimization impact
    const cacheStats = getCacheStats();

    // Update status to completed

    await storage.updateGroupStatus(groupId, "completed");

  } catch (error) {
    console.error("Error in generateAndStoreActivities:", error);

    // Update status to failed with error message
    await storage.updateGroupStatus(
      groupId, 
      "failed", 
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
}
