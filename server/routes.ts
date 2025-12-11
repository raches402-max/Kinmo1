// Reference: javascript_log_in_with_replit blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import * as Sentry from "@sentry/node";
import { storage } from "./storage";
import { insertGroupSchema, insertMemberSchema, updateGroupSchema, updateMemberSchema, insertVotingEventSchema, updateVotingEventSchema, insertItinerarySchema, updateItinerarySchema, updateUserProfileSchema, activities as activitiesTable, groups as groupsTable, members as membersTable, itineraryInvites, guestInvites, rsvps as rsvpsTable, itineraries, itineraryItems, proposedTimeSlots, users, userProfiles, photosCache, geocodingCache, hostAssignments, curatedVenues, votingEvents as votingEventsTable, activitySwipes, activities, votingEvents, swipeSessions, venueVisitHistory, autoScheduledEvents, rejectedEventDates, userSavedPlaces, groupSavedPlaces, standaloneEventInvitees, type UpdateItinerary, type ItineraryItem } from "@shared/schema";
import { generateActivitySuggestions, generateSwipeConcepts, categorizeByTime, categorizeVenue, categorizeVenuesBatch, analyzePreferencePatterns, parseSchedulingPrompt, parseSchedulingPromptWithHistory, detectCategory, getPromptCacheStats, validateVenueForCategory, type SchedulingParams } from "./openai";
import { searchPlaces, searchNearbyPlaces, geocodeLocation, clearPlacesCache, getCacheStats, getPlaceDetails, detectAndParseGoogleMapsUrl, getBestVenueType, getBestVenueTypeSync } from "./google-places";
import { planEventWithAgent, type VenueForAgent } from "./ai-event-agent";
import { setupAuth, isAuthenticated } from "./replitAuth";
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
  userIsMemberOfGroup
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
import { generateOGImage, generateDefaultOGImage, type OGImageParams } from "./og-image";
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
  suggestAlternativesSchema,
} from './validation-schemas';

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
 * Get list of admin emails based on environment
 * In development: includes test admin for automated testing
 * In production: only real admin emails
 */
function getAdminEmails(): string[] {
  const prodAdmins = ['raches402@gmail.com'];

  if (process.env.NODE_ENV === 'development') {
    return [...prodAdmins, 'test-admin@example.com'];
  }

  return prodAdmins;
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

  // Filter out members where the organizer added themselves (by email match or userId match)
  const filteredMembers = regularMembers.filter(m => {
    // If member has userId and it matches organizer, exclude
    if (m.userId === organizerUserId) return false;
    // If member email matches organizer email (case insensitive), exclude
    if (organizerEmail && m.email && m.email.toLowerCase() === organizerEmail.toLowerCase()) return false;
    return true;
  });

  // Build the final members array with organizer first
  const organizer = {
    id: `organizer-${organizerUserId}`, // Virtual ID for organizer
    name: organizerName,
    email: organizerEmail,
    openToHosting: false,
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
  // Set up authentication
  await setupAuth(app);

  // Health check endpoint (for monitoring and load balancers)
  app.get('/api/health', async (req, res) => {
    try {
      // Check database connectivity
      await db.select().from(users).limit(1);

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      console.error('[Health Check] Database connection failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Debug endpoint to check static file paths
  app.get('/api/debug/paths', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const dirname = import.meta.dirname;
    const distPath = path.resolve(dirname, "..", "dist", "public");
    const altPath = path.resolve(dirname, "public");

    res.json({
      dirname,
      distPath,
      distPathExists: fs.existsSync(distPath),
      altPath,
      altPathExists: fs.existsSync(altPath),
      cwd: process.cwd(),
      nodeEnv: process.env.NODE_ENV,
      buildTime: "2025-12-08T01:15:00Z"
    });
  });

  // Rate limiting for public endpoints to prevent scraping and abuse
  const publicEndpointLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

  // OG Image generation for shareable link previews
  // These images show in iMessage, WhatsApp, Slack, etc.
  app.get("/api/og-image/:type/:id", async (req, res) => {
    const { type, id } = req.params;

    // Set caching headers (cache for 1 day)
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.setHeader("Content-Type", "image/png");

    try {
      let imageParams: OGImageParams;

      if (type === "join") {
        // Group join link
        const group = await storage.getGroupByShareableLink(id);
        if (!group) {
          return res.status(404).send("Not found");
        }
        imageParams = {
          groupEmoji: group.emoji || "👋",
          groupName: group.name,
          city: group.locationBase || undefined,
        };
      } else if (type === "rsvp") {
        // Guest RSVP link - look up itinerary from guest token
        // First check rsvps table (member guest RSVPs)
        const [guestRsvp] = await db
          .select()
          .from(rsvpsTable)
          .where(eq(rsvpsTable.guestToken, id))
          .limit(1);

        let itineraryId: string | null = null;

        if (guestRsvp) {
          itineraryId = guestRsvp.itineraryId;
        } else {
          // Try guestInvites table (non-member guest invites)
          const [guestInvite] = await db
            .select()
            .from(guestInvites)
            .where(eq(guestInvites.guestToken, id))
            .limit(1);

          if (guestInvite) {
            itineraryId = guestInvite.itineraryId;
          }
        }

        if (!itineraryId) {
          return res.status(404).send("Not found");
        }

        const itinerary = await storage.getItinerary(itineraryId);
        if (!itinerary || !itinerary.groupId) {
          return res.status(404).send("Not found");
        }

        const group = await storage.getGroup(itinerary.groupId);
        if (!group) {
          return res.status(404).send("Not found");
        }

        // Format the event date (e.g., "Saturday, Dec 14")
        const eventDate = itinerary.eventDate
          ? new Date(itinerary.eventDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })
          : undefined;

        imageParams = {
          groupEmoji: group.emoji || "📅",
          groupName: group.name,
          date: eventDate,
          city: group.locationBase || undefined,
        };
      } else if (type === "claim") {
        // Member claim link
        const [member] = await db
          .select({
            id: membersTable.id,
            name: membersTable.name,
            groupId: membersTable.groupId,
          })
          .from(membersTable)
          .where(sql`claim_token = ${id}`)
          .limit(1);

        if (!member) {
          return res.status(404).send("Not found");
        }

        const group = await storage.getGroup(member.groupId);
        if (!group) {
          return res.status(404).send("Not found");
        }

        imageParams = {
          groupEmoji: group.emoji || "👋",
          groupName: `Join ${group.name}`,
          city: group.locationBase || undefined,
        };
      } else if (type === "default") {
        // Default Kinmo branding image
        const image = await generateDefaultOGImage();
        return res.send(image);
      } else {
        return res.status(400).send("Invalid type");
      }

      const image = await generateOGImage(imageParams);
      res.send(image);
    } catch (error) {
      console.error("[OG Image] Error:", error);
      res.status(500).send("Error generating image");
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      if (!userId) {
        console.error('[Auth] No user ID found in claims:', req.user);
        return res.status(401).json({ message: "Invalid session - no user ID in claims" });
      }

      const user = await storage.getUser(userId);

      if (!user) {
        console.error(`[Auth] User not found in database: ${userId}`);
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("[Auth] Error fetching user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Geocode endpoint - convert address to coordinates
  app.get('/api/geocode', async (req, res) => {
    try {
      const { address } = req.query;
      
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ message: "Address parameter required" });
      }

      const result = await geocodeLocation(address);
      
      if (!result) {
        return res.status(404).json({ message: "Location not found" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Geocode error:", error);
      res.status(500).json({ message: error.message || "Failed to geocode location" });
    }
  });

  // NEW Photo proxy endpoint - for Places API v1 (uses full photo resource name)
  app.get('/api/photos/v1/:photoName(*)', async (req, res) => {
    try {
      const photoName = decodeURIComponent(req.params.photoName);

      if (!photoName) {
        return res.status(400).json({ message: "Photo name is required" });
      }

      // Extract placeId from photoName format: "places/{placeId}/photos/{photoId}"
      const placeIdMatch = photoName.match(/^places\/([^\/]+)\/photos\//);
      const placeId = placeIdMatch ? placeIdMatch[1] : null;

      // Check cache first (use photoName as key)
      const cached = await db
        .select()
        .from(photosCache)
        .where(eq(photosCache.photoReference, photoName))
        .limit(1);

      if (cached.length > 0) {
        const cachedPhoto = cached[0];

        // Check if expired
        if (new Date() > cachedPhoto.expiresAt) {
          console.log(`[Photo Cache v1] EXPIRED - ${photoName}`);
          await db.delete(photosCache).where(eq(photosCache.photoReference, photoName));
        } else {
          console.log(`[Photo Cache v1] HIT - ${photoName}`);
          const imageBuffer = Buffer.from(cachedPhoto.imageData, 'base64');
          res.set('Content-Type', cachedPhoto.contentType);
          res.set('Cache-Control', 'public, max-age=2592000'); // 30 days
          return res.send(imageBuffer);
        }
      }

      // Fallback: Try to find a cached photo for the same placeId (handles ephemeral photo IDs)
      if (placeId) {
        const placeIdCached = await db
          .select()
          .from(photosCache)
          .where(eq(photosCache.placeId, placeId))
          .limit(1);

        if (placeIdCached.length > 0) {
          const cachedPhoto = placeIdCached[0];

          // Check if expired
          if (new Date() > cachedPhoto.expiresAt) {
            console.log(`[Photo Cache v1] EXPIRED (placeId fallback) - ${placeId}`);
            await db.delete(photosCache).where(eq(photosCache.photoReference, cachedPhoto.photoReference));
          } else {
            console.log(`[Photo Cache v1] HIT (placeId fallback) - ${placeId}`);
            const imageBuffer = Buffer.from(cachedPhoto.imageData, 'base64');
            res.set('Content-Type', cachedPhoto.contentType);
            res.set('Cache-Control', 'public, max-age=2592000'); // 30 days
            return res.send(imageBuffer);
          }
        }
      }

      // Not in cache or expired - download from Google using NEW Photos API
      console.log(`[Photo Cache v1] MISS - downloading ${photoName}`);

      const apiKey = process.env.GOOGLE_PLACES_API_KEY_2 || process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google API key not configured" });
      }

      // Try to fetch using the provided photo name first
      let photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400`;
      let photoResponse = await fetch(photoUrl, {
        headers: { 'X-Goog-Api-Key': apiKey },
      });

      let actualPhotoName = photoName;

      // If the photo ID is stale/invalid, try to get a fresh photo from the place
      if (!photoResponse.ok && placeId) {
        console.log(`[Photo Cache v1] Stale photo ID, fetching fresh photo for place ${placeId}`);

        // Fetch place details to get current photo references
        const placeDetailsUrl = `https://places.googleapis.com/v1/places/${placeId}?fields=photos&languageCode=en`;
        const placeResponse = await fetch(placeDetailsUrl, {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'photos',
          },
        });

        if (placeResponse.ok) {
          const placeData = await placeResponse.json();
          if (placeData.photos && placeData.photos.length > 0) {
            // Get the first photo's name (format: places/{placeId}/photos/{photoId})
            actualPhotoName = placeData.photos[0].name;
            console.log(`[Photo Cache v1] Got fresh photo: ${actualPhotoName}`);

            // Fetch the actual photo using the fresh photo name
            photoUrl = `https://places.googleapis.com/v1/${actualPhotoName}/media?maxWidthPx=400`;
            photoResponse = await fetch(photoUrl, {
              headers: { 'X-Goog-Api-Key': apiKey },
            });
          }
        }
      }

      if (!photoResponse.ok) {
        console.error(`[Photo Cache v1] Failed to fetch photo: ${photoResponse.status}`);
        return res.status(404).json({ message: "Photo not found" });
      }

      const photoBuffer = await photoResponse.arrayBuffer();
      const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';
      const base64Data = Buffer.from(photoBuffer).toString('base64');

      // Cache it using the actual photo name (may be different from requested if we refreshed)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      await db
        .insert(photosCache)
        .values({
          photoReference: actualPhotoName,
          placeId: placeId,
          imageData: base64Data,
          contentType,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: photosCache.photoReference,
          set: {
            placeId: placeId,
            imageData: base64Data,
            contentType,
            expiresAt,
          },
        });

      console.log(`[Photo Cache v1] SAVED - ${actualPhotoName} (placeId: ${placeId}, expires in 30 days)`);

      // Return the photo
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=2592000'); // 30 days
      res.send(Buffer.from(photoBuffer));

    } catch (error) {
      console.error("Error fetching photo v1:", error);
      res.status(500).json({ message: "Failed to fetch photo" });
    }
  });

  // LEGACY Photo proxy endpoint - for backwards compatibility with old photo references
  app.get('/api/photos/:photoReference', async (req, res) => {
    try {
      const { photoReference } = req.params;
      
      if (!photoReference) {
        return res.status(400).json({ message: "Photo reference is required" });
      }

      // Check cache first
      const cached = await db
        .select()
        .from(photosCache)
        .where(eq(photosCache.photoReference, photoReference))
        .limit(1);

      if (cached.length > 0) {
        const cachedPhoto = cached[0];
        
        // Check if expired
        if (new Date() > cachedPhoto.expiresAt) {

          await db.delete(photosCache).where(eq(photosCache.photoReference, photoReference));
        } else {

          const imageBuffer = Buffer.from(cachedPhoto.imageData, 'base64');
          res.set('Content-Type', cachedPhoto.contentType);
          res.set('Cache-Control', 'public, max-age=2592000'); // 30 days
          return res.send(imageBuffer);
        }
      }

      // Not in cache or expired - download from Google

      // Use KEY_1 by default for photo downloads (not part of round-robin since photos should be cached)
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google API key not configured" });
      }

      const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
      
      const photoResponse = await fetch(photoUrl);
      if (!photoResponse.ok) {
        console.error(`[Photo Cache] Failed to fetch photo: ${photoResponse.status}`);
        return res.status(404).json({ message: "Photo not found" });
      }

      const photoBuffer = await photoResponse.arrayBuffer();
      const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';
      const base64Data = Buffer.from(photoBuffer).toString('base64');

      // Cache it
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      await db
        .insert(photosCache)
        .values({
          photoReference,
          imageData: base64Data,
          contentType,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: photosCache.photoReference,
          set: {
            imageData: base64Data,
            contentType,
            expiresAt,
          },
        });

      // Return the photo
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=2592000'); // 30 days
      res.send(Buffer.from(photoBuffer));

    } catch (error) {
      console.error("Error fetching photo:", error);
      res.status(500).json({ message: "Failed to fetch photo" });
    }
  });

  // Refresh stale photo URL for a venue (lazy refresh on image error)
  // Requires authentication to prevent abuse
  app.post('/api/venues/:googlePlaceId/refresh-photo', isAuthenticated, async (req, res) => {
    try {
      const { googlePlaceId } = req.params;

      if (!googlePlaceId) {
        return res.status(400).json({ message: "Google Place ID is required" });
      }

      // Fetch fresh place details from Google Places API
      const placeDetails = await getPlaceDetails(googlePlaceId);

      if (!placeDetails?.photoUrl) {

        return res.status(404).json({ message: "No photo available for this place" });
      }

      // Update all voting_events with this googlePlaceId
      const updatedVotingEvents = await db
        .update(votingEvents)
        .set({ photoUrl: placeDetails.photoUrl })
        .where(eq(votingEvents.googlePlaceId, googlePlaceId))
        .returning({ id: votingEvents.id, title: votingEvents.title });

      // Also update complementary place photos if they match
      const updatedComplementary1 = await db
        .update(votingEvents)
        .set({ complementaryPlacePhotoUrl: placeDetails.photoUrl })
        .where(eq(votingEvents.complementaryPlaceId, googlePlaceId))
        .returning({ id: votingEvents.id });

      const updatedComplementary2 = await db
        .update(votingEvents)
        .set({ complementaryPlacePhotoUrl2: placeDetails.photoUrl })
        .where(eq(votingEvents.complementaryPlaceId2, googlePlaceId))
        .returning({ id: votingEvents.id });

      // Update curated_venues table if exists
      await db
        .update(curatedVenues)
        .set({ photoUrl: placeDetails.photoUrl })
        .where(eq(curatedVenues.googlePlaceId, googlePlaceId));

      // Update user_saved_places table
      await db
        .update(userSavedPlaces)
        .set({ photoUrl: placeDetails.photoUrl })
        .where(eq(userSavedPlaces.googlePlaceId, googlePlaceId));

      // Update group_saved_places table
      await db
        .update(groupSavedPlaces)
        .set({ photoUrl: placeDetails.photoUrl })
        .where(eq(groupSavedPlaces.googlePlaceId, googlePlaceId));

      const totalUpdated = updatedVotingEvents.length + updatedComplementary1.length + updatedComplementary2.length;

      res.json({
        success: true,
        photoUrl: placeDetails.photoUrl,
        updatedCount: totalUpdated,
        venues: updatedVotingEvents.map(v => v.title)
      });

    } catch (error: any) {
      console.error("[Photo Refresh] Error:", error);
      res.status(500).json({ message: error.message || "Failed to refresh photo" });
    }
  });

  // Bulk import curated venues (admin only - for seeding SF data)
  app.post('/api/admin/import-venues', isAuthenticated, requireAdmin(), async (req, res) => {
    try {

      // Validate request body
      const validatedData = safeParse(importVenuesSchema, req.body, res);
      if (!validatedData) return;

      const { venues } = validatedData;

      // Helper to extract Place ID from Google Maps URL
      const extractPlaceId = (url: string): string | null => {
        const match = url.match(/query_place_id=([^&]+)/);
        return match ? match[1] : null;
      };

      // Map category names to our system categories
      const mapCategory = (categoryName: string): string => {
        const lower = categoryName.toLowerCase();
        if (lower.includes('bar') || lower.includes('pub') || lower.includes('brewery')) return 'drinks';
        if (lower.includes('restaurant') || lower.includes('dining')) return 'meal';
        if (lower.includes('cafe') || lower.includes('coffee')) return 'cafes';
        if (lower.includes('dessert') || lower.includes('ice cream') || lower.includes('bakery')) return 'dessert';
        if (lower.includes('museum') || lower.includes('theater') || lower.includes('concert')) return 'experiences';
        return 'experiences'; // default
      };

      const imported = [];
      const skipped = [];

      for (const venue of venues) {
        try {
          const placeId = extractPlaceId(venue.url);
          if (!placeId) {
            skipped.push({ venue: venue.title, reason: 'No Place ID found' });
            continue;
          }

          // Check if already exists
          const existing = await db
            .select()
            .from(curatedVenues)
            .where(eq(curatedVenues.googlePlaceId, placeId))
            .limit(1);

          if (existing.length > 0) {
            skipped.push({ venue: venue.title, reason: 'Already exists' });
            continue;
          }

          // Build full address
          const address = `${venue.street || ''}, ${venue.city || ''}, ${venue.state || ''} ${venue.countryCode || ''}`.trim();

          // Try to geocode the address (if geocodingCache has it)
          let latitude = "0";
          let longitude = "0";
          
          try {
            const cached = await db
              .select()
              .from(geocodingCache)
              .where(eq(geocodingCache.location, address))
              .limit(1);
            
            if (cached.length > 0) {
              latitude = cached[0].latitude;
              longitude = cached[0].longitude;
            } else {
              // Geocode on the fly
              const geocoded = await geocodeLocation(address);
              if (geocoded) {
                latitude = geocoded.latitude.toString();
                longitude = geocoded.longitude.toString();
              }
            }
          } catch (geocodeError) {

          }

          // Insert venue
          await db.insert(curatedVenues).values({
            name: venue.title,
            address,
            latitude,
            longitude,
            category: mapCategory(venue.categoryName || 'other'),
            rating: venue.totalScore?.toString() || null,
            reviewCount: venue.reviewsCount || null,
            priceLevel: null, // Not in source data
            photoUrl: null, // Will be populated on first use
            googlePlaceId: placeId,
            description: null,
            tags: venue.categoryName ? [venue.categoryName] : [], // Store original category as tag
            region: 'san_francisco',
            isActive: true,
            source: 'api_scrape',
          });

          imported.push(venue.title);
        } catch (venueError) {
          console.error(`[Venue Import] Error importing ${venue.title}:`, venueError);
          skipped.push({ venue: venue.title, reason: 'Import error' });
        }
      }

      res.json({
        success: true,
        imported: imported.length,
        skipped: skipped.length,
        details: { imported: imported.slice(0, 10), skipped: skipped.slice(0, 10) }
      });

    } catch (error) {
      console.error("[Venue Import] Error:", error);
      res.status(500).json({ message: "Failed to import venues" });
    }
  });

  // User profile routes
  app.get("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const profile = await storage.getUserProfile(userId);
      res.json(profile || { displayName: '', bio: '', emailNotifications: true });
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const validatedData = updateUserProfileSchema.parse(req.body);
      const profile = await storage.upsertUserProfile(userId, validatedData);
      res.json(profile);
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid profile data", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's global preferences (from userProfiles)
  app.get("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const profile = await storage.getUserProfile(userId);

      // Return preferences-specific fields
      res.json({
        budgetMin: profile?.budgetMin || null,
        budgetMax: profile?.budgetMax || null,
        activityPreferences: profile?.activityPreferences || [],
        personalAvailability: profile?.personalAvailability || null,
        emailNotifications: profile?.emailNotifications ?? true,
      });
    } catch (error: any) {
      console.error("Error fetching user preferences:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update user's global preferences
  app.patch("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      // Validate request body
      const validatedData = safeParse(updateUserPreferencesSchema, req.body, res);
      if (!validatedData) return;
      const { budgetMin, budgetMax, activityPreferences, personalAvailability, emailNotifications } = validatedData;
      const updateData: any = {};

      if (budgetMin !== undefined) updateData.budgetMin = budgetMin;
      if (budgetMax !== undefined) updateData.budgetMax = budgetMax;
      if (activityPreferences !== undefined) updateData.activityPreferences = activityPreferences;
      if (personalAvailability !== undefined) updateData.personalAvailability = personalAvailability;
      if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;

      const profile = await storage.upsertUserProfile(userId, updateData);

      // Return preferences-specific fields
      res.json({
        budgetMin: profile.budgetMin,
        budgetMax: profile.budgetMax,
        activityPreferences: profile.activityPreferences,
        personalAvailability: profile.personalAvailability,
        emailNotifications: profile.emailNotifications,
      });
    } catch (error: any) {
      console.error("Error updating user preferences:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get group-specific preference overrides
  app.get("/api/user/preferences/groups/:groupId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;

      // Verify user has access to this group
      const hasAccess = await userOwnsGroup(userId, groupId) || await userIsMemberOfGroup(userId, groupId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const preferences = await storage.getMemberGroupPreferences(userId, groupId);
      res.json(preferences || {
        budgetOverrideMin: null,
        budgetOverrideMax: null,
        categoryPreferencesOverride: null,
        availabilityOverride: null,
        meetingFrequencyOverride: null,
      });
    } catch (error: any) {
      console.error("Error fetching group preferences:", error);
      if (error.message === "Unauthorized") {
        return res.status(403).json({ message: "You don't have access to this group" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Update group-specific preference overrides
  app.patch("/api/user/preferences/groups/:groupId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;

      // Verify user has access to this group
      const hasAccess = await userOwnsGroup(userId, groupId) || await userIsMemberOfGroup(userId, groupId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Validate request body
      const validatedData = safeParse(updateMemberGroupPreferencesSchema, req.body, res);
      if (!validatedData) return;
      const {
        budgetOverrideMin,
        budgetOverrideMax,
        categoryPreferencesOverride,
        availabilityOverride,
        meetingFrequencyOverride,
      } = validatedData;

      const updateData: any = {};
      if (budgetOverrideMin !== undefined) updateData.budgetOverrideMin = budgetOverrideMin;
      if (budgetOverrideMax !== undefined) updateData.budgetOverrideMax = budgetOverrideMax;
      if (categoryPreferencesOverride !== undefined) updateData.categoryPreferencesOverride = categoryPreferencesOverride;
      if (availabilityOverride !== undefined) updateData.availabilityOverride = availabilityOverride;
      if (meetingFrequencyOverride !== undefined) updateData.meetingFrequencyOverride = meetingFrequencyOverride;

      const preferences = await storage.upsertMemberGroupPreferences(userId, groupId, updateData);
      res.json(preferences);
    } catch (error: any) {
      console.error("Error updating group preferences:", error);
      if (error.message === "Unauthorized") {
        return res.status(403).json({ message: "You don't have access to this group" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Get AI-learned constraint analysis for a member
  app.get("/api/members/:memberId/constraint-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { memberId } = req.params;

      // Get member's current constraints
      const member = await db.select()
        .from(membersTable)
        .where(eq(membersTable.id, memberId))
        .limit(1);

      if (member.length === 0) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Verify user has access to this member's group
      const hasAccess = await userOwnsGroup(userId, member[0].groupId) || await userIsMemberOfGroup(userId, member[0].groupId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const currentConstraints = member[0].memberConstraints as any || {};
      const groupId = member[0].groupId;

      // Analyze RSVP patterns to get current patterns
      const patterns = await analyzeRSVPPatterns(memberId, groupId);

      // Calculate confidence percentages
      const budgetConfidence = patterns.totalRSVPs > 0
        ? Math.round((patterns.budgetConcernCount / patterns.totalRSVPs) * 100)
        : 0;
      const locationConfidence = patterns.totalRSVPs > 0
        ? Math.round((patterns.locationConcernCount / patterns.totalRSVPs) * 100)
        : 0;
      const timeConfidence = patterns.totalRSVPs > 0
        ? Math.round((patterns.timeConcernCount / patterns.totalRSVPs) * 100)
        : 0;

      // Build suggestions based on patterns
      const suggestions = [];

      if (patterns.budgetConcernCount >= 3 && !currentConstraints.budgetConcern) {
        suggestions.push({
          type: 'budgetConcern',
          title: 'Budget is a frequent concern',
          description: `Mentioned in ${patterns.budgetConcernCount} of ${patterns.totalRSVPs} recent RSVPs`,
          confidence: budgetConfidence,
          action: 'accept',
        });
      }

      if (patterns.locationConcernCount >= 3 && !currentConstraints.distanceConcern) {
        suggestions.push({
          type: 'distanceConcern',
          title: 'Location/distance is often mentioned',
          description: `Mentioned in ${patterns.locationConcernCount} of ${patterns.totalRSVPs} recent RSVPs`,
          confidence: locationConfidence,
          action: 'accept',
        });
      }

      if (patterns.timeConcernCount >= 3) {
        suggestions.push({
          type: 'timeConcern',
          title: 'Timing conflicts detected',
          description: `Mentioned in ${patterns.timeConcernCount} of ${patterns.totalRSVPs} recent RSVPs`,
          confidence: timeConfidence,
          action: 'accept',
        });
      }

      // Check for schedule conflicts
      if (patterns.unavailableDays.length >= 3) {
        const dayFrequency: Record<string, number> = {};
        patterns.unavailableDays.forEach(day => {
          dayFrequency[day] = (dayFrequency[day] || 0) + 1;
        });

        const frequentDays = Object.entries(dayFrequency)
          .filter(([_, count]) => count >= 2)
          .map(([day]) => day);

        if (frequentDays.length > 0 &&
            !currentConstraints.scheduleConflicts?.some((d: string) => frequentDays.includes(d))) {
          suggestions.push({
            type: 'scheduleConflicts',
            title: `${frequentDays.join(', ')} seem difficult`,
            description: `You've mentioned these days as unavailable multiple times`,
            confidence: Math.round((Math.max(...Object.values(dayFrequency)) / patterns.totalRSVPs) * 100),
            action: 'accept',
            data: frequentDays,
          });
        }
      }

      res.json({
        currentConstraints,
        patterns: {
          budgetConcernCount: patterns.budgetConcernCount,
          locationConcernCount: patterns.locationConcernCount,
          timeConcernCount: patterns.timeConcernCount,
          unavailableDays: patterns.unavailableDays,
          totalRSVPs: patterns.totalRSVPs,
        },
        suggestions,
      });
    } catch (error: any) {
      console.error("Error analyzing member constraints:", error);
      if (error.message === "Unauthorized") {
        return res.status(403).json({ message: "You don't have access to this member" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Update member constraints (accept/dismiss AI suggestions)
  app.patch("/api/members/:memberId/constraints", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { memberId } = req.params;

      // Validate request body
      const validatedData = safeParse(updateMemberConstraintsActionSchema, req.body, res);
      if (!validatedData) return;
      const { action, constraintType, data } = validatedData;

      // Get current member data
      const member = await db.select()
        .from(membersTable)
        .where(eq(membersTable.id, memberId))
        .limit(1);

      if (member.length === 0) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Verify user has access to this member's group
      const hasAccess = await userOwnsGroup(userId, member[0].groupId) || await userIsMemberOfGroup(userId, member[0].groupId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const currentConstraints = member[0].memberConstraints as any || {};

      if (action === 'accept') {
        // Update constraints based on type
        if (constraintType === 'budgetConcern') {
          currentConstraints.budgetConcern = true;
        } else if (constraintType === 'distanceConcern') {
          currentConstraints.distanceConcern = true;
        } else if (constraintType === 'scheduleConflicts' && data) {
          currentConstraints.scheduleConflicts = [
            ...(currentConstraints.scheduleConflicts || []),
            ...data.filter((d: string) => !currentConstraints.scheduleConflicts?.includes(d))
          ];
        }

        // Update member in database
        await db.update(membersTable)
          .set({ memberConstraints: currentConstraints })
          .where(eq(membersTable.id, memberId));

        res.json({ success: true, constraints: currentConstraints });
      } else {
        // action === 'dismiss' - User dismissed the suggestion
        res.json({ success: true, message: 'Suggestion dismissed' });
      }
    } catch (error: any) {
      console.error("Error updating member constraints:", error);
      if (error.message === "Unauthorized") {
        return res.status(403).json({ message: "You don't have access to this member" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's groups
  app.get("/api/user/groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const groups = await storage.getUserGroups(userId);
      res.json(groups);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all contacts across user's groups (for standalone event invites)
  app.get("/api/user/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const contacts = await storage.getUserContacts(userId);
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Export user groups as backup (downloadable JSON)
  app.get("/api/user/groups/backup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const groups = await storage.getUserGroups(userId);
      
      // Create backup object with timestamp
      const backup = {
        exportedAt: new Date().toISOString(),
        userId: userId,
        groupCount: groups.length,
        groups: groups
      };
      
      // Set headers for download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="kinmo-backup-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(backup);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's group collections
  app.get("/api/user/collections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const collections = await storage.getUserGroupCollections(userId);
      res.json(collections);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get member dashboard data (all groups, events, stats)
  app.get("/api/user/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      // Get user info
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get all groups where user is a member
      const memberGroups = await db
        .select({
          groupId: membersTable.groupId,
          memberId: membersTable.id,
          memberSince: membersTable.createdAt,
          isOrganizer: membersTable.isOrganizer,
        })
        .from(membersTable)
        .where(eq(membersTable.userId, userId));

      // Get groups where user is the organizer (owner)
      const ownedGroups = await db
        .select({
          id: groupsTable.id,
          name: groupsTable.name,
          emoji: groupsTable.emoji,
          locationBase: groupsTable.locationBase,
          createdAt: groupsTable.createdAt,
        })
        .from(groupsTable)
        .where(eq(groupsTable.userId, userId));

      // Combine member groups and owned groups
      const allGroupIds = new Set([
        ...memberGroups.map(m => m.groupId),
        ...ownedGroups.map(g => g.id)
      ]);

      // Get full group details for all groups (using Promise.allSettled for resilience)
      const groupResults = await Promise.allSettled(
        Array.from(allGroupIds).map(async (groupId) => {
          const [group] = await db
            .select()
            .from(groupsTable)
            .where(eq(groupsTable.id, groupId));

          if (!group || group.deletedAt) return null;

          // Find member record if exists
          const memberRecord = memberGroups.find(m => m.groupId === groupId);
          const isOwner = group.userId === userId;

          // Get member count
          const memberCount = await db
            .select({ count: sql<number>`cast(count(*) as int)` })
            .from(membersTable)
            .where(eq(membersTable.groupId, groupId));

          // Get upcoming events count
          const upcomingEventsCount = await db
            .select({ count: sql<number>`cast(count(*) as int)` })
            .from(itineraries)
            .where(
              and(
                eq(itineraries.groupId, groupId),
                or(
                  eq(itineraries.status, 'proposed'),
                  eq(itineraries.status, 'scheduled')
                ),
                gte(itineraries.eventDate, new Date())
              )
            );

          return {
            id: group.id,
            name: group.name,
            emoji: group.emoji,
            locationBase: group.locationBase,
            memberSince: memberRecord?.memberSince || group.createdAt,
            isOrganizer: isOwner || (memberRecord?.isOrganizer || false),
            isOwner,
            memberCount: memberCount[0]?.count || 0,
            upcomingEvents: upcomingEventsCount[0]?.count || 0,
          };
        })
      );

      // Extract successful results, log failures
      const groups = groupResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      const failedGroups = groupResults.filter(r => r.status === 'rejected');
      if (failedGroups.length > 0) {
        console.error(`[Dashboard] ${failedGroups.length}/${allGroupIds.size} group fetches failed`);
      }

      // Filter out nulls
      const validGroups = groups.filter(g => g !== null);

      // Get all itineraries for these groups
      const allItineraries = await db
        .select({
          id: itineraries.id,
          groupId: itineraries.groupId,
          name: itineraries.name,
          status: itineraries.status,
          eventDate: itineraries.eventDate,
          createdAt: itineraries.createdAt,
        })
        .from(itineraries)
        .where(
          and(
            sql`group_id IN (${sql.join(Array.from(allGroupIds), sql`, `)})`,
            or(
              eq(itineraries.status, 'proposed'),
              eq(itineraries.status, 'scheduled'),
              eq(itineraries.status, 'completed')
            )
          )
        )
        .orderBy(desc(itineraries.eventDate));

      // Get RSVPs for all itineraries
      const allRsvps = await db
        .select()
        .from(rsvpsTable)
        .where(
          or(
            eq(rsvpsTable.userId, userId),
            sql`member_id IN (SELECT id FROM members WHERE user_id = ${userId})`
          )
        );

      // Categorize events
      const now = new Date();
      const upcomingEvents = [];
      const pastEvents = [];
      let totalInvited = 0;
      let totalAttended = 0;
      let totalResponded = 0;

      for (const itinerary of allItineraries) {
        const group = validGroups.find(g => g.id === itinerary.groupId);
        if (!group) continue;

        const rsvp = allRsvps.find(r => r.itineraryId === itinerary.id);
        const isPast = itinerary.eventDate && itinerary.eventDate < now;

        // Get itinerary items for preview
        const items = await db
          .select()
          .from(itineraryItems)
          .where(eq(itineraryItems.itineraryId, itinerary.id))
          .orderBy(itineraryItems.orderIndex)
          .limit(3);

        const eventData = {
          id: itinerary.id,
          name: itinerary.name,
          groupId: itinerary.groupId,
          groupName: group.name,
          groupEmoji: group.emoji,
          status: itinerary.status,
          eventDate: itinerary.eventDate,
          rsvpStatus: rsvp?.response || null,
          isOrganizer: group.isOrganizer,
          attended: rsvp?.response === 'yes',
          venues: items.map(item => ({
            name: item.venueName,
            type: item.venueType,
          })),
        };

        totalInvited++;
        if (rsvp?.response) totalResponded++;
        if (rsvp?.response === 'yes') totalAttended++;

        if (isPast) {
          pastEvents.push(eventData);
        } else {
          upcomingEvents.push(eventData);
        }
      }

      // Calculate stats
      const stats = {
        totalGroups: validGroups.length,
        totalEventsInvited: totalInvited,
        totalEventsAttended: totalAttended,
        attendanceRate: totalInvited > 0 ? Math.round((totalAttended / totalInvited) * 100) : 0,
        rsvpResponseRate: totalInvited > 0 ? Math.round((totalResponded / totalInvited) * 100) : 0,
      };

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        },
        groups: validGroups,
        upcomingEvents: upcomingEvents.slice(0, 10), // Limit to 10 most recent
        pastEvents: pastEvents.slice(0, 10), // Limit to 10 most recent
        stats,
      });
    } catch (error) {
      console.error("Error fetching member dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Create a new group collection
  app.post("/api/user/collections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      // Validate request body
      const validatedData = safeParse(createCollectionSchema, req.body, res);
      if (!validatedData) return;
      const { name, orderIndex } = validatedData;

      const collection = await storage.createGroupCollection(userId, { name, orderIndex });
      res.json(collection);
    } catch (error: any) {
      console.error("[Create Collection] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update a group collection
  app.patch("/api/user/collections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = await getUserId(req);

      // Validate request body
      const validatedData = safeParse(updateCollectionSchema, req.body, res);
      if (!validatedData) return;
      const { name } = validatedData;

      // Verify ownership
      const collections = await storage.getUserGroupCollections(userId);
      const collection = collections.find(c => c.id === id);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }

      const updated = await storage.updateGroupCollection(id, { name });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a group collection
  app.delete("/api/user/collections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = await getUserId(req);
      
      // Verify ownership
      const collections = await storage.getUserGroupCollections(userId);
      const collection = collections.find(c => c.id === id);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      
      await storage.deleteGroupCollection(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reorder group collections
  app.patch("/api/user/collections/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      // Validate request body
      const validatedData = safeParse(reorderCollectionsSchema, req.body, res);
      if (!validatedData) return;
      const { collectionOrders } = validatedData;

      // Verify all collections belong to this user
      const userCollections = await storage.getUserGroupCollections(userId);
      const userCollectionIds = new Set(userCollections.map(c => c.id));
      const allOwned = collectionOrders.every((order) => userCollectionIds.has(order.id));

      if (!allOwned) {
        return res.status(403).json({ message: "You don't own all these collections" });
      }

      await storage.reorderGroupCollections(collectionOrders);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Reorder Collections] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update group's collection assignment
  app.patch("/api/groups/:id/collection", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = await getUserId(req);
      const { collectionId, orderIndex } = req.body;
      
      // Verify user owns the group
      const group = await storage.getGroup(id);
      if (!group || group.userId !== userId) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // If collectionId is provided, verify user owns that collection too
      if (collectionId) {
        const collections = await storage.getUserGroupCollections(userId);
        const collection = collections.find(c => c.id === collectionId);
        if (!collection) {
          return res.status(404).json({ message: "Collection not found" });
        }
      }
      
      await storage.updateGroupCollectionAssignment(id, collectionId, orderIndex);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reorder groups within a collection or uncategorized
  app.patch("/api/groups/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupOrders } = req.body; // Array of { id, orderIndex }
      
      // Verify all groups belong to this user
      const userGroups = await storage.getUserGroups(userId);
      const userGroupIds = new Set(userGroups.map(g => g.id));
      const allOwned = groupOrders.every((order: any) => userGroupIds.has(order.id));
      
      if (!allOwned) {
        return res.status(403).json({ message: "You don't own all these groups" });
      }
      
      await storage.reorderGroupsInCollection(groupOrders);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's events (all itinerary invites for this user)
  // Supports optional ?groupId= query param to filter events for a specific group
  app.get("/api/user/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const filterGroupId = req.query.groupId as string | undefined;

      // Build where conditions
      const whereConditions = [isNull(groupsTable.deletedAt)];
      if (filterGroupId) {
        whereConditions.push(eq(itineraries.groupId, filterGroupId));
      }

      // Find all itinerary invites for this user
      // This includes both member invites and organizer invites (memberId = null)
      const invitesQuery = await db
        .select({
          inviteId: itineraryInvites.id,
          inviteToken: itineraryInvites.inviteToken,
          itineraryId: itineraryInvites.itineraryId,
          memberId: itineraryInvites.memberId,
          itineraryName: itineraries.name,
          eventDate: itineraries.eventDate,
          status: itineraries.status,
          groupId: itineraries.groupId,
          groupName: groupsTable.name,
          groupEmoji: groupsTable.emoji,
          groupAccentColor: groupsTable.accentColor,
          groupTimezone: groupsTable.timezone,
          groupUserId: groupsTable.userId,
        })
        .from(itineraryInvites)
        .leftJoin(itineraries, eq(itineraryInvites.itineraryId, itineraries.id))
        .leftJoin(groupsTable, eq(itineraries.groupId, groupsTable.id))
        .where(and(...whereConditions));

      // Filter to only invites relevant to this user
      const verifiedInvites = [];
      const seenItineraryIds = new Set<string>();

      for (const invite of invitesQuery) {
        // Skip if itineraryId is null/undefined
        if (!invite.itineraryId) {
          continue;
        }

        // Skip if we've already added this itinerary for this user
        if (seenItineraryIds.has(invite.itineraryId)) {
          continue;
        }

        // Check if user is the group organizer
        const isGroupOrganizer = invite.groupUserId === userId;

        if (isGroupOrganizer) {
          // User owns the group - add as organizer
          verifiedInvites.push({ ...invite, isOrganizer: true });
          seenItineraryIds.add(invite.itineraryId);
        } else if (invite.memberId) {
          // Not the organizer - check if they're a claimed member
          const member = await storage.getMember(invite.memberId);
          if (member && member.userId === userId) {
            verifiedInvites.push({ ...invite, isOrganizer: false });
            seenItineraryIds.add(invite.itineraryId);
          }
        }
      }

      // Fetch RSVP status and itinerary items for each invite (using Promise.allSettled for resilience)
      const eventResults = await Promise.allSettled(verifiedInvites.map(async (invite) => {
        // Get RSVP if it exists
        let rsvp = null;
        if (invite.isOrganizer) {
          // For organizers, check for RSVP by userId (no memberId)
          const rsvps = await db
            .select()
            .from(rsvpsTable)
            .where(
              sql`itinerary_id = ${invite.itineraryId} AND user_id = ${userId} AND member_id IS NULL`
            );
          rsvp = rsvps[0] || null;
        } else if (invite.memberId) {
          // For members, check by memberId
          const rsvps = await db
            .select()
            .from(rsvpsTable)
            .where(
              sql`itinerary_id = ${invite.itineraryId} AND member_id = ${invite.memberId}`
            );
          rsvp = rsvps[0] || null;
        }

        // Get itinerary items
        const items = await db
          .select()
          .from(itineraryItems)
          .where(eq(itineraryItems.itineraryId, invite.itineraryId))
          .orderBy(itineraryItems.orderIndex);

        // Get itinerary to check hosting info
        const [itinerary] = await db
          .select()
          .from(itineraries)
          .where(eq(itineraries.id, invite.itineraryId));

        // Get host member info if exists
        let hostMemberName = null;
        if (itinerary?.hostMemberId) {
          const [hostMember] = await db
            .select({ name: membersTable.name })
            .from(membersTable)
            .where(eq(membersTable.id, itinerary.hostMemberId));
          hostMemberName = hostMember?.name || null;
        }

        // Get group members including organizer (filters out duplicate self-adds)
        const groupMembers = invite.groupId && invite.groupUserId
          ? await getGroupMembersWithOrganizer(invite.groupId, invite.groupUserId)
          : [];

        // Get current user's member ID and hosting status
        let currentUserMemberId = null;
        let currentUserOpenToHosting = false;
        if (!invite.isOrganizer && invite.memberId) {
          currentUserMemberId = invite.memberId;
          const member = groupMembers.find(m => m.id === invite.memberId);
          currentUserOpenToHosting = member?.openToHosting || false;
        }

        // Get all RSVPs for this itinerary (excluding pending guest approvals)
        const allRsvps = await db
          .select()
          .from(rsvpsTable)
          .where(
            sql`itinerary_id = ${invite.itineraryId} AND (requires_approval = false OR approved = true)`
          );

        // Map RSVPs to member/user names for summary
        const rsvpSummary = {
          yes: [] as string[],
          maybe: [] as string[],
          no: [] as string[],
        };

        // Build detailed RSVP list with additional attendees and kids count
        const detailedRsvps: Array<{name: string; response: string; additionalAttendees: any[]; numberOfKids: number; isGuest: boolean}> = [];

        // Track names already added to avoid duplicates (e.g., organizer appearing twice)
        const processedNames = new Set<string>();

        for (const r of allRsvps) {
          let name = '';
          if (r.memberId) {
            const member = groupMembers.find(m => m.id === r.memberId);
            name = member?.name || member?.email || 'Unknown';
          } else if (r.userId) {
            // Organizer RSVP - get user name with proper fallback chain
            const [userInfo] = await db
              .select({
                displayName: userProfiles.displayName,
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email
              })
              .from(users)
              .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
              .where(eq(users.id, r.userId));

            if (userInfo) {
              name = userInfo.displayName ||
                     (userInfo.firstName && userInfo.lastName
                       ? `${userInfo.firstName} ${userInfo.lastName}`
                       : userInfo.firstName || userInfo.email || 'Organizer');
            } else {
              name = 'Organizer';
            }
          } else if (r.guestName) {
            // Guest RSVP
            name = r.guestName;
          }

          // Only add if we have a name, response, and haven't already added this person
          const nameLower = name.toLowerCase();
          if (name && r.response && !processedNames.has(nameLower)) {
            processedNames.add(nameLower);
            rsvpSummary[r.response as 'yes' | 'maybe' | 'no'].push(name);

            // Add detailed RSVP info
            detailedRsvps.push({
              name,
              response: r.response,
              additionalAttendees: Array.isArray(r.additionalAttendees) ? r.additionalAttendees : [],
              numberOfKids: r.numberOfKids || 0,
              isGuest: !!r.guestName,
            });
          }
        }

        // Get pending guest RSVPs (for organizers only)
        const pendingGuestRsvps = invite.isOrganizer ? await db
          .select()
          .from(rsvpsTable)
          .where(
            sql`itinerary_id = ${invite.itineraryId} AND requires_approval = true AND approved = false`
          ) : [];

        // Get all guest invites for this itinerary
        const allGuestInvites = await db
          .select()
          .from(guestInvites)
          .where(eq(guestInvites.itineraryId, invite.itineraryId));

        // Add guest invites to detailed RSVPs (only if not already added from rsvps table)
        for (const gi of allGuestInvites) {
          const guestNameLower = gi.guestName.toLowerCase();
          // Only add if they have responded and aren't already in the list
          if (gi.rsvpStatus && gi.rsvpStatus !== null && !processedNames.has(guestNameLower)) {
            processedNames.add(guestNameLower);
            detailedRsvps.push({
              name: gi.guestName,
              response: gi.rsvpStatus,
              additionalAttendees: [],
              numberOfKids: 0,
              isGuest: true,
            });

            // Add to RSVP summary
            if (gi.rsvpStatus in rsvpSummary) {
              rsvpSummary[gi.rsvpStatus as 'yes' | 'maybe' | 'no'].push(gi.guestName);
            }
          }
        }

        console.log('[DEBUG /api/user/events] Event:', invite.itineraryName, 'groupMembers count:', groupMembers.length, 'members:', groupMembers.map(m => m.name));

        // For organizers, get the shareable invite token (memberId IS NULL)
        // This is the generic link they can share with anyone
        let shareableInviteToken = invite.inviteToken;
        if (invite.isOrganizer) {
          const [shareableInvite] = await db
            .select({ inviteToken: itineraryInvites.inviteToken })
            .from(itineraryInvites)
            .where(
              and(
                eq(itineraryInvites.itineraryId, invite.itineraryId),
                isNull(itineraryInvites.memberId)
              )
            )
            .limit(1);
          if (shareableInvite) {
            shareableInviteToken = shareableInvite.inviteToken;
          } else {
            // No shareable token exists (legacy event) - create one now
            const crypto = await import('crypto');
            const newShareableToken = crypto.randomUUID();
            await db.insert(itineraryInvites).values({
              itineraryId: invite.itineraryId,
              memberId: null,
              inviteToken: newShareableToken,
            });
            shareableInviteToken = newShareableToken;
            console.log(`[User Events] Created shareable invite token for legacy itinerary ${invite.itineraryId}`);
          }
        }

        return {
          inviteId: invite.inviteId,
          inviteToken: shareableInviteToken,
          itineraryId: invite.itineraryId,
          itineraryName: invite.itineraryName,
          eventDate: invite.eventDate,
          status: invite.status,
          inviteSentAt: itinerary?.inviteSentAt || null,
          rsvpDeadline: itinerary?.rsvpDeadline || null,
          groupId: invite.groupId,
          groupName: invite.groupName,
          groupEmoji: invite.groupEmoji,
          groupAccentColor: invite.groupAccentColor,
          groupTimezone: invite.groupTimezone,
          isOrganizer: invite.isOrganizer,
          hostMemberId: itinerary?.hostMemberId || null,
          hostMemberName,
          currentUserMemberId,
          currentUserOpenToHosting,
          members: groupMembers, // Already includes organizer and filters duplicates
          rsvp: rsvp ? {
            response: rsvp.response,
            rsvpFeedback: rsvp.rsvpFeedback,
            postEventFeedback: rsvp.postEventFeedback,
          } : null,
          rsvpSummary,
          detailedRsvps,
          pendingGuestRsvps: pendingGuestRsvps.map(gr => ({
            id: gr.id,
            guestName: gr.guestName,
            response: gr.response,
            additionalAttendees: gr.additionalAttendees,
            numberOfKids: gr.numberOfKids,
          })),
          items: items.map(item => ({
            id: item.id,
            sourceId: item.sourceId,
            venueName: item.venueName,
            venueType: item.venueType,
            venueAddress: item.venueAddress,
            photoUrl: item.photoUrl,
            rating: item.rating,
            googlePlaceId: item.googlePlaceId,
            notes: item.notes,
            googleMapsUrl: item.googleMapsUrl,
            sourceType: item.sourceType,
            arrivalTime: item.arrivalTime,
            departureTime: item.departureTime,
            travelNotes: item.travelNotes,
          })),
        };
      }));

      // Extract successful results, log failures
      const events = eventResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      const failedEvents = eventResults.filter(r => r.status === 'rejected');
      if (failedEvents.length > 0) {
        console.error(`[User Events] ${failedEvents.length}/${verifiedInvites.length} event fetches failed`);
        failedEvents.forEach((f, i) => {
          if (f.status === 'rejected') {
            console.error(`[User Events] Failed event ${i}:`, f.reason);
          }
        });
      }

      // Add draft and proposed itineraries (auto-created for scheduled groups, or manually created but not yet sent)
      // Only include itineraries that don't already have invites (to avoid duplicates)
      const existingItineraryIds = verifiedInvites.map(inv => inv.itineraryId);

      // Build draft where conditions
      const draftWhereConditions = [
        or(
          eq(itineraries.status, 'draft'),
          eq(itineraries.status, 'proposed')
        ),
        eq(itineraries.isSaved, false),
        sql`${itineraries.groupId} IN (SELECT id FROM groups WHERE user_id = ${userId})`,
        // Exclude itineraries that already have invites
        existingItineraryIds.length > 0
          ? sql`${itineraries.id} NOT IN (${sql.join(existingItineraryIds.map(id => sql`${id}`), sql`, `)})`
          : sql`1=1`
      ];

      // Add groupId filter if provided
      if (filterGroupId) {
        draftWhereConditions.push(eq(itineraries.groupId, filterGroupId));
      }

      const draftItineraries = await db
        .select({
          itineraryId: itineraries.id,
          itineraryName: itineraries.name,
          eventDate: itineraries.eventDate,
          status: itineraries.status,
          groupId: itineraries.groupId,
          groupName: groupsTable.name,
          groupEmoji: groupsTable.emoji,
          groupAccentColor: groupsTable.accentColor,
        })
        .from(itineraries)
        .leftJoin(groupsTable, eq(itineraries.groupId, groupsTable.id))
        .where(and(...draftWhereConditions));

      // Convert draft itineraries to event format
      const draftEvents = await Promise.all(draftItineraries.map(async (draft) => {
        // Get itinerary items
        const items = await db
          .select()
          .from(itineraryItems)
          .where(eq(itineraryItems.itineraryId, draft.itineraryId))
          .orderBy(itineraryItems.orderIndex);

        // Get group members including organizer (current user is always the organizer for drafts)
        const groupMembers = draft.groupId
          ? await getGroupMembersWithOrganizer(draft.groupId, userId)
          : [];

        // Get organizer's RSVP for draft events (userId-based, no memberId)
        const organizerRsvps = await db
          .select()
          .from(rsvpsTable)
          .where(
            sql`itinerary_id = ${draft.itineraryId} AND user_id = ${userId} AND member_id IS NULL`
          );
        const organizerRsvp = organizerRsvps.length > 0 ? {
          response: organizerRsvps[0].response,
          rsvpFeedback: organizerRsvps[0].rsvpFeedback,
        } : null;

        return {
          inviteId: `draft-${draft.itineraryId}`,
          inviteToken: null,
          itineraryId: draft.itineraryId,
          itineraryName: draft.itineraryName,
          eventDate: draft.eventDate,
          status: draft.status,
          groupId: draft.groupId,
          groupName: draft.groupName,
          groupEmoji: draft.groupEmoji || '🎉',
          groupAccentColor: draft.groupAccentColor,
          isOrganizer: true,
          hostMemberId: null,
          hostMemberName: null,
          currentUserMemberId: null,
          currentUserOpenToHosting: false,
          members: groupMembers, // Already includes organizer and filters duplicates
          rsvp: organizerRsvp,
          rsvpSummary: { yes: [], maybe: [], no: [] },
          detailedRsvps: [],
          pendingGuestRsvps: [],
          items: items.map(item => ({
            id: item.id,
            sourceId: item.sourceId,
            venueName: item.venueName,
            venueType: item.venueType,
            venueAddress: item.venueAddress,
            photoUrl: item.photoUrl,
            rating: item.rating,
            googlePlaceId: item.googlePlaceId,
            orderIndex: item.orderIndex,
            sourceType: item.sourceType,
            notes: item.notes,
            googleMapsUrl: item.googleMapsUrl,
            arrivalTime: item.arrivalTime,
            departureTime: item.departureTime,
            travelNotes: item.travelNotes,
          })),
          isVirtual: false, // Draft itineraries are real, not virtual
          meetingFrequency: null,
        };
      }));

      // Add virtual future events for recurring groups with auto-schedule enabled
      // Build userGroups where conditions
      const userGroupsWhereConditions = [
        eq(groupsTable.userId, userId),
        eq(groupsTable.autoScheduleEnabled, true),
        isNotNull(groupsTable.nextEventDueDate)
      ];

      // Add groupId filter if provided
      if (filterGroupId) {
        userGroupsWhereConditions.push(eq(groupsTable.id, filterGroupId));
      }

      const userGroups = await db
        .select()
        .from(groupsTable)
        .where(and(...userGroupsWhereConditions));

      const virtualEvents = [];
      for (const group of userGroups) {
        if (!group.nextEventDueDate || !group.meetingFrequency) continue;

        // Calculate next 2 future event dates with smart time selection
        const { calculateFutureEventDates } = await import('./auto-scheduler');
        const futureDates = calculateFutureEventDates(
          new Date(group.nextEventDueDate),
          group.meetingFrequency,
          2,
          group // Pass group for smart time selection
        );

        // Check which dates already have real events to avoid duplicates
        const existingEventDates = new Set(
          events
            .filter(e => e.groupId === group.id && e.eventDate)
            .map(e => new Date(e.eventDate!).toISOString().split('T')[0])
        );

        // Also check for draft itineraries
        const draftItineraries = await db
          .select()
          .from(itineraries)
          .where(
            and(
              eq(itineraries.groupId, group.id),
              eq(itineraries.status, 'draft'),
              eq(itineraries.isSaved, false)
            )
          );

        const draftEventDates = new Set(
          draftItineraries
            .filter(d => d.eventDate)
            .map(d => new Date(d.eventDate!).toISOString().split('T')[0])
        );

        // Also check for proposed itineraries
        const proposedItineraries = await db
          .select()
          .from(itineraries)
          .where(
            and(
              eq(itineraries.groupId, group.id),
              eq(itineraries.status, 'proposed'),
              isNotNull(itineraries.eventDate)
            )
          );

        const proposedEventDates = new Set(
          proposedItineraries
            .filter(p => p.eventDate)
            .map(p => new Date(p.eventDate!).toISOString().split('T')[0])
        );

        // Check for rejected dates for this group
        const rejectedDates = await db
          .select()
          .from(rejectedEventDates)
          .where(eq(rejectedEventDates.groupId, group.id));

        const rejectedDateStrs = new Set(
          rejectedDates.map(rd => new Date(rd.rejectedDate).toISOString().split('T')[0])
        );

        for (const date of futureDates) {
          const dateStr = date.toISOString().split('T')[0];

          // Skip if this date was explicitly rejected by the user
          if (rejectedDateStrs.has(dateStr)) {
            continue;
          }

          // Skip if a real event, draft, or proposed itinerary already exists for this date
          if (existingEventDates.has(dateStr) || draftEventDates.has(dateStr) || proposedEventDates.has(dateStr)) continue;

          // Check if there's an auto-scheduled event for this date
          const autoEvent = await db
            .select()
            .from(autoScheduledEvents)
            .where(
              and(
                eq(autoScheduledEvents.groupId, group.id),
                sql`DATE(${autoScheduledEvents.proposedDate}) = ${dateStr}`
              )
            )
            .limit(1);

          const autoEventData = autoEvent[0];

          // Create virtual event object
          virtualEvents.push({
            inviteId: `virtual-${group.id}-${dateStr}`,
            inviteToken: null,
            itineraryId: autoEventData?.itineraryId || null,
            itineraryName: `${group.name}`,
            eventDate: date.toISOString(),
            status: autoEventData?.status || ('virtual' as any), // Use auto-event status if exists
            groupId: group.id,
            groupName: group.name,
            groupEmoji: group.emoji || '🎉',
            isOrganizer: true,
            hostMemberId: null,
            hostMemberName: null,
            currentUserMemberId: null,
            currentUserOpenToHosting: false,
            members: [],
            rsvp: null,
            rsvpSummary: { yes: [], maybe: [], no: [] },
            detailedRsvps: [],
            pendingGuestRsvps: [],
            items: [],
            isVirtual: true, // Flag to identify virtual events
            meetingFrequency: group.meetingFrequency,
            // Auto-scheduled event fields
            isAutoScheduled: !!autoEventData,
            autoEventId: autoEventData?.id || null,
            autoEventItineraryId: autoEventData?.itineraryId || null,
            autoSendAt: autoEventData?.autoSendAt?.toISOString() || null,
            proposedDate: autoEventData?.proposedDate?.toISOString() || null,
            confidenceScore: autoEventData?.confidenceScore || null,
            requiresReview: autoEventData?.requiresReview || null,
          });
        }
      }

      // Fetch standalone events created by this user
      const standaloneItineraries = await db
        .select()
        .from(itineraries)
        .where(
          and(
            eq(itineraries.createdBy, userId),
            eq(itineraries.isStandalone, true)
          )
        );

      const standaloneEvents = await Promise.all(standaloneItineraries.map(async (itinerary) => {
        // Get itinerary items
        const items = await db
          .select()
          .from(itineraryItems)
          .where(eq(itineraryItems.itineraryId, itinerary.id))
          .orderBy(itineraryItems.orderIndex);

        // Get invitees
        const invitees = await db
          .select()
          .from(standaloneEventInvitees)
          .where(eq(standaloneEventInvitees.itineraryId, itinerary.id));

        // Get organizer RSVP
        const [organizerRsvp] = await db
          .select()
          .from(rsvpsTable)
          .where(
            sql`itinerary_id = ${itinerary.id} AND user_id = ${userId} AND member_id IS NULL`
          );

        return {
          inviteId: null,
          inviteToken: null,
          itineraryId: itinerary.id,
          itineraryName: itinerary.name,
          eventDate: itinerary.eventDate,
          eventEndTime: null, // Not stored in itineraries table
          status: itinerary.status,
          inviteSentAt: itinerary.inviteSentAt,
          groupId: null,
          groupName: null,
          groupEmoji: null,
          groupAccentColor: null,
          groupTimezone: itinerary.timezone, // Use itinerary's timezone for standalone events
          isOrganizer: true,
          hostMemberId: null,
          hostMemberName: null,
          currentUserMemberId: null,
          currentUserOpenToHosting: false,
          members: [],
          rsvp: organizerRsvp ? {
            response: organizerRsvp.response,
            rsvpFeedback: organizerRsvp.rsvpFeedback,
            postEventFeedback: organizerRsvp.postEventFeedback,
          } : null,
          organizerRsvp: organizerRsvp?.response || null,
          rsvpSummary: { yes: [], maybe: [], no: [] },
          detailedRsvps: [],
          pendingGuestRsvps: [],
          items: items.map(item => ({
            id: item.id,
            venueName: item.venueName,
            venueType: item.venueType,
            venueAddress: item.venueAddress,
            photoUrl: item.photoUrl,
            rating: item.rating,
            googlePlaceId: item.googlePlaceId,
            orderIndex: item.orderIndex,
            arrivalTime: item.arrivalTime,
            departureTime: item.departureTime,
            travelNotes: item.travelNotes,
            notes: item.notes,
            googleMapsUrl: item.googleMapsUrl,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
          })),
          isStandalone: true,
          invitees: invitees.map(inv => ({
            id: inv.id,
            inviteeName: inv.inviteeName,
            inviteeEmail: inv.inviteeEmail,
            rsvpStatus: inv.rsvpStatus,
            memberId: inv.memberId,
            sourceGroupId: inv.sourceGroupId,
          })),
          note: null, // Not stored in itineraries table
          quorumThreshold: null, // Not stored in itineraries table
          rsvpDeadline: itinerary.rsvpDeadline,
          autoScheduleConfig: itinerary.autoScheduleConfig,
        };
      }));

      // Merge real events, draft itineraries, virtual events, and standalone events
      const allEvents = [...events, ...draftEvents, ...virtualEvents, ...standaloneEvents];

      // Debug: Log event counts and any potential duplicates

      // Check for duplicate dates within virtual events
      const virtualDateCounts = new Map<string, number>();
      for (const ve of virtualEvents) {
        const dateKey = ve.eventDate ? new Date(ve.eventDate).toISOString().split('T')[0] : 'null';
        const groupKey = `${ve.groupName}-${dateKey}`;
        virtualDateCounts.set(groupKey, (virtualDateCounts.get(groupKey) || 0) + 1);
      }
      for (const [key, count] of virtualDateCounts.entries()) {
        if (count > 1) {

        }
      }

      // Final deduplication by itineraryId AND inviteId (safety check to prevent any duplicates)
      const deduplicatedEvents = [];
      const seenFinalItineraryIds = new Set<string>();
      const seenInviteIds = new Set<string>();

      for (const event of allEvents) {
        // Check inviteId first (catches virtual event duplicates)
        if (event.inviteId && seenInviteIds.has(event.inviteId)) {
          continue; // Skip duplicate
        }

        if (event.itineraryId) {
          // Real event with itineraryId - deduplicate by itineraryId
          if (!seenFinalItineraryIds.has(event.itineraryId)) {
            deduplicatedEvents.push(event);
            seenFinalItineraryIds.add(event.itineraryId);
            if (event.inviteId) seenInviteIds.add(event.inviteId);
          }
        } else {
          // Virtual event without itineraryId - deduplicate by inviteId
          deduplicatedEvents.push(event);
          if (event.inviteId) seenInviteIds.add(event.inviteId);
        }
      }

      // Sort by event date (upcoming first, then past)
      deduplicatedEvents.sort((a, b) => {
        if (!a.eventDate && !b.eventDate) return 0;
        if (!a.eventDate) return 1;
        if (!b.eventDate) return -1;
        return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
      });

      if (deduplicatedEvents.length > 0) {

      } else {

      }

      res.json(deduplicatedEvents);
    } catch (error: any) {
      console.error('[User Events] Error:', error);
      console.error('[User Events] Error stack:', error.stack);
      console.error('[User Events] Error details:', {
        message: error.message,
        name: error.name,
        userId: req.user?.id
      });
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's pending hosting requests
  app.get("/api/user/hosting-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      // Find members for this user
      const userMembers = await db
        .select({ id: membersTable.id })
        .from(membersTable)
        .where(eq(membersTable.userId, userId));

      if (userMembers.length === 0) {
        return res.json([]);
      }

      const memberIds = userMembers.map(m => m.id);

      // Get pending host assignments
      const assignments = await db
        .select({
          id: hostAssignments.id,
          itineraryId: hostAssignments.itineraryId,
          itineraryName: itineraries.name,
          eventDate: itineraries.eventDate,
          groupId: itineraries.groupId,
          groupName: groupsTable.name,
          groupEmoji: groupsTable.emoji,
        })
        .from(hostAssignments)
        .leftJoin(itineraries, eq(hostAssignments.itineraryId, itineraries.id))
        .leftJoin(groupsTable, eq(itineraries.groupId, groupsTable.id))
        .where(
          sql`${hostAssignments.memberId} IN ${memberIds} AND ${hostAssignments.status} = 'pending'`
        );

      res.json(assignments);
    } catch (error: any) {
      console.error('[Hosting Requests] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create group with AI suggestions (protected)
  app.post("/api/groups", isAuthenticated, async (req: any, res) => {
    try {
      // Validate entire request body with createGroupSchema
      const validatedInput = safeParse(createGroupSchema, req.body, res);
      if (!validatedInput) return;

      const { members, ...groupData } = validatedInput;
      const userId = await getUserId(req);

      // Validate group data for database insertion
      const validatedGroup = insertGroupSchema.parse(groupData);

      // Geocode location to get coordinates and timezone
      const geocoded = await geocodeLocation(validatedGroup.locationBase);
      if (geocoded) {
        validatedGroup.latitude = geocoded.latitude.toString();
        validatedGroup.longitude = geocoded.longitude.toString();
        validatedGroup.timezone = geocoded.timezone;
        console.log(`Geocoded location: ${validatedGroup.locationBase} -> (${geocoded.latitude}, ${geocoded.longitude}) timezone: ${geocoded.timezone}`);
      } else {
        console.warn(`Failed to geocode location: ${validatedGroup.locationBase}`);
      }

      // Create group with members
      const group = await storage.createGroup(validatedGroup, userId, members || []);

      // Auto-assign accent color after group is created (need group ID)
      if (!validatedGroup.accentColor) {
        const accentColor = assignGroupColor(group.id);
        await storage.updateGroup(group.id, { accentColor });
        group.accentColor = accentColor;
        console.log(`Auto-assigned color ${accentColor} to group ${group.id}`);
      }

      // Generate AI activity suggestions in background
      generateAndStoreActivities(group.id, validatedGroup).catch((error) => {
        console.error(`[Activity Generation] Failed for group ${group.id}:`, error);
        Sentry.captureException(error, {
          tags: { groupId: group.id, operation: 'generateActivities' },
          level: 'error'
        });
      });

      // Send welcome emails to new members in background
      if (members && members.length > 0) {
        setImmediate(async () => {
          try {
            const createdMembers = await storage.getGroupMembers(group.id);
            for (const member of createdMembers) {
              if (member.email && member.claimToken) {
                const claimLink = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/claim/${member.claimToken}`;
                const recipient: EmailRecipient = {
                  email: member.email,
                  name: member.name || 'there',
                };
                const welcomeData: MemberWelcomeData = {
                  groupName: group.name,
                  groupEmoji: group.emoji || '🎉',
                  organizerName: group.name,
                  claimLink,
                };
                await sendMemberWelcome(recipient, welcomeData);
                console.log(`Sent welcome email to ${member.email} for group ${group.name}`);
              }
            }
          } catch (error) {
            console.error('Error sending welcome emails:', error);
            Sentry.captureException(error, {
              tags: { groupId: group.id, operation: 'sendWelcomeEmails' },
              level: 'warning'
            });
          }
        });
      }

      res.json(group);
    } catch (error: any) {
      console.error("Error creating group:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get group by ID
  app.get("/api/groups/:id", async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Gather member budget data for visualization
      const members = await storage.getGroupMembers(req.params.id);
      const memberBudgets: number[] = [];
      
      for (const member of members) {
        if (member.userId) {
          // Get member group preferences
          const memberPrefs = await storage.getMemberGroupPreferences(member.userId, req.params.id);

          // Use fallback chain: budgetOverrideMin/Max → global profile budget
          if (memberPrefs?.budgetOverrideMin != null || memberPrefs?.budgetOverrideMax != null) {
            const avg = ((memberPrefs.budgetOverrideMin || 0) + (memberPrefs.budgetOverrideMax || 100)) / 2;
            memberBudgets.push(avg);
          } else {
            // Try global profile
            const profile = await storage.getUserProfile(member.userId);
            if (profile?.budgetMin != null || profile?.budgetMax != null) {
              const avg = ((profile.budgetMin || 0) + (profile.budgetMax || 100)) / 2;
              memberBudgets.push(avg);
            }
          }
        }
      }

      // Calculate statistics
      const memberBudgetStats = memberBudgets.length > 0 ? {
        budgets: memberBudgets,
        average: Math.round(memberBudgets.reduce((a, b) => a + b, 0) / memberBudgets.length),
        count: memberBudgets.length,
      } : null;

      res.json({ ...group, memberBudgetStats });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update group details
  app.patch("/api/groups/:id", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      // Group is already fetched and validated by requireGroupOwnership middleware
      const group = req.group;
      const validatedUpdates = updateGroupSchema.parse(req.body);

      // Check for cadence change
      let cadenceChanged = false;
      let pipelineRebuilt = false;
      let eventsCleared = 0;
      let eventsCreated = 0;

      if (validatedUpdates.meetingFrequency &&
          validatedUpdates.meetingFrequency !== group.meetingFrequency &&
          group.autoScheduleEnabled) {

        console.log(`[Cadence Change] ${group.name}: ${group.meetingFrequency} → ${validatedUpdates.meetingFrequency}`);
        cadenceChanged = true;

        // Clear existing pending events
        eventsCleared = await storage.deletePendingAutoEvents(req.params.id);
        console.log(`[Cadence Change] Cleared ${eventsCleared} pending events`);
      }

      // If location is being updated, geocode it
      let geocodingResult: 'success' | 'failed' | 'not_attempted' = 'not_attempted';
      if (validatedUpdates.locationBase) {
        const geocoded = await geocodeLocation(validatedUpdates.locationBase);
        if (geocoded) {
          validatedUpdates.latitude = geocoded.latitude.toString();
          validatedUpdates.longitude = geocoded.longitude.toString();
          validatedUpdates.timezone = geocoded.timezone;
          geocodingResult = 'success';
          console.log(`Geocoded location update: ${validatedUpdates.locationBase} -> (${geocoded.latitude}, ${geocoded.longitude}) timezone: ${geocoded.timezone}`);
        } else {
          geocodingResult = 'failed';
          console.warn(`Failed to geocode location: ${validatedUpdates.locationBase}`);
        }
      }

      const updatedGroup = await storage.updateGroup(req.params.id, validatedUpdates);

      // Regenerate pipeline with new cadence
      if (cadenceChanged) {
        const { maintainEventPipeline } = await import('./auto-scheduler.js');
        eventsCreated = await maintainEventPipeline(req.params.id, storage);
        pipelineRebuilt = true;
        console.log(`[Cadence Change] Created ${eventsCreated} new events with new cadence`);
      }

      res.json({
        ...updatedGroup,
        geocodingResult,
        cadenceChange: cadenceChanged ? {
          oldCadence: group.meetingFrequency,
          newCadence: validatedUpdates.meetingFrequency,
          eventsCleared,
          eventsCreated,
          pipelineRebuilt
        } : undefined
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update search radius
  app.patch("/api/groups/:id/radius", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(updateGroupRadiusSchema, req.body, res);
      if (!validatedData) return;

      const { searchRadius } = validatedData;

      const updatedGroup = await storage.updateGroup(req.params.id, { searchRadius });
      res.json(updatedGroup);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete group (organizer only)
  app.delete("/api/groups/:id", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      await storage.softDeleteGroup(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Leave group (remove member)
  app.delete("/api/groups/:groupId/members/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId, memberId } = req.params;

      // Get the member to verify it belongs to the requesting user
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Verify the member belongs to the user and group
      if (member.userId !== userId || member.groupId !== groupId) {
        return res.status(403).json({ message: "Not authorized to remove this member" });
      }

      // Cannot leave if you're an organizer
      if (member.isOrganizer) {
        return res.status(400).json({ message: "Organizers cannot leave the group. Delete the group instead." });
      }

      await storage.deleteMember(memberId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update automation settings and category filters
  app.patch("/api/groups/:id/automation", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(updateAutomationSchema, req.body, res);
      if (!validatedData) return;

      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Support both patterns:
      // 1. { field: 'meal_enabled', value: true } (from toggleAutomationMutation)
      // 2. { meal_enabled: true, cafe_enabled: false } (direct field updates)
      const updates: any = {};
      
      // Map snake_case API field names to camelCase database column names
      const fieldMapping: Record<string, string> = {
        'meal_enabled': 'mealEnabled',
        'cafe_enabled': 'cafeEnabled',
        'drinks_enabled': 'drinksEnabled',
        'dessert_enabled': 'dessertEnabled',
        'experiences_enabled': 'experiencesEnabled',
        'autoActivitiesEnabled': 'autoActivitiesEnabled',
        'autoItineraryEnabled': 'autoItineraryEnabled',
        'autoScheduleEnabled': 'autoScheduleEnabled',
        'automation_level': 'automationLevel',
        'automationLevel': 'automationLevel',
        'review_every_nth_event': 'reviewEveryNthEvent',
        'reviewEveryNthEvent': 'reviewEveryNthEvent',
        'membersCanCreateEvents': 'membersCanCreateEvents',
        'members_can_create_events': 'membersCanCreateEvents',
      };
      
      // Pattern 1: Single field/value pair (from mutation)
      if (validatedData.field && validatedData.value !== undefined) {
        const apiField = validatedData.field;
        const value = validatedData.value;

        const dbField = fieldMapping[apiField];
        if (!dbField) {
          return res.status(400).json({ message: `Invalid field: ${apiField}` });
        }

        updates[dbField] = value;
      } else {
        // Pattern 2: Direct field updates (accepts both snake_case and camelCase)
        for (const apiField in validatedData) {
          const value = validatedData[apiField as keyof typeof validatedData];
          const dbField = fieldMapping[apiField];

          if (dbField) {
            // Allow booleans, strings (for automationLevel), and numbers (for reviewEveryNthEvent)
            if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
              updates[dbField] = value;
            }
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid automation settings provided" });
      }

      // When enabling auto-scheduling, initialize nextEventDueDate if not set
      if (updates.autoScheduleEnabled === true && !group.nextEventDueDate && group.meetingFrequency) {
        const { calculateNextEventDueDate } = await import('./auto-scheduler');
        const baseDate = group.lastEventDate ? new Date(group.lastEventDate) : new Date();
        updates.nextEventDueDate = calculateNextEventDueDate(baseDate, group.meetingFrequency);
      }

      const updatedGroup = await storage.updateGroup(req.params.id, updates);
      res.json(updatedGroup);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Manage group invite link (open/close, regenerate)
  app.patch("/api/groups/:id/invite-link", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const { open, regenerate } = req.body;

      const updates: any = {};

      // Toggle link open/closed
      if (typeof open === 'boolean') {
        updates.inviteLinkOpen = open;
      }

      // Regenerate the shareable link (invalidates old link)
      if (regenerate === true) {
        const { randomBytes } = await import('crypto');
        updates.shareableLink = randomBytes(16).toString('hex');
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid options provided. Use 'open' (boolean) or 'regenerate' (true)." });
      }

      const updatedGroup = await storage.updateGroup(req.params.id, updates);
      res.json({
        shareableLink: updatedGroup.shareableLink,
        inviteLinkOpen: updatedGroup.inviteLinkOpen,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Pause automation for a group
  app.post("/api/groups/:id/pause-automation", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Validate request body
      const validatedData = safeParse(pauseAutomationSchema, req.body, res);
      if (!validatedData) return;
      const { pauseType, value } = validatedData;

      const updates: any = {
        automationPaused: true,
      };

      if (pauseType === 'events') {
        // Pause for N events
        updates.automationPauseEventsRemaining = value;
        updates.automationPausedUntil = null;
      } else {
        // pauseType === 'until' - Pause until specific date
        updates.automationPausedUntil = new Date(value as string);
        updates.automationPauseEventsRemaining = null;
      }

      const updatedGroup = await storage.updateGroup(req.params.id, updates);
      res.json(updatedGroup);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Resume automation for a group
  app.post("/api/groups/:id/resume-automation", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const updates: any = {
        automationPaused: false,
        automationPausedUntil: null,
        automationPauseEventsRemaining: null,
      };

      const updatedGroup = await storage.updateGroup(req.params.id, updates);
      res.json(updatedGroup);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Approve a flagged auto-scheduled event
  app.post("/api/auto-events/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const { autoScheduledEvents } = await import('../shared/schema');
      const [event] = await db.select().from(autoScheduledEvents).where(eq(autoScheduledEvents.id, req.params.id));

      if (!event) {
        return res.status(404).json({ message: "Auto-scheduled event not found" });
      }

      const group = await storage.getGroup(event.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check ownership
      if (group.userId !== req.user.id) {
        return res.status(403).json({ message: "Only the group owner can approve events" });
      }

      if (!event.itineraryId) {
        return res.status(400).json({ message: "Event has no itinerary" });
      }

      const itinerary = await storage.getItinerary(event.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Update itinerary to proposed status using adaptive timeline
      const { calculateAdaptiveTimeline, calculateRsvpDeadline } = await import('./adaptive-timeline');
      const eventDate = new Date(event.proposedDate);
      const now = new Date();

      // Calculate adaptive timeline based on how far out the event is
      const adaptiveConfig = calculateAdaptiveTimeline(eventDate, now);
      const rsvpDeadline = calculateRsvpDeadline(eventDate, adaptiveConfig);

      console.log(`[Auto-Approve] Using ${adaptiveConfig.timelineType} timeline for event ${event.id}: ${adaptiveConfig.reasoning}`);

      await storage.updateItinerary(itinerary.id, {
        status: 'proposed',
        eventDate: event.proposedDate,
        rsvpDeadline,
        autoScheduleConfig: adaptiveConfig
      });

      // Log venue visits for rotation tracking
      await storage.logVenueVisits(itinerary.id, new Date(event.proposedDate));

      // Send initial invites
      const { sendInitialInvites } = await import('./reminder-scheduler');
      await sendInitialInvites(itinerary, group);

      // Mark auto-event as sent
      await storage.updateAutoScheduledEventStatus(event.id, 'auto_sent');

      // Reset review sampling counter if this was a scheduled review
      if (event.reviewReason === 'scheduled_review') {
        await db.update(groupsTable).set({ eventCountSinceLastReview: 0 }).where(eq(groupsTable.id, group.id));
      }

      res.json({ message: "Event approved and sent", event, itinerary });
    } catch (error: any) {
      console.error('Error approving event:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Skip an auto-scheduled event (mark as rejected, create replacement for later week)
  app.post("/api/auto-events/:id/skip", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const eventId = req.params.id;

      // Get the event to verify ownership
      const event = await storage.getAutoScheduledEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Auto-scheduled event not found" });
      }

      // Verify user owns the group
      const group = await storage.getGroup(event.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You don't own this group" });
      }

      // Skip the event (marks as rejected)
      const result = await storage.skipAutoScheduledEvent(eventId);

      // Import maintainEventPipeline to create replacement event
      const { maintainEventPipeline } = await import('./auto-scheduler');

      console.log(`[Auto-Event Skip] Triggering pipeline maintenance for group ${result.groupId}`);

      // Trigger pipeline maintenance to create replacement event for a later week
      await maintainEventPipeline(result.groupId, storage);

      res.json({
        message: "Event skipped successfully. A replacement event will be created for a future week.",
        groupId: result.groupId
      });
    } catch (error: any) {
      console.error("[Auto-Event Skip] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete an auto-scheduled event (for past events that didn't happen)
  app.delete("/api/auto-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const eventId = req.params.id;

      // Get the event to verify ownership
      const event = await storage.getAutoScheduledEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Auto-scheduled event not found" });
      }

      // Verify user owns the group
      const group = await storage.getGroup(event.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You don't own this group" });
      }

      // Track rejected date if the event has a proposed date
      if (event.proposedDate) {
        try {
          await db.insert(rejectedEventDates).values({
            groupId: event.groupId,
            rejectedDate: event.proposedDate,
            reason: 'user_deleted',
            sourceType: 'auto_event',
            sourceId: eventId,
          });
          console.log(`[Rejected Dates] Tracked rejected date for group ${event.groupId}: ${event.proposedDate}`);
        } catch (error) {
          console.error('[Rejected Dates] Error tracking rejected date:', error);
          // Don't fail the delete if tracking fails
        }
      }

      // Delete the event
      await storage.deleteAutoScheduledEvent(eventId);

      res.json({
        message: "Event deleted successfully",
        groupId: event.groupId
      });
    } catch (error: any) {
      console.error("[Auto-Event Delete] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Trigger auto-schedule for a group (manually create pending event if within window)
  app.post("/api/groups/:id/trigger-auto-schedule", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (!group.autoScheduleEnabled) {
        return res.status(400).json({
          message: "Auto-scheduling not enabled",
          code: "AUTO_SCHEDULE_DISABLED",
          suggestion: "Enable auto-scheduling in group settings, or use manual event creation"
        });
      }

      if (!group.userId) {
        return res.status(400).json({
          message: "Group must have an owner",
          code: "NO_OWNER"
        });
      }

      // Check if there's already a pending auto-event
      const existingPendingEvents = await storage.getPendingAutoScheduledEvents(req.params.id);
      if (existingPendingEvents.length > 0) {
        return res.status(200).json({
          message: "Event already exists",
          event: existingPendingEvents[0]
        });
      }

      // Check for existing proposed/scheduled itineraries (regular events, not auto-scheduled)
      const existingItineraries = await storage.getGroupItineraries(req.params.id);
      const existingProposedOrScheduled = existingItineraries.filter(i =>
        i.status === 'proposed' || i.status === 'scheduled'
      );

      // Import auto-scheduler functions
      const { shouldTriggerAutoSchedule, selectBestItineraryForAutoSchedule } = await import('./auto-scheduler.js');
      const { suggestOptimalTime } = await import('./ai-time-picker.js');

      const hasPendingEvent = existingPendingEvents.length > 0;

      // Check if we should trigger (within 10-day window)
      // For high-cadence groups with existing events, we'll still generate new options
      // but return both to the frontend for user to choose
      const canTrigger = await shouldTriggerAutoSchedule(storage, group, hasPendingEvent);

      if (!canTrigger && existingProposedOrScheduled.length === 0) {
        // Not within window and no existing events - just return error
        return res.status(400).json({
          message: "Not within 10-day creation window",
          nextEventDueDate: group.nextEventDueDate
        });
      }

      // If there are existing proposed/scheduled events, generate new options anyway
      // and return both to the frontend
      const shouldGenerateNewEvent = canTrigger || existingProposedOrScheduled.length > 0;

      // Check if auto-itinerary creation is enabled
      // If not, we can only use existing saved itineraries
      let selection;

      if (group.autoItineraryEnabled) {
        // Auto-create itinerary combinations from activities/favorites

        selection = await selectBestItineraryForAutoSchedule(storage, group);
      } else {
        // Auto-itinerary disabled - only use existing saved itineraries

        const savedItineraries = existingItineraries.filter(i => i.isSaved && i.status === 'saved');

        if (savedItineraries.length === 0) {
          return res.status(400).json({
            message: "Auto-itinerary creation is disabled. Please create and save an itinerary first, or enable auto-itinerary creation in group settings.",
            suggestion: "Enable 'Auto-create itineraries' in group settings to let AI combine your activities automatically."
          });
        }

        // Use the most recently saved itinerary
        const mostRecent = savedItineraries.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        selection = { itineraryId: mostRecent.id };
      }

      if (!selection) {
        return res.status(400).json({
          message: "No venues available for AI scheduling",
          code: "NO_VENUES",
          suggestion: "Add some favorite venues or activities first, then try again"
        });
      }

      let itineraryId: string | null;

      // If we selected an existing itinerary, duplicate it manually
      if ('itineraryId' in selection && selection.itineraryId) {
        const originalItinerary = await storage.getItinerary(selection.itineraryId);
        if (!originalItinerary) {
          return res.status(404).json({ message: "Selected itinerary not found" });
        }

        // Clean up any existing draft itineraries before creating a new one
        await db.delete(itineraries).where(
          and(
            eq(itineraries.groupId, group.id),
            eq(itineraries.status, "draft"),
            eq(itineraries.isSaved, false)
          )
        );

        // Manually duplicate by creating new itinerary with same items
        const originalItems = originalItinerary.items;
        const duplicatedItinerary = await storage.createItinerary(
          {
            groupId: group.id,
            name: group.name,
            status: "draft",
            proposedOrder: [],
          },
          group.userId,
          originalItems
            .filter(item => item.sourceId !== null)
            .map(item => ({
              sourceType: item.sourceType as 'activity' | 'voting_event' | 'ad_hoc',
              sourceId: item.sourceId!
            }))
        );
        itineraryId = duplicatedItinerary.id;
      } else if ('selectedVenues' in selection && selection.selectedVenues) {
        // Clean up any existing draft itineraries before creating a new one
        await db.delete(itineraries).where(
          and(
            eq(itineraries.groupId, group.id),
            eq(itineraries.status, "draft"),
            eq(itineraries.isSaved, false)
          )
        );

        // Create new itinerary from selected activities
        const proposedOrder = selection.selectedVenues.map(v => v.sourceId);
        const newItinerary = await storage.createItinerary(
          {
            groupId: group.id,
            name: group.name,
            status: "draft",
            proposedOrder,
          },
          group.userId,
          selection.selectedVenues.map(venue => ({
            sourceType: 'activity' as const,
            sourceId: venue.sourceId
          }))
        );
        itineraryId = newItinerary.id;
      } else if ('options' in selection && selection.options && selection.options.length > 0) {
        // NEW FLOW: Store options and create itinerary immediately for top option
        // This allows users to view/edit the event before approval

        const topOption = selection.options[0];
        const venueItems = topOption.venues.map((v: any) => ({
          sourceType: v.sourceType as 'activity' | 'voting_event',
          sourceId: v.sourceId,
        }));

        // Create itinerary immediately with "proposed" status
        const newItinerary = await storage.createItinerary(
          {
            groupId: group.id,
            name: group.name,
            eventDate: null, // Will be set after AI time suggestion
            status: 'proposed',
            proposedOrder: [],
          },
          group.userId!,
          venueItems
        );
        itineraryId = newItinerary.id;

        // Create invites for all group members so event is visible
        const members = await storage.getGroupMembers(group.id);
        const { itineraryInvites } = await import('@shared/schema');
        const crypto = await import('crypto');

        for (const member of members) {
          const inviteToken = crypto.randomUUID();
          await db.insert(itineraryInvites).values({
            itineraryId: newItinerary.id,
            memberId: member.id,
            inviteToken,
          });
        }

      } else {
        return res.status(400).json({ message: "No valid selection" });
      }

      // Validate and optimize itinerary ordering using AI (only if itinerary was created)
      if (itineraryId) {

        try {
          const { validateItinerary } = await import('./itinerary-validation.js');
          const itineraryWithItems = await storage.getItinerary(itineraryId);
          if (!itineraryWithItems) {
            throw new Error('Itinerary not found for validation');
          }
          const itineraryItems = itineraryWithItems.items;

          // Prepare venues for validation
          const venuesForValidation = itineraryItems
            .filter(item => item.sourceId !== null)
            .map(item => ({
              sourceType: item.sourceType as 'activity' | 'voting_event' | 'ad_hoc',
              sourceId: item.sourceId!,
              venueName: item.venueName,
              venueType: item.venueType,
              venueAddress: item.venueAddress,
              googlePlaceId: item.googlePlaceId,
              location: item.latitude && item.longitude ? {
                lat: parseFloat(item.latitude),
                lng: parseFloat(item.longitude)
              } : undefined
            }));

          // Get AI-validated order
          const validation = await validateItinerary(venuesForValidation);

          if (validation.proposedOrder && validation.proposedOrder.length > 0) {
            // Update itinerary with optimized order
            await db.update(itineraries)
              .set({
                proposedOrder: validation.proposedOrder,
                aiValidationNotes: validation.validationNotes || null
              })
              .where(eq(itineraries.id, itineraryId));

          }
        } catch (validationError: any) {
          // Log but don't fail - validation is optional enhancement
          console.error('[Manual Trigger] AI validation failed (continuing anyway):', validationError.message);
        }
      }

      // AI suggests optimal time
      let proposedDate: Date;
      let venues: Array<{ name: string; type: string }> = [];

      // Get venue information (either from itinerary or from options)
      if (itineraryId) {
        const itinerary = await storage.getItinerary(itineraryId);
        if (!itinerary || !itinerary.groupId) {
          return res.status(404).json({ message: "Created itinerary not found" });
        }
        venues = itinerary.items.map((item: any) => ({
          name: item.venueName,
          type: item.venueType,
        }));
      } else if ('options' in selection && selection.options && selection.options.length > 0) {
        // Use venues from the top option for time suggestion
        const topOption = selection.options[0];
        venues = topOption.venues.map((v: any) => ({
          name: v.venueName,
          type: v.venueType || 'restaurant',
        }));
      } else {
        return res.status(400).json({ message: "No venues available for scheduling" });
      }

      try {

        // Aggregate member availability
        const { aggregateMemberAvailability, convertAvailabilityToText } = await import('./availability-utils');
        const aggregatedAvailability = await aggregateMemberAvailability(group.id, storage);

        // Convert to text format for AI
        const availabilityString = convertAvailabilityToText(
          aggregatedAvailability.grid,
          aggregatedAvailability.conflicts,
          aggregatedAvailability.memberCount
        );

        // Use AI to find optimal time
        const timeResult = await suggestOptimalTime({
          generalAvailability: availabilityString,
          venues,
          location: group.locationBase,
          meetingFrequency: group.meetingFrequency || undefined,
          timezone: group.timezone || undefined,
        });

        proposedDate = timeResult.eventDate;

      } catch (err) {
        console.error('[Manual Trigger] AI time suggestion failed, using fallback:', err);
        proposedDate = group.nextEventDueDate ? new Date(group.nextEventDueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      }

      // Update the itinerary with the proposed date (fixes TBD date bug)
      await storage.updateItinerary(itineraryId, {
        eventDate: proposedDate
      });

      // If there are existing proposed/scheduled events, return both options for user to choose
      if (existingProposedOrScheduled.length > 0) {
        // Get full details of existing events with their items
        const existingEventsWithItems = await Promise.all(
          existingProposedOrScheduled.map(async (event) => {
            const fullEvent = await storage.getItinerary(event.id);
            return {
              ...event,
              items: fullEvent?.items || []
            };
          })
        );

        // Get details of the new event option
        const newItinerary = await storage.getItinerary(itineraryId);

        return res.json({
          hasMultipleOptions: true,
          existingEvents: existingEventsWithItems,
          newEventOption: {
            ...newItinerary,
            items: newItinerary?.items || [],
            proposedDate,
            isNewlyGenerated: true
          },
          message: "Multiple event options available"
        });
      }

      // No existing events - create auto-scheduled event as normal
      const autoSendAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

      // Calculate confidence score for the event

      const { calculateEventConfidence } = await import('./confidence-scoring.js');

      // Get venue data for confidence calculation
      let venuesForConfidence: Array<{ sourceType: string; sourceId: string; venueName: string }> = [];

      if (itineraryId) {
        const fullItinerary = await storage.getItinerary(itineraryId);
        venuesForConfidence = fullItinerary?.items.map(item => ({
          sourceType: item.sourceType,
          sourceId: item.sourceId || '',
          venueName: item.venueName,
        })) || [];
      } else if ('options' in selection && selection.options && selection.options.length > 0) {
        // Use venues from top option for confidence calculation
        const topOption = selection.options[0];
        venuesForConfidence = topOption.venues.map((v: any) => ({
          sourceType: v.sourceType,
          sourceId: v.sourceId,
          venueName: v.venueName,
        }));
      }

      // Calculate member availability for this time
      const { aggregateMemberAvailability } = await import('./availability-utils');
      const availability = await aggregateMemberAvailability(group.id, storage);

      const dayOfWeek = proposedDate.getDay();
      const hour = proposedDate.getHours();
      const timePeriod = hour < 12 ? 'morning' : (hour < 17 ? 'afternoon' : 'evening');
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
      const slotKey = `${dayNames[dayOfWeek]}-${timePeriod}` as keyof typeof availability.grid;
      const membersAvailable = (availability.grid as Record<string, number>)[slotKey] || 0;
      const totalMembers = availability.memberCount;

      const confidenceResult = await calculateEventConfidence(
        storage,
        group.id,
        venuesForConfidence,
        proposedDate,
        membersAvailable,
        totalMembers
      );

      // Determine initial status based on confidence
      // ≥80: auto-approve immediately
      // <80: pending_approval (requires organizer review or will auto-send after 48hrs)
      const shouldAutoApprove = confidenceResult.score >= 80;
      const initialStatus = shouldAutoApprove ? 'auto_approved' : 'pending_approval';
      const requiresReview = confidenceResult.score < 60;

      const pendingEvent = await storage.createAutoScheduledEvent({
        groupId: group.id,
        itineraryId,
        proposedDate,
        autoSendAt,
        status: initialStatus,
        confidenceScore: confidenceResult.score,
        confidenceFactors: confidenceResult.factors,
        requiresReview,
        reviewReason: requiresReview ? 'low_confidence' : null,
      });

      // Update itinerary's eventDate with the proposed date
      if (itineraryId) {
        await db.update(itineraries)
          .set({ eventDate: proposedDate })
          .where(eq(itineraries.id, itineraryId));

      }

      // Create itineraryOptions if we have options (for member voting and auto-approval)
      if ('options' in selection && selection.options && selection.options.length > 0) {

        const { itineraryOptions } = await import('@shared/schema');

        for (const option of selection.options) {
          await db.insert(itineraryOptions).values({
            autoEventId: pendingEvent.id,
            optionNumber: option.optionNumber,
            venues: option.venues, // Already in correct format from selectBestItineraryForAutoSchedule
            description: option.description,
            // nearbySuggestions not included in selectBestItineraryForAutoSchedule return type
          });
        }

      }

      // If auto-approved (≥80% confidence), immediately create the itinerary
      if (shouldAutoApprove) {

        const { approveAndCreateItinerary } = await import('./auto-approval.js');
        const approvalResult = await approveAndCreateItinerary(
          pendingEvent.id,
          null, // Let it determine best option
          'auto'
        );

        if (approvalResult.success) {

        } else {
          console.error('[Auto-Schedule] ❌ Auto-approval failed:', approvalResult.error);
        }
      } else if (requiresReview) {

      } else {

      }

      res.json({
        hasMultipleOptions: false,
        message: shouldAutoApprove
          ? "Event auto-approved! High confidence match for your group."
          : requiresReview
            ? "Event created but needs your review (low confidence)"
            : "Auto-scheduled event created - awaiting approval",
        event: pendingEvent,
        confidence: {
          score: confidenceResult.score,
          summary: confidenceResult.plainLanguageSummary,
          reasons: confidenceResult.plainLanguageReasons,
        },
      });
    } catch (error: any) {
      console.error('Error triggering auto-schedule:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Maintain event pipeline for a group (create future events based on cadence)
  app.post("/api/groups/:id/maintain-event-pipeline", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (!group.autoScheduleEnabled) {
        return res.status(400).json({ message: "Auto-scheduling is not enabled for this group" });
      }

      console.log(`[Event Pipeline] Manually triggered pipeline maintenance for ${group.name}`);

      // Import and call the pipeline maintenance function
      const { maintainEventPipeline } = await import('./auto-scheduler.js');
      const eventsCreated = await maintainEventPipeline(req.params.id, storage);

      return res.status(200).json({
        message: `Pipeline maintenance complete`,
        eventsCreated,
        group: {
          id: group.id,
          name: group.name,
          targetFutureEvents: group.targetFutureEvents,
        }
      });
    } catch (error: any) {
      console.error('Error maintaining event pipeline:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Clear all pending auto-scheduled events for a group
  app.delete("/api/groups/:id/auto-scheduled-events", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (!group.autoScheduleEnabled) {
        return res.status(400).json({ message: "Auto-scheduling is not enabled for this group" });
      }

      console.log(`[Event Pipeline] Clearing pending events for ${group.name}`);

      const deletedCount = await storage.deletePendingAutoEvents(req.params.id);

      return res.status(200).json({
        message: `Cleared ${deletedCount} pending event(s)`,
        deletedCount,
        group: {
          id: group.id,
          name: group.name,
        }
      });
    } catch (error: any) {
      console.error('Error clearing pending events:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get group by shareable link
  app.get("/api/groups/by-link/:shareableLink", publicEndpointLimiter, async (req, res) => {
    try {
      const group = await storage.getGroupByShareableLink(req.params.shareableLink);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // If link is closed, return minimal info (don't expose group details for privacy)
      if (!group.inviteLinkOpen) {
        return res.status(403).json({
          message: "This invite link is no longer active",
          linkClosed: true
        });
      }

      // Filter sensitive fields for public group preview
      // Only return data needed for invite/join context
      const safeGroup = {
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        locationBase: group.locationBase,  // City-level location
        budgetMin: group.budgetMin,
        budgetMax: group.budgetMax,
        meetingFrequency: group.meetingFrequency,
        generalAvailability: group.generalAvailability,
        activityCategories: group.activityCategories,
        shareableLink: group.shareableLink,
        inviteLinkOpen: group.inviteLinkOpen,
        // Explicitly exclude: userId, additionalInstructions, schedulingPreferences,
        // automation settings, lastEventDate, nextEventDueDate, and other internal config
      };

      res.json(safeGroup);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get group members (includes organizer as implicit member)
  app.get("/api/groups/:id/members", publicEndpointLimiter, async (req, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Get members including organizer (filters out duplicates)
      const allMembers = group.userId
        ? await getGroupMembersWithOrganizer(req.params.id, group.userId)
        : await storage.getGroupMembers(req.params.id);

      // Filter sensitive fields for public access
      // Only return data needed for social context (showing who's invited)
      const safeMembers = allMembers.map(m => ({
        id: m.id,
        name: m.name,
        isOrganizer: m.isOrganizer || false,
        isGuest: m.isGuest || false,
        // For organizer, these don't exist on member record
        rsvpStatus: (m as any).rsvpStatus,
        hasJoined: (m as any).hasJoined,
        openToHosting: m.openToHosting || false,
        // Include userId presence to indicate if member is claimed (but not the actual value for privacy)
        userId: m.userId ? 'claimed' : null, // Obfuscate actual userId but indicate claimed status
        // Explicitly exclude: claimToken, email, memberLocation,
        // memberBudgetMin/Max, memberAvailability, preferences
      }));

      res.json(safeMembers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get group activities
  app.get("/api/groups/:id/activities", publicEndpointLimiter, async (req, res) => {
    try {
      const activities = await storage.getGroupActivities(req.params.id);

      // Filter sensitive AI reasoning that may contain private context
      const safeActivities = activities.map(a => ({
        id: a.id,
        groupId: a.groupId,
        venueName: a.venueName,
        venueAddress: a.venueAddress,
        city: a.city,
        venueType: a.venueType,
        description: a.description,
        googlePlaceId: a.googlePlaceId,
        latitude: a.latitude,
        longitude: a.longitude,
        rating: a.rating,
        reviewCount: a.reviewCount,
        priceLevel: a.priceLevel,
        photoUrl: a.photoUrl,
        // Exclude: aiReasoning (may contain sensitive context about group dynamics)
        suggestedDate: a.suggestedDate,
        suggestedTime: a.suggestedTime,
        priceEstimate: a.priceEstimate,
        createdAt: a.createdAt,
      }));

      res.json(safeActivities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update activity feedback
  app.patch("/api/activities/:activityId/feedback", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(updateActivityFeedbackSchema, req.body, res);
      if (!validatedData) return;

      const { feedback } = validatedData;

      // Fetch the specific activity by ID (not loading all activities!)
      const activity = await storage.getActivity(req.params.activityId);

      if (!activity || !activity.groupId) {
        return res.status(404).json({ message: "Activity not found" });
      }

      // Verify user owns the group
      const userId = await getUserId(req);
      const group = await storage.getGroup(activity.groupId);

      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You don't have access to this activity" });
      }

      const updatedActivity = await storage.updateActivityFeedback(req.params.activityId, feedback || '');

      if (updatedActivity.groupId) {
        await trackFeedbackAndMaybeAnalyze(updatedActivity.groupId);
      }

      res.json(updatedActivity);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== SWIPE SESSION MANAGEMENT =====

  // Create a new swipe session for a group
  app.post("/api/groups/:groupId/swipe-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user is a member or organizer
      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Validate request body
      const sessionSchema = z.object({
        sessionType: z.enum(['itinerary_validation', 'activity_curation', 'favorites_triage', 'discovery', 'weekly_digest']),
        triggeredBy: z.enum(['auto_scheduler', 'ai_generation', 'manual', 'weekly_job', 'post_event']).default('manual'),
        isBlocking: z.boolean().optional(),
        targetSwipeCount: z.number().min(1).max(20).optional(),
        expiresInHours: z.number().min(1).max(168).optional(), // Max 1 week
        autoEventId: z.string().optional(),
      });

      const validatedData = safeParse(sessionSchema, req.body, res);
      if (!validatedData) return;

      // Create session
      const { createSwipeSession } = await import('./swipe-session-manager');
      const sessionId = await createSwipeSession({
        groupId,
        sessionType: validatedData.sessionType,
        triggeredBy: validatedData.triggeredBy || 'manual',
        isBlocking: validatedData.isBlocking,
        targetSwipeCount: validatedData.targetSwipeCount,
        expiresInHours: validatedData.expiresInHours,
        autoEventId: validatedData.autoEventId,
      });

      res.json({ sessionId });
    } catch (error: any) {
      console.error('Error creating swipe session:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get active swipe sessions for a group
  app.get("/api/groups/:groupId/swipe-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user is a member
      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Get active sessions
      const { getActiveSwipeSessions } = await import('./swipe-session-manager');
      const sessions = await getActiveSwipeSessions(groupId);

      res.json({ sessions });
    } catch (error: any) {
      console.error('Error fetching swipe sessions:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get swipe session result
  app.get("/api/swipe-sessions/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = await getUserId(req);

      // Get session
      const { getSwipeSessionResult } = await import('./swipe-session-manager');
      const session = await getSwipeSessionResult(sessionId);

      if (!session) {
        return res.status(404).json({ message: "Swipe session not found" });
      }

      // Verify user is member of this group
      const sessionData = await db
        .select()
        .from(swipeSessions)
        .where(eq(swipeSessions.id, sessionId))
        .limit(1);

      if (sessionData.length === 0) {
        return res.status(404).json({ message: "Session not found" });
      }

      const member = await storage.getGroupMemberByUserId(sessionData[0].groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      res.json(session);
    } catch (error: any) {
      console.error('Error fetching swipe session:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Manually complete a swipe session
  app.post("/api/swipe-sessions/:sessionId/complete", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = await getUserId(req);

      // Get session to verify group membership
      const sessionData = await db
        .select()
        .from(swipeSessions)
        .where(eq(swipeSessions.id, sessionId))
        .limit(1);

      if (sessionData.length === 0) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Verify user is organizer (group owner)
      const group = await storage.getGroup(sessionData[0].groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only organizers can manually complete sessions" });
      }

      // Complete session
      const { completeSwipeSession, getSwipeSessionResult } = await import('./swipe-session-manager');
      await completeSwipeSession(sessionId);

      // Get updated result
      const result = await getSwipeSessionResult(sessionId);

      res.json(result);
    } catch (error: any) {
      console.error('Error completing swipe session:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== SWIPE RECORDING =====

  // Swipe on an activity (democratic curation)
  app.post("/api/groups/:groupId/activities/:activityId/swipe", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId, activityId } = req.params;
      const userId = await getUserId(req);

      // Validate request body
      const swipeSchema = z.object({
        direction: z.enum(['right', 'left']),
        sessionId: z.string().optional(),
      });

      const validatedData = safeParse(swipeSchema, req.body, res);
      if (!validatedData) return;

      const { direction, sessionId } = validatedData;

      // Verify activity exists and belongs to group
      const activity = await db
        .select()
        .from(activities)
        .where(and(eq(activities.id, activityId), eq(activities.groupId, groupId)))
        .limit(1);

      if (!activity || activity.length === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }

      // Get member for this user in this group
      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Check if user already swiped on this activity
      const { hasUserSwipedActivity } = await import('./swipe-consensus');
      const alreadySwiped = await hasUserSwipedActivity(userId, activityId);

      if (alreadySwiped) {
        return res.status(400).json({ message: "You've already swiped on this activity" });
      }

      // Record the swipe
      const swipe = await db.insert(activitySwipes).values({
        groupId,
        activityId,
        votingEventId: null,
        userId,
        memberId: member.id,
        swipeDirection: direction,
        swipeSessionId: sessionId || null,
      }).returning();

      // Update consensus for this activity
      const { updateActivityConsensus, getActivitySwipeStats, performActivityAutoActions } = await import('./swipe-consensus');
      await updateActivityConsensus(activityId);

      // Get updated stats
      const stats = await getActivitySwipeStats(activityId);

      // Perform auto-actions if consensus thresholds are met
      const autoAction = await performActivityAutoActions(activityId);

      // Check if favorites overflow trigger should fire (after auto-promotion)
      if (autoAction?.action === 'promoted') {
        try {
          const { triggerSwipeSession } = await import('./swipe-trigger-manager');
          const triggerResult = await triggerSwipeSession({
            groupId,
            triggerType: 'favorites_overflow',
          });

          if (triggerResult.triggered) {
            console.log(`[FavoritesOverflow] ${triggerResult.reason}`);
          }
        } catch (triggerError) {
          console.error('[FavoritesOverflow] Error checking trigger:', triggerError);
        }
      }

      // If part of a session, update session participation and check auto-complete
      if (sessionId) {
        const { recordSwipeInSession, checkAndAutoCompleteSession } = await import('./swipe-session-manager');
        await recordSwipeInSession(sessionId, member.id, userId);
        await checkAndAutoCompleteSession(sessionId);
      }

      res.json({
        swipe: swipe[0],
        stats,
        autoAction, // Include auto-action result in response
      });
    } catch (error: any) {
      console.error('Error recording activity swipe:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Swipe on a voting event (Favorite) - for shortlisting
  app.post("/api/groups/:groupId/favorites/:votingEventId/swipe", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId, votingEventId } = req.params;
      const userId = await getUserId(req);

      // Validate request body
      const swipeSchema = z.object({
        direction: z.enum(['right', 'left']),
        sessionId: z.string().optional(),
      });

      const validatedData = safeParse(swipeSchema, req.body, res);
      if (!validatedData) return;

      const { direction, sessionId } = validatedData;

      // Verify voting event exists and belongs to group
      const votingEvent = await db
        .select()
        .from(votingEvents)
        .where(and(eq(votingEvents.id, votingEventId), eq(votingEvents.groupId, groupId)))
        .limit(1);

      if (!votingEvent || votingEvent.length === 0) {
        return res.status(404).json({ message: "Favorite not found" });
      }

      // Get member for this user in this group
      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Check if user already swiped on this voting event
      const { hasUserSwipedVotingEvent } = await import('./swipe-consensus');
      const alreadySwiped = await hasUserSwipedVotingEvent(userId, votingEventId);

      if (alreadySwiped) {
        return res.status(400).json({ message: "You've already swiped on this favorite" });
      }

      // Record the swipe
      const swipe = await db.insert(activitySwipes).values({
        groupId,
        activityId: null,
        votingEventId,
        userId,
        memberId: member.id,
        swipeDirection: direction,
        swipeSessionId: sessionId || null,
      }).returning();

      // Update consensus for this voting event
      const { updateVotingEventConsensus, getVotingEventSwipeStats, performVotingEventAutoActions } = await import('./swipe-consensus');
      await updateVotingEventConsensus(votingEventId);

      // Get updated stats
      const stats = await getVotingEventSwipeStats(votingEventId);

      // Perform auto-actions if consensus thresholds are met
      const autoAction = await performVotingEventAutoActions(votingEventId);

      // If part of a session, update session participation and check auto-complete
      if (sessionId) {
        const { recordSwipeInSession, checkAndAutoCompleteSession } = await import('./swipe-session-manager');
        await recordSwipeInSession(sessionId, member.id, userId);
        await checkAndAutoCompleteSession(sessionId);
      }

      res.json({
        swipe: swipe[0],
        stats,
        autoAction, // Include auto-action result in response
      });
    } catch (error: any) {
      console.error('Error recording favorite swipe:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get swipe progress for a group
  app.get("/api/groups/:groupId/swipe-progress", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user has access to this group
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member && group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this group" });
      }

      // Get swipe progress
      const { getGroupSwipeProgress } = await import('./swipe-consensus');
      const progress = await getGroupSwipeProgress(groupId);

      res.json(progress);
    } catch (error: any) {
      console.error('Error fetching swipe progress:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Check swipe trigger opportunities
  app.get("/api/groups/:groupId/swipe-triggers/status", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user has access to this group
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member && group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this group" });
      }

      // Check all trigger opportunities
      const { checkTriggerOpportunities } = await import('./swipe-trigger-manager');
      const opportunities = await checkTriggerOpportunities(groupId);

      res.json(opportunities);
    } catch (error: any) {
      console.error('Error checking swipe triggers:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Manually trigger a swipe session (organizer only)
  app.post("/api/groups/:groupId/swipe-triggers/manual", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user is organizer
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only group organizers can manually trigger swipe sessions" });
      }

      // Validate request body
      const manualTriggerSchema = z.object({
        activityIds: z.array(z.string()).min(1),
        reason: z.string().optional(),
        expiresInHours: z.number().min(1).max(168).optional(),
      });

      const validatedData = safeParse(manualTriggerSchema, req.body, res);
      if (!validatedData) return;

      const { activityIds, reason, expiresInHours } = validatedData;

      // Trigger manual swipe session
      const { triggerSwipeSession } = await import('./swipe-trigger-manager');
      const result = await triggerSwipeSession({
        groupId,
        triggerType: 'manual',
        activityIds,
        reason,
        expiresInHours,
      });

      if (result.triggered) {
        res.json({
          success: true,
          sessionId: result.sessionId,
          message: result.reason,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.skippedReason,
        });
      }
    } catch (error: any) {
      console.error('Error triggering manual swipe session:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Trigger weekly digest (organizer only or cron)
  app.post("/api/groups/:groupId/swipe-triggers/weekly-digest", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user is organizer
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only group organizers can trigger weekly digests" });
      }

      // Trigger weekly digest
      const { triggerSwipeSession } = await import('./swipe-trigger-manager');
      const result = await triggerSwipeSession({
        groupId,
        triggerType: 'weekly_digest',
      });

      if (result.triggered) {
        res.json({
          success: true,
          sessionId: result.sessionId,
          message: result.reason,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.skippedReason,
        });
      }
    } catch (error: any) {
      console.error('Error triggering weekly digest:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Process weekly digests for all groups (for cron jobs)
  app.post("/api/cron/weekly-digest", async (req, res) => {
    try {
      // Simple auth: check for CRON_SECRET in headers or query
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        console.error("CRON_SECRET environment variable not configured");
        return res.status(500).json({ message: "Server configuration error" });
      }
      const providedSecret = req.headers['x-cron-secret'] || req.query.secret;

      if (providedSecret !== cronSecret) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Process weekly digests for all groups
      const { processWeeklyDigests } = await import('./swipe-digest-worker');
      await processWeeklyDigests();

      res.json({ success: true, message: "Weekly digests processed" });
    } catch (error: any) {
      console.error('Error processing weekly digests:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Join a group (requires valid invite token, matching email, or shareable link for security)
  app.post("/api/groups/:id/join", async (req, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(joinGroupSchema, req.body, res);
      if (!validatedData) return;

      const { name, email, inviteToken, shareableLink } = validatedData;

      // Verify the group exists and is not deleted
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if invite link is open (reject joins via shareable link if closed)
      if (!group.inviteLinkOpen && shareableLink) {
        return res.status(403).json({
          message: "This invite link is no longer active",
          linkClosed: true
        });
      }

      // Require invite token OR email that matches an existing invited member OR valid shareable link
      let existingMember: any = null;
      if (inviteToken) {
        // Validate invite token by querying members with that claim token
        const [memberByToken] = await db
          .select()
          .from(membersTable)
          .where(sql`claim_token = ${inviteToken}`);

        if (!memberByToken || memberByToken.groupId !== req.params.id) {
          return res.status(403).json({ message: "Invalid invite token" });
        }
        existingMember = memberByToken;
      } else if (shareableLink) {
        // Validate shareable link matches this group - allows "I'm not on this list" flow
        if (group.shareableLink !== shareableLink) {
          return res.status(403).json({ message: "Invalid invite link" });
        }
        // Name is required for new members joining via shareable link
        if (!name || !name.trim()) {
          return res.status(400).json({ message: "Name is required to join" });
        }
        // Create new guest member for this group (not a recurring member, just for this invite)
        const newMember = await storage.createMember({
          groupId: req.params.id,
          name: name.trim(),
          email: email || null,
          hasJoined: true,
          isGuest: true, // Mark as guest - they're not a permanent group member
        });
        return res.json(newMember);
      } else {
        return res.status(403).json({ message: "Invite token or email required to join" });
      }

      // Update existing member record instead of creating duplicate
      if (existingMember) {
        const updatedMember = await storage.updateMember(existingMember.id, {
          name: name || existingMember.name,
          hasJoined: true,
        });
        return res.json(updatedMember);
      }

      // Fallback: should not reach here with proper validation above
      return res.status(403).json({ message: "Unable to join group" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get individual member by ID (public for event invite flow)
  // Returns only safe, non-sensitive fields for public access
  // Returns additional fields (userId, profile data) for authenticated users
  app.get("/api/members/:id", publicEndpointLimiter, async (req: any, res) => {
    try {
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Check if user is authenticated
      let authenticatedUserId: string | null = null;
      try {
        authenticatedUserId = await getUserId(req);
      } catch {
        // Not authenticated, that's fine for public access
      }

      // Base safe fields for public access
      const safeMember: any = {
        id: member.id,
        name: member.name,
        groupId: member.groupId,
        isOrganizer: member.isOrganizer,
        openToHosting: member.openToHosting,
        hasJoined: member.hasJoined,
      };

      // If authenticated, include userId and profile fields for ownership verification
      if (authenticatedUserId) {
        safeMember.userId = member.userId;
        safeMember.homeBaseLocation = member.homeBaseLocation;
        safeMember.homeBaseLatitude = member.homeBaseLatitude;
        safeMember.homeBaseLongitude = member.homeBaseLongitude;
        safeMember.activityPreferences = member.activityPreferences;
        safeMember.personalAvailability = member.personalAvailability;
        safeMember.profileCompleted = member.profileCompleted;
      }

      res.json(safeMember);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update member (requires authentication - user must be group owner OR the member themselves)
  app.patch("/api/members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      
      // Get the member to check authorization
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      // Get the group to check if user is the organizer
      const group = await storage.getGroup(member.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Authorization: user must be group owner OR the member themselves
      const isGroupOwner = group.userId === userId;
      const isMemberOwner = member.userId === userId;
      
      if (!isGroupOwner && !isMemberOwner) {
        return res.status(403).json({ message: "Not authorized to update this member" });
      }
      
      const validatedUpdates = updateMemberSchema.parse(req.body);
      const updatedMember = await storage.updateMember(req.params.id, validatedUpdates);
      res.json(updatedMember);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete member
  app.delete("/api/members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const member = await storage.getMember(req.params.id);

      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Verify user owns the group
      const group = await storage.getGroup(member.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You don't have access to this member" });
      }

      await storage.deleteMember(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      const status = error.message.includes("Cannot delete organizer") ? 400 : 500;
      res.status(status).json({ message: error.message });
    }
  });

  // Member Group Preferences Routes
  // Get member's preferences for a specific group
  app.get("/api/groups/:groupId/my-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;

      // Verify user is a member or owner of this group
      const group = await storage.getGroup(groupId);
      const members = await storage.getGroupMembers(groupId);
      const member = members.find(m => m.userId === userId);
      const isOwner = group?.userId === userId;
      
      if (!member && !isOwner) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      const preferences = await storage.getMemberGroupPreferences(userId, groupId);
      res.json(preferences || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update member's preferences for a specific group
  app.patch("/api/groups/:groupId/my-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;

      // Verify user is a member or owner of this group
      const group = await storage.getGroup(groupId);
      const members = await storage.getGroupMembers(groupId);
      const member = members.find(m => m.userId === userId);
      const isOwner = group?.userId === userId;
      
      if (!member && !isOwner) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      const { budgetOverrideMin, budgetOverrideMax, categoryPreferencesOverride, availabilityOverride, meetingFrequencyOverride } = req.body;

      const preferences = await storage.upsertMemberGroupPreferences(userId, groupId, {
        budgetOverrideMin,
        budgetOverrideMax,
        categoryPreferencesOverride,
        availabilityOverride,
        meetingFrequencyOverride,
      });

      res.json(preferences);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get aggregated availability for all members in a group (for heatmap)
  app.get("/api/groups/:groupId/members-availability", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;

      // Verify user is a member or owner of this group
      const group = await storage.getGroup(groupId);
      const members = await storage.getGroupMembers(groupId);
      const member = members.find(m => m.userId === userId);
      const isOwner = group?.userId === userId;

      if (!member && !isOwner) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Get all members' availability with preference hierarchy applied
      const membersAvailability = await storage.getGroupMembersAvailability(groupId);

      // Find the current user's member ID for the frontend
      const currentUserMemberId = member?.id || null;

      res.json({
        membersAvailability,
        currentUserMemberId,
        totalMembers: membersAvailability.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all members' budgets for group budget influence visualization
  app.get("/api/groups/:groupId/members-budgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;

      // Verify user is a member or owner of this group
      const group = await storage.getGroup(groupId);
      const members = await storage.getGroupMembers(groupId);
      const member = members.find(m => m.userId === userId);
      const isOwner = group?.userId === userId;

      if (!member && !isOwner) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Get all members' budgets with preference hierarchy applied
      const membersBudgets = await storage.getGroupMembersBudgets(groupId);

      // Find the current user's member ID for the frontend
      const currentUserMemberId = member?.id || null;

      res.json({
        membersBudgets,
        currentUserMemberId,
        groupBudgetMin: group?.budgetMin ?? 20,
        groupBudgetMax: group?.budgetMax ?? 80,
        totalMembers: membersBudgets.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Member RSVP Routes

  // Verify an invite token and return member data (no auth required)
  app.get("/api/members/verify-claim/:inviteToken", async (req, res) => {
    try {
      const { inviteToken } = req.params;

      if (!inviteToken) {
        return res.status(400).json({ message: "Invite token required" });
      }

      // Find invite by token
      const invites = await db
        .select()
        .from(itineraryInvites)
        .where(sql`invite_token = ${inviteToken}`);

      if (invites.length === 0) {
        return res.status(404).json({ message: "Invalid or expired invite token" });
      }

      const invite = invites[0];
      
      // Handle organizer invites (no member yet - memberId is null)
      if (!invite.memberId) {
        // Get itinerary to find the group
        if (!invite.itineraryId) {
          return res.status(404).json({ message: "Invalid invite - missing itinerary" });
        }
        const itinerary = await storage.getItinerary(invite.itineraryId);
        if (!itinerary || !itinerary.groupId) {
          return res.status(404).json({ message: "Itinerary not found" });
        }

        // Get group to find organizer
        const group = await storage.getGroup(itinerary.groupId);
        if (!group || !group.userId) {
          return res.status(404).json({ message: "Group not found" });
        }

        // Get organizer user data
        const organizer = await storage.getUser(group.userId);
        if (!organizer) {
          return res.status(404).json({ message: "Organizer not found" });
        }
        
        // Return organizer data as if they were a member
        return res.json({
          id: null, // No member ID yet
          name: `${organizer.firstName} ${organizer.lastName}`,
          email: organizer.email,
          isOrganizer: true,
        });
      }
      
      // Get member data for regular member invites
      const member = await storage.getMember(invite.memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      // Return member data (without sensitive fields)
      res.json({
        id: member.id,
        name: member.name,
        email: member.email,
        hasAccount: !!member.userId, // Whether member has linked their account
      });
    } catch (error: any) {
      console.error('[Verify Invite] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Claim a member identity (no auth required)
  app.post("/api/members/:id/claim", async (req, res) => {
    try {
      const { claimToken, groupId } = req.body;

      if (!claimToken) {
        return res.status(400).json({ message: "Claim token required" });
      }

      let memberId = req.params.id;

      // Handle virtual organizer IDs (format: "organizer-{userId}")
      // These are created by getGroupMembersWithOrganizer() for display purposes
      // but don't exist in the database - we need to create a real member record
      if (memberId.startsWith("organizer-")) {
        const organizerUserId = memberId.replace("organizer-", "");

        if (!groupId) {
          return res.status(400).json({ message: "Group ID required for organizer claim" });
        }

        // Verify the group exists and the user is actually the organizer
        const group = await storage.getGroup(groupId);
        if (!group || group.userId !== organizerUserId) {
          return res.status(403).json({ message: "Invalid organizer claim" });
        }

        // Get organizer info
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

        // Check if there's already a member record for this organizer
        const existingOrganizerMember = await db
          .select()
          .from(membersTable)
          .where(and(
            eq(membersTable.groupId, groupId),
            eq(membersTable.userId, organizerUserId)
          ))
          .limit(1);

        if (existingOrganizerMember.length > 0) {
          // Use the existing member record
          memberId = existingOrganizerMember[0].id;
        } else {
          // Create a new member record for the organizer
          const newMember = await storage.createMember({
            groupId,
            name: organizerName,
            email: organizerInfo?.email || null,
            userId: organizerUserId,
            hasJoined: true,
            isGuest: false, // Organizer is not a guest
          });
          memberId = newMember.id;
        }
      }

      // Check if member exists and if already claimed
      const existingMember = await storage.getMember(memberId);
      if (!existingMember) {
        return res.status(404).json({ message: "Member not found" });
      }

      // If member already has a claim token, reject the claim attempt
      // This prevents RSVP hijacking - once claimed, the identity is locked to that token
      if (existingMember.claimToken && existingMember.claimToken !== claimToken) {
        return res.status(409).json({ 
          message: "This member has already been claimed by someone else",
          alreadyClaimed: true 
        });
      }

      // If not claimed yet, or re-claiming with same token, allow it
      const member = await storage.updateMember(memberId, {
        claimToken,
        hasJoined: true,
      });

      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update member RSVP status (no auth required, validates claim token)
  app.patch("/api/members/:id/rsvp", requireMemberAccess(), async (req: any, res) => {
    try {
      const { rsvpStatus, claimToken } = req.body;

      if (!claimToken) {
        return res.status(401).json({ message: "Claim token required" });
      }

      if (!["going", "maybe", "not_going"].includes(rsvpStatus)) {
        return res.status(400).json({ message: "Invalid RSVP status" });
      }

      // Verify the claim token matches
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      if (member.claimToken !== claimToken) {
        return res.status(401).json({ message: "Invalid claim token" });
      }

      // Update RSVP status
      const updatedMember = await storage.updateMember(req.params.id, {
        rsvpStatus,
      });

      res.json(updatedMember);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update member preferences (no auth required, validates claim token)
  app.patch("/api/members/:id/preferences", requireMemberAccess(), async (req: any, res) => {
    try {
      const { memberLocation, memberBudgetMin, memberBudgetMax, memberAvailability, claimToken } = req.body;

      if (!claimToken) {
        return res.status(401).json({ message: "Claim token required" });
      }

      // Verify the claim token matches
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      if (member.claimToken !== claimToken) {
        return res.status(401).json({ message: "Invalid claim token" });
      }

      // Build update object with only provided fields
      const updates: any = {};
      if (memberLocation !== undefined) updates.memberLocation = memberLocation;
      if (memberBudgetMin !== undefined) updates.memberBudgetMin = memberBudgetMin;
      if (memberBudgetMax !== undefined) updates.memberBudgetMax = memberBudgetMax;
      if (memberAvailability !== undefined) updates.memberAvailability = memberAvailability;

      // Update preferences
      const updatedMember = await storage.updateMember(req.params.id, updates);

      res.json(updatedMember);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update member constraints from RSVP follow-ups (no auth required, validates claim token)
  app.patch("/api/members/:id/constraints", requireMemberAccess(), async (req: any, res) => {
    try {
      const { memberConstraints, claimToken } = req.body;

      if (!claimToken) {
        return res.status(401).json({ message: "Claim token required" });
      }

      // Verify the claim token matches
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      if (member.claimToken !== claimToken) {
        return res.status(401).json({ message: "Invalid claim token" });
      }

      // Update constraints
      const updatedMember = await storage.updateMember(req.params.id, {
        memberConstraints,
      });

      res.json(updatedMember);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update member profile (authenticated only)
  app.patch("/api/members/:id/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      const { homeBaseLocation, homeBaseLatitude, homeBaseLongitude, activityPreferences, personalAvailability } = req.body;

      // Get the member
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Authorization: must be the linked user
      if (member.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this member" });
      }

      // Update profile fields
      const updatedMember = await storage.updateMember(req.params.id, {
        homeBaseLocation,
        homeBaseLatitude: homeBaseLatitude ? String(homeBaseLatitude) : undefined,
        homeBaseLongitude: homeBaseLongitude ? String(homeBaseLongitude) : undefined,
        activityPreferences,
        personalAvailability,
        profileCompleted: true, // Mark profile as completed
      });

      res.json(updatedMember);
    } catch (error: any) {
      console.error('[Update Member Profile] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Member Favorite Venues Routes

  // Get member's favorite venues
  app.get("/api/members/:memberId/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { memberId } = req.params;

      // Get the member
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Authorization: must be the linked user
      if (member.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this member's favorites" });
      }

      const favorites = await storage.getMemberFavoriteVenues(memberId);
      res.json(favorites);
    } catch (error: any) {
      console.error('[Get Member Favorites] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add a favorite venue
  app.post("/api/members/:memberId/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { memberId } = req.params;
      const { venuePlaceId, venueName, venueAddress, venuePhotoUrl, category } = req.body;

      if (!venuePlaceId || !venueName) {
        return res.status(400).json({ message: "venuePlaceId and venueName are required" });
      }

      // Get the member
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Authorization: must be the linked user
      if (member.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this member's favorites" });
      }

      // Check if already favorited
      const alreadyFavorited = await storage.isFavoriteVenue(memberId, venuePlaceId);
      if (alreadyFavorited) {
        return res.status(400).json({ message: "Venue already in favorites" });
      }

      // Add to favorites
      const favorite = await storage.addMemberFavoriteVenue(memberId, {
        venuePlaceId,
        venueName,
        venueAddress,
        venuePhotoUrl,
        category,
      });

      // Auto-cache to curatedVenues if not already cached (with source='user_suggested')
      try {
        // Check if venue already exists in curatedVenues
        const [existingVenue] = await db
          .select()
          .from(curatedVenues)
          .where(eq(curatedVenues.googlePlaceId, venuePlaceId))
          .limit(1);

        if (!existingVenue) {

          // Fetch full venue details from Google Places
          const placeDetails = await getPlaceDetails(venuePlaceId);

          if (placeDetails && placeDetails.location) {
            // Map category to curated venue categories
            const categoryMap: Record<string, string> = {
              'restaurant': 'meal',
              'cafe': 'cafes',
              'coffee': 'cafes',
              'bar': 'drinks',
              'dessert': 'dessert',
              'bakery': 'dessert',
              'ice_cream': 'dessert',
            };
            const mappedCategory = categoryMap[category?.toLowerCase() || ''] || 'experiences';

            // Insert into curatedVenues
            await db.insert(curatedVenues).values({
              name: placeDetails.name,
              address: placeDetails.address,
              latitude: placeDetails.location.lat.toString(),
              longitude: placeDetails.location.lng.toString(),
              category: mappedCategory,
              rating: placeDetails.rating?.toString() || null,
              reviewCount: placeDetails.reviewCount || null,
              priceLevel: typeof placeDetails.priceLevel === 'number' ? placeDetails.priceLevel : null,
              photoUrl: placeDetails.photoUrl || null,
              googlePlaceId: venuePlaceId,
              description: null, // Could add AI-generated description later
              tags: placeDetails.types || [],
              region: 'bay_area', // Default to bay area, could improve with geocoding
              isActive: true,
              source: 'user_suggested',
              suggestedBy: userId,
              openingHours: placeDetails.openingHours || null,
              businessStatus: placeDetails.businessStatus || null,
            });

          } else {

          }
        } else {

        }
      } catch (cacheError: any) {
        // Don't fail the request if caching fails
        console.error('[Auto-Cache] Error caching venue to curatedVenues:', cacheError);
      }

      res.json(favorite);
    } catch (error: any) {
      console.error('[Add Member Favorite] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Remove a favorite venue
  app.delete("/api/members/:memberId/favorites/:placeId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { memberId, placeId } = req.params;

      // Get the member
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Authorization: must be the linked user
      if (member.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this member's favorites" });
      }

      await storage.removeMemberFavoriteVenue(memberId, placeId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Remove Member Favorite] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Venue search/autocomplete for adding favorites
  app.get("/api/venues/search", isAuthenticated, async (req: any, res) => {
    try {
      const { query, location } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query parameter required" });
      }

      // Use searchPlaces to find venues matching the query
      // Default to San Francisco if no location provided
      const searchLocation = location && typeof location === 'string' ? location : "San Francisco, CA";

      // searchPlaces expects positional parameters: query, location, radiusMiles
      const results = await searchPlaces(
        query,
        searchLocation,
        6.2, // 10km radius (~6.2 miles)
        undefined, // coordinates
        false, // skipCurated
        undefined, // venueType
        undefined, // budgetMax
        undefined, // seenVenues
        false, // forceComprehensiveSearch
        true // userDirected - this is a user-initiated search
      );

      // Return simplified results for autocomplete
      const suggestions = results.map((place: any) => ({
        placeId: place.placeId || place.googlePlaceId,
        name: place.name,
        address: place.address,
        category: place.types?.[0] || 'other',
        photoUrl: place.photoUrl,
        rating: place.rating,
        priceLevel: place.priceLevel,
      }));

      res.json({ results: suggestions });
    } catch (error: any) {
      console.error('[Venue Search] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== Saved Places Routes ====================

  // Get user's personal saved places
  app.get("/api/user/saved-places", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { category } = req.query;

      const places = await storage.getUserSavedPlaces(
        userId,
        category && typeof category === 'string' ? category : undefined
      );
      res.json(places);
    } catch (error: any) {
      console.error('[Get User Saved Places] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add a personal saved place
  app.post("/api/user/saved-places", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { googlePlaceId, name, address, latitude, longitude, category, rating, priceLevel, photoUrl, notes } = req.body;

      if (!googlePlaceId || !name) {
        return res.status(400).json({ message: "googlePlaceId and name are required" });
      }

      // Check if already saved
      const alreadySaved = await storage.isUserSavedPlace(userId, googlePlaceId);
      if (alreadySaved) {
        return res.status(400).json({ message: "Place already saved" });
      }

      const place = await storage.addUserSavedPlace({
        userId,
        googlePlaceId,
        name,
        address,
        latitude,
        longitude,
        category,
        rating,
        priceLevel,
        photoUrl,
        notes,
      });

      res.json(place);
    } catch (error: any) {
      console.error('[Add User Saved Place] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Remove a personal saved place
  app.delete("/api/user/saved-places/:placeId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { placeId } = req.params;

      await storage.removeUserSavedPlace(userId, placeId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Remove User Saved Place] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get group's saved places
  app.get("/api/groups/:groupId/saved-places", isAuthenticated, requireGroupAccess, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const { category } = req.query;

      const places = await storage.getGroupSavedPlaces(
        groupId,
        category && typeof category === 'string' ? category : undefined
      );
      res.json(places);
    } catch (error: any) {
      console.error('[Get Group Saved Places] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add a group saved place
  app.post("/api/groups/:groupId/saved-places", isAuthenticated, requireGroupAccess, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;
      const { googlePlaceId, name, address, latitude, longitude, category, rating, priceLevel, photoUrl, notes } = req.body;

      if (!googlePlaceId || !name) {
        return res.status(400).json({ message: "googlePlaceId and name are required" });
      }

      // Check if already saved in this group
      const alreadySaved = await storage.isGroupSavedPlace(groupId, googlePlaceId);
      if (alreadySaved) {
        return res.status(400).json({ message: "Place already saved to this group" });
      }

      // Get user name for attribution
      const user = await storage.getUser(userId);
      const addedByName = user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.firstName || user?.email || 'Someone';

      const place = await storage.addGroupSavedPlace({
        groupId,
        addedByUserId: userId,
        addedByName,
        googlePlaceId,
        name,
        address,
        latitude,
        longitude,
        category,
        rating,
        priceLevel,
        photoUrl,
        notes,
      });

      res.json(place);
    } catch (error: any) {
      console.error('[Add Group Saved Place] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Remove a group saved place
  app.delete("/api/groups/:groupId/saved-places/:placeId", isAuthenticated, requireGroupAccess, async (req: any, res) => {
    try {
      const { groupId, placeId } = req.params;

      await storage.removeGroupSavedPlace(groupId, placeId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Remove Group Saved Place] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all places for a user (personal + all their groups' venue libraries)
  app.get("/api/user/all-places", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { category } = req.query;
      const categoryFilter = category && typeof category === 'string' ? category : undefined;

      console.log(`[All Places] Fetching for user ${userId}, category filter: ${categoryFilter}`);

      // Get personal places (manually saved)
      const personalPlaces = await storage.getUserSavedPlaces(userId, categoryFilter);

      // Get user's groups
      const userGroups = await storage.getUserGroups(userId);

      // Get venue library (voting_events) from each group
      const venueLibraryPromises = userGroups.map(async (group) => {
        const votingEvents = await storage.getGroupVotingEvents(group.id);

        // Filter to only venues with place IDs and transform to place format
        const places = votingEvents
          .filter(ve => ve.googlePlaceId)
          .filter(ve => !categoryFilter || ve.venueType === categoryFilter)
          .map(ve => ({
            id: ve.id,
            googlePlaceId: ve.googlePlaceId!,
            name: ve.title,
            address: ve.venueAddress || null,
            category: ve.venueType || null,
            rating: ve.rating || null,
            priceLevel: ve.priceLevel ? parseInt(ve.priceLevel) : null,
            photoUrl: ve.photoUrl || null,
            createdAt: ve.createdAt.toISOString(),
            upvotes: ve.upvotes,
            downvotes: ve.downvotes,
          }));

        return {
          groupId: group.id,
          groupName: group.name,
          groupEmoji: group.emoji,
          places,
        };
      });

      const venueLibraryResults = await Promise.allSettled(venueLibraryPromises);
      const venueLibrary = venueLibraryResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      const failedLibrary = venueLibraryResults.filter(r => r.status === 'rejected');
      if (failedLibrary.length > 0) {
        console.error(`[All Places] ${failedLibrary.length}/${userGroups.length} venue library fetches failed`);
      }

      console.log(`[All Places] Found ${userGroups.length} groups, venueLibrary totals: ${venueLibrary.map(g => `${g.groupName}:${g.places.length}`).join(', ')}`);

      // Also get manually saved group places (if any)
      const groupPlacesPromises = userGroups.map(async (group) => {
        const places = await storage.getGroupSavedPlaces(group.id, categoryFilter);
        return {
          groupId: group.id,
          groupName: group.name,
          groupEmoji: group.emoji,
          places,
        };
      });

      const groupPlacesResults = await Promise.allSettled(groupPlacesPromises);
      const groupPlaces = groupPlacesResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      const failedPlaces = groupPlacesResults.filter(r => r.status === 'rejected');
      if (failedPlaces.length > 0) {
        console.error(`[All Places] ${failedPlaces.length}/${userGroups.length} group places fetches failed`);
      }

      res.json({
        personal: personalPlaces,
        groups: groupPlaces,
        venueLibrary, // This is the main source - voting_events from each group
      });
    } catch (error: any) {
      console.error('[Get All Places] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get unreviewed venues across all groups for Places swipe flow
  app.get("/api/user/places-swipe-queue", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      // Get user's groups
      const userGroups = await storage.getUserGroups(userId);

      // Get user's existing votes to filter out already-voted venues
      const userVotes = await storage.getUserVotes(userId);
      const votedEventIds = new Set(userVotes.map(v => v.eventId));

      // Build queue for each group
      const groupQueues = await Promise.all(
        userGroups.map(async (group) => {
          // Get voting events for this group
          const votingEvents = await storage.getGroupVotingEvents(group.id);

          // Filter to unvoted only
          const unvotedEvents = votingEvents.filter(
            (event) => !votedEventIds.has(event.id)
          );

          // Get member info for context
          const members = await storage.getGroupMembers(group.id);
          const memberNames = members
            .filter((m) => m.userId !== userId) // Exclude current user
            .slice(0, 5)
            .map((m) => m.name || m.email?.split("@")[0] || "Member");

          // Get who added each venue and who liked it
          const venuesWithContext = await Promise.all(
            unvotedEvents.map(async (event) => {
              // Get who added this venue
              const addedByUser = event.createdBy
                ? await storage.getUser(event.createdBy)
                : null;
              const addedByName =
                addedByUser?.firstName ||
                addedByUser?.email?.split("@")[0] ||
                "Someone";

              // Get who liked this venue
              const votes = await storage.getEventVotes(event.id);
              const upvoters = votes.filter((v) => v.voteType === "upvote");
              const likerNames = await Promise.all(
                upvoters.slice(0, 3).map(async (vote) => {
                  const user = await storage.getUser(vote.userId);
                  return user?.firstName || "Someone";
                })
              );

              return {
                id: event.id,
                title: event.title,
                venueAddress: event.venueAddress,
                venueType: event.venueType,
                googlePlaceId: event.googlePlaceId,
                rating: event.rating,
                reviewCount: event.reviewCount,
                priceLevel: event.priceLevel,
                photoUrl: event.photoUrl,
                addedBy: addedByName,
                likedBy: likerNames,
                likedByCount: upvoters.length,
              };
            })
          );

          return {
            groupId: group.id,
            groupName: group.name,
            groupEmoji: group.emoji || "👥",
            memberNames,
            memberCount: members.length,
            venues: venuesWithContext,
            totalUnreviewed: venuesWithContext.length,
          };
        })
      );

      // Filter out groups with no unreviewed venues
      const groupsWithVenues = groupQueues.filter((g) => g.venues.length > 0);

      // Sort by most venues first (or could do most recently active)
      groupsWithVenues.sort((a, b) => b.totalUnreviewed - a.totalUnreviewed);

      const totalUnreviewed = groupsWithVenues.reduce(
        (sum, g) => sum + g.totalUnreviewed,
        0
      );

      res.json({
        groups: groupsWithVenues,
        totalUnreviewed,
        totalGroups: groupsWithVenues.length,
      });
    } catch (error: any) {
      console.error("[Places Swipe Queue] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get curated venues for browsing
  app.get("/api/curated-venues", isAuthenticated, async (req: any, res) => {
    try {
      const { category, priceLevel, limit = "20" } = req.query;

      let query = db.select().from(curatedVenues).where(eq(curatedVenues.isActive, true));

      // Apply filters
      const conditions: any[] = [eq(curatedVenues.isActive, true)];

      if (category && typeof category === 'string') {
        conditions.push(eq(curatedVenues.category, category));
      }

      if (priceLevel && typeof priceLevel === 'string') {
        const priceLevelNum = parseInt(priceLevel);
        if (!isNaN(priceLevelNum)) {
          conditions.push(eq(curatedVenues.priceLevel, priceLevelNum));
        }
      }

      const venues = await db
        .select()
        .from(curatedVenues)
        .where(and(...conditions))
        .orderBy(desc(curatedVenues.rating))
        .limit(parseInt(limit as string) || 20);

      res.json(venues);
    } catch (error: any) {
      console.error('[Curated Venues] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI-powered venue alternative suggestions
  app.post("/api/venues/suggest-alternatives", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body - safeParse returns the data or undefined (and sends 400)
      const validatedData = safeParse(suggestAlternativesSchema, req.body, res);
      if (!validatedData) return; // safeParse already sent 400 response
      const { currentVenue, itineraryId } = validatedData;

      // Get itinerary context if provided
      let itinerary = null;
      let groupLocation = "San Francisco, CA";

      if (itineraryId) {
        itinerary = await storage.getItinerary(itineraryId);
        if (itinerary?.groupId) {
          const group = await storage.getGroup(itinerary.groupId);
          if (group?.locationBase) {
            groupLocation = group.locationBase;
          }
        }
      }

      // Search for similar venues
      const venueType = currentVenue.venueType || 'restaurant';
      const searchQuery = `${venueType} near ${currentVenue.address || groupLocation}`;

      const alternatives = await searchPlaces(
        searchQuery,
        groupLocation,
        3, // 3 mile radius
        undefined,
        false,
        venueType,
        undefined,
        currentVenue.placeId ? [currentVenue.placeId] : [], // Exclude current venue
        false,
        true
      );

      // Limit to top 5 and add reasoning
      const suggestions = alternatives.slice(0, 5).map((alt: any) => {
        const reasons: string[] = [];

        // Check review count and rating
        if (alt.rating && parseFloat(alt.rating) >= 4.0) {
          reasons.push(`Highly rated (${alt.rating})`);
        }
        if (alt.reviewCount && alt.reviewCount > 100) {
          reasons.push(`Well-reviewed (${alt.reviewCount} reviews)`);
        }
        if (alt.priceLevel) {
          const priceLen = alt.priceLevel.length;
          if (priceLen <= 2) {
            reasons.push(`Affordable (${alt.priceLevel})`);
          }
        }

        return {
          placeId: alt.placeId,
          name: alt.name,
          address: alt.address,
          rating: alt.rating,
          priceLevel: alt.priceLevel,
          reviewCount: alt.reviewCount,
          photoUrl: alt.photoUrl,
          types: alt.types,
          type: alt.types?.[0] || venueType, // Primary type for frontend compatibility
          latitude: alt.location?.lat,
          longitude: alt.location?.lng,
          reasoning: reasons.length > 0 ? reasons.join(', ') : 'Similar venue in area',
        };
      });

      res.json({ suggestions });
    } catch (error: any) {
      console.error('[AI Venue Suggestions] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Event Hosting Routes

  // Toggle member hosting availability (authenticated or via claim token)
  app.patch("/api/members/:id/hosting-toggle", requireMemberAccess(), async (req: any, res) => {
    try {
      const { openToHosting, claimToken } = req.body;
      const userId = await getUserId(req);

      if (!userId && !claimToken) {
        return res.status(401).json({ message: "Authentication or claim token required" });
      }

      // Get the member
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Authorization: must be the linked user or have claim token
      if (claimToken && member.claimToken !== claimToken) {
        return res.status(403).json({ message: "Invalid claim token" });
      }
      if (userId && member.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this member" });
      }

      const updatedMember = await storage.toggleMemberHosting(req.params.id, openToHosting);
      res.json(updatedMember);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Volunteer to host an event (authenticated or via claim token)
  app.post("/api/itineraries/:id/volunteer-host", requireMemberAccess(), async (req: any, res) => {
    try {
      const { claimToken } = req.body;
      const userId = await getUserId(req);

      if (!userId && !claimToken) {
        return res.status(401).json({ message: "Authentication or claim token required" });
      }

      // Get the itinerary to find the group
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Find the member record for this user in this group
      const groupMembers = await storage.getGroupMembers(itinerary.groupId);
      let member;
      
      if (claimToken) {
        member = groupMembers.find(m => m.claimToken === claimToken);
      } else if (userId) {
        member = groupMembers.find(m => m.userId === userId);
      }

      if (!member) {
        return res.status(404).json({ message: "You are not a member of this group" });
      }

      // Check if member is open to hosting
      if (!member.openToHosting) {
        return res.status(400).json({ message: "You must be open to hosting to volunteer" });
      }

      // Volunteer to host
      const updatedItinerary = await storage.volunteerToHost(req.params.id, member.id);
      
      // Also auto-RSVP the host as "yes" since hosts must attend
      // Check if there's already an RSVP for this member
      const existingRsvps = await storage.getItineraryRsvps(req.params.id);
      const existingRsvp = existingRsvps.find(r => r.memberId === member.id);
      
      if (!existingRsvp) {
        await storage.createRsvp({
          itineraryId: req.params.id,
          memberId: member.id,
          memberName: member.name || undefined,
          response: 'yes',
        });
      } else if (existingRsvp.response !== 'yes') {
        await storage.updateRsvp(existingRsvp.id, { response: 'yes' });
      }

      res.json(updatedItinerary);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Hand off hosting to another member (authenticated or via claim token)
  app.post("/api/itineraries/:id/hand-off-host", requireMemberAccess(), async (req: any, res) => {
    try {
      const { newHostMemberId, claimToken } = req.body;
      const userId = await getUserId(req);

      if (!userId && !claimToken) {
        return res.status(401).json({ message: "Authentication or claim token required" });
      }

      // Get the itinerary
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Find the current user's member record in this group
      const groupMembers = await storage.getGroupMembers(itinerary.groupId);
      let currentMember;
      
      if (claimToken) {
        currentMember = groupMembers.find(m => m.claimToken === claimToken);
      } else if (userId) {
        currentMember = groupMembers.find(m => m.userId === userId);
      }

      if (!currentMember) {
        return res.status(404).json({ message: "You are not a member of this group" });
      }

      // Verify they are the current host
      if (itinerary.hostMemberId !== currentMember.id) {
        return res.status(403).json({ message: "You are not the current host" });
      }

      // Get new host member
      const newHostMember = await storage.getMember(newHostMemberId);
      if (!newHostMember) {
        return res.status(404).json({ message: "New host member not found" });
      }

      // Verify new host is open to hosting
      if (!newHostMember.openToHosting) {
        return res.status(400).json({ message: "New host must be open to hosting" });
      }

      // Hand off
      const updatedItinerary = await storage.handOffHost(req.params.id, newHostMemberId);
      
      // Auto-RSVP the new host as "yes"
      const existingRsvps = await storage.getItineraryRsvps(req.params.id);
      const existingRsvp = existingRsvps.find(r => r.memberId === newHostMemberId);
      
      if (!existingRsvp) {
        await storage.createRsvp({
          itineraryId: req.params.id,
          memberId: newHostMemberId,
          memberName: newHostMember.name || undefined,
          response: 'yes',
        });
      } else if (existingRsvp.response !== 'yes') {
        await storage.updateRsvp(existingRsvp.id, { response: 'yes' });
      }

      res.json(updatedItinerary);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Rotating Host Assignment Routes

  // Request a host for an event (organizer only)
  app.post("/api/groups/:groupId/request-host", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const { itineraryId } = req.body;
      const userId = await getUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get the group
      const group = await storage.getGroup(req.params.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Authorization: must be the group owner
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only group owner can request a host" });
      }

      // Check if there's already a pending request
      const pendingAssignment = await storage.getPendingHostAssignment(req.params.groupId);
      if (pendingAssignment) {
        return res.status(400).json({ message: "There is already a pending host request" });
      }

      // Find next volunteer to ask
      const nextVolunteer = await storage.getNextHostVolunteer(req.params.groupId);
      if (!nextVolunteer) {
        return res.status(404).json({ message: "No volunteers available to host" });
      }

      // Create host assignment
      const assignment = await storage.createHostAssignment(
        req.params.groupId,
        nextVolunteer.id,
        itineraryId
      );

      res.json({ assignment, volunteer: nextVolunteer });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending host assignment for a group
  app.get("/api/groups/:groupId/pending-host-request", async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const assignment = await storage.getPendingHostAssignment(req.params.groupId);
      if (!assignment) {
        return res.json(null);
      }

      // Get volunteer info
      const volunteer = await storage.getMember(assignment.memberId);
      res.json({ assignment, volunteer });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get host assignments for a member (authenticated or via claim token)
  app.get("/api/members/:memberId/host-assignments", async (req: any, res) => {
    try {
      const { claimToken } = req.query;
      const userId = await getUserId(req);

      if (!userId && !claimToken) {
        return res.status(401).json({ message: "Authentication or claim token required" });
      }

      // Get the member
      const member = await storage.getMember(req.params.memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Authorization: must be the linked user or have claim token
      if (claimToken && member.claimToken !== claimToken) {
        return res.status(403).json({ message: "Invalid claim token" });
      }
      if (userId && member.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const assignments = await storage.getMemberHostAssignments(req.params.memberId);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Respond to host assignment (accept/decline)
  app.post("/api/host-assignments/:assignmentId/respond", requireMemberAccess(), async (req: any, res) => {
    try {
      const { accepted, claimToken } = req.body;
      const userId = await getUserId(req);

      if (!userId && !claimToken) {
        return res.status(401).json({ message: "Authentication or claim token required" });
      }

      // Get the assignment
      const assignments = await db
        .select()
        .from(hostAssignments)
        .where(eq(hostAssignments.id, req.params.assignmentId));

      if (assignments.length === 0) {
        return res.status(404).json({ message: "Host assignment not found" });
      }

      const assignment = assignments[0];

      // Get the member
      const member = await storage.getMember(assignment.memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Authorization: must be the linked user or have claim token
      if (claimToken && member.claimToken !== claimToken) {
        return res.status(403).json({ message: "Invalid claim token" });
      }
      if (userId && member.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Update assignment
      const updatedAssignment = await storage.respondToHostAssignment(
        req.params.assignmentId,
        accepted,
        member.id
      );

      // If accepted and there's an itinerary, assign the host
      if (accepted && assignment.itineraryId) {
        await storage.volunteerToHost(assignment.itineraryId, member.id);
        
        // Auto-RSVP the host as "yes"
        const existingRsvps = await storage.getItineraryRsvps(assignment.itineraryId);
        const existingRsvp = existingRsvps.find(r => r.memberId === member.id);
        
        if (!existingRsvp) {
          await storage.createRsvp({
            itineraryId: assignment.itineraryId,
            memberId: member.id,
            memberName: member.name || undefined,
            response: 'yes',
          });
        } else if (existingRsvp.response !== 'yes') {
          await storage.updateRsvp(existingRsvp.id, { response: 'yes' });
        }
      }

      // If declined, ask next volunteer
      if (!accepted) {
        const nextVolunteer = await storage.getNextHostVolunteer(
          assignment.groupId,
          [member.id] // Exclude the person who just declined
        );

        if (nextVolunteer) {
          const newAssignment = await storage.createHostAssignment(
            assignment.groupId,
            nextVolunteer.id,
            assignment.itineraryId || undefined
          );
          
          return res.json({ 
            assignment: updatedAssignment, 
            nextAssignment: newAssignment,
            nextVolunteer 
          });
        }
      }

      res.json({ assignment: updatedAssignment });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Authenticated Member Claim Routes

  // Verify claim token and get member info (no auth required)
  app.get("/api/members/claim/verify/:claimToken", async (req, res) => {
    try {
      const { claimToken } = req.params;

      if (!claimToken) {
        return res.status(400).json({ message: "Claim token required" });
      }

      // Find member by claim token
      const members = await db
        .select({
          id: membersTable.id,
          name: membersTable.name,
          email: membersTable.email,
          userId: membersTable.userId,
          claimedAt: membersTable.claimedAt,
          groupId: membersTable.groupId,
        })
        .from(membersTable)
        .where(sql`claim_token = ${claimToken}`);

      if (members.length === 0) {
        return res.status(404).json({ message: "Invalid or expired claim token" });
      }

      const member = members[0];

      // Get group info
      const group = await storage.getGroup(member.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if already claimed
      const alreadyClaimed = !!member.userId && !!member.claimedAt;

      res.json({
        id: member.id,
        name: member.name,
        email: member.email,
        groupName: group.name,
        groupEmoji: group.emoji || "🎉",
        alreadyClaimed,
      });
    } catch (error: any) {
      console.error('[Verify Claim Token] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Claim membership (authenticated - links userId to member record)
  app.post("/api/members/claim", isAuthenticated, async (req: any, res) => {
    try {
      const { claimToken } = req.body;
      const userId = await getUserId(req);

      if (!claimToken) {
        return res.status(400).json({ message: "Claim token required" });
      }

      // Find member by claim token
      const members = await db
        .select()
        .from(membersTable)
        .where(sql`claim_token = ${claimToken}`);

      if (members.length === 0) {
        return res.status(404).json({ message: "Invalid claim token" });
      }

      const member = members[0];

      // Check if already claimed by a different user
      if (member.userId && member.userId !== userId) {
        return res.status(409).json({ 
          message: "This membership has already been claimed by another account" 
        });
      }

      // If already claimed by this user, just return success
      if (member.userId === userId) {
        return res.json({
          message: "Membership already claimed",
          member,
        });
      }

      // Claim the membership - link userId to member record
      const updatedMember = await storage.updateMember(member.id, {
        userId,
        claimedAt: new Date(),
        hasJoined: true,
      });

      res.json({
        message: "Membership claimed successfully",
        member: updatedMember,
      });
    } catch (error: any) {
      console.error('[Claim Membership] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Register as a guest using a member's claim token (for people who aren't the intended member)
  app.post("/api/members/register-guest", async (req, res) => {
    try {
      const { claimToken, guestName } = req.body;

      if (!claimToken) {
        return res.status(400).json({ message: "Claim token required" });
      }

      if (!guestName || typeof guestName !== 'string' || guestName.trim().length < 1) {
        return res.status(400).json({ message: "Guest name required" });
      }

      // Find member by claim token to get the group ID
      const members = await db
        .select({
          id: membersTable.id,
          groupId: membersTable.groupId,
        })
        .from(membersTable)
        .where(sql`claim_token = ${claimToken}`);

      if (members.length === 0) {
        return res.status(404).json({ message: "Invalid or expired claim token" });
      }

      const member = members[0];

      // Check if a guest with this name already exists in the group
      const existingGuests = await db
        .select()
        .from(membersTable)
        .where(sql`group_id = ${member.groupId} AND is_guest = true AND LOWER(name) = LOWER(${guestName.trim()})`);

      if (existingGuests.length > 0) {
        // Guest already exists, return success with existing member
        return res.json({
          message: "Guest already registered",
          member: existingGuests[0],
        });
      }

      // Create a new guest member in the group
      const [newGuestMember] = await db
        .insert(membersTable)
        .values({
          groupId: member.groupId,
          name: guestName.trim(),
          isGuest: true,
          hasJoined: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      console.log(`[Register Guest] Created guest member ${newGuestMember.id} in group ${member.groupId}`);

      res.json({
        message: "Guest registered successfully",
        member: newGuestMember,
      });
    } catch (error: any) {
      console.error('[Register Guest] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Phase 2: Link authenticated user to existing member record (simpler than claim)
  app.post("/api/members/link-account", isAuthenticated, async (req: any, res) => {
    try {
      const { memberId } = req.body;
      const userId = await getUserId(req);

      if (!memberId) {
        return res.status(400).json({ message: "Member ID required" });
      }

      // Find member by ID
      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Check if already linked to a different user
      if (member.userId && member.userId !== userId) {
        return res.status(409).json({
          message: "This membership has already been claimed by another account"
        });
      }

      // If already linked to this user, just return success
      if (member.userId === userId) {
        return res.json({
          message: "Account already linked",
          member,
        });
      }

      // Link the account - update member record with userId
      const updatedMember = await storage.updateMember(member.id, {
        userId,
        claimedAt: new Date(),
        hasJoined: true,
      });

      console.log(`[Link Account] Successfully linked member ${member.name} (${memberId}) to user ${userId}`);

      res.json({
        message: "Account linked successfully",
        member: updatedMember,
      });
    } catch (error: any) {
      console.error('[Link Account] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get member's events (pending invitations, upcoming, past)
  // Supports both authenticated users and unclaimed members via claim token
  app.get("/api/members/me/events", async (req: any, res) => {
    try {
      const { claimToken } = req.query;
      const userId = await getUserId(req);

      if (!userId && !claimToken) {
        return res.status(401).json({ message: "Authentication or claim token required" });
      }

      let memberIds: string[] = [];

      // If authenticated, find all member records linked to this user
      if (userId) {
        const userMembers = await db
          .select({ id: membersTable.id })
          .from(membersTable)
          .where(eq(membersTable.userId, userId));
        memberIds = userMembers.map(m => m.id);
      }

      // If claim token provided, find member by claim token
      if (claimToken && typeof claimToken === 'string') {
        const claimMembers = await db
          .select({ id: membersTable.id })
          .from(membersTable)
          .where(eq(membersTable.claimToken, claimToken));
        
        // Add to memberIds if not already present
        claimMembers.forEach(m => {
          if (!memberIds.includes(m.id)) {
            memberIds.push(m.id);
          }
        });
      }

      if (memberIds.length === 0) {
        return res.json({
          pending: [],
          upcoming: [],
          past: [],
        });
      }

      // Get all invites for this member
      const invites = await db
        .select()
        .from(itineraryInvites)
        .where(sql`member_id IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`);

      const invitesByItinerary = new Map(invites.map(inv => [inv.itineraryId, inv]));

      // Get all RSVPs for this member
      const rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`member_id IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`);

      const rsvpsByItinerary = new Map(rsvps.map(rsvp => [rsvp.itineraryId, rsvp]));

      // Get all itineraries this member has been invited to
      const itineraryIds = Array.from(invitesByItinerary.keys());
      
      if (itineraryIds.length === 0) {
        return res.json({
          pending: [],
          upcoming: [],
          past: [],
        });
      }

      // Fetch itineraries with items
      const itinerariesData = await db
        .select()
        .from(itineraries)
        .where(sql`id IN (${sql.join(itineraryIds.map(id => sql`${id}`), sql`, `)})`);

      // Fetch items for each itinerary
      const allItems = await db
        .select()
        .from(itineraryItems)
        .where(sql`itinerary_id IN (${sql.join(itineraryIds.map(id => sql`${id}`), sql`, `)})`);

      const itemsByItinerary = new Map<string, any[]>();
      allItems.forEach(item => {
        if (!itemsByItinerary.has(item.itineraryId)) {
          itemsByItinerary.set(item.itineraryId, []);
        }
        itemsByItinerary.get(item.itineraryId)!.push(item);
      });

      // Fetch groups for context
      const groupIds = Array.from(new Set(itinerariesData.map(it => it.groupId)));
      const groups = await db
        .select()
        .from(groupsTable)
        .where(sql`id IN (${sql.join(groupIds.map(id => sql`${id}`), sql`, `)})`);

      const groupsById = new Map(groups.map(g => [g.id, g]));

      // Categorize itineraries
      const now = new Date();
      const pending: any[] = [];
      const upcoming: any[] = [];
      const past: any[] = [];

      itinerariesData.forEach(itinerary => {
        const invite = invitesByItinerary.get(itinerary.id);
        const rsvp = rsvpsByItinerary.get(itinerary.id);
        const group = itinerary.groupId ? groupsById.get(itinerary.groupId) : undefined;
        const items = itemsByItinerary.get(itinerary.id) || [];

        const eventData = {
          id: itinerary.id,
          name: itinerary.name,
          status: itinerary.status,
          eventDate: itinerary.eventDate,
          inviteToken: invite?.inviteToken,
          rsvpResponse: rsvp?.response || null,
          rsvpFeedback: rsvp?.rsvpFeedback || null,
          group: group ? {
            id: group.id,
            name: group.name,
            emoji: group.emoji,
          } : null,
          items: items.map(item => ({
            id: item.id,
            venueName: item.venueName,
            venueType: item.venueType,
            venueAddress: item.venueAddress,
            photoUrl: item.photoUrl,
            rating: item.rating,
            googlePlaceId: item.googlePlaceId,
            notes: item.notes,
            googleMapsUrl: item.googleMapsUrl,
            sourceType: item.sourceType,
            arrivalTime: item.arrivalTime,
            departureTime: item.departureTime,
            travelNotes: item.travelNotes,
          })),
        };

        // Categorize based on RSVP status and event date
        if (!rsvp) {
          // No RSVP yet - this is a pending invitation
          pending.push(eventData);
        } else if (itinerary.eventDate && new Date(itinerary.eventDate) < now) {
          // Event date in past
          past.push(eventData);
        } else if (rsvp.response === 'yes' || rsvp.response === 'maybe') {
          // RSVP'd yes/maybe and event is in future (or no date set)
          upcoming.push(eventData);
        } else {
          // RSVP'd no - could go in past or just not show
          past.push(eventData);
        }
      });

      // Sort by event date (most recent first for each category)
      const sortByDate = (a: any, b: any) => {
        if (!a.eventDate && !b.eventDate) return 0;
        if (!a.eventDate) return 1;
        if (!b.eventDate) return -1;
        return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
      };

      pending.sort(sortByDate);
      upcoming.sort(sortByDate);
      past.sort(sortByDate);

      res.json({
        pending,
        upcoming,
        past,
      });
    } catch (error: any) {
      console.error('[Get Member Events] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // RSVP Routes (for itinerary invites)

  // Create or update RSVP for an itinerary (no auth required, validates invite token)
  app.post("/api/rsvps", async (req, res) => {
    console.log('[RSVP] Request received:', JSON.stringify(req.body, null, 2));
    try {
      // Validate request body
      const validatedData = safeParse(createRsvpSchema, req.body, res);
      if (!validatedData) {
        console.log('[RSVP] Validation failed');
        return;
      }

      const { itineraryId, inviteToken, response, rsvpFeedback, claimedMemberId, guestName, additionalAttendees, numberOfKids } = validatedData;
      console.log('[RSVP] Validated data:', { itineraryId, inviteToken, claimedMemberId, guestName, response });

      // Verify invite token
      const invites = await db
        .select()
        .from(itineraryInvites)
        .where(sql`invite_token = ${inviteToken}`);

      if (invites.length === 0) {
        console.log('[RSVP] Invalid invite token:', inviteToken);
        return res.status(401).json({ message: "Invalid invite token" });
      }

      const invite = invites[0];
      console.log('[RSVP] Found invite:', { inviteId: invite.id, inviteMemberId: invite.memberId, inviteItineraryId: invite.itineraryId });

      // Verify the invite is for this specific itinerary (critical security check)
      if (invite.itineraryId !== itineraryId) {
        console.log('[RSVP] Itinerary mismatch:', { inviteItineraryId: invite.itineraryId, requestedItineraryId: itineraryId });
        return res.status(403).json({ message: "This invite is not valid for this itinerary" });
      }

      // Verify the claimedMemberId matches the invite's memberId (authorization check)
      // This prevents someone with one invite token from RSVPing as a different member
      if (claimedMemberId && invite.memberId && claimedMemberId !== invite.memberId) {
        console.log('[RSVP] Member mismatch:', { inviteMemberId: invite.memberId, claimedMemberId });
        return res.status(403).json({ message: "This invite is not valid for this member" });
      }

      // Fetch itinerary to verify it exists
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        console.log('[RSVP] Itinerary not found:', itineraryId);
        return res.status(404).json({ message: "Itinerary not found" });
      }
      console.log('[RSVP] Found itinerary:', { id: itinerary.id, name: itinerary.name, groupId: itinerary.groupId });

      // Determine which member to use
      let memberId = claimedMemberId || invite.memberId;

      // If guest RSVP, memberId should be null
      if (guestName && !claimedMemberId) {
        memberId = null;
      }
      console.log('[RSVP] Using memberId:', memberId);

      // For member RSVPs, verify member exists
      if (memberId) {
        const member = await storage.getMember(memberId);
        if (!member) {
          console.log('[RSVP] Member not found:', memberId);
          return res.status(404).json({ message: "Member not found" });
        }
        console.log('[RSVP] Found member:', { id: member.id, name: member.name });
      }

      // Check if RSVP already exists for this member/guest/itinerary combo
      const existingRsvps = await db
        .select()
        .from(rsvpsTable)
        .where(
          memberId 
            ? sql`itinerary_id = ${itineraryId} AND member_id = ${memberId}`
            : sql`itinerary_id = ${itineraryId} AND guest_name = ${guestName}`
        );

      let rsvp;
      const rsvpData: any = {
        response,
        rsvpFeedback: rsvpFeedback || null,
        guestName: guestName || null,
        additionalAttendees: additionalAttendees || null,
        numberOfKids: numberOfKids || 0,
        requiresApproval: guestName ? true : false,
        updatedAt: new Date(),
      };

      if (existingRsvps.length > 0) {
        // Update existing RSVP - generate token if not exists
        const updateData: any = { ...rsvpData };
        if (!existingRsvps[0].guestToken) {
          updateData.guestToken = guestName
            ? `guest_${crypto.randomUUID()}`
            : `member_${crypto.randomUUID()}`;
        }
        const updated = await db
          .update(rsvpsTable)
          .set(updateData)
          .where(sql`id = ${existingRsvps[0].id}`)
          .returning();
        rsvp = updated[0];
      } else {
        // Create new RSVP with token for later retrieval
        const rsvpToken = guestName
          ? `guest_${crypto.randomUUID()}`
          : `member_${crypto.randomUUID()}`;
        const inserted = await db
          .insert(rsvpsTable)
          .values({
            itineraryId,
            memberId: memberId || null,
            guestToken: rsvpToken,
            ...rsvpData,
          })
          .returning();
        rsvp = inserted[0];
      }

      // Trigger auto-reschedule check (non-blocking)
      checkAndReschedule(itineraryId).catch(err => {
        console.error(`[RSVP] Auto-reschedule check failed:`, err);
      });

      // 🤖 LEARNING LOOP #3: Auto-update member constraints from RSVP patterns
      // Only analyze patterns if this is a member RSVP (not guest) with feedback
      if (memberId && rsvpFeedback && itinerary.groupId) {
        autoUpdateMemberConstraints(memberId, itinerary.groupId).catch(err => {
          console.error(`[RSVP] Pattern analysis failed:`, err);
        });

        // 🎯 INSIGHT TRIGGER: Update group insights after RSVP with feedback
        // Debounced to avoid excessive regeneration (max once per 6 hours)
        triggerInsightUpdateDebounced(itinerary.groupId, 'rsvp-collected', 6).catch(err => {
          console.error(`[RSVP] Insight update failed:`, err);
        });
      }

      // 🎉 Calculate "Gang's all here" status - all non-guest members RSVPed yes
      let gangsAllHere = false;
      let isCompletingVote = false;

      if (response === "yes" && memberId && itinerary.groupId) {
        const allMembers = await storage.getGroupMembers(itinerary.groupId);
        const nonGuestMembers = allMembers.filter(m => !m.isGuest);

        // Get all RSVPs for this itinerary
        const allRsvps = await db
          .select()
          .from(rsvpsTable)
          .where(sql`itinerary_id = ${itineraryId}`);

        // Get member IDs who RSVPed yes
        const yesRsvpMemberIds = new Set(
          allRsvps
            .filter(r => r.response === "yes" && r.memberId)
            .map(r => r.memberId)
        );

        // Count how many non-guest members have RSVPed yes
        const nonGuestYesCount = nonGuestMembers.filter(m => yesRsvpMemberIds.has(m.id)).length;
        gangsAllHere = nonGuestYesCount === nonGuestMembers.length && nonGuestMembers.length > 0;

        // Check if THIS RSVP was the one that completed the group
        if (gangsAllHere) {
          const wasNewYes = existingRsvps.length === 0 || existingRsvps[0].response !== "yes";
          isCompletingVote = wasNewYes;
        }
      }

      res.json({ ...rsvp, gangsAllHere, isCompletingVote });
    } catch (error: any) {
      console.error('[RSVP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get RSVP for a specific member/itinerary (requires invite token validation)
  app.get("/api/rsvps/itinerary/:itineraryId/member/:memberId", async (req, res) => {
    try {
      const { itineraryId, memberId } = req.params;
      const inviteToken = req.query.inviteToken as string;

      if (!inviteToken) {
        return res.status(401).json({ message: "Invite token required" });
      }

      // Verify invite token
      const invites = await db
        .select()
        .from(itineraryInvites)
        .where(sql`invite_token = ${inviteToken}`);

      if (invites.length === 0) {
        return res.status(401).json({ message: "Invalid invite token" });
      }

      const invite = invites[0];

      // Verify the invite is for this specific itinerary and member
      if (invite.itineraryId !== itineraryId || invite.memberId !== memberId) {
        return res.status(403).json({ message: "This invite is not valid for this itinerary/member" });
      }

      // Fetch itinerary to verify it exists
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Get the member to check if they have a linked user account
      const member = await storage.getMember(memberId);

      // Fetch RSVP - check by member_id OR user_id (for organizers who RSVP'd before member record existed)
      let rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(
          sql`itinerary_id = ${itineraryId} AND member_id = ${memberId}`
        );

      // If no RSVP found by member_id but member has a userId, check by userId too
      if (rsvps.length === 0 && member?.userId) {
        rsvps = await db
          .select()
          .from(rsvpsTable)
          .where(
            sql`itinerary_id = ${itineraryId} AND user_id = ${member.userId}`
          );
      }

      if (rsvps.length === 0) {
        return res.status(404).json({ message: "RSVP not found" });
      }

      res.json(rsvps[0]);
    } catch (error: any) {
      console.error('[RSVP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all RSVPs for an itinerary (authenticated)
  app.get("/api/rsvps/itinerary/:itineraryId", isAuthenticated, async (req, res) => {
    try {
      const rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${req.params.itineraryId}`);

      res.json(rsvps);
    } catch (error: any) {
      console.error('[RSVP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Organizer RSVP - allows authenticated group owners to RSVP to their own events
  app.post("/api/itineraries/:itineraryId/organizer-rsvp", isAuthenticated, async (req: any, res) => {
    console.log('[Organizer RSVP] Request received:', { params: req.params, body: req.body });
    try {
      // Validate request body
      const validatedData = safeParse(organizerRsvpSchema, req.body, res);
      if (!validatedData) {
        console.log('[Organizer RSVP] Validation failed for body:', req.body);
        return;
      }

      const userId = await getUserId(req);
      const { itineraryId } = req.params;
      const { response, rsvpFeedback } = validatedData;
      console.log('[Organizer RSVP] Validated:', { userId, itineraryId, response });

      // Verify itinerary exists and user is the organizer
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // For standalone events, check if user is the creator
      if (itinerary.isStandalone) {
        if (itinerary.createdBy !== userId) {
          return res.status(403).json({ message: "Only the event creator can use this endpoint" });
        }
      } else {
        // For group events, check if user is the group owner
        if (!itinerary.groupId) {
          return res.status(404).json({ message: "Group not found for this itinerary" });
        }

        const group = await storage.getGroup(itinerary.groupId);
        if (!group) {
          return res.status(404).json({ message: "Group not found" });
        }

        if (group.userId !== userId) {
          return res.status(403).json({ message: "Only the group organizer can use this endpoint" });
        }
      }

      // Check if organizer RSVP already exists (using userId, no memberId)
      const existingRsvps = await db
        .select()
        .from(rsvpsTable)
        .where(
          sql`itinerary_id = ${itineraryId} AND user_id = ${userId} AND member_id IS NULL`
        );

      let rsvp;
      if (existingRsvps.length > 0) {
        console.log('[Organizer RSVP] Updating existing RSVP:', existingRsvps[0].id);
        // Update existing RSVP
        const updated = await db
          .update(rsvpsTable)
          .set({
            response,
            rsvpFeedback: rsvpFeedback || null,
            updatedAt: new Date(),
          })
          .where(sql`id = ${existingRsvps[0].id}`)
          .returning();
        rsvp = updated[0];
      } else {
        console.log('[Organizer RSVP] Creating new RSVP');
        // Create new organizer RSVP
        const inserted = await db
          .insert(rsvpsTable)
          .values({
            itineraryId,
            userId,
            memberId: null,
            response,
            rsvpFeedback: rsvpFeedback || null,
          })
          .returning();
        rsvp = inserted[0];
      }

      console.log('[Organizer RSVP] Success:', rsvp);
      res.json(rsvp);
    } catch (error: any) {
      console.error('[Organizer RSVP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve a pending guest RSVP (organizer only)
  app.post("/api/rsvps/:rsvpId/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { rsvpId } = req.params;

      // Get the RSVP
      const rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`id = ${rsvpId}`);

      if (rsvps.length === 0) {
        return res.status(404).json({ message: "RSVP not found" });
      }

      const rsvp = rsvps[0];

      // Get the itinerary
      const itinerary = await storage.getItinerary(rsvp.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Get the group and verify user is the owner
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only the group organizer can approve guest RSVPs" });
      }

      // Approve the RSVP
      const updated = await db
        .update(rsvpsTable)
        .set({
          approved: true,
          updatedAt: new Date(),
        })
        .where(sql`id = ${rsvpId}`)
        .returning();

      res.json(updated[0]);
    } catch (error: any) {
      console.error('[Approve RSVP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Deny a pending guest RSVP (organizer only) - deletes the RSVP
  app.post("/api/rsvps/:rsvpId/deny", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { rsvpId } = req.params;

      // Get the RSVP
      const rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`id = ${rsvpId}`);

      if (rsvps.length === 0) {
        return res.status(404).json({ message: "RSVP not found" });
      }

      const rsvp = rsvps[0];

      // Get the itinerary
      const itinerary = await storage.getItinerary(rsvp.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Get the group and verify user is the owner
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only the group organizer can deny guest RSVPs" });
      }

      // Delete the RSVP
      await db
        .delete(rsvpsTable)
        .where(sql`id = ${rsvpId}`);

      res.json({ message: "RSVP denied and removed" });
    } catch (error: any) {
      console.error('[Deny RSVP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update RSVP (for organizer to set member RSVP)
  app.patch("/api/rsvps/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { id } = req.params;

      // Validate request body
      const validatedData = safeParse(updateRsvpResponseSchema, req.body, res);
      if (!validatedData) return;
      const { response } = validatedData;

      // Get the RSVP
      const [existingRsvp] = await db
        .select()
        .from(rsvpsTable)
        .where(eq(rsvpsTable.id, id));

      if (!existingRsvp) {
        return res.status(404).json({ message: "RSVP not found" });
      }

      // Get the itinerary and verify the user is the organizer
      const itinerary = await storage.getItinerary(existingRsvp.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only the organizer can update RSVPs" });
      }

      // Update the RSVP
      const updated = await storage.updateRsvp(id, { response });
      res.json(updated);
    } catch (error: any) {
      console.error('[Update RSVP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete itinerary invite (for organizer to remove members)
  app.delete("/api/itinerary-invites/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { id } = req.params;

      // Get the invite
      const [invite] = await db
        .select()
        .from(itineraryInvites)
        .where(eq(itineraryInvites.id, id));

      if (!invite) {
        return res.status(404).json({ message: "Invite not found" });
      }

      // Check if user is group organizer (can delete any invite)
      let isOrganizer = false;
      if (invite.itineraryId) {
        const itinerary = await storage.getItinerary(invite.itineraryId);
        if (itinerary && itinerary.groupId) {
          const group = await storage.getGroup(itinerary.groupId);
          isOrganizer = !!(group && group.userId === userId);
        }
      }

      // Get the member to verify invite ownership (if memberId exists)
      let isInviteOwner = false;
      if (invite.memberId) {
        const [member] = await db
          .select()
          .from(membersTable)
          .where(eq(membersTable.id, invite.memberId));

        if (member) {
          isInviteOwner = member.userId === userId;
        }
      }

      if (!isInviteOwner && !isOrganizer) {
        return res.status(403).json({ message: "Not authorized to remove this invite" });
      }

      // Delete the invite
      await db
        .delete(itineraryInvites)
        .where(eq(itineraryInvites.id, id));

      res.json({ message: "Invite removed" });
    } catch (error: any) {
      console.error('[Delete Invite] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Voting Events Routes

  // Get all voting events (top 10 with vote counts)
  app.get("/api/voting-events", async (req, res) => {
    try {
      const events = await storage.getVotingEvents();
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get group-specific voting events (top 10 with vote counts)
  app.get("/api/groups/:groupId/voting-events", async (req, res) => {
    try {
      // Validate that the group exists and is active
      const group = await storage.getGroup(req.params.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const events = await storage.getGroupVotingEvents(req.params.groupId);

      // Get "liked by" member names for each event
      const groupMembers = await storage.getGroupMembers(req.params.groupId);
      const memberMap = new Map(groupMembers.map(m => [m.userId, m.name]));

      // Fetch upvotes for each event and map to member names (using Promise.allSettled for resilience)
      const eventsWithLikedByResults = await Promise.allSettled(events.map(async (event) => {
        const eventVotes = await storage.getEventVotes(event.id);
        const upvoters = eventVotes
          .filter(v => v.voteType === 'upvote')
          .map(v => memberMap.get(v.userId))
          .filter((name): name is string => !!name);

        return {
          ...event,
          likedBy: upvoters,
        };
      }));

      const eventsWithLikedBy = eventsWithLikedByResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      const failedVotes = eventsWithLikedByResults.filter(r => r.status === 'rejected');
      if (failedVotes.length > 0) {
        console.error(`[Voting Events] ${failedVotes.length}/${events.length} vote fetches failed`);
      }

      res.json(eventsWithLikedBy);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a voting event (authenticated) - enriches with Google Places data
  app.post("/api/voting-events", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const validatedEvent = insertVotingEventSchema.parse(req.body);
      const skipEnrichmentCheck = req.body.skipEnrichmentCheck === true;

      // Get the group to know the location for Google Places search
      const group = await storage.getGroup(validatedEvent.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Search Google Places to enrich the event with venue details
      let enrichedEvent = { ...validatedEvent };
      let enrichmentStatus: 'success' | 'no_results' | 'error' | 'skipped' = 'error';

      // Only check Google Places if not explicitly skipping
      if (!skipEnrichmentCheck) {
        try {
          const coordinates = group.latitude && group.longitude 
            ? { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) }
            : undefined;
          const places = await searchPlaces(
            validatedEvent.title, 
            group.locationBase,
            group.searchRadius || 2, // Use group's search radius
            coordinates,
            false, // skipCurated
            undefined, // venueType
            group.budgetMax // Pass budget for filtering
          );

          // Merge Google Places data if found
          if (places.length > 0) {
            // CRITICAL FIX: Rank places by name similarity and only use matches above threshold
            const { calculateNameSimilarity } = await import('./google-places');
            const SIMILARITY_THRESHOLD = 0.5;

            const rankedPlaces = places.map(p => ({
              place: p,
              similarity: calculateNameSimilarity(validatedEvent.title, p.name)
            })).sort((a, b) => b.similarity - a.similarity);

            const bestMatch = rankedPlaces[0];

            // Reject if no good name match found - don't use wrong venue data!
            if (bestMatch.similarity < SIMILARITY_THRESHOLD) {
              console.warn(`[Voting Event] NAME MISMATCH: User requested "${validatedEvent.title}" but best match is "${bestMatch.place.name}" (${(bestMatch.similarity * 100).toFixed(0)}% similarity) - rejecting to prevent data corruption`);
              enrichmentStatus = 'no_results';

              return res.json({
                enrichmentStatus,
                warning: `Could not find an exact match for "${validatedEvent.title}". The closest result was "${bestMatch.place.name}". Please verify the venue name or add it manually.`
              });
            }

            const place = bestMatch.place;
            console.log(`[Voting Event] ✅ Matched "${validatedEvent.title}" to "${place.name}" (${(bestMatch.similarity * 100).toFixed(0)}% similarity)`);

            // Check for suspicious types (tour operators, etc.)
            const suspiciousTypes = ['travel_agency', 'tour_operator'];
            const hasSuspiciousType = place.types?.some(type => suspiciousTypes.includes(type));

            if (hasSuspiciousType) {
              console.warn(`[Voting Event] SUSPICIOUS TYPE WARNING: "${place.name}" is a ${place.types?.find(t => suspiciousTypes.includes(t))}`);
              // Don't auto-enrich with tour operator data
              enrichmentStatus = 'no_results';

              return res.json({
                enrichmentStatus,
                warning: `The top Google result appears to be a ${place.types?.find(t => suspiciousTypes.includes(t))} instead of a venue. Please verify the venue name.`
              });
            }

            enrichedEvent = {
              ...validatedEvent,
              venueAddress: place.address || validatedEvent.venueAddress,
              googlePlaceId: place.placeId || validatedEvent.googlePlaceId,
              latitude: place.location?.lat?.toString() || validatedEvent.latitude,
              longitude: place.location?.lng?.toString() || validatedEvent.longitude,
              rating: place.rating || validatedEvent.rating,
              reviewCount: place.reviewCount || validatedEvent.reviewCount,
              priceLevel: place.priceLevel || validatedEvent.priceLevel,
              photoUrl: place.photoUrl || validatedEvent.photoUrl,
            };

            enrichmentStatus = 'success';

          } else {
            enrichmentStatus = 'no_results';

            // Don't create event yet - let frontend ask for confirmation
            return res.json({ enrichmentStatus });
          }
        } catch (error) {
          enrichmentStatus = 'error';
          console.error(`[Voting Event] Google Places enrichment failed for "${validatedEvent.title}":`, error);
          // Continue with un-enriched event - graceful degradation
        }
      } else {
        enrichmentStatus = 'skipped';

      }

      // Check for duplicates (unless explicitly allowing duplicates)
      const allowDuplicate = req.body.allowDuplicate === true;
      if (!allowDuplicate && enrichedEvent.googlePlaceId) {
        const existingEvents = await storage.getGroupVotingEvents(validatedEvent.groupId);
        const duplicate = existingEvents.find(e => e.googlePlaceId === enrichedEvent.googlePlaceId);

        if (duplicate) {

          return res.status(409).json({
            message: "This venue is already in your favorites",
            existingEvent: duplicate
          });
        }
      }

      const event = await storage.createVotingEvent(enrichedEvent, userId);
      res.json({ event, enrichmentStatus });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update a voting event (authenticated)
  app.patch("/api/voting-events/:id", isAuthenticated, requireVotingEventAccess(), async (req: any, res) => {
    try {
      const event = await storage.getVotingEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const userId = await getUserId(req);
      if (event.createdBy !== userId) {
        return res.status(403).json({ message: "Unauthorized to edit this event" });
      }

      const validatedUpdates = updateVotingEventSchema.parse(req.body);
      const updatedEvent = await storage.updateVotingEvent(req.params.id, validatedUpdates);
      res.json(updatedEvent);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete a voting event (authenticated)
  // Any member of the group can delete a voting event (venue from favorites)
  app.delete("/api/voting-events/:id", isAuthenticated, requireVotingEventAccess(), async (req: any, res) => {
    try {
      const event = await storage.getVotingEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const userId = await getUserId(req);

      // Allow deletion if:
      // 1. User is the creator, OR
      // 2. User is a member of the group (verified by requireVotingEventAccess middleware)
      // The middleware already verified the user has access to this event's group
      const member = await storage.getGroupMemberByUserId(event.groupId, userId);
      if (event.createdBy !== userId && !member) {
        return res.status(403).json({ message: "Unauthorized to delete this event" });
      }

      await storage.deleteVotingEvent(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cast a vote (authenticated)
  app.post("/api/voting-events/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(castVoteSchema, req.body, res);
      if (!validatedData) return;

      const userId = await getUserId(req);
      const { voteType } = validatedData;

      const vote = await storage.castVote(req.params.id, userId, voteType);
      
      const event = await storage.getVotingEvent(req.params.id);
      if (event?.groupId) {
        await trackFeedbackAndMaybeAnalyze(event.groupId);
      }
      
      res.json(vote);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Remove a vote (authenticated)
  app.delete("/api/voting-events/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      await storage.removeVote(req.params.id, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get votes for an event
  app.get("/api/voting-events/:id/votes", async (req, res) => {
    try {
      const votes = await storage.getEventVotes(req.params.id);
      res.json(votes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's vote for an event (authenticated)
  app.get("/api/voting-events/:id/my-vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const vote = await storage.getUserVote(req.params.id, userId);
      res.json(vote || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ARCHIVED: General AI activity generation (Nov 2025)
  // This endpoint is kept for backward compatibility but is no longer used in the UI.
  // The app now uses category-specific generation (/generate-category) instead.
  // Retry activity generation (protected)
  app.post("/api/groups/:id/retry-generation", isAuthenticated, async (req: any, res) => {
    // Return 410 Gone - this feature has been replaced with category-specific generation
    return res.status(410).json({ 
      message: "General AI generation is no longer supported. Please use category-specific generation instead.",
      hint: "Select a category (Bars, Coffee, Meals, Dessert, Events) and generate from there."
    });

    /*
    // OLD CODE - kept for reference
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Verify user owns this group
      const userId = await getUserId(req);
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this group" });
      }

      // Accept temporary instructions from the request body
      const { tempInstructions } = req.body;

      // Combine permanent and temporary instructions
      const combinedInstructions = [
        group.additionalInstructions,
        tempInstructions
      ].filter(Boolean).join('\n');

      // Reset status and trigger regeneration
      await storage.updateGroupStatus(req.params.id, "pending");

      generateAndStoreActivities(req.params.id, {
        locationBase: group.locationBase,
        budgetMin: group.budgetMin,
        budgetMax: group.budgetMax,
        meetingFrequency: group.meetingFrequency,
        availability: group.availability,
        closenessLevel: group.closenessLevel,
        noveltyPreference: group.noveltyPreference,
        pastPreferences: group.pastPreferences,
        additionalInstructions: combinedInstructions || group.additionalInstructions,
        activityCategories: group.activityCategories,
        searchRadius: group.searchRadius,
        latitude: group.latitude,
        longitude: group.longitude,
        rejectedVenues: group.rejectedVenues,
        mealEnabled: group.mealEnabled,
        cafeEnabled: group.cafeEnabled,
        drinksEnabled: group.drinksEnabled,
        dessertEnabled: group.dessertEnabled,
        experiencesEnabled: group.experiencesEnabled,
      }).catch((error) => {
        console.error(`[Activity Regeneration] Failed for group ${req.params.id}:`, error);
        Sentry.captureException(error, {
          tags: { groupId: req.params.id, operation: 'regenerateActivities' },
          level: 'error'
        });
      });

      res.json({ success: true, message: "Activity generation restarted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
    */
  });

  // Cancel AI generation (protected)
  app.post("/api/groups/:id/activities/cancel-generation", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Verify user owns this group
      const userId = await getUserId(req);
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this group" });
      }

      // Update status to failed with cancellation message (idempotent - safe to call multiple times)
      await storage.updateGroupStatus(req.params.id, "failed", "Generation cancelled by user");
      
      res.json({ success: true, message: "Activity generation cancelled" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Regenerate specific category
  app.post("/api/groups/:id/activities/regenerate-category", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Validate request body
      const validatedData = safeParse(regenerateCategorySchema, req.body, res);
      if (!validatedData) return;

      const { category, currentVenueNames, checkedActivityIds } = validatedData;

      // Calculate how many new activities we need
      const existingActivities = await storage.getGroupActivities(req.params.id);
      const checkedIds = new Set(checkedActivityIds || []);
      let checkedCount = 0;

      for (const a of existingActivities) {
        const activityCategory = await categorizeVenue(a.venueName, a.venueType);
        if (activityCategory === category && checkedIds.has(a.id)) {
          checkedCount++;
        }
      }

      const neededCount = 3 - checkedCount;

      if (neededCount <= 0) {

        return res.json([]);
      }

      // Get feedback data for AI context
      const previousFeedback = existingActivities
        .filter(a => a.feedback)
        .map(a => ({
          venueName: a.venueName,
          venueType: a.venueType,
          feedback: a.feedback!,
          description: a.description
        }));

      const votingEvents = await storage.getGroupVotingEvents(req.params.id);
      const votingFeedback = votingEvents
        .filter(e => e.netVotes !== 0 && e.venueType)
        .map(e => ({
          venueName: e.title,
          venueType: e.venueType!,
          upvotes: e.upvotes,
          downvotes: e.downvotes,
          netVotes: e.netVotes,
          description: e.description || ''
        }));

      const preferenceSignals = await storage.getGroupPreferenceSignals(req.params.id);
      const likedConcepts = preferenceSignals
        .filter(s => s.feedback === 'like')
        .map(s => s.conceptDescription);
      const passedConcepts = preferenceSignals
        .filter(s => s.feedback === 'pass')
        .map(s => s.conceptDescription);

      // Fetch seen venues from database to prevent repetitive suggestions
      const seenVenuesFromDB = await storage.getSeenVenues(req.params.id);
      const seenVenueNames = seenVenuesFromDB.map(v => v.venueName);

      // Retry logic to ensure we get enough quality venues
      let allValidActivities: any[] = [];
      const seenVenues = new Set<string>(); // Track across attempts

      // Add existing venues (both checked and current) to prevent duplicates
      for (const venue of existingActivities) {
        const venueKey = venue.googlePlaceId || venue.venueName.toLowerCase();
        seenVenues.add(venueKey);
      }
      for (const venue of currentVenueNames || []) {
        seenVenues.add(venue.toLowerCase());
      }

      let attempt = 0;
      const maxAttempts = 3;

      while (allValidActivities.length < neededCount && attempt < maxAttempts) {
        attempt++;

        // Refresh group data to get latest rejected venues
        const refreshedGroup = await storage.getGroup(req.params.id);
        if (!refreshedGroup) {
          return res.status(404).json({ message: "Group not found" });
        }
        const rejectedVenues = refreshedGroup.rejectedVenues || [];
        const rejectedSet = new Set(rejectedVenues.map(v => v.toLowerCase()));

        // Get member constraints for this category regeneration
        const groupMembers = await storage.getGroupMembers(refreshedGroup.id);
        const memberConstraints = groupMembers
          .filter(m => m.memberConstraints)
          .map(m => m.memberConstraints as { scheduleConflicts?: string[]; budgetConcern?: boolean; distanceConcern?: boolean; notes?: string });

        // Get group insights for AI context
        const groupInsights = refreshedGroup.preferenceInsights || undefined;

        // Generate suggestions for this specific category
        const suggestions = await generateActivitySuggestions({
          locationBase: refreshedGroup.locationBase,
          budgetMin: refreshedGroup.budgetMin,
          budgetMax: refreshedGroup.budgetMax,
          meetingFrequency: refreshedGroup.meetingFrequency,
          availability: refreshedGroup.availability,
          closenessLevel: refreshedGroup.closenessLevel,
          noveltyPreference: refreshedGroup.noveltyPreference,
          activityCategories: refreshedGroup.activityCategories || undefined,
          pastPreferences: refreshedGroup.pastPreferences || undefined,
          additionalInstructions: refreshedGroup.additionalInstructions || undefined,
          searchRadius: refreshedGroup.searchRadius || undefined,
          previousFeedback: previousFeedback.length > 0 ? previousFeedback : undefined,
          votingFeedback: votingFeedback.length > 0 ? votingFeedback : undefined,
          likedConcepts: likedConcepts.length > 0 ? likedConcepts : undefined,
          passedConcepts: passedConcepts.length > 0 ? passedConcepts : undefined,
          mealEnabled: refreshedGroup.mealEnabled ?? true,
          cafeEnabled: refreshedGroup.cafeEnabled ?? true,
          drinksEnabled: refreshedGroup.drinksEnabled ?? true,
          dessertEnabled: refreshedGroup.dessertEnabled ?? true,
          experiencesEnabled: refreshedGroup.experiencesEnabled ?? true,
          previouslySuggestedVenues: [...(currentVenueNames || []), ...seenVenueNames],
          targetCategories: [category],
          memberConstraints: memberConstraints.length > 0 ? memberConstraints : undefined,
          rejectedVenues: rejectedVenues,
          seenVenues: seenVenueNames.length > 0 ? seenVenueNames : undefined,
          groupInsights: groupInsights,
        });

        // Filter out rejected venues AND disabled categories before calling Google Places
        const filteredSuggestions = suggestions.filter(s => {
          const normalized = s.venueName.trim().toLowerCase();
          
          // Skip blacklisted venues
          if (rejectedSet.has(normalized)) {

            return false;
          }
          
          // CRITICAL: Skip disabled categories to save API quota
          const detectedCategory = detectCategory(s.venueName, s.venueType);
          const categoryEnabled = 
            (detectedCategory === 'meal' && (refreshedGroup.mealEnabled ?? true)) ||
            (detectedCategory === 'cafes' && (refreshedGroup.cafeEnabled ?? true)) ||
            (detectedCategory === 'drinks' && (refreshedGroup.drinksEnabled ?? true)) ||
            (detectedCategory === 'dessert' && (refreshedGroup.dessertEnabled ?? true)) ||
            (detectedCategory === 'experiences' && (refreshedGroup.experiencesEnabled ?? true));
          
          if (!categoryEnabled) {

            return false;
          }
          
          return true;
        });

        // Enrich with Google Places
        const coordinates = refreshedGroup.latitude && refreshedGroup.longitude 
          ? { lat: parseFloat(refreshedGroup.latitude), lng: parseFloat(refreshedGroup.longitude) }
          : undefined;
        const enrichedActivities = await Promise.all(
        filteredSuggestions.map(async (suggestion) => {
          const places = await searchPlaces(
            suggestion.searchQuery,
            refreshedGroup.locationBase,
            refreshedGroup.searchRadius || 2,
            coordinates,
            false, // skipCurated
            undefined, // venueType
            refreshedGroup.budgetMax // Pass budget for filtering
          );

          // If Google Places returns NO results at all, this is likely a fake/non-existent venue
          if (places.length === 0) {

            await storage.addRejectedVenue(req.params.id, suggestion.venueName);
            return null;
          }

          const searchRadius = refreshedGroup.searchRadius || 2;
          const { minRating, minReviews } = getQualityThresholds(searchRadius);

          const qualityFiltered = places.filter(place => {
            const rating = parseFloat(place.rating || '0');
            const reviewCount = place.reviewCount || 0;
            return rating >= minRating && reviewCount >= minReviews;
          });

          // Budget filtering now handled by searchPlaces itself
          const budgetFiltered = qualityFiltered;

          // Only use venues that meet quality AND budget standards
          const finalPlaces = budgetFiltered;

          if (finalPlaces.length > 0) {
            // Rank venues by name similarity to AI suggestion
            const rankedPlaces = finalPlaces.map(place => ({
              place,
              similarity: calculateNameSimilarity(suggestion.venueName, place.name)
            })).sort((a, b) => b.similarity - a.similarity);

            const bestMatch = rankedPlaces[0];
            const SIMILARITY_THRESHOLD = 0.6;

            // Only accept matches above threshold, otherwise fall back to API
            if (bestMatch.similarity < SIMILARITY_THRESHOLD) {

              return null; // This will trigger API fallback in searchPlaces
            }

            const place = bestMatch.place;

            // Search for complementary places
            let complementaryPlace = null;
            let complementaryPlace2 = null;
            if (suggestion.complementaryFoodPlace && place.location) {
              const foodPlaces = await searchNearbyPlaces(
                suggestion.complementaryFoodPlace,
                place.location,
                805,
                3.5
              );
              const validFoodPlaces = foodPlaces.filter(fp => fp.placeId !== place.placeId);
              if (validFoodPlaces.length > 0) {
                complementaryPlace = validFoodPlaces[0];
              }
              if (validFoodPlaces.length > 1) {
                complementaryPlace2 = validFoodPlaces[1];
              }
            }
            
            // CRITICAL: Only include venues with verified Google Places data
            // Note: photoUrl is optional - we can fetch it later on-demand
            if (!place.rating || !place.address) {

              return null;
            }
            
            return {
              aiSuggestedName: suggestion.venueName,
              venueName: place.name,
              venueAddress: place.address,
              city: place.city || null,
              venueType: suggestion.venueType,
              description: suggestion.description,
              googlePlaceId: place.placeId,
              latitude: place.location?.lat?.toString() || null,
              longitude: place.location?.lng?.toString() || null,
              rating: place.rating,
              reviewCount: place.reviewCount || null,
              priceLevel: place.priceLevel,
              photoUrl: place.photoUrl,
              googleReview: place.review || null,
              aiReasoning: suggestion.reasoning,
              timeCategory: categorizeByTime(suggestion.venueType),
              category: await categorizeVenue(place.name, suggestion.venueType, place.types),
              complementaryPlaceName: complementaryPlace?.name || null,
              complementaryPlaceAddress: complementaryPlace?.address || null,
              complementaryPlaceId: complementaryPlace?.placeId || null,
              complementaryPlacePhotoUrl: complementaryPlace?.photoUrl || null,
              complementaryPlaceRating: complementaryPlace?.rating || null,
              complementaryPlaceName2: complementaryPlace2?.name || null,
              complementaryPlaceAddress2: complementaryPlace2?.address || null,
              complementaryPlaceId2: complementaryPlace2?.placeId || null,
              complementaryPlacePhotoUrl2: complementaryPlace2?.photoUrl || null,
              complementaryPlaceRating2: complementaryPlace2?.rating || null,
            };
          }
          
          // If we reach here, finalPlaces is empty due to quality/budget filtering
          // This is NOT a fake venue - it's a real venue that doesn't meet our criteria

          return null;
        })
      );

        const validActivities = enrichedActivities.filter(a => a !== null);

        // CRITICAL: Filter out disabled categories AFTER AI categorization (in case AI categorized differently)
        const beforeFilter = validActivities.length;
        const categoryFilteredActivities = validActivities.filter((activity: any) => {
          const activityCategory = activity.category;
          const categoryEnabled = 
            (activityCategory === 'meal' && (refreshedGroup.mealEnabled ?? true)) ||
            (activityCategory === 'cafes' && (refreshedGroup.cafeEnabled ?? true)) ||
            (activityCategory === 'drinks' && (refreshedGroup.drinksEnabled ?? true)) ||
            (activityCategory === 'dessert' && (refreshedGroup.dessertEnabled ?? true)) ||
            (activityCategory === 'experiences' && (refreshedGroup.experiencesEnabled ?? true));
          
          if (!categoryEnabled) {
            console.log(`[Category Regen Post-Filter] ❌ REMOVING: ${activity.venueName} - categorized as "${activityCategory}" which is disabled`);
            return false;
          }
          return true;
        });
        
        if (categoryFilteredActivities.length < beforeFilter) {
          console.log(`[Category Regen Post-Filter] Filtered out ${beforeFilter - categoryFilteredActivities.length} venues in disabled categories`);
        }

        // Add unique activities to our collection (using the filtered list!)
        for (const activity of categoryFilteredActivities) {
          const venueKey = activity.googlePlaceId || activity.venueName.toLowerCase();
          if (!seenVenues.has(venueKey) && allValidActivities.length < neededCount) {
            seenVenues.add(venueKey);
            allValidActivities.push(activity);

          }
        }

      }

      // Check if we successfully collected enough venues
      if (allValidActivities.length < neededCount) {
        const errorMsg = `Could not find enough quality venues after ${maxAttempts} attempts. Found ${allValidActivities.length}/${neededCount} venues. Try adjusting search radius or preferences.`;
        console.error(`[Category Regen] ${errorMsg}`);
        return res.status(400).json({ message: errorMsg });
      }

      // Delete unchecked activities in this category
      const uncheckedActivities = [];

      for (const a of existingActivities) {
        const activityCategory = await categorizeVenue(a.venueName, a.venueType);
        if (activityCategory === category && !checkedIds.has(a.id)) {
          uncheckedActivities.push(a);
        }
      }

      // Delete unchecked activities
      for (const activity of uncheckedActivities) {
        await db.delete(activitiesTable).where(eq(activitiesTable.id, activity.id));
      }

      // Insert new activities to reach exactly 3 total for this category
      const newActivities = [];

      for (let i = 0; i < Math.min(neededCount, allValidActivities.length); i++) {
        const activityData = allValidActivities[i];
        const activityCategory = await categorizeVenue(activityData.venueName, activityData.venueType);
        const newActivity = await storage.createActivity({
          ...activityData,
          groupId: req.params.id,
          category: activityCategory,
        });
        newActivities.push(newActivity);
      }

      const finalCount = checkedCount + newActivities.length;

      res.json(newActivities);
    } catch (error: any) {
      console.error("[Category Regen] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate category-specific suggestions with custom location/radius
  app.post("/api/groups/:id/generate-category", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Verify user is a member of this group (or owns it)
      const userId = await getUserId(req);
      const isOwner = group.userId === userId;
      const member = await storage.getGroupMemberByUserId(req.params.id, userId);

      if (!isOwner && !member) {
        return res.status(403).json({ message: "Not authorized to access this group" });
      }

      // Check if members are allowed to create events
      if (!isOwner && member && !group.membersCanCreateEvents) {
        return res.status(403).json({ message: "Only the group organizer can discover venues for this group" });
      }

      // Fetch member group preferences for fallback chain
      const memberPreferences = await storage.getMemberGroupPreferences(userId, req.params.id);
      
      // Fetch global user profile for fallback chain
      const userProfile = await storage.getUserProfile(userId);

      // Implement preference fallback chain for all preferences:
      // 1. Member group preferences (budgetOverrideMax, categoryPreferencesOverride, availabilityOverride)
      // 2. Global user profile (budgetMax, activityPreferences, personalAvailability)
      // 3. Group defaults (budgetMax, enabled categories, availability)
      const effectiveBudget = memberPreferences?.budgetOverrideMax ?? userProfile?.budgetMax ?? group.budgetMax;
      const effectiveCategories = memberPreferences?.categoryPreferencesOverride ?? userProfile?.activityPreferences ?? null;
      const effectiveAvailability = memberPreferences?.availabilityOverride ?? userProfile?.personalAvailability ?? group.availability;

      console.log(`  Budget: ${effectiveBudget} (member: ${memberPreferences?.budgetOverrideMax}, profile: ${userProfile?.budgetMax}, group: ${group.budgetMax})`);
      console.log(`  Categories: ${effectiveCategories ? JSON.stringify(effectiveCategories) : 'null'} (member: ${memberPreferences?.categoryPreferencesOverride ? 'set' : 'null'}, profile: ${userProfile?.activityPreferences ? 'set' : 'null'})`);
      console.log(`  Availability: ${effectiveAvailability ? 'set' : 'null'} (member: ${memberPreferences?.availabilityOverride ? 'set' : 'null'}, profile: ${userProfile?.personalAvailability ? 'set' : 'null'}, group: ${group.availability ? 'set' : 'null'})`);

      // Validate request body
      const validatedData = safeParse(generateCategorySchema, req.body, res);
      if (!validatedData) return;

      const { categories, category, location, radius, count = 9, sortBy = 'rating', budgetOverride, tempInstructions } = validatedData;

      // Use budgetOverride if provided, otherwise fall back to effectiveBudget
      const finalBudget = budgetOverride !== undefined ? budgetOverride : effectiveBudget;

      if (budgetOverride !== undefined) {

      } else {

      }

      // Support both single category (backward compatibility) and multiple categories
      let categoriesToProcess = categories || (category ? [category] : []);
      
      // Apply category preference override: if user has category preferences, 
      // filter requested categories to only include those in their preferences
      if (effectiveCategories && Array.isArray(effectiveCategories) && effectiveCategories.length > 0) {
        if (categoriesToProcess.length > 0) {
          // Filter requested categories to only include user's preferred categories
          const originalCount = categoriesToProcess.length;
          categoriesToProcess = categoriesToProcess.filter((cat: string) => effectiveCategories.includes(cat));
          if (categoriesToProcess.length < originalCount) {

          }
        } else {
          // No explicit categories requested, use user's preferred categories
          categoriesToProcess = effectiveCategories;

        }
      }
      
      if (!categoriesToProcess.length) {
        return res.status(400).json({ message: "No categories provided or all requested categories filtered out by preferences" });
      }

      // Validate all categories
      const validCategories = ['meal', 'cafes', 'drinks', 'dessert', 'experiences'];
      for (const cat of categoriesToProcess) {
        if (!validCategories.includes(cat)) {
          return res.status(400).json({ message: `Invalid category: ${cat}` });
        }
      }

      if (sortBy && !['distance', 'rating'].includes(sortBy)) {
        return res.status(400).json({ message: "Invalid sortBy parameter. Must be 'distance' or 'rating'" });
      }

      if (tempInstructions) {

      }

      // Use custom location if provided, otherwise use group location
      const searchLocation = location?.address || group.locationBase;
      const searchRadius = radius || group.searchRadius || 2;
      
      // Determine coordinates for distance filtering
      let coordinates: { lat: number; lng: number } | undefined;
      
      if (location?.lat && location?.lng) {
        // Explicit coordinates provided
        coordinates = { lat: location.lat, lng: location.lng };
      } else if (location?.address) {
        // Custom location text provided - geocode it for strict distance filtering

        const geocoded = await geocodeLocation(location.address);
        if (geocoded) {
          coordinates = { lat: geocoded.latitude, lng: geocoded.longitude };

        } else {

        }
      } else if (group.latitude && group.longitude) {
        // Use group's stored coordinates
        coordinates = { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) };
      }

      // Get existing activities to avoid duplicates
      const existingActivities = await storage.getGroupActivities(req.params.id);
      const existingVenueNames = existingActivities.map(a => a.venueName);

      // ========== LEARNING SYSTEM: Query Historical Data ==========

      // 1. Get venue visit history for rotation and proven winners
      const visitStats = await db.select({
        venueName: venueVisitHistory.venueName,
        count: sql<number>`count(*)`.as('count'),
        lastVisit: sql<Date>`max(visited_at)`.as('last_visit'),
      })
      .from(venueVisitHistory)
      .where(eq(venueVisitHistory.groupId, req.params.id))
      .groupBy(venueVisitHistory.venueName);

      const visitMap = new Map(visitStats.map(v => [v.venueName, {
        count: Number(v.count),
        lastVisit: v.lastVisit,
        daysSinceVisit: v.lastVisit ? Math.floor((Date.now() - new Date(v.lastVisit).getTime()) / (1000 * 60 * 60 * 24)) : 999
      }]));

      // 2. Get member favorites for boosting
      const groupMembers = await storage.getGroupMembers(req.params.id);
      const allMemberFavorites = await Promise.all(
        groupMembers.map(m => storage.getMemberFavoriteVenues(m.id))
      );
      const favoritesMap = new Map<string, number>(); // placeId -> member count
      for (const memberFavs of allMemberFavorites) {
        for (const fav of memberFavs) {
          if (fav.venuePlaceId) {
            favoritesMap.set(fav.venuePlaceId, (favoritesMap.get(fav.venuePlaceId) || 0) + 1);
          }
        }
      }

      // 3. Build swipe consensus map from existing activities (already have swipeConsensus field)
      const swipeConsensusMap = new Map<string, number>();
      for (const activity of existingActivities) {
        if (activity.googlePlaceId && activity.swipeConsensus !== null) {
          swipeConsensusMap.set(activity.googlePlaceId, activity.swipeConsensus);
        }
      }

      // Map category to Google Places search query
      const categorySearchQueries: Record<string, string> = {
        'meal': 'restaurants',
        'cafes': 'coffee shops cafes',
        'drinks': 'bars',
        'dessert': 'dessert ice cream boba',
        'experiences': 'museums parks attractions activities'
      };

      // Process each category
      const resultsByCategory: Record<string, any[]> = {};
      const allResults: any[] = [];

      for (const currentCategory of categoriesToProcess) {

        let searchQuery = categorySearchQueries[currentCategory] || currentCategory;
        
        // If custom instructions provided, append them to refine the search
        if (tempInstructions && tempInstructions.trim()) {
          searchQuery = `${tempInstructions.trim()} ${searchQuery}`;

        } else {

        }

        // Search Google Places directly (no AI needed!)
        // Apply budget filter (uses budgetOverride if provided, otherwise effectiveBudget)
        const places = await searchPlaces(
          `${searchQuery} in ${searchLocation}`,
          searchLocation,
          searchRadius,
          coordinates,
          false, // skipCurated
          undefined, // venueType
          finalBudget || undefined // Apply final budget (override or effective)
        );

        if (places.length === 0) {
          resultsByCategory[currentCategory] = [];
          continue;
        }

        // Process and filter Google Places results with concurrency limiting
        // Limit to 5 concurrent AI validation calls to prevent rate limiting
        const limit = pLimit(5);

        const enrichedActivities = await Promise.all(
          places.map(place => limit(async () => {
            // Skip if already in existing activities
            if (existingVenueNames.includes(place.name)) {

              return null;
            }

            // Relaxed quality filtering for category-specific searches
            const rating = parseFloat(place.rating || '0');
            const reviewCount = place.reviewCount || 0;
            
            // Ensure minimum quality (3.5★ + 10 reviews) regardless of radius
            if (rating < 3.5 || reviewCount < 10) {

              return null;
            }

            // Only include venues with complete data
            if (!place.rating || !place.address || !place.photoUrl) {

              return null;
            }

            // LAYER 1: Google Place Type Filtering
            // Exclude obviously wrong business types (universal exclusions)
            const invalidTypes = ['liquor_store', 'convenience_store', 'gas_station', 'supermarket', 'grocery_store', 'pharmacy', 'drugstore'];
            const placeTypes = place.types || [];
            const hasInvalidType = placeTypes.some((type: string) => invalidTypes.includes(type));

            if (hasInvalidType) {
              const invalidType = placeTypes.find((type: string) => invalidTypes.includes(type));

              return null;
            }

            // Category-specific type validation
            if (currentCategory === 'meal') {
              // Exclude dessert-specific venues from meal searches
              const dessertTypes = ['ice_cream_shop', 'dessert_shop', 'dessert', 'bakery'];
              const isDessertVenue = placeTypes.some((type: string) => dessertTypes.includes(type));

              if (isDessertVenue) {

                return null;
              }

              // For meal category, prefer restaurant types
              const mealTypes = ['restaurant', 'meal_takeaway', 'meal_delivery', 'cafe', 'food'];
              const hasMealType = placeTypes.some((type: string) => mealTypes.some(mt => type.includes(mt)));

              if (!hasMealType) {

                return null;
              }
            } else if (currentCategory === 'dessert') {
              // For dessert category, require dessert-specific types
              const dessertTypes = ['ice_cream_shop', 'dessert_shop', 'dessert', 'bakery', 'cafe'];
              const isDessertVenue = placeTypes.some((type: string) => dessertTypes.includes(type));

              if (!isDessertVenue) {

                return null;
              }
            } else if (currentCategory === 'drinks') {
              // For drinks category, require bar/nightlife types
              const drinkTypes = ['bar', 'night_club', 'nightclub', 'pub', 'wine_bar', 'cocktail_bar'];
              const isDrinkVenue = placeTypes.some((type: string) => drinkTypes.some(dt => type.includes(dt)));

              if (!isDrinkVenue) {

                return null;
              }
            } else if (currentCategory === 'cafes') {
              // For cafes category, require cafe/coffee types
              const cafeTypes = ['cafe', 'coffee_shop', 'coffee', 'tea'];
              const isCafeVenue = placeTypes.some((type: string) => cafeTypes.some(ct => type.includes(ct)));

              if (!isCafeVenue) {

                return null;
              }
            }

            // Calculate distance from search center
            let distanceFromBase: number | undefined;
            if (coordinates && place.location?.lat && place.location?.lng) {
              const R = 3959; // Earth's radius in miles
              const lat1 = coordinates.lat * Math.PI / 180;
              const lat2 = place.location.lat * Math.PI / 180;
              const dLat = (place.location.lat - coordinates.lat) * Math.PI / 180;
              const dLng = (place.location.lng - coordinates.lng) * Math.PI / 180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                       Math.cos(lat1) * Math.cos(lat2) *
                       Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              distanceFromBase = R * c;
            }

            // LAYER 3: Enhanced Location Validation (Moderate Strictness)
            // Enforce distance < radius * 1.2 (20% buffer for edge-of-radius venues)
            if (distanceFromBase !== undefined) {
              const maxDistance = searchRadius * 1.2; // 20% buffer
              if (distanceFromBase > maxDistance) {

                return null;
              } else if (distanceFromBase > searchRadius) {

              }
            }

            // City validation - check if venue city matches search location
            if (place.city && searchLocation) {
              const searchLower = searchLocation.toLowerCase();
              const placeCityLower = place.city.toLowerCase();

              // SF city name variants for flexible matching
              const sfVariants = ['sf', 'san francisco', 'san fran', 'san fransisco', 'frisco'];
              const oaklandVariants = ['oakland', 'oak'];
              const berkeleyVariants = ['berkeley', 'berk'];

              // Check if search is for SF
              const isSearchSF = sfVariants.some(v => searchLower.includes(v));
              const isPlaceSF = sfVariants.some(v => placeCityLower.includes(v));

              // Check if search is for Oakland
              const isSearchOakland = oaklandVariants.some(v => searchLower.includes(v));
              const isPlaceOakland = oaklandVariants.some(v => placeCityLower.includes(v));

              // Check if search is for Berkeley
              const isSearchBerkeley = berkeleyVariants.some(v => searchLower.includes(v));
              const isPlaceBerkeley = berkeleyVariants.some(v => placeCityLower.includes(v));

              // Flag city mismatches (but allow if within distance buffer)
              if ((isSearchSF && !isPlaceSF) ||
                  (isSearchOakland && !isPlaceOakland) ||
                  (isSearchBerkeley && !isPlaceBerkeley)) {

                // If venue is outside city AND outside distance buffer, reject
                if (distanceFromBase && distanceFromBase > searchRadius) {

                  return null;
                } else {
                  // Within distance buffer, log warning but allow

                }
              }
            }

            // LAYER 2: Smart AI Quality Validation (Edge Case Detection)
            // Only run AI validation after Google type filtering passes
            // This catches edge cases like "sports bar with extensive menu" classified incorrectly
            const aiValidation = await validateVenueForCategory(
              place.name,
              place.address,
              placeTypes,
              currentCategory as 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences'
            );

            if (!aiValidation.isValid) {

              return null;
            }

            // ========== PERSONALIZED SCORING: Apply Learning Signals ==========
            const googleRating = parseFloat(place.rating || '0');
            let personalizedScore = googleRating;
            let badges: string[] = [];
            let learningBoosts: string[] = [];

            // 1. Visit History (rotation + proven winners)
            const visitInfo = visitMap.get(place.placeId);
            if (visitInfo) {
              if (visitInfo.daysSinceVisit < 60) {
                // Recently visited - filter out

                return null;
              } else if (visitInfo.daysSinceVisit >= 180 && googleRating >= 4.5) {
                // Proven winner: visited 6+ months ago with great rating
                personalizedScore += 0.5;
                badges.push('🏆 Proven winner');
                learningBoosts.push(`proven winner (+0.5)`);

              } else {
                // Been a while
                personalizedScore += 0.2;
                badges.push('📅 Been a while');
                learningBoosts.push(`rotation (+0.2)`);
              }
            } else {
              // Never visited
              personalizedScore += 0.3;
              badges.push('✨ New to group');
              learningBoosts.push(`new spot (+0.3)`);
            }

            // 2. Member Favorites
            const favCount = favoritesMap.get(place.placeId);
            if (favCount && favCount > 0) {
              const boost = Math.min(favCount * 0.3, 1.0); // +0.3 per member, max +1.0
              personalizedScore += boost;
              badges.push(`❤️ ${favCount} member${favCount > 1 ? 's' : ''} favorited`);
              learningBoosts.push(`${favCount} favorites (+${boost.toFixed(1)})`);

            }

            // 3. Swipe Consensus (if venue was swiped before)
            const swipeConsensus = swipeConsensusMap.get(place.placeId);
            if (swipeConsensus !== undefined) {
              if (swipeConsensus >= 70) {
                // High consensus - strong boost
                personalizedScore += 0.8;
                badges.push('🌟 High group approval');
                learningBoosts.push(`${swipeConsensus}% approval (+0.8)`);

              } else if (swipeConsensus >= 50) {
                // Moderate consensus
                personalizedScore += 0.4;
                learningBoosts.push(`${swipeConsensus}% approval (+0.4)`);
              } else if (swipeConsensus < 30) {
                // Low consensus - penalize or skip

                return null;
              }
            }

            return {
              venueName: place.name,
              venueAddress: place.address,
              city: place.city || null,
              venueType: getBestVenueTypeSync(place.types || []),
              description: place.review || '',
              googlePlaceId: place.placeId,
              latitude: place.location?.lat?.toString() || null,
              longitude: place.location?.lng?.toString() || null,
              rating: place.rating,
              reviewCount: place.reviewCount || null,
              priceLevel: place.priceLevel,
              photoUrl: place.photoUrl,
              googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.placeId}`,
              googleReview: place.review || null,
              category: currentCategory, // Use the requested category directly
              distanceFromGroupBase: distanceFromBase,
              personalizedScore, // Add personalized score for sorting
              badges, // Add badges for transparency
            };
          }))
        );

        // Filter out nulls (filtered items) and calculate filtering stats
        let validActivities = enrichedActivities.filter(a => a !== null);

        // Log filtering statistics
        const totalFromGoogle = places.length;
        const passedFiltering = validActivities.length;
        const filteredCount = totalFromGoogle - passedFiltering;
        const passRate = totalFromGoogle > 0 ? ((passedFiltering / totalFromGoogle) * 100).toFixed(1) : 0;

        console.log(`  ├─ Total from Google: ${totalFromGoogle}`);
        console.log(`  ├─ Passed all filters: ${passedFiltering}`);
        console.log(`  ├─ Filtered out: ${filteredCount}`);
        console.log(`  └─ Pass rate: ${passRate}%\n`);

        // Sort based on mode: personalized score (default) or distance
        if (sortBy === 'distance') {
          validActivities.sort((a, b) => {
            const distA = a.distanceFromGroupBase || 999;
            const distB = b.distanceFromGroupBase || 999;
            return distA - distB;
          });

        } else {
          // Sort by personalized score (combines Google rating + learning signals)
          validActivities.sort((a, b) => {
            const scoreA = a.personalizedScore || parseFloat(a.rating || '0');
            const scoreB = b.personalizedScore || parseFloat(b.rating || '0');
            return scoreB - scoreA; // Highest score first
          });

        }

        // Return ALL results for pagination (don't limit to count)
        // Users can now scroll through dozens of venues without extra API calls

        resultsByCategory[currentCategory] = validActivities;
        allResults.push(...validActivities);

        // NOTE: No longer auto-saving to history - user must select which venues to keep
        // They will be saved via POST /api/groups/:id/add-venues-to-library
      }

      // Return grouped results if multiple categories, flat array if single category
      if (categoriesToProcess.length === 1) {
        res.json(allResults);
      } else {
        res.json(resultsByCategory);
      }
    } catch (error: any) {
      console.error("[Category Generate] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Quick Event Creation - One-click event creation with AI-selected venues
  app.post("/api/groups/:id/quick-event", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const { eventType } = req.body;
      const validTypes = ['surprise', 'dinner', 'drinks', 'coffee', 'activity'];

      if (!eventType || !validTypes.includes(eventType)) {
        return res.status(400).json({
          message: `Invalid event type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      console.log(`[Quick Event] Creating ${eventType} event for group "${group.name}"`);

      // Map event type to category for venue selection
      const typeToCategory: Record<string, string> = {
        'surprise': 'all', // AI picks from all categories
        'dinner': 'meal',
        'drinks': 'drinks',
        'coffee': 'cafes',
        'activity': 'experiences',
      };
      const targetCategory = typeToCategory[eventType];

      // Get available venues (activities + voting events)
      const activities = await storage.getGroupActivities(req.params.id);
      const votingEvents = await storage.getGroupVotingEvents(req.params.id);

      // Filter by category (unless "all" for surprise)
      const matchingActivities = targetCategory === 'all'
        ? activities
        : activities.filter(a => {
            const type = (a.venueType || '').toLowerCase();
            if (targetCategory === 'meal') return type.includes('restaurant') || type.includes('food') || type.includes('meal');
            if (targetCategory === 'drinks') return type.includes('bar') || type.includes('drinks') || type.includes('wine') || type.includes('cocktail');
            if (targetCategory === 'cafes') return type.includes('cafe') || type.includes('coffee') || type.includes('tea');
            if (targetCategory === 'experiences') return type.includes('activity') || type.includes('experience') || type.includes('museum') || type.includes('park');
            return true;
          });

      const matchingVotingEvents = targetCategory === 'all'
        ? votingEvents.filter(v => v.netVotes > 0) // Favorites with positive votes
        : votingEvents.filter(v => {
            const type = (v.venueType || '').toLowerCase();
            if (targetCategory === 'meal') return type.includes('restaurant') || type.includes('food');
            if (targetCategory === 'drinks') return type.includes('bar') || type.includes('drinks');
            if (targetCategory === 'cafes') return type.includes('cafe') || type.includes('coffee');
            if (targetCategory === 'experiences') return type.includes('activity') || type.includes('experience');
            return false;
          });

      // Build available venues list with scoring
      const availableVenues: any[] = [];

      // Add activities (scored by rating and freshness)
      for (const activity of matchingActivities) {
        availableVenues.push({
          sourceType: 'activity' as const,
          sourceId: activity.id,
          name: activity.venueName,
          venueType: activity.venueType,
          rating: activity.rating,
          photoUrl: activity.photoUrl,
          score: parseFloat(activity.rating || '0') + (activity.photoUrl ? 0.5 : 0),
        });
      }

      // Add voting events (favorites get bonus)
      for (const event of matchingVotingEvents) {
        availableVenues.push({
          sourceType: 'voting_event' as const,
          sourceId: event.id,
          name: event.title,
          venueType: event.venueType,
          rating: event.rating,
          photoUrl: event.photoUrl,
          score: parseFloat(event.rating || '0') + (event.netVotes > 0 ? 1 : 0) + (event.photoUrl ? 0.5 : 0),
          isFavorite: true,
        });
      }

      // Sort by score and take top venue(s)
      availableVenues.sort((a, b) => b.score - a.score);

      if (availableVenues.length === 0) {
        return res.status(400).json({
          message: `No ${eventType === 'surprise' ? '' : eventType + ' '}venues found. Add some favorites or discover new places first!`
        });
      }

      // Select 1-2 venues based on event type
      const numVenues = eventType === 'surprise' ? Math.min(2, availableVenues.length) : 1;
      const selectedVenues = availableVenues.slice(0, numVenues);

      console.log(`[Quick Event] Selected ${selectedVenues.length} venues: ${selectedVenues.map(v => v.name).join(', ')}`);

      // Create the itinerary
      const items = selectedVenues.map(v => ({
        sourceType: v.sourceType,
        sourceId: v.sourceId,
      }));

      // Calculate a suggested date (next Saturday evening)
      const now = new Date();
      const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7; // Next Saturday
      const suggestedDate = new Date(now);
      suggestedDate.setDate(suggestedDate.getDate() + daysUntilSaturday);
      suggestedDate.setHours(18, 0, 0, 0); // 6 PM

      // Generate event name
      const eventNames: Record<string, string> = {
        'surprise': `${group.name} Hangout`,
        'dinner': `${group.name} Dinner`,
        'drinks': `${group.name} Drinks`,
        'coffee': `${group.name} Coffee`,
        'activity': `${group.name} Activity`,
      };

      const itinerary = await storage.createItinerary(
        {
          groupId: req.params.id,
          name: eventNames[eventType],
          status: 'draft',
          eventDate: suggestedDate,
          proposedOrder: items.map(i => i.sourceId),
        },
        group.userId!,
        items
      );

      console.log(`[Quick Event] Created itinerary ${itinerary.id} with ${items.length} venues`);

      // Fetch the full itinerary with items for response
      const fullItinerary = await storage.getItinerary(itinerary.id);

      res.json({
        message: `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} event created! Review and send invites when ready.`,
        itinerary: fullItinerary,
        suggestedDate: suggestedDate.toISOString(),
        venueCount: selectedVenues.length,
      });
    } catch (error: any) {
      console.error("[Quick Event] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get recent category searches for a group
  app.get("/api/groups/:id/category-search-history", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Verify user owns this group
      const userId = await getUserId(req);
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to access this group" });
      }

      const limit = parseInt(req.query.limit as string) || 5;
      const searches = await storage.getRecentCategorySearches(req.params.id, limit);
      
      res.json(searches);
    } catch (error: any) {
      console.error("[Category Search History] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add selected venues to the library (save to activities)
  app.post("/api/groups/:id/add-venues-to-library", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Verify user owns this group
      const userId = await getUserId(req);
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this group" });
      }

      const { category, searchLocation, searchRadius, selectedVenues } = req.body;

      if (!category || !selectedVenues || !Array.isArray(selectedVenues)) {
        return res.status(400).json({ message: "Missing required fields: category, selectedVenues" });
      }

      console.log(`[Add Venues] Saving ${selectedVenues.length} ${category} venues to activities for group ${req.params.id}`);

      // Get existing activities to avoid duplicates
      const existingActivities = await storage.getAllGroupActivities(req.params.id);
      const existingPlaceIds = new Set(existingActivities.map(a => a.googlePlaceId).filter(Boolean));

      // Save each selected venue as an activity
      const createdActivities = [];
      for (const venue of selectedVenues) {
        // Skip if already exists
        if (venue.googlePlaceId && existingPlaceIds.has(venue.googlePlaceId)) {
          console.log(`[Add Venues] Skipping duplicate venue: ${venue.venueName}`);
          continue;
        }

        const newActivity = await storage.createActivity({
          groupId: req.params.id,
          venueName: venue.venueName,
          venueAddress: venue.venueAddress,
          venueType: venue.venueType || 'venue',
          category,
          description: '',
          googlePlaceId: venue.googlePlaceId || null,
          rating: venue.rating ? String(venue.rating) : null,
          reviewCount: venue.reviewCount ? Number(venue.reviewCount) : null,
          priceLevel: venue.priceLevel ? String(venue.priceLevel) : null,
          photoUrl: venue.photoUrl || null,
        });
        createdActivities.push(newActivity);
      }

      console.log(`[Add Venues] Created ${createdActivities.length} new activities (${selectedVenues.length - createdActivities.length} were duplicates)`);

      res.json({
        success: true,
        count: createdActivities.length,
        message: `Added ${createdActivities.length} venues to your library${selectedVenues.length > createdActivities.length ? ` (${selectedVenues.length - createdActivities.length} duplicates skipped)` : ''}`
      });
    } catch (error: any) {
      console.error("[Add Venues] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

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

  // Schedule event from natural language prompt
  app.post("/api/groups/:id/schedule-from-prompt", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Verify user owns this group
      const userId = await getUserId(req);
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this group" });
      }

      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ message: "Prompt is required" });
      }

      // Parse the natural language prompt with group history for smarter understanding
      // Uses GPT-4o (not mini) for intelligent history application
      // Cost: ~5-7x more than mini, but provides significantly better context understanding
      // Trade-off: Worth it for personalized, history-aware event creation
      const groupHistory = {
        preferenceInsights: group.preferenceInsights as string | null | undefined,
        schedulingPreferences: group.schedulingPreferences,
        closenessLevel: group.closenessLevel
      };
      const schedulingParams = await parseSchedulingPromptWithHistory(prompt, group.locationBase, groupHistory);

      if (schedulingParams.historyApplied && schedulingParams.historyApplied.length > 0) {

      }

      // Use category search to find venues based on parsed params
      const searchLocation = schedulingParams.location || group.locationBase;
      const searchRadius = group.searchRadius || 2;
      
      // Determine coordinates for distance filtering
      let coordinates: { lat: number; lng: number } | undefined;
      if (group.latitude && group.longitude) {
        coordinates = { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) };
      }

      // Map category to Google Places search query
      const categorySearchQueries: Record<string, string> = {
        'meal': 'restaurants',
        'cafes': 'coffee shops cafes',
        'drinks': 'bars',
        'dessert': 'dessert ice cream boba',
        'experiences': 'museums parks attractions activities'
      };

      // Build context-aware search query
      let searchQuery = `${schedulingParams.activityType} ${categorySearchQueries[schedulingParams.category] || ''}`;

      // Add context keywords for smarter search (e.g., "romantic", "family-friendly")
      if (schedulingParams.contextKeywords && schedulingParams.contextKeywords.length > 0) {
        searchQuery += ' ' + schedulingParams.contextKeywords.join(' ');

      }

      // Add venue attributes (e.g., "outdoor seating", "live music")
      if (schedulingParams.venueAttributes && schedulingParams.venueAttributes.length > 0) {
        searchQuery += ' ' + schedulingParams.venueAttributes.join(' ');

      }

      // Search Google Places with budget filtering
      const places = await searchPlaces(
        `${searchQuery} in ${searchLocation}`,
        searchLocation,
        searchRadius,
        coordinates,
        false, // skipCurated
        undefined, // venueType
        group.budgetMax // Pass budget for filtering
      );

      if (places.length === 0) {
        return res.status(404).json({ message: "No venues found matching your criteria" });
      }

      // Get existing activities to avoid duplicates
      const existingActivities = await storage.getGroupActivities(req.params.id);
      const existingVenueNames = existingActivities.map(a => a.venueName);

      // Neighborhood filtering: if a specific SF neighborhood is mentioned, filter to only that area
      const sfNeighborhoods = ['mission', 'castro', 'haight', 'soma', 'nob hill', 'russian hill',
        'marina', 'pacific heights', 'richmond', 'sunset', 'north beach', 'chinatown', 'financial district',
        'potrero hill', 'dogpatch', 'hayes valley', 'lower haight', 'fillmore', 'presidio', 'embarcadero'];

      let neighborhoodFilter: string | null = null;
      if (schedulingParams.location) {
        const locationLower = schedulingParams.location.toLowerCase();
        // Check if location matches a SF neighborhood
        const matchedNeighborhood = sfNeighborhoods.find(n => locationLower.includes(n));
        if (matchedNeighborhood) {
          neighborhoodFilter = matchedNeighborhood;

        }
      }

      // Apply smart time and day inference based on activity type (MOVED UP for agent)
      const inferredTiming = inferTimeFromActivity(schedulingParams);

      // VALIDATION: Check if inferred time makes sense for activity type
      const activityLower = schedulingParams.activityType.toLowerCase();
      let validatedTimePreference = inferredTiming.timePreference;
      const validationWarnings: string[] = [];

      // Check for obvious mismatches
      if (activityLower.includes('dinner') && (validatedTimePreference === 'morning' || validatedTimePreference === 'afternoon')) {
        validationWarnings.push(`CORRECTED: Dinner scheduled for ${validatedTimePreference}, changing to evening`);
        validatedTimePreference = 'evening';
      } else if (activityLower.includes('breakfast') && validatedTimePreference === 'evening') {
        validationWarnings.push(`CORRECTED: Breakfast scheduled for evening, changing to morning`);
        validatedTimePreference = 'morning';
      } else if (activityLower.includes('brunch') && (validatedTimePreference === 'evening' || validatedTimePreference === 'night')) {
        validationWarnings.push(`CORRECTED: Brunch scheduled for ${validatedTimePreference}, changing to morning`);
        validatedTimePreference = 'morning';
      } else if (activityLower.includes('lunch') && (validatedTimePreference === 'morning' || validatedTimePreference === 'night')) {
        validationWarnings.push(`CORRECTED: Lunch scheduled for ${validatedTimePreference}, changing to afternoon`);
        validatedTimePreference = 'afternoon';
      }

      if (validationWarnings.length > 0) {
        console.log(`[AI Scheduling Validation] ${validationWarnings.join(', ')}`);
      }

      // Generate 2-3 date/time options based on timeframe and constraints
      const timeOptions = generateTimeOptions(
        schedulingParams.timeframe || 'next week',
        inferredTiming.dayConstraints,
        validatedTimePreference,
        group.timezone || 'America/Los_Angeles'
      );

      // Filter places for quality and de-duplication
      const qualityPlaces = places
        .filter(place => !existingVenueNames.includes(place.name))
        .filter(place => {
          const rating = parseFloat(place.rating || '0');
          const reviewCount = place.reviewCount || 0;
          return rating >= 3.5 && reviewCount >= 10 && place.address && place.photoUrl;
        })
        .filter(place => {
          // If neighborhood filter is active, only include venues in that neighborhood
          if (neighborhoodFilter && place.location) {
            const inNeighborhood = isInNeighborhood(place.location.lat, place.location.lng, neighborhoodFilter);
            if (!inNeighborhood) {

            }
            return inNeighborhood;
          }
          return true;
        });

      if (qualityPlaces.length === 0) {
        return res.status(404).json({ message: "No quality venues found" });
      }

      // Convert places to VenueForAgent format for intelligent selection
      const venuesForAgent: VenueForAgent[] = qualityPlaces.map(place => ({
        type: 'activity' as const,
        id: place.placeId || place.name,
        name: place.name,
        score: parseFloat(place.rating || '0') * 3, // Convert rating to score format
        visitCount: 0,
        daysSinceLastVisit: 999,
        qualityScore: parseFloat(place.rating || '0'),
        category: null, // Let agent derive category from venueType for better diversity
        venueType: getBestVenueTypeSync(place.types || []),
        rating: place.rating,
        venueAddress: place.address,
        googlePlaceId: place.placeId,
        latitude: place.location?.lat || null,
        longitude: place.location?.lng || null,
      }));

      // Use AI Event Planning Agent for intelligent venue selection
      let selectedVenuesData: Array<{ name: string; placeId?: string }>;
      let agentReasoning: string | undefined;
      let agentConfidence: number | undefined;

      try {
        const firstEventDate = new Date(timeOptions[0].eventDate);
        const agentResult = await planEventWithAgent({
          group,
          eventDate: firstEventDate,
          availableVenues: venuesForAgent,
          constraints: {
            desiredVenueCount: 3,
            maxDistanceMiles: group.searchRadius || 2,
          },
        });

        if (!agentResult) {
          throw new Error('Agent returned null result');
        }

        selectedVenuesData = agentResult.selectedVenues.map(v => ({
          name: v.name,
          placeId: v.googlePlaceId || undefined,
        }));
        agentReasoning = agentResult.reasoning;
        agentConfidence = agentResult.confidence;

      } catch (agentError) {
        console.error(`[AI Scheduling Agent] Failed, falling back to simple selection:`, agentError);
        // Fallback: simple rating-based selection
        selectedVenuesData = qualityPlaces
          .sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'))
          .slice(0, 3)
          .map(p => ({ name: p.name, placeId: p.placeId }));
      }

      // Get full place data for selected venues
      const topVenues = selectedVenuesData
        .map(selected => qualityPlaces.find(p =>
          p.placeId === selected.placeId || p.name === selected.name
        ))
        .filter(p => p !== undefined);

      if (topVenues.length === 0) {
        return res.status(404).json({ message: "No venues selected" });
      }

      // Create activities from the top venues
      const createdActivities: Array<{ id: string }> = [];
      for (const place of topVenues) {
        const venueType = await getBestVenueType(place.types || [], place.placeId);
        const activityCategory = await categorizeVenue(place.name, venueType);
        const newActivity = await storage.createActivity({
          groupId: req.params.id,
          venueName: place.name,
          venueAddress: place.address,
          city: place.city || null,
          venueType,
          description: place.review || '',
          googlePlaceId: place.placeId,
          latitude: place.location?.lat?.toString() || null,
          longitude: place.location?.lng?.toString() || null,
          rating: place.rating,
          reviewCount: place.reviewCount || null,
          priceLevel: place.priceLevel,
          photoUrl: place.photoUrl,
          googleReview: place.review || null,
          category: activityCategory,
        });
        createdActivities.push(newActivity);
      }

      // Create itinerary items from activities
      const items = createdActivities.map(activity => ({
        sourceType: 'activity' as const,
        sourceId: activity.id,
        orderIndex: createdActivities.indexOf(activity),
      }));

      // Generate event name
      const eventName = `${schedulingParams.activityType.charAt(0).toUpperCase() + schedulingParams.activityType.slice(1)} ${schedulingParams.timeframe || ''}`.trim();

      // DEDUPLICATION: Check for existing proposed itineraries on the same date
      // This prevents creating duplicate events when user submits multiple times
      const { deduplicateByDate } = await import('./itinerary-deduplication');
      const proposedEventDate = new Date(timeOptions[0].eventDate);
      await deduplicateByDate(req.params.id, proposedEventDate, 'AI Scheduling');

      // Create proposed itinerary with multiple time slots
      // proposedOrder must be set for proposed itineraries (array of item IDs in sequence)
      const proposedOrder = items.map(item => item.sourceId);

      // createItinerary signature: (insertItinerary, userId, itemsData)
      // Set eventDate to first time option so itinerary shows up on Home tab immediately
      const itinerary = await storage.createItinerary(
        {
          groupId: req.params.id,
          name: eventName,
          status: 'proposed',
          timingRecommendations: timeOptions.length > 1 ? 'Vote for your preferred time' : null,
          proposedOrder,
          eventDate: proposedEventDate, // Set default to first time option
        },
        userId, // Passed separately, not in the object!
        items
      );

      // Create time slot options for voting
      for (const option of timeOptions) {
        await storage.createProposedTimeSlot({
          itineraryId: itinerary.id,
          proposedDateTime: new Date(option.eventDate), // Use proposedDateTime, not eventDate
          // Note: label removed - frontend will format datetime with timezone
        });
      }

      // Collect all applied enhancements for transparency
      const appliedEnhancements: {
        timeInferences?: string[];
        contextKeywords?: string[];
        venueAttributes?: string[];
        historyApplied?: string[];
      } = {};

      if (inferredTiming.appliedInferences.length > 0) {
        appliedEnhancements.timeInferences = inferredTiming.appliedInferences;
      }

      if (schedulingParams.contextKeywords && schedulingParams.contextKeywords.length > 0) {
        appliedEnhancements.contextKeywords = schedulingParams.contextKeywords;
      }

      if (schedulingParams.venueAttributes && schedulingParams.venueAttributes.length > 0) {
        appliedEnhancements.venueAttributes = schedulingParams.venueAttributes;
      }

      if (schedulingParams.historyApplied && schedulingParams.historyApplied.length > 0) {
        appliedEnhancements.historyApplied = schedulingParams.historyApplied;
      }

      res.json({
        itinerary,
        venues: createdActivities,
        timeOptions,
        appliedEnhancements: Object.keys(appliedEnhancements).length > 0 ? appliedEnhancements : undefined,
        // A/B test info - so you can see which model was used!
        aiMetadata: {
          model: schedulingParams.aiModel,
          cached: schedulingParams.cached,
          responseTimeMs: schedulingParams.responseTimeMs,
        },
      });
    } catch (error: any) {
      console.error("[AI Scheduling] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Analyze preference patterns and generate insights
  app.post("/api/groups/:id/analyze-patterns", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Gather all feedback data
      const activities = await storage.getAllGroupActivities(req.params.id);
      const notThisFeedback = activities
        .filter(a => a.feedback === 'less')
        .map(a => ({
          venueName: a.venueName,
          venueType: a.venueType,
          description: a.description
        }));

      const votingEvents = await storage.getGroupVotingEvents(req.params.id);
      const votingFeedback = votingEvents
        .filter(e => e.netVotes !== 0 && e.venueType)
        .map(e => ({
          venueName: e.title,
          venueType: e.venueType!,
          upvotes: e.upvotes,
          downvotes: e.downvotes,
          netVotes: e.netVotes
        }));

      const preferenceSignals = await storage.getGroupPreferenceSignals(req.params.id);
      const likedConcepts = preferenceSignals
        .filter(s => s.feedback === 'like')
        .map(s => s.conceptDescription);
      const passedConcepts = preferenceSignals
        .filter(s => s.feedback === 'pass')
        .map(s => s.conceptDescription);

      // Generate insights using OpenAI
      const patterns = await analyzePreferencePatterns({
        notThisFeedback,
        votingFeedback,
        likedConcepts,
        passedConcepts
      });

      // Update group with insights
      await db.update(groupsTable)
        .set({
          preferenceInsights: patterns,
          lastInsightsUpdate: new Date()
        })
        .where(eq(groupsTable.id, req.params.id));

      res.json({ patterns });
    } catch (error: any) {
      console.error("[AI Insights] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Compare GPT-4o vs mini side-by-side for a prompt
  app.post("/api/groups/:id/compare-models", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const groupHistory = {
        preferenceInsights: group.preferenceInsights as string | null | undefined,
        schedulingPreferences: group.schedulingPreferences,
        closenessLevel: group.closenessLevel
      };

      // Force each model to run once for comparison

      const gpt4oStartTime = Date.now();
      const gpt4oResult = await parseSchedulingPromptWithHistory(
        prompt,
        group.locationBase,
        groupHistory,
        'gpt-4o' // Force GPT-4o
      );
      const gpt4oTime = Date.now() - gpt4oStartTime;

      const miniStartTime = Date.now();
      const miniResult = await parseSchedulingPromptWithHistory(
        prompt,
        group.locationBase,
        groupHistory,
        'gpt-4o-mini' // Force mini
      );
      const miniTime = Date.now() - miniStartTime;

      // Compare the results
      const comparison = {
        prompt,
        gpt4o: {
          ...gpt4oResult,
          model: 'gpt-4o',
          responseTimeMs: gpt4oTime,
        },
        mini: {
          ...miniResult,
          model: 'gpt-4o-mini',
          responseTimeMs: miniTime,
        },
        differences: {
          contextKeywords: {
            gpt4oOnly: (gpt4oResult.contextKeywords || []).filter(k => !(miniResult.contextKeywords || []).includes(k)),
            miniOnly: (miniResult.contextKeywords || []).filter(k => !(gpt4oResult.contextKeywords || []).includes(k)),
            same: (gpt4oResult.contextKeywords || []).filter(k => (miniResult.contextKeywords || []).includes(k)),
          },
          venueAttributes: {
            gpt4oOnly: (gpt4oResult.venueAttributes || []).filter(k => !(miniResult.venueAttributes || []).includes(k)),
            miniOnly: (miniResult.venueAttributes || []).filter(k => !(gpt4oResult.venueAttributes || []).includes(k)),
            same: (gpt4oResult.venueAttributes || []).filter(k => (miniResult.venueAttributes || []).includes(k)),
          },
          historyApplied: {
            gpt4oOnly: (gpt4oResult.historyApplied || []).filter(h => !(miniResult.historyApplied || []).includes(h)),
            miniOnly: (miniResult.historyApplied || []).filter(h => !(gpt4oResult.historyApplied || []).includes(h)),
            same: (gpt4oResult.historyApplied || []).filter(h => (miniResult.historyApplied || []).includes(h)),
          },
          activityType: gpt4oResult.activityType !== miniResult.activityType ? {
            gpt4o: gpt4oResult.activityType,
            mini: miniResult.activityType,
          } : null,
          timePreference: gpt4oResult.timePreference !== miniResult.timePreference ? {
            gpt4o: gpt4oResult.timePreference,
            mini: miniResult.timePreference,
          } : null,
          dayConstraints: gpt4oResult.dayConstraints !== miniResult.dayConstraints ? {
            gpt4o: gpt4oResult.dayConstraints,
            mini: miniResult.dayConstraints,
          } : null,
          performance: {
            gpt4oTimeMs: gpt4oTime,
            miniTimeMs: miniTime,
            speedupFactor: (gpt4oTime / miniTime).toFixed(2) + 'x',
          },
        },
        costDifference: "GPT-4o costs ~5-7x more than mini per request",
      };

      res.json(comparison);
    } catch (error: any) {
      console.error("[Model Comparison] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get A/B testing and cache statistics
  app.get("/api/admin/ai-stats", isAuthenticated, requireAdmin(), async (req, res) => {
    try {
      // Get prompt cache stats
      const cacheStats = getPromptCacheStats();

      // Get Google Places cache stats for comparison
      const placesStats = getCacheStats();

      // API call logs not available - would need a separate logging table
      const recentCalls: any[] = [];

      // Analyze A/B test results
      const abTestMetrics = {
        totalCalls: 0,
        gpt4oCalls: 0,
        miniCalls: 0,
        cacheHits: 0,
        averageCost: {
          gpt4o: 0,
          mini: 0,
        },
        averageResponseTime: {
          gpt4o: 0,
          mini: 0,
        },
        currentABTestPercentage: 100, // GPT-4o always used for parsing
      };

      // This would analyze the recent API calls if we have access to them
      // For now, just return cache stats

      res.json({
        promptCache: cacheStats,
        placesCache: {
          searchHits: placesStats.searchHits,
          searchMisses: placesStats.searchMisses,
          placeDetailsHits: placesStats.placeDetailsHits,
          placeDetailsMisses: placesStats.placeDetailsMisses,
        },
        abTest: abTestMetrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[AI Stats] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Clear all activities for a group
  app.delete("/api/groups/:id/activities", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      await storage.deleteAllGroupActivities(req.params.id);
      res.json({ success: true, message: "All activities cleared" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a single activity from the library
  app.delete("/api/activities/:activityId", isAuthenticated, async (req: any, res) => {
    try {
      const { activityId } = req.params;
      const userId = await getUserId(req);

      // Get the activity to verify it exists and check ownership
      const activity = await storage.getActivity(activityId);
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      // Verify the user owns the group this activity belongs to
      const group = await storage.getGroup(activity.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this activity" });
      }

      await storage.deleteActivity(activityId);
      res.json({ success: true, message: "Activity deleted" });
    } catch (error: any) {
      console.error("[Delete Activity] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create voting event from category search result (when user hearts a venue)
  app.post("/api/groups/:id/activities/from-category-result", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Any authenticated user can add to group favorites (not just owner)
      const userId = await getUserId(req);

      const { activityData } = req.body;
      
      // Create a voting event so the whole group can vote on this favorite
      const votingEvent = await storage.createVotingEvent({
        groupId: req.params.id,
        title: activityData.venueName,
        venueType: activityData.venueType || null,
        venueAddress: activityData.venueAddress || null,
        description: activityData.description || null,
        googlePlaceId: activityData.googlePlaceId || null,
        latitude: activityData.latitude || null,
        longitude: activityData.longitude || null,
        rating: activityData.rating ? activityData.rating.toString() : null,
        priceLevel: activityData.priceLevel || null,
        photoUrl: activityData.photoUrl || null,
      }, userId);

      res.json(votingEvent);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send email invitations (simplified - logs to console for MVP)
  app.post("/api/groups/:id/send-invitations", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const members = await storage.getGroupMembers(req.params.id);
      const inviteLink = `${req.headers.origin || 'http://localhost:5000'}/join/${group.shareableLink}`;

      // For MVP: Log email invitations to console
      // In production, this would integrate with an email service
      const emailsSent = members
        .filter(m => m.email && !m.invitationSent)
        .map(m => {
          console.log(`
=== EMAIL INVITATION ===
To: ${m.email}
Subject: Join ${group.name} - Group Activity Planner
Body:
You've been invited to join "${group.name}"!

${m.name ? `Hi ${m.name},` : 'Hi there,'}

Click the link below to join the group and see AI-powered activity suggestions:
${inviteLink}

Looking forward to planning great activities together!
========================
          `);
          return m.email;
        });

      // Mark invitations as sent
      if (emailsSent.length > 0) {
        await storage.markInvitationsSent(req.params.id);
      }

      res.json({ 
        success: true, 
        emailsSent: emailsSent.length,
        message: `Invitations logged for ${emailsSent.length} members. Check server console for details.`
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate swipeable concepts for preference refinement
  app.post("/api/groups/:id/swipe-concepts", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Get previously seen concepts to avoid repeats
      const previousSignals = await storage.getGroupPreferenceSignals(req.params.id);
      const previouslySeenConcepts = previousSignals.map(s => s.conceptDescription);

      const concepts = await generateSwipeConcepts({
        locationBase: group.locationBase,
        budgetMin: group.budgetMin,
        budgetMax: group.budgetMax,
        activityCategories: group.activityCategories || [],
        pastPreferences: group.pastPreferences || '',
        previouslySeenConcepts,
        mealEnabled: group.mealEnabled ?? true,
        cafeEnabled: group.cafeEnabled ?? true,
        drinksEnabled: group.drinksEnabled ?? true,
        dessertEnabled: group.dessertEnabled ?? true,
        experiencesEnabled: group.experiencesEnabled ?? true,
      });

      res.json({ concepts });
    } catch (error: any) {
      console.error("Error generating swipe concepts:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Save swipe feedback (like or pass)
  // Discover Venues - Start a discovery swipe session with cache-first strategy
  app.post("/api/groups/:groupId/discover-venues", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user has access to this group
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Parse request body (optional category filter)
      const discoverSchema = z.object({
        category: z.enum(['meal', 'cafe', 'drinks', 'dessert', 'experiences']).optional(),
        count: z.number().min(5).max(30).optional().default(15),  // Reduced from 20 to 15
      });

      const validatedData = safeParse(discoverSchema, req.body, res);
      if (!validatedData) return;

      const { category } = validatedData;
      const count = validatedData.count ?? 15;

      // Create a discovery swipe session
      const { createSwipeSession } = await import('./swipe-session-manager');
      const sessionId = await createSwipeSession({
        groupId,
        sessionType: 'discovery',
        triggeredBy: 'manual',
        isBlocking: false,
        targetSwipeCount: count,
        expiresInHours: 48,
      });

      const COOLDOWN_DAYS = 30;
      let deck: any[] = [];

      // TIER 1: Popular cached venues (group favorites with cooldown)

      const popularVenuesQuery = await db.execute<{
        id: string;
        title: string;
        description: string;
        venue_address: string;
        venue_type: string;
        google_place_id: string;
        rating: string;
        price_level: string;
        photo_url: string;
        upvote_count: number;
      }>(sql`
        SELECT DISTINCT
          ve.id,
          ve.title,
          ve.description,
          ve.venue_address,
          ve.venue_type,
          ve.google_place_id,
          ve.rating,
          ve.price_level,
          ve.photo_url,
          COUNT(DISTINCT v.id) FILTER (WHERE v.vote_type = 'upvote') as upvote_count
        FROM voting_events ve
        LEFT JOIN votes v ON ve.id = v.event_id
        LEFT JOIN activity_swipes swipe ON ve.id = swipe.voting_event_id AND swipe.user_id = ${userId}
        WHERE ve.group_id = ${groupId}
          AND (
            swipe.id IS NULL
            OR swipe.created_at < NOW() - INTERVAL '${COOLDOWN_DAYS} days'
          )
          ${category ? sql`AND LOWER(ve.venue_type) LIKE LOWER(${'%' + category + '%'})` : sql``}
        GROUP BY ve.id
        HAVING COUNT(DISTINCT v.id) FILTER (WHERE v.vote_type = 'upvote') > 0
        ORDER BY upvote_count DESC
        LIMIT ${count || 10}
      `);

      const popularVenues = popularVenuesQuery.rows || [];
      deck.push(...popularVenues.map(v => ({
        id: v.id,
        title: v.title,
        description: v.description || `Popular venue in ${group.locationBase}`,
        venueAddress: v.venue_address,
        venueType: v.venue_type,
        googlePlaceId: v.google_place_id,
        rating: v.rating,
        priceLevel: v.price_level,
        photoUrl: v.photo_url,
        sourceType: 'voting_event' as const,
        isNew: false,
        likedByCount: Number(v.upvote_count),
        groupId,
      })));

      // TIER 2: Unvoted activities from cache (if we need more)
      const remaining = count - deck.length;
      if (remaining > 0) {

        const activitiesQuery = await db.execute<{
          id: string;
          venue_name: string;
          description: string;
          venue_address: string;
          venue_type: string;
          google_place_id: string;
          rating: string;
          price_level: string;
          photo_url: string;
        }>(sql`
          SELECT DISTINCT
            a.id,
            a.venue_name,
            a.description,
            a.venue_address,
            a.venue_type,
            a.google_place_id,
            a.rating,
            a.price_level,
            a.photo_url
          FROM activities a
          LEFT JOIN activity_swipes swipe ON a.id = swipe.activity_id AND swipe.user_id = ${userId}
          WHERE a.group_id = ${groupId}
            AND a.archived_at IS NULL
            AND swipe.id IS NULL
            ${category ? sql`AND a.category = ${category}` : sql``}
          LIMIT ${remaining}
        `);

        const activities = activitiesQuery.rows || [];
        deck.push(...activities.map(a => ({
          id: a.id,
          title: a.venue_name,
          description: a.description || `${a.venue_type || 'Activity'} in ${group.locationBase}`,
          venueAddress: a.venue_address,
          venueType: a.venue_type,
          googlePlaceId: a.google_place_id,
          rating: a.rating,
          priceLevel: a.price_level,
          photoUrl: a.photo_url,
          sourceType: 'ai_suggestion' as const,
          isNew: true,
          groupId,
        })));

      }

      // TIER 3: Google Places API (only if still need more)
      const stillNeeded = count - deck.length;
      if (stillNeeded > 0) {

        const { generateSwipeConcepts } = await import('./openai');
        const categoryFilters = {
          mealEnabled: category === 'meal' || (!category && (group.mealEnabled ?? true)),
          cafeEnabled: category === 'cafe' || (!category && (group.cafeEnabled ?? true)),
          drinksEnabled: category === 'drinks' || (!category && (group.drinksEnabled ?? true)),
          dessertEnabled: category === 'dessert' || (!category && (group.dessertEnabled ?? true)),
          experiencesEnabled: category === 'experiences' || (!category && (group.experiencesEnabled ?? true)),
        };

        const previousSignals = await storage.getGroupPreferenceSignals(groupId);
        const previouslySeenConcepts = previousSignals.map(s => s.conceptDescription);

        // Generate fewer concepts (3-5 instead of 10)
        const concepts = await generateSwipeConcepts({
          locationBase: group.locationBase,
          budgetMin: group.budgetMin,
          budgetMax: group.budgetMax,
          activityCategories: group.activityCategories || [],
          pastPreferences: group.pastPreferences || '',
          previouslySeenConcepts,
          ...categoryFilters,
        });

        if (concepts && concepts.length > 0) {
          const { searchPlaces } = await import('./google-places');

          // Limit concepts to reduce API calls
          const limitedConcepts = concepts.slice(0, Math.min(3, concepts.length));

          const venuePromises = limitedConcepts.map(async (concept) => {
            try {
              const venues = await searchPlaces(
                concept.searchQuery,
                `${group.latitude || ''},${group.longitude || ''}`,
                group.searchRadius || 5,
                group.latitude && group.longitude
                  ? { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) }
                  : undefined,
                false, // skipCurated
                undefined, // venueType
                group.budgetMax,
                [], // seenVenues
                false // forceComprehensiveSearch
              );

              return venues.slice(0, Math.ceil(stillNeeded / limitedConcepts.length));
            } catch (error) {
              console.error(`[Discover Venues] Error searching for "${concept.searchQuery}":`, error);
              return [];
            }
          });

          const venueArrays = await Promise.all(venuePromises);
          const newVenues = venueArrays.flat();

          // Filter out duplicates
          const existingIds = new Set(deck.map(v => v.googlePlaceId).filter(Boolean));
          const rejectedIds = new Set(group.rejectedVenues || []);

          const filteredNewVenues = newVenues.filter(venue =>
            !existingIds.has(venue.placeId) &&
            !rejectedIds.has(venue.placeId || venue.name)
          );

          deck.push(...filteredNewVenues.slice(0, stillNeeded).map(venue => ({
            id: venue.placeId,
            title: venue.name,
            description: `${venue.types?.[0] || 'Venue'} in ${group.locationBase}`,
            venueAddress: venue.address,
            venueType: venue.types?.[0] || 'place',
            googlePlaceId: venue.placeId,
            rating: venue.rating,
            reviewCount: venue.reviewCount,
            priceLevel: venue.priceLevel,
            photoUrl: venue.photoUrl,
            sourceType: 'ai_suggestion' as const,
            isNew: true,
            groupId,
          })));

        }
      }

      // Shuffle the final deck for variety
      const shuffledDeck = deck.sort(() => Math.random() - 0.5);

      res.json({
        sessionId,
        deck: shuffledDeck,
        totalVenues: shuffledDeck.length,
        category: category || 'all',
        cacheStats: {
          popularVenues: popularVenues.length,
          cachedActivities: deck.filter(d => d.sourceType === 'ai_suggestion' && !d.likedByCount).length,
          newFromAPI: deck.filter(d => d.isNew && !popularVenues.some(p => p.id === d.id)).length,
        }
      });
    } catch (error: any) {
      console.error('[Discover Venues] Error:', error);
      res.status(500).json({
        message: error.message || "Failed to create discovery session"
      });
    }
  });

  app.post("/api/groups/:id/swipe-feedback", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const { conceptType, conceptDescription, feedback } = req.body;

      if (!conceptType || !conceptDescription || !feedback) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (feedback !== 'like' && feedback !== 'pass') {
        return res.status(400).json({ message: "Feedback must be 'like' or 'pass'" });
      }

      const signal = await storage.createPreferenceSignal({
        groupId: req.params.id,
        conceptType,
        conceptDescription,
        feedback,
      });

      await trackFeedbackAndMaybeAnalyze(req.params.id);

      res.json({ signal });
    } catch (error: any) {
      console.error("Error saving swipe feedback:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get swipe deck - mix of voting events and AI suggestions
  app.get("/api/groups/:id/swipe-deck", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const groupId = req.params.id;

      // Get group settings for category filtering
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Get all voting events for this group with vote data
      const votingEvents = await storage.getGroupVotingEvents(groupId);
      
      // Get user's existing votes to filter out already-voted venues
      const userVotes = await storage.getUserVotes(userId);
      const votedEventIds = new Set(userVotes.map(v => v.eventId));

      // Filter out venues user has already voted on OR created (adding = implicit like)
      const unvotedEvents = votingEvents.filter(event =>
        !votedEventIds.has(event.id) && event.createdBy !== userId
      );

      // Get who liked each event (for "Liked by X" badges)
      const eventsWithLikers = await Promise.all(
        unvotedEvents.map(async (event) => {
          const votes = await storage.getEventVotes(event.id);
          const upvoters = votes.filter(v => v.voteType === 'upvote');
          
          // Get user names for upvoters
          const likerNames = await Promise.all(
            upvoters.slice(0, 3).map(async (vote) => {
              const user = await storage.getUser(vote.userId);
              return user?.firstName || 'Someone';
            })
          );

          return {
            ...event,
            likedBy: likerNames,
            likedByCount: upvoters.length,
            sourceType: 'voting_event' as const,
          };
        })
      );

      // Filter out voting events from disabled categories (keyword-based)
      const filteredEvents = eventsWithLikers.filter(event => {
        const venueType = (event.venueType || '').toLowerCase();
        const title = event.title.toLowerCase();
        
        // Check if venue belongs to a disabled category
        if (group.cafeEnabled === false && (venueType.includes('cafe') || venueType.includes('coffee') || title.includes('cafe') || title.includes('coffee'))) {

          return false;
        }
        
        if (group.mealEnabled === false && (venueType.includes('restaurant') || venueType.includes('dining') || venueType.includes('food'))) {

          return false;
        }
        
        if (group.drinksEnabled === false && (venueType.includes('bar') || venueType.includes('brewery') || venueType.includes('pub') || venueType.includes('wine'))) {

          return false;
        }
        
        if (group.dessertEnabled === false && (venueType.includes('dessert') || venueType.includes('ice cream') || venueType.includes('boba') || venueType.includes('bakery'))) {

          return false;
        }
        
        return true;
      });

      // If we have fewer than 10 venues, backfill with AI suggestions
      let deck = filteredEvents;
      const MIN_DECK_SIZE = 10;

      if (deck.length < MIN_DECK_SIZE) {
        // Get previously seen concepts to avoid repeats
        const previousSignals = await storage.getGroupPreferenceSignals(groupId);
        const previouslySeenConcepts = previousSignals.map(s => s.conceptDescription);

        // Get already suggested place IDs to avoid duplicates
        const existingPlaceIds = new Set(
          eventsWithLikers
            .map(e => e.googlePlaceId)
            .filter(Boolean)
        );

        // Generate new AI suggestions
        const neededCount = MIN_DECK_SIZE - deck.length;
        const concepts = await generateSwipeConcepts({
          locationBase: group.locationBase,
          budgetMin: group.budgetMin,
          budgetMax: group.budgetMax,
          activityCategories: group.activityCategories || [],
          pastPreferences: group.pastPreferences || '',
          previouslySeenConcepts,
          mealEnabled: group.mealEnabled ?? true,
          cafeEnabled: group.cafeEnabled ?? true,
          drinksEnabled: group.drinksEnabled ?? true,
          dessertEnabled: group.dessertEnabled ?? true,
          experiencesEnabled: group.experiencesEnabled ?? true,
        });

        // Convert concepts to venue-style cards and enrich with Google Places
        const enrichedConcepts = await Promise.all(
          concepts.slice(0, neededCount * 2).map(async (concept) => {
            // Use the searchQuery field for Google Places search

            try {
              // Parse coordinates - they're stored as strings in DB
              const lat = group.latitude ? parseFloat(group.latitude) : undefined;
              const lng = group.longitude ? parseFloat(group.longitude) : undefined;
              const radius = group.searchRadius || 10; // default 10 miles
              
              // Only pass coordinates object if both values are defined
              const coordinates = (lat !== undefined && lng !== undefined) ? { lat, lng } : undefined;

              const places = await import('./google-places').then(m => 
                m.searchPlaces(concept.searchQuery, group.locationBase, radius, coordinates, false, undefined, group.budgetMax)
              );

              if (places.length > 0) {
                const place = places[0];

                // Skip if we already have this place
                if (existingPlaceIds.has(place.placeId)) {

                  return null;
                }

                // Filter out places from disabled categories
                const placeTypes = (place.types || []).map(t => t.toLowerCase()).join(' ');
                const placeName = place.name.toLowerCase();
                
                if (group.cafeEnabled === false) {
                  if (placeTypes.includes('cafe') || placeTypes.includes('coffee') || placeName.includes('cafe') || placeName.includes('coffee')) {

                    return null;
                  }
                }
                
                if (group.mealEnabled === false) {
                  if (placeTypes.includes('restaurant') || placeTypes.includes('food')) {

                    return null;
                  }
                }
                
                if (group.drinksEnabled === false) {
                  if (placeTypes.includes('bar') || placeTypes.includes('night_club') || placeTypes.includes('liquor_store')) {

                    return null;
                  }
                }
                
                if (group.dessertEnabled === false) {
                  if (placeTypes.includes('bakery') || placeTypes.includes('ice_cream') || placeName.includes('dessert') || placeName.includes('boba')) {

                    return null;
                  }
                }

                // Add to existing places to avoid duplicates in this batch
                existingPlaceIds.add(place.placeId);

                return {
                  id: `ai-${concept.conceptType}-${Date.now()}-${Math.random()}`,
                  title: place.name,
                  description: concept.conceptDescription,
                  venueAddress: place.address,
                  venueType: getBestVenueTypeSync(place.types || []) || concept.conceptType,
                  googlePlaceId: place.placeId,
                  rating: place.rating?.toString(),
                  reviewCount: place.reviewCount,
                  priceLevel: place.priceLevel ? '$'.repeat(parseInt(place.priceLevel)) : undefined,
                  photoUrl: place.photoUrl,
                  sourceType: 'ai_suggestion' as const,
                  isNew: true,
                  groupId,
                };
              } else {
                console.warn(`[Swipe Deck] ❌ No Google Places results for: "${concept.searchQuery}"`);
                return null;
              }
            } catch (error) {
              console.error(`[Swipe Deck] Error searching for "${concept.searchQuery}":`, error);
              return null;
            }
          })
        );

        // Filter out nulls and add to deck
        const validConcepts = enrichedConcepts.filter((c): c is NonNullable<typeof c> => c !== null);
        deck.push(...(validConcepts as any[]));
      }

      // Shuffle the deck to mix voting events and new suggestions
      const shuffledDeck = deck.sort(() => Math.random() - 0.5);

      res.json({ deck: shuffledDeck });
    } catch (error: any) {
      console.error("Error generating swipe deck:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Validate and create itinerary
  app.post("/api/groups/:groupId/itineraries/validate", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const { selectedVenues } = req.body; // Array of { sourceType, sourceId }
      const userId = await getUserId(req);

      if (!selectedVenues || !Array.isArray(selectedVenues) || selectedVenues.length === 0) {
        return res.status(400).json({ message: "No venues selected" });
      }

      // Fetch venue details with location data
      const venuesWithDetails = await Promise.all(
        selectedVenues.map(async (v: { sourceType: string; sourceId: string; adHocData?: any }) => {
          if (v.sourceType === 'activity') {
            const activities = await storage.getGroupActivities(groupId);
            const activity = activities.find(a => a.id === v.sourceId);
            if (!activity) return null;

            // Use stored location coordinates (already saved from search results)
            let location: { lat: number; lng: number } | undefined;
            if (activity.latitude && activity.longitude) {
              location = {
                lat: parseFloat(activity.latitude),
                lng: parseFloat(activity.longitude),
              };
            }

            return {
              sourceType: 'activity' as const,
              sourceId: activity.id,
              venueName: activity.venueName,
              venueType: activity.venueType,
              venueAddress: activity.venueAddress,
              googlePlaceId: activity.googlePlaceId,
              location,
            };
          } else if (v.sourceType === 'voting_event') {
            const events = await storage.getGroupVotingEvents(groupId);
            const event = events.find(e => e.id === v.sourceId);
            if (!event) return null;

            // Use stored location coordinates (already saved from search results)
            let location: { lat: number; lng: number } | undefined;
            if (event.latitude && event.longitude) {
              location = {
                lat: parseFloat(event.latitude),
                lng: parseFloat(event.longitude),
              };
            }

            return {
              sourceType: 'voting_event' as const,
              sourceId: event.id,
              venueName: event.title,
              venueType: event.venueType || 'venue',
              venueAddress: event.venueAddress,
              googlePlaceId: event.googlePlaceId,
              location,
            };
          } else if (v.sourceType === 'ad_hoc' && v.adHocData) {
            // Handle ad-hoc venue
            const { name, address, googlePlaceId, googleMapsUrl, notes } = v.adHocData;

            // For validation purposes, create a temporary venue object
            let location: { lat: number; lng: number } | undefined;

            // Try to geocode if we have an address but no coordinates
            if (address) {
              try {
                const geocoded = await geocodeLocation(address);
                if (geocoded) {
                  location = { lat: geocoded.latitude, lng: geocoded.longitude };
                }
              } catch (error) {
                console.error('[Validate Itinerary] Error geocoding ad-hoc venue:', error);
              }
            }

            return {
              sourceType: 'ad_hoc' as const,
              sourceId: v.sourceId, // temp ID
              venueName: name,
              venueType: 'venue',
              venueAddress: address || '',
              googlePlaceId,
              location,
              adHocData: v.adHocData, // Pass through for later
            };
          }
          return null;
        })
      );

      const validVenues = venuesWithDetails.filter((v): v is NonNullable<typeof v> => v !== null);

      if (validVenues.length === 0) {
        return res.status(400).json({ message: "No valid venues found" });
      }

      // Validate itinerary with AI
      const validation = await validateItinerary(validVenues as any);

      if (!validation.isValid) {
        return res.status(400).json({
          message: validation.validationNotes,
          issues: validation.issues,
        });
      }

      // DEDUPLICATION: Delete any existing unsent draft itineraries for this group
      // This prevents duplicate itineraries when user clicks "Send to Group" multiple times
      // Only delete drafts that haven't been sent yet (no eventDate or inviteSentAt)
      const { deduplicateUnsentDrafts } = await import('./itinerary-deduplication');
      await deduplicateUnsentDrafts(groupId, 'Validate Itinerary');

      // Create itinerary with proposed order
      const itinerary = await storage.createItinerary(
        {
          groupId,
          status: 'proposed',
          aiValidationNotes: validation.validationNotes,
          proposedOrder: validation.proposedOrder,
        },
        userId,
        validation.proposedOrder.map(sourceId => {
          const venue = validVenues.find(v => v?.sourceId === sourceId);
          if (venue?.sourceType === 'ad_hoc') {
            return {
              sourceType: 'ad_hoc' as const,
              sourceId: sourceId,
              adHocData: venue.adHocData,
            };
          }
          return {
            sourceType: (venue?.sourceType || 'activity') as 'activity' | 'voting_event',
            sourceId: sourceId,
          };
        })
      );

      // Fetch full itinerary with items
      const fullItinerary = await storage.getItinerary(itinerary.id);

      res.json({
        itinerary: fullItinerary,
        validation: {
          notes: validation.validationNotes,
          issues: validation.issues,
        },
      });
    } catch (error: any) {
      console.error("Error validating itinerary:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get nearby add-on suggestions for selected venues
  app.post("/api/groups/:groupId/nearby-suggestions", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const { selectedVenues } = req.body; // Array of { sourceType, sourceId }
      const { groupId } = req.params;

      if (!selectedVenues || !Array.isArray(selectedVenues) || selectedVenues.length === 0) {
        return res.json({ suggestions: [] });
      }

      // Fetch venue details with location data
      const venuesWithLocations = await Promise.all(
        selectedVenues.map(async (v: { sourceType: string; sourceId: string }) => {
          if (v.sourceType === 'activity') {
            const activities = await storage.getGroupActivities(groupId);
            const activity = activities.find(a => a.id === v.sourceId);
            if (!activity?.googlePlaceId) return null;

            // Use stored location coordinates (already saved from search results)
            if (!activity.latitude || !activity.longitude) return null;

            return {
              location: {
                lat: parseFloat(activity.latitude),
                lng: parseFloat(activity.longitude),
              },
              placeId: activity.googlePlaceId,
              name: activity.venueName,
            };
          } else {
            const events = await storage.getGroupVotingEvents(groupId);
            const event = events.find(e => e.id === v.sourceId);
            if (!event?.googlePlaceId) return null;

            // Use stored location coordinates (already saved from search results)
            if (!event.latitude || !event.longitude) return null;

            return {
              location: {
                lat: parseFloat(event.latitude),
                lng: parseFloat(event.longitude),
              },
              placeId: event.googlePlaceId,
              name: event.title,
            };
          }
        })
      );

      const validLocations = venuesWithLocations.filter(Boolean);

      if (validLocations.length === 0) {
        return res.json({ suggestions: [] });
      }

      // Search for nearby high-rated places around the first venue
      const centerLocation = validLocations[0]!.location;
      const selectedPlaceIds = validLocations.map(v => v!.placeId);

      // Search for various types of nearby venues
      const searchQueries = ['restaurant', 'cafe', 'bar', 'dessert', 'ice cream'];
      const allNearbyPlaces = await Promise.all(
        searchQueries.map(query => 
          searchNearbyPlaces(query, centerLocation, 805, 4.0) // 0.5 miles = 805 meters, 4.0+ rating
        )
      );

      // Flatten and deduplicate
      const uniquePlaces = new Map();
      allNearbyPlaces.flat().forEach(place => {
        // Skip if it's one of the selected venues
        if (selectedPlaceIds.includes(place.placeId)) return;

        if (!uniquePlaces.has(place.placeId)) {
          uniquePlaces.set(place.placeId, place);
        }
      });

      // Take top 3 suggestions by rating
      const suggestions = Array.from(uniquePlaces.values())
        .sort((a, b) => {
          const ratingA = parseFloat(a.rating || '0');
          const ratingB = parseFloat(b.rating || '0');
          return ratingB - ratingA;
        })
        .slice(0, 3);

      res.json({ suggestions });
    } catch (error: any) {
      console.error("Error fetching nearby suggestions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get nearby suggestions for a specific venue by lat/lng
  app.post("/api/groups/:groupId/venue-nearby-suggestions", async (req, res) => {
    try {
      const { lat, lng, placeId, excludePlaceIds } = req.body;
      const { groupId } = req.params;

      if (lat === undefined || lat === null || lng === undefined || lng === null) {
        return res.json({ suggestions: [] });
      }

      const location = { lat: parseFloat(lat), lng: parseFloat(lng) };
      const excludeIds = new Set([placeId, ...(excludePlaceIds || [])]);

      // Search for various types of nearby venues
      const searchQueries = ['restaurant', 'cafe', 'bar', 'dessert', 'ice cream'];
      const allNearbyPlaces = await Promise.all(
        searchQueries.map(query => 
          searchNearbyPlaces(query, location, 805, 4.0) // 0.5 miles = 805 meters, 4.0+ rating
        )
      );

      // Flatten and deduplicate
      const uniquePlaces = new Map();
      allNearbyPlaces.flat().forEach(place => {
        if (excludeIds.has(place.placeId)) return;
        if (!uniquePlaces.has(place.placeId)) {
          uniquePlaces.set(place.placeId, place);
        }
      });

      // Take top 3 suggestions by rating
      const suggestions = Array.from(uniquePlaces.values())
        .sort((a, b) => {
          const ratingA = parseFloat(a.rating || '0');
          const ratingB = parseFloat(b.rating || '0');
          return ratingB - ratingA;
        })
        .slice(0, 3);

      res.json({ suggestions });
    } catch (error: any) {
      console.error("Error fetching venue nearby suggestions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Simple places search (for ad-hoc venue dialog and "search near" feature)
  app.get("/api/places/search", async (req, res) => {
    try {
      const { query, lat, lng, radius } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.json({ results: [] });
      }

      // Check if custom coordinates are provided (for "search near itinerary venue" feature)
      const hasCustomCoords = lat && lng &&
        !isNaN(parseFloat(lat as string)) &&
        !isNaN(parseFloat(lng as string));

      // Use custom coordinates if provided, otherwise default to Bay Area
      const searchQuery = query.trim();
      const defaultLocation = "San Francisco Bay Area";
      const searchRadius = radius ? parseFloat(radius as string) : (hasCustomCoords ? 0.5 : 25); // miles
      const coordinates = hasCustomCoords
        ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) }
        : { lat: 37.7749, lng: -122.4194 }; // San Francisco center

      const results = await searchPlaces(searchQuery, defaultLocation, searchRadius, coordinates, false, undefined, undefined, undefined, true, true);

      // Return top 10 results
      const limitedResults = results.slice(0, 10).map(place => ({
        placeId: place.placeId,
        name: place.name,
        address: place.address,
        photoUrl: place.photoUrl,
        rating: place.rating,
        reviewCount: place.reviewCount,
        types: place.types || [],
      }));

      res.json({ results: limitedResults });
    } catch (error: any) {
      console.error("[Places Search] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Search for venues by query string
  app.get("/api/groups/:groupId/search-venues", async (req, res) => {
    try {
      const { query } = req.query;
      const { groupId } = req.params;

      if (!query || typeof query !== 'string' || query.trim().length < 2) {

        return res.json({ results: [] });
      }

      // Get group location for context
      const group = await storage.getGroup(groupId);
      if (!group) {

        return res.status(404).json({ message: "Group not found" });
      }

      // Use Google Places Text Search with group location as context
      const searchQuery = query.trim();
      const location = group.locationBase;
      const radius = group.searchRadius || 10;
      const coordinates = group.latitude && group.longitude
        ? { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) }
        : undefined;

      const results = await searchPlaces(searchQuery, location, radius, coordinates, false, undefined, group.budgetMax, undefined, true, true);

      // Return top 10 results
      const limitedResults = results.slice(0, 10).map(place => ({
        placeId: place.placeId,
        name: place.name,
        address: place.address,
        photoUrl: place.photoUrl,
        rating: place.rating,
        reviewCount: place.reviewCount,
        types: place.types || [],
      }));

      if (limitedResults.length > 0) {

      }

      res.json({ results: limitedResults });
    } catch (error: any) {
      console.error("Error searching venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get group itineraries
  app.get("/api/groups/:groupId/itineraries", async (req, res) => {
    try {
      const itineraries = await storage.getGroupItineraries(req.params.groupId);
      res.json(itineraries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single itinerary (public endpoint for RSVP page)
  app.get("/api/itineraries/:id", async (req, res) => {
    try {
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Handle standalone events (no group)
      if (itinerary.isStandalone || !itinerary.groupId) {
        // For standalone events, get items and invitees
        const items = await db
          .select()
          .from(itineraryItems)
          .where(eq(itineraryItems.itineraryId, itinerary.id))
          .orderBy(itineraryItems.orderIndex);

        const invitees = await storage.getStandaloneEventInvitees(itinerary.id);

        // Get proposed time slots if any
        const timeSlots = await storage.getItineraryTimeSlots(req.params.id);
        const voteCounts = await storage.getItineraryTimeSlotVoteCounts(req.params.id);
        const timeSlotsWithVotes = timeSlots.map((slot) => {
          const counts = voteCounts.find(vc => vc.timeSlotId === slot.id);
          return {
            ...slot,
            yesCount: counts?.yesCount || 0,
            maybeCount: counts?.maybeCount || 0,
            noCount: counts?.noCount || 0,
            yesVoters: counts?.yesVoters || [],
            maybeVoters: counts?.maybeVoters || [],
            noVoters: counts?.noVoters || [],
          };
        });

        return res.json({
          ...itinerary,
          items: items.map(item => ({
            id: item.id,
            venueName: item.venueName,
            venueType: item.venueType,
            venueAddress: item.venueAddress,
            photoUrl: item.photoUrl,
            rating: item.rating,
            googlePlaceId: item.googlePlaceId,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            orderIndex: item.orderIndex,
          })),
          invitees,
          isStandalone: true,
          group: null,
          members: [],
          proposedTimeSlots: timeSlotsWithVotes,
        });
      }

      // Get group information (for group-based events)
      const group = await storage.getGroup(itinerary.groupId);

      // Get group members including organizer (filters out duplicate self-adds)
      const groupMembers = group?.userId
        ? await getGroupMembersWithOrganizer(itinerary.groupId, group.userId)
        : [];

      // Get organizer's RSVP if exists (userId-based, no memberId)
      let organizerRsvp = null;
      if (group?.userId) {
        const organizerRsvps = await db
          .select()
          .from(rsvpsTable)
          .where(
            sql`itinerary_id = ${req.params.id} AND user_id = ${group.userId} AND member_id IS NULL`
          );
        if (organizerRsvps.length > 0) {
          organizerRsvp = {
            response: organizerRsvps[0].response,
            rsvpFeedback: organizerRsvps[0].rsvpFeedback,
          };
        }
      }

      // Get proposed time slots if any
      const timeSlots = await storage.getItineraryTimeSlots(req.params.id);

      // Get vote counts for all time slots
      const voteCounts = await storage.getItineraryTimeSlotVoteCounts(req.params.id);

      // Combine time slots with their vote counts and voter names
      const timeSlotsWithVotes = timeSlots.map((slot) => {
        const counts = voteCounts.find(vc => vc.timeSlotId === slot.id);
        return {
          ...slot,
          yesCount: counts?.yesCount || 0,
          maybeCount: counts?.maybeCount || 0,
          noCount: counts?.noCount || 0,
          yesVoters: counts?.yesVoters || [],
          maybeVoters: counts?.maybeVoters || [],
          noVoters: counts?.noVoters || [],
        };
      });

      res.json({
        ...itinerary,
        group: group,
        members: groupMembers, // Already includes organizer and filters duplicates
        rsvp: organizerRsvp, // Include organizer's RSVP
        proposedTimeSlots: timeSlotsWithVotes,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete itinerary item
  app.delete("/api/itinerary-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const itemId = req.params.id;

      // Get the item to find its itinerary
      const item = await storage.getItineraryItemById(itemId);
      if (!item) {
        return res.status(404).json({ message: "Itinerary item not found" });
      }

      // Delete the item
      await storage.deleteItineraryItem(itemId);

      res.json({ message: "Itinerary item deleted successfully" });
    } catch (error: any) {
      console.error("[Delete Itinerary Item] Error:", error);
      res.status(500).json({ message: error.message || "Failed to delete itinerary item" });
    }
  });

  // Update itinerary item
  app.patch("/api/itinerary-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const itemId = req.params.id;

      // Validate request body
      const validatedData = safeParse(updateItineraryItemSchema, req.body, res);
      if (!validatedData) return;

      // Get the item to verify it exists
      const item = await storage.getItineraryItemById(itemId);
      if (!item) {
        return res.status(404).json({ message: "Itinerary item not found" });
      }

      // Parse date strings to Date objects if provided
      const updates: any = { ...validatedData };
      if (updates.arrivalTime) {
        updates.arrivalTime = new Date(updates.arrivalTime);
      }
      if (updates.departureTime) {
        updates.departureTime = new Date(updates.departureTime);
      }

      // Update the item
      const updatedItem = await storage.updateItineraryItem(itemId, updates);

      res.json(updatedItem);
    } catch (error: any) {
      console.error("[Update Itinerary Item] Error:", error);
      res.status(500).json({ message: error.message || "Failed to update itinerary item" });
    }
  });

  // Add items to an existing itinerary
  app.post("/api/itineraries/:id/items", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(addItineraryItemsSchema, req.body, res);
      if (!validatedData) return;

      const itineraryId = req.params.id;
      const { items } = validatedData;

      // Verify itinerary exists
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Add the items
      const newItems = await storage.addItineraryItems(itineraryId, items);

      res.json(newItems);
    } catch (error: any) {
      console.error("[Add Itinerary Items] Error:", error);
      res.status(500).json({ message: error.message || "Failed to add itinerary items" });
    }
  });

  // Add ad-hoc venue to itinerary
  app.post("/api/itineraries/:id/items/ad-hoc", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(addAdHocVenueSchema, req.body, res);
      if (!validatedData) return;

      const itineraryId = req.params.id;
      let { name, address, googlePlaceId, googleMapsUrl, notes, venueType } = validatedData;

      // Verify itinerary exists (allow both group events and standalone events)
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || (!itinerary.groupId && !itinerary.isStandalone)) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      let latitude: string | null = null;
      let longitude: string | null = null;
      let photoUrl: string | null = null;
      let rating: string | null = null;

      // Handle Google Maps URL parsing
      if (googleMapsUrl) {
        try {
          const parsedPlace = await detectAndParseGoogleMapsUrl(googleMapsUrl);
          if (parsedPlace?.placeId) {
            googlePlaceId = parsedPlace.placeId;
            // Override name if parsed from URL (address not available from URL parsing)
            if (parsedPlace.placeName) name = parsedPlace.placeName;
          } else if (parsedPlace?.type === 'coordinates' && parsedPlace.placeName) {
            // No direct Place ID found, but we have coordinates + name
            // Search for the venue using the name and coordinates
            console.log(`[Add Ad-hoc Venue] Searching for venue "${parsedPlace.placeName}" at coordinates ${parsedPlace.lat}, ${parsedPlace.lng}`);
            const places = await searchPlaces(
              parsedPlace.placeName,
              '', // location string
              2, // radius miles
              { lat: parsedPlace.lat!, lng: parsedPlace.lng! } // coordinates
            );

            if (places.length > 0) {
              // Rank by name similarity to find best match
              const { calculateNameSimilarity } = await import('./google-places');
              const rankedPlaces = places.map(p => ({
                place: p,
                similarity: calculateNameSimilarity(parsedPlace.placeName!, p.name)
              })).sort((a, b) => b.similarity - a.similarity);

              const bestMatch = rankedPlaces[0];
              if (bestMatch.similarity >= 0.5) {
                const topResult = bestMatch.place;
                console.log(`[Add Ad-hoc Venue] Found venue via search: ${topResult.name} (${topResult.placeId}) - ${(bestMatch.similarity * 100).toFixed(0)}% match`);
                googlePlaceId = topResult.placeId;
                name = topResult.name;
                address = topResult.address;
              } else {
                console.warn(`[Add Ad-hoc Venue] Best match "${bestMatch.place.name}" has low similarity (${(bestMatch.similarity * 100).toFixed(0)}%) to "${parsedPlace.placeName}"`);
              }
            } else {
              console.warn(`[Add Ad-hoc Venue] No venues found for "${parsedPlace.placeName}"`);
            }
          } else if (parsedPlace?.type === 'text_search' && parsedPlace.placeName) {
            // Text search needed
            console.log(`[Add Ad-hoc Venue] Searching for venue "${parsedPlace.placeName}"`);
            const places = await searchPlaces(parsedPlace.placeName, '');

            if (places.length > 0) {
              // Rank by name similarity to find best match
              const { calculateNameSimilarity } = await import('./google-places');
              const rankedPlaces = places.map(p => ({
                place: p,
                similarity: calculateNameSimilarity(parsedPlace.placeName!, p.name)
              })).sort((a, b) => b.similarity - a.similarity);

              const bestMatch = rankedPlaces[0];
              if (bestMatch.similarity >= 0.5) {
                const topResult = bestMatch.place;
                console.log(`[Add Ad-hoc Venue] Found venue via search: ${topResult.name} (${topResult.placeId}) - ${(bestMatch.similarity * 100).toFixed(0)}% match`);
                googlePlaceId = topResult.placeId;
                name = topResult.name;
                address = topResult.address;
              } else {
                console.warn(`[Add Ad-hoc Venue] Best match "${bestMatch.place.name}" has low similarity (${(bestMatch.similarity * 100).toFixed(0)}%) to "${parsedPlace.placeName}"`);
              }
            }
          }
        } catch (error) {
          console.error('[Add Ad-hoc Venue] Error parsing Google Maps URL:', error);
          // Continue with manual address if URL parsing fails
        }
      }

      // Fetch Google Places details if placeId is provided
      if (googlePlaceId) {
        try {
          // Import validation function
          const { validateVenuePlaceId } = await import('./google-places');

          // Validate that Place ID matches expected venue name
          const validation = await validateVenuePlaceId(name, googlePlaceId);

          // Log validation warnings
          if (validation.warnings.length > 0) {
            console.warn('[Add Ad-hoc Venue] Venue validation warnings:', {
              expectedName: name,
              placeId: googlePlaceId,
              actualName: validation.placeDetails?.name,
              confidence: validation.confidence,
              warnings: validation.warnings
            });
          }

          // Reject if validation failed with low confidence
          if (!validation.isValid) {
            console.error('[Add Ad-hoc Venue] Venue validation FAILED:', validation.warnings);
            return res.status(400).json({
              message: 'Venue validation failed',
              errors: validation.warnings,
              suggestion: `The Place ID appears to point to "${validation.placeDetails?.name}" instead of "${name}". Please verify the correct venue.`
            });
          }

          const placeDetails = validation.placeDetails;
          if (placeDetails) {
            // Use Google Places data to enrich the venue
            if (!address) address = placeDetails.address;
            if (!venueType && placeDetails.types && placeDetails.types.length > 0) {
              venueType = await getBestVenueType(placeDetails.types, placeDetails.placeId);
            }
            if (placeDetails.location) {
              latitude = placeDetails.location.lat.toString();
              longitude = placeDetails.location.lng.toString();
            }
            if (placeDetails.photoUrl) photoUrl = placeDetails.photoUrl;
            if (placeDetails.rating) rating = placeDetails.rating.toString();
          }
        } catch (error) {
          console.error('[Add Ad-hoc Venue] Error fetching place details:', error);
          // Continue with provided data if Google Places fetch fails
        }
      }

      // Geocode manual address if no coordinates yet
      if (address && !latitude && !longitude) {
        try {
          const geocoded = await geocodeLocation(address);
          if (geocoded) {
            latitude = geocoded.latitude.toString();
            longitude = geocoded.longitude.toString();
          }
        } catch (error) {
          console.error('[Add Ad-hoc Venue] Error geocoding address:', error);
          // Continue without coordinates if geocoding fails
        }
      }

      // Add the ad-hoc venue to itinerary
      const newItem = await storage.addAdHocVenueToItinerary(itineraryId, {
        venueName: name,
        venueAddress: address || '',
        venueType: venueType || 'venue',
        googlePlaceId: googlePlaceId || null,
        latitude,
        longitude,
        notes: notes || null,
        googleMapsUrl: googleMapsUrl || null,
        arrivalTime: null,
        departureTime: null,
        travelNotes: null,
        rating,
        photoUrl,
      });

      res.json(newItem);
    } catch (error: any) {
      console.error("[Add Ad-hoc Venue] Error:", error);
      res.status(500).json({ message: error.message || "Failed to add ad-hoc venue" });
    }
  });

  // Update itinerary (for editing saved itineraries)
  app.patch("/api/itineraries/:id", isAuthenticated, async (req, res) => {
    try {
      const updates = req.body;
      const itineraryId = req.params.id;
      
      // If proposedOrder is being updated, handle item deletion and reordering
      if (updates.proposedOrder) {
        const currentItinerary = await storage.getItinerary(itineraryId);
        if (currentItinerary) {
          const newSourceIds = new Set(updates.proposedOrder);
          const itemsToDelete = currentItinerary.items.filter(
            (item: ItineraryItem) => !newSourceIds.has(item.sourceId)
          );
          
          // Delete items that are no longer in the proposed order
          for (const item of itemsToDelete) {
            await storage.deleteItineraryItem(item.id);
          }
          
          // Map sourceIds to item IDs for ordering
          const sourceIdToItemId = new Map(
            currentItinerary.items.map((item: ItineraryItem) => [item.sourceId, item.id])
          );
          const orderedItemIds = updates.proposedOrder
            .map((sourceId: string) => sourceIdToItemId.get(sourceId))
            .filter((id: string | undefined) => id !== undefined);
          
          // Update the order indices
          await storage.updateItineraryItemOrder(itineraryId, orderedItemIds);
        }
        
        // Remove proposedOrder from updates since it's already handled
        // (database expects item IDs, but updates contains source IDs)
        delete updates.proposedOrder;
      }
      
      // Convert eventDate string to Date object if present
      // (drizzle-zod expects Date objects for timestamp fields)
      if (updates.eventDate && typeof updates.eventDate === 'string') {
        updates.eventDate = new Date(updates.eventDate);
      }
      
      const itinerary = await storage.updateItinerary(itineraryId, updates);
      res.json(itinerary);
    } catch (error: any) {
      console.error("[Update Itinerary] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update itinerary item order
  app.patch("/api/itineraries/:id/order", isAuthenticated, async (req, res) => {
    try {
      const { proposedOrder } = req.body; // Array of item IDs in new order
      const itineraryId = req.params.id;

      // Verify the itinerary exists
      const currentItinerary = await storage.getItinerary(itineraryId);
      if (!currentItinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Validate that all provided IDs belong to this itinerary
      const validItemIds = new Set(currentItinerary.items.map((item: ItineraryItem) => item.id));
      const orderedItemIds = proposedOrder.filter((id: string) => validItemIds.has(id));

      // Update the order indices in the database
      await storage.updateItineraryItemOrder(itineraryId, orderedItemIds);

      // Return updated itinerary with items in new order
      const updatedItinerary = await storage.getItinerary(itineraryId);
      res.json(updatedItinerary);
    } catch (error: any) {
      console.error("[Update Order] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete itinerary
  app.delete("/api/itineraries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const itineraryId = req.params.id;
      const userId = await getUserId(req);
      
      // Get the itinerary and verify authorization
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }
      
      // Get the group to check ownership
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Only the group owner can delete itineraries
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this itinerary" });
      }

      // Track rejected date if the itinerary has an event date
      if (itinerary.eventDate) {
        try {
          await db.insert(rejectedEventDates).values({
            groupId: itinerary.groupId,
            rejectedDate: itinerary.eventDate,
            reason: 'user_deleted',
            sourceType: 'itinerary',
            sourceId: itineraryId,
          });
          console.log(`[Rejected Dates] Tracked rejected date for group ${itinerary.groupId}: ${itinerary.eventDate}`);
        } catch (error) {
          console.error('[Rejected Dates] Error tracking rejected date:', error);
          // Don't fail the delete if tracking fails
        }
      }

      // Send cancellation notifications if this was a proposed/scheduled event (not a draft)
      if (itinerary.status === 'proposed' || itinerary.status === 'scheduled') {
        try {
          const groupMembers = await storage.getGroupMembers(itinerary.groupId);
          const memberIds = groupMembers.map(m => m.id);

          // Get the first venue name if available
          const firstVenueName = itinerary.items && itinerary.items.length > 0
            ? itinerary.items[0].venueName
            : null;

          const { notifyEventCancelled } = await import('./notifications');
          await notifyEventCancelled({
            itineraryId,
            groupId: itinerary.groupId,
            eventName: itinerary.name || 'Upcoming Event',
            groupName: group.name,
            memberIds,
            eventDate: itinerary.eventDate,
            venueName: firstVenueName
          });
        } catch (notifyError) {
          console.error('[Notifications] Error sending cancellation notifications:', notifyError);
          // Don't fail the delete if notifications fail
        }
      }

      await storage.deleteItinerary(itineraryId);
      res.json({ message: "Itinerary deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // AI Suggestions for Event Editing
  // ============================================================================

  /**
   * Get AI-powered venue suggestions for an event
   * - alternatives: Better venues to replace a current one
   * - complements: Venues that pair well with existing itinerary
   */
  app.post("/api/itineraries/:id/ai-suggestions", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      const itineraryId = req.params.id;
      const { venueId, suggestionType = 'alternatives' } = req.body;

      // Get the itinerary
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Need group context for AI suggestions
      if (!itinerary.groupId) {
        return res.status(400).json({ message: "AI suggestions require group context" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Import scoring utilities
      const { calculateVenueScore, getVisitStats: getVisitStatsUtil, shouldSkipVenue, calculateQualityScore, calculateVotingEventQuality } = await import('./venue-scoring-utils');
      const { suggestAlternativesWithAgent, suggestComplementsWithAgent } = await import('./ai-event-agent');
      const { getVenueVisitStats } = await import('./auto-scheduler');

      // Get all available venues (activities + voting events)
      const activities = await storage.getGroupActivities(group.id);
      const votingEvents = await storage.getGroupVotingEvents(group.id);

      console.log(`[AI Suggestions] Found ${activities.length} activities, ${votingEvents.length} favorites for group "${group.name}"`);

      // Get visit history
      const visitStats = await getVenueVisitStats(group.id);

      // Score all venues - use any[] and let the agent functions handle typing
      const scoredVenues: any[] = [];

      // Score activities
      for (const activity of activities) {
        if (shouldSkipVenue(activity.businessStatus, activity.feedback)) continue;

        const qualityScore = calculateQualityScore(activity.feedback);
        const stats = visitStats.find((v: any) => v.activityId === activity.id);
        const { visitCount, daysSinceLastVisit } = getVisitStatsUtil(stats);
        const score = calculateVenueScore(qualityScore, visitCount, daysSinceLastVisit);

        scoredVenues.push({
          type: 'activity',
          id: activity.id,
          name: activity.venueName,
          score,
          visitCount,
          daysSinceLastVisit,
          qualityScore,
          feedback: activity.feedback,
          category: activity.category,
          timeCategory: activity.timeCategory,
          venueType: activity.venueType,
          rating: activity.rating,
          venueAddress: activity.venueAddress,
          googlePlaceId: activity.googlePlaceId,
          latitude: activity.latitude,
          longitude: activity.longitude,
        });
      }

      // Score voting events (favorites)
      const voteCounts = await Promise.all(
        votingEvents.map(async (ve) => {
          const votes = await storage.getEventVotes(ve.id);
          const upvotes = votes.filter((v: any) => v.voteType === 'upvote').length;
          const downvotes = votes.filter((v: any) => v.voteType === 'downvote').length;
          return { id: ve.id, upvotes, downvotes, netVotes: upvotes - downvotes };
        })
      );

      for (const votingEvent of votingEvents) {
        const voteCount = voteCounts.find(vc => vc.id === votingEvent.id);
        const upvotes = voteCount?.upvotes || 0;
        const downvotes = voteCount?.downvotes || 0;

        const qualityScore = calculateVotingEventQuality(upvotes, downvotes);
        if (qualityScore === -1) continue; // Skip net-downvoted

        const stats = visitStats.find((v: any) => v.votingEventId === votingEvent.id);
        const { visitCount, daysSinceLastVisit } = getVisitStatsUtil(stats);
        const score = calculateVenueScore(qualityScore, visitCount, daysSinceLastVisit);

        scoredVenues.push({
          type: 'voting_event',
          id: votingEvent.id,
          name: votingEvent.title,
          score,
          visitCount,
          daysSinceLastVisit,
          qualityScore,
          venueType: votingEvent.venueType || undefined,
          rating: votingEvent.rating || undefined,
          venueAddress: votingEvent.venueAddress || undefined,
          googlePlaceId: votingEvent.googlePlaceId || undefined,
          latitude: votingEvent.latitude,
          longitude: votingEvent.longitude,
        });
      }

      // Sort by score descending
      scoredVenues.sort((a, b) => b.score - a.score);

      console.log(`[AI Suggestions] ${scoredVenues.length} scored venues available`);

      // Prepare event date (use itinerary date or default to now)
      const eventDate = itinerary.eventDate ? new Date(itinerary.eventDate) : new Date();

      // Find current venue if venueId provided
      let currentVenue: VenueForAgent | undefined;
      if (venueId) {
        currentVenue = scoredVenues.find(v => v.id === venueId);
      }

      // Get existing venues in itinerary (for complements)
      const existingVenues: VenueForAgent[] = [];
      if (itinerary.items && itinerary.items.length > 0) {
        for (const item of itinerary.items) {
          const found = scoredVenues.find(v => v.id === item.sourceId);
          if (found) existingVenues.push(found);
        }
      }

      // Call the appropriate agent function
      const result: { alternatives?: any[]; complements?: any[] } = {};

      if (suggestionType === 'alternatives' || suggestionType === 'both') {
        const alternatives = await suggestAlternativesWithAgent({
          group,
          eventDate,
          availableVenues: scoredVenues,
          currentVenue,
        });
        result.alternatives = alternatives.map(s => ({
          venue: {
            id: s.venue.id,
            name: s.venue.name,
            type: s.venue.type,
            venueType: s.venue.venueType,
            rating: s.venue.rating,
            address: s.venue.venueAddress,
            googlePlaceId: s.venue.googlePlaceId,
            latitude: s.venue.latitude,
            longitude: s.venue.longitude,
          },
          confidence: s.confidence,
          category: s.category,
          replaces: currentVenue?.name,
        }));
      }

      if (suggestionType === 'complements' || suggestionType === 'both') {
        const complements = await suggestComplementsWithAgent({
          group,
          eventDate,
          availableVenues: scoredVenues,
          existingVenues,
        });
        result.complements = complements.map(s => ({
          venue: {
            id: s.venue.id,
            name: s.venue.name,
            type: s.venue.type,
            venueType: s.venue.venueType,
            rating: s.venue.rating,
            address: s.venue.venueAddress,
            googlePlaceId: s.venue.googlePlaceId,
            latitude: s.venue.latitude,
            longitude: s.venue.longitude,
          },
          confidence: s.confidence,
          category: s.category,
        }));
      }

      res.json(result);
    } catch (error: any) {
      console.error("[AI Suggestions] Error:", error);
      res.status(500).json({ message: error.message || "Failed to get AI suggestions" });
    }
  });

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
  app.post("/api/itineraries/:id/ai-chat", isAuthenticated, aiChatLimiter, requireItineraryAccess(), async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const itineraryId = req.params.id;
      const { prompt, sessionId, stream = false } = req.body;

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (prompt.length > 2000) {
        return res.status(400).json({ error: "Prompt too long (max 2000 characters)" });
      }

      // Check for Anthropic API key
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ error: "AI chat is not configured. Please add ANTHROPIC_API_KEY to environment secrets." });
      }

      // Get itinerary (already verified by requireItineraryAccess)
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
        return res.status(404).json({ error: "Itinerary not found" });
      }

      // Fetch group data to provide context to the AI
      let groupContext = null;
      if (itinerary.groupId) {
        const group = await storage.getGroup(itinerary.groupId);
        if (group) {
          const enabledCategories: string[] = [];
          if (group.mealEnabled !== false) enabledCategories.push('meals');
          if (group.cafeEnabled !== false) enabledCategories.push('cafes');
          if (group.drinksEnabled !== false) enabledCategories.push('drinks');
          if (group.dessertEnabled !== false) enabledCategories.push('dessert');
          if (group.experiencesEnabled !== false) enabledCategories.push('experiences');

          groupContext = {
            name: group.name,
            locationBase: group.locationBase,
            latitude: group.latitude,
            longitude: group.longitude,
            searchRadius: group.searchRadius,
            budgetMin: group.budgetMin,
            budgetMax: group.budgetMax,
            enabledCategories,
            additionalInstructions: group.additionalInstructions,
            timezone: group.timezone
          };
        }
      }

      // Import the agent module
      const { runEventPlanningAgent, streamEventPlanningAgent } = await import("./ai-agent-chat");

      const agentOptions = {
        prompt,
        itineraryId,
        groupId: itinerary.groupId,
        groupContext,
        sessionId
      };

      if (stream) {
        // Set up Server-Sent Events for streaming
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const result = await streamEventPlanningAgent(agentOptions, (chunk) => {
          res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
        });

        // Send final message
        res.write(`data: ${JSON.stringify({
          type: "done",
          sessionId: result.sessionId,
          toolsUsed: result.toolsUsed
        })}\n\n`);
        res.end();
      } else {
        // Non-streaming response
        const result = await runEventPlanningAgent(agentOptions);

        res.json({
          response: result.response,
          sessionId: result.sessionId,
          toolsUsed: result.toolsUsed
        });
      }
    } catch (error: any) {
      console.error("[AI Chat] Error:", error);

      // Handle streaming errors
      if (req.body?.stream) {
        res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: error.message || "Failed to communicate with AI assistant" });
      }
    }
  });

  // Create a new itinerary (used for TBD events on dashboard)
  app.post("/api/itineraries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      console.log('[Create Itinerary] Received request body:', JSON.stringify(req.body, null, 2));

      // Convert eventDate string to Date object if provided (drizzle-zod expects Date objects)
      const bodyWithDateConversion = { ...req.body };
      if (bodyWithDateConversion.eventDate && typeof bodyWithDateConversion.eventDate === 'string') {
        bodyWithDateConversion.eventDate = new Date(bodyWithDateConversion.eventDate);
      }

      // Validate request body
      const validatedData = safeParse(insertItinerarySchema, bodyWithDateConversion, res);
      if (!validatedData) {
        console.log('[Create Itinerary] Validation failed for body:', JSON.stringify(req.body, null, 2));
        return;
      }

      console.log('[Create Itinerary] Creating new itinerary:', {
        groupId: validatedData.groupId,
        name: validatedData.name,
        status: validatedData.status,
        eventDate: validatedData.eventDate
      });

      // Verify user has access to the group
      const groupId = validatedData.groupId;
      if (!groupId) {
        return res.status(400).json({ message: "Group ID is required" });
      }
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if user is member of the group
      const groupMembers = await storage.getGroupMembers(groupId);
      const isMember = groupMembers.some(m => m.userId === userId);
      const isOwner = group.userId === userId;

      if (!isMember && !isOwner) {
        return res.status(403).json({ message: "You must be a member of this group to create itineraries" });
      }

      // Create itinerary with no items initially (items can be added later via decide-now)
      const itinerary = await storage.createItinerary(
        validatedData,
        userId,
        [] // Empty items array - will be populated by decide-now
      );

      console.log('[Create Itinerary] ✅ Created itinerary:', itinerary.id);

      res.json(itinerary);
    } catch (error: any) {
      console.error('[Create Itinerary] Error:', error);
      res.status(500).json({
        message: error.message || "Couldn't create itinerary. Mind giving it another try?"
      });
    }
  });

  // Auto-populate TBD event with AI-selected venues
  app.post("/api/itineraries/:id/decide-now", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      const itineraryId = req.params.id;
      const userId = await getUserId(req);

      console.log('');
      console.log('🎯 ========================================');
      console.log('🎯 DECIDE NOW ENDPOINT CALLED!');
      console.log('🎯 Itinerary ID:', itineraryId);
      console.log('🎯 User ID:', userId);
      console.log('🎯 ========================================');
      console.log('');
      console.log('[Decide Now] Starting venue selection for itinerary:', itineraryId);

      // Get the itinerary
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Get the group
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Use the existing auto-scheduler logic to select best venues
      const { selectBestItineraryForAutoSchedule } = await import('./auto-scheduler');

      const result = await selectBestItineraryForAutoSchedule(
        storage,
        group
      );

      // For backwards compatibility, support both options and itineraryOptions
      const itineraryOptions = result.options || result.itineraryOptions || [];

      if (!result || itineraryOptions.length === 0) {
        return res.status(500).json({
          message: "Hmm, we're struggling to find suitable venues for this one. While we think about it, feel free to manually add some spots you have in mind!"
        });
      }

      const usedAI = result.usedAI !== false; // Default to true if not specified

      console.log('[Decide Now] Venue selection complete:', {
        usedAI,
        optionCount: itineraryOptions.length,
        topOptionVenues: itineraryOptions[0]?.venues.length || 0
      });

      // Get the top option (best selected itinerary)
      const topOption = itineraryOptions[0];

      if (!topOption || !topOption.venues || topOption.venues.length === 0) {
        return res.status(500).json({
          message: "No suitable venues found. Try adding more activities or favorites to this group."
        });
      }

      // Create itinerary items from the selected venues
      const items = topOption.venues.map((venue: any, index: number) => ({
        itineraryId,
        venueName: venue.venueName,
        venueType: venue.venueType || venue.category || 'venue',
        venueAddress: venue.venueAddress || venue.address,
        photoUrl: venue.photoUrl,
        rating: venue.rating,
        googlePlaceId: venue.googlePlaceId || venue.placeId,
        notes: venue.reasoning || null,
        googleMapsUrl: venue.googleMapsUrl || venue.mapsUrl ||
          (venue.googlePlaceId ? `https://www.google.com/maps/place/?q=place_id:${venue.googlePlaceId}` : null),
        sourceType: venue.sourceType || 'activity',
        sourceId: venue.sourceId || venue.activityId || venue.votingEventId,
        orderIndex: index,
        arrivalTime: null,
        departureTime: null,
        travelNotes: null,
      }));

      // Clear existing items and add new ones
      const existingItems = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itineraryId));

      if (existingItems.length > 0) {
        await db
          .delete(itineraryItems)
          .where(eq(itineraryItems.itineraryId, itineraryId));
      }

      // Insert new items
      await db.insert(itineraryItems).values(items);

      // Update itinerary name if it's generic
      const itineraryName = itinerary.name || '';
      if (itineraryName.includes('Auto-scheduled') || itineraryName.includes('TBD')) {
        const venueSummary = items.map((v: any) => v.venueName).join(', ');
        const newName = items.length === 0
          ? 'Event'
          : items.length === 1
            ? items[0].venueName
            : `${items[0].venueName} + ${items.length - 1} more`;

        await storage.updateItinerary(itineraryId, {
          name: newName.length > 100 ? newName.substring(0, 97) + '...' : newName
        });
      }

      console.log('[Decide Now] Successfully populated', items.length, 'venues');

      // Return the updated itinerary with items
      const updatedItinerary = await storage.getItinerary(itineraryId);
      const updatedItems = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, itineraryId))
        .orderBy(itineraryItems.orderIndex);

      // Friendly messages based on selection method
      let successMessage: string;
      if (usedAI) {
        successMessage = `AI selected ${items.length} venue${items.length > 1 ? 's' : ''} for your event`;
      } else {
        successMessage = "We had trouble getting AI's picks this time, so we went with our backup venue selection! Feel free to regenerate if you want AI to take another shot.";
      }

      res.json({
        itinerary: updatedItinerary,
        items: updatedItems,
        venueCount: items.length,
        reasoning: topOption.reasoning || topOption.description || 'Selected venues based on your group preferences and visit history',
        usedAI,
        message: successMessage,
      });

    } catch (error: any) {
      console.error('[Decide Now] Error:', error);
      console.error('[Decide Now] Error stack:', error.stack);
      console.error('[Decide Now] Error details:', {
        message: error.message,
        itineraryId: req.params.id,
        errorType: error.constructor.name
      });
      res.status(500).json({
        message: error.message || "We hit a snag. Mind giving it another try?",
        errorDetails: error.message
      });
    }
  });

  // ========== TIME SLOT MANAGEMENT ==========

  // Get time slots for an itinerary
  app.get("/api/itineraries/:itineraryId/time-slots", async (req: any, res) => {
    try {
      const { itineraryId } = req.params;
      const timeSlots = await storage.getItineraryTimeSlots(itineraryId);
      const voteCounts = await storage.getItineraryTimeSlotVoteCounts(itineraryId);
      
      let userId = null;
      if (req.user) {
        userId = await getUserId(req);
      }
      
      const timeSlotsWithVotes = await Promise.all(timeSlots.map(async slot => {
        const userVote = userId ? await storage.getUserTimeSlotVote(slot.id, userId) : null;
        const counts = voteCounts.find(vc => vc.timeSlotId === slot.id);
        return {
          ...slot,
          yesCount: counts?.yesCount || 0,
          maybeCount: counts?.maybeCount || 0,
          noCount: counts?.noCount || 0,
          yesVoters: counts?.yesVoters || [],
          maybeVoters: counts?.maybeVoters || [],
          noVoters: counts?.noVoters || [],
          userVoteType: userVote?.voteType || null,
          userHasVoted: !!userVote,
        };
      }));
      
      res.json(timeSlotsWithVotes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create time slots for an itinerary (organizer only)
  app.post("/api/itineraries/:itineraryId/time-slots", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      const { itineraryId } = req.params;
      const { timeSlots } = req.body; // Array of { proposedDateTime, label }
      const userId = await getUserId(req);
      
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }
      
      const group = await storage.getGroup(itinerary.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only the group organizer can add time slots" });
      }
      
      const timeSlotsToCreate = timeSlots.map((slot: any) => ({
        itineraryId,
        proposedDateTime: new Date(slot.proposedDateTime),
        label: slot.label || null,
        isSelected: false,
      }));
      
      const created = await storage.createProposedTimeSlots(timeSlotsToCreate);
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Vote for a time slot
  app.post("/api/time-slots/:timeSlotId/vote", async (req: any, res) => {
    try {
      const { timeSlotId } = req.params;
      const { memberId, memberName, voteType = "yes" } = req.body;

      // Validate voteType
      if (!["yes", "maybe", "no"].includes(voteType)) {
        return res.status(400).json({ message: "voteType must be 'yes', 'maybe', or 'no'" });
      }

      let userId = null;
      if (req.user) {
        userId = await getUserId(req);
      }

      if (!userId && !memberId) {
        return res.status(400).json({ message: "Either userId or memberId is required" });
      }

      // Validate that the time slot exists and get its itinerary
      const timeSlot = await storage.getTimeSlot(timeSlotId);
      if (!timeSlot) {
        return res.status(404).json({ message: "Time slot not found" });
      }

      const itinerary = await storage.getItinerary(timeSlot.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Validate memberId belongs to this group
      if (memberId) {
        const member = await storage.getMember(memberId);
        if (!member || member.groupId !== itinerary.groupId) {
          return res.status(403).json({ message: "Member does not belong to this group" });
        }
      }

      const vote = await storage.voteForTimeSlot({
        timeSlotId,
        userId,
        memberId,
        memberName: memberName || null,
        voteType,
      });

      res.json(vote);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Remove vote for a time slot
  app.delete("/api/time-slots/:timeSlotId/vote", async (req: any, res) => {
    try {
      const { timeSlotId } = req.params;

      let userId: string | undefined = undefined;
      let memberId: string | undefined = undefined;

      if (req.user) {
        userId = await getUserId(req);
      } else if (req.body.memberId) {
        memberId = req.body.memberId;
      }

      if (!userId && !memberId) {
        return res.status(400).json({ message: "Either userId or memberId is required" });
      }

      // Validate that the time slot exists and get its itinerary
      const timeSlot = await storage.getTimeSlot(timeSlotId);
      if (!timeSlot) {
        return res.status(404).json({ message: "Time slot not found" });
      }

      const itinerary = await storage.getItinerary(timeSlot.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Validate memberId belongs to this group
      if (memberId) {
        const member = await storage.getMember(memberId);
        if (!member || member.groupId !== itinerary.groupId) {
          return res.status(403).json({ message: "Member does not belong to this group" });
        }
      }

      await storage.removeTimeSlotVote(timeSlotId, userId, memberId);
      res.json({ message: "Vote removed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Select a time slot (organizer only)
  app.patch("/api/time-slots/:timeSlotId/select", isAuthenticated, async (req: any, res) => {
    try {
      const { timeSlotId } = req.params;
      const userId = await getUserId(req);
      
      const timeSlot = await storage.getTimeSlot(timeSlotId);
      if (!timeSlot) {
        return res.status(404).json({ message: "Time slot not found" });
      }
      
      const itinerary = await storage.getItinerary(timeSlot.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Allow group owner OR event host to select time slot
      const isOwner = group.userId === userId;
      let isHost = false;

      if (itinerary.hostMemberId) {
        const members = await storage.getGroupMembers(itinerary.groupId);
        const hostMember = members.find(m => m.id === itinerary.hostMemberId);
        isHost = hostMember?.userId === userId;
      }

      if (!isOwner && !isHost) {
        return res.status(403).json({ message: "Only the group organizer or event host can select a time slot" });
      }
      
      const updated = await storage.updateTimeSlotSelection(timeSlotId, true);
      
      await storage.updateItinerary(itinerary.id, {
        eventDate: updated.proposedDateTime,
      });
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get saved itineraries for a group
  app.get("/api/groups/:groupId/saved-itineraries", async (req, res) => {
    try {
      const savedItineraries = await storage.getSavedItineraries(req.params.groupId);
      res.json(savedItineraries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Save an itinerary (creates a copy so the draft remains editable)
  app.post("/api/itineraries/:id/save", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(saveItinerarySchema, req.body, res);
      if (!validatedData) return;

      let { name, timingRecommendations } = validatedData;
      const userId = await getUserId(req);
      
      // Get the original itinerary with items
      const original = await storage.getItinerary(req.params.id);
      if (!original || !original.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Get the group to access location
      const group = await storage.getGroup(original.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Auto-generate name if not provided
      if (!name || name.trim() === '') {
        const { generateItineraryName } = await import('./ai-itinerary-naming');
        const venuesForNaming = original.items.map((item: ItineraryItem) => ({
          name: item.venueName || 'Venue',
          type: item.venueType || 'Activity'
        }));
        
        name = await generateItineraryName(venuesForNaming, group.locationBase);
        console.log('[Save Itinerary] AI generated name:', name);
      }

      // Create a duplicate itinerary marked as saved
      const itemsData = original.items
        .filter((item: ItineraryItem) => item.sourceId)
        .map((item: ItineraryItem) => ({
          sourceType: item.sourceType as 'activity' | 'voting_event',
          sourceId: item.sourceId!
        }));

      const savedItinerary = await storage.createItinerary(
        {
          groupId: original.groupId,
          name,
          status: 'saved',
          isSaved: true,
          aiValidationNotes: original.aiValidationNotes,
          timingRecommendations: (timingRecommendations || null) as any,
          proposedOrder: original.proposedOrder as any,
        },
        userId,
        itemsData
      );

      // Delete the original draft since we now have a saved copy
      await storage.deleteItinerary(req.params.id);

      res.json(savedItinerary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Duplicate a saved itinerary to create an editable draft copy
  app.post("/api/itineraries/:id/duplicate", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      
      // Get the original itinerary with items
      const original = await storage.getItinerary(req.params.id);
      if (!original || !original.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Get the group to check ownership
      const group = await storage.getGroup(original.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Verify user is the group owner
      if (group.userId !== userId) {
        return res.status(403).json({ message: "You do not have permission to duplicate this itinerary" });
      }

      // Create a duplicate as a draft
      const itemsData = original.items
        .filter((item: ItineraryItem) => item.sourceId)
        .map((item: ItineraryItem) => ({
          sourceType: item.sourceType as 'activity' | 'voting_event',
          sourceId: item.sourceId!
        }));

      const duplicatedItinerary = await storage.createItinerary(
        {
          groupId: original.groupId,
          name: `${original.name || 'Itinerary'} (Copy)`,
          status: 'draft',
          isSaved: false,
          aiValidationNotes: original.aiValidationNotes,
          proposedOrder: original.proposedOrder as any,
        },
        userId,
        itemsData
      );

      res.json(duplicatedItinerary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get AI-suggested time for an itinerary
  app.post("/api/itineraries/:id/suggest-time", isAuthenticated, async (req, res) => {
    try {
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Get member constraints if any
      const members = await storage.getGroupMembers(group.id);
      const memberConstraints = members
        .filter(m => m.memberConstraints)
        .map(m => {
          const constraints = m.memberConstraints;
          const parts: string[] = [];
          if (constraints && typeof constraints === 'object' && 'scheduleConflicts' in constraints) {
            const sc = (constraints as {scheduleConflicts?: string[]}).scheduleConflicts;
            if (sc) parts.push(`Not available ${sc.join(', ')}`);
          }
          if (constraints && typeof constraints === 'object' && 'notes' in constraints) {
            const notes = (constraints as {notes?: string}).notes;
            if (notes) parts.push(notes);
          }
          return parts.join('; ');
        })
        .filter(Boolean);

      // Prepare venues for AI
      // Prefer venues from request body (current cart state) over saved itinerary venues
      let venues;
      if (req.body.venues && Array.isArray(req.body.venues) && req.body.venues.length > 0) {
        venues = req.body.venues;

      } else {
        venues = itinerary.items.map((item: ItineraryItem) => ({
          name: item.venueName,
          type: item.venueType,
        }));

      }

      const { suggestMultipleTimeOptions, convertAvailabilityToString } = await import('./ai-time-picker');
      
      // Convert availability object to natural language string
      const availabilityString = convertAvailabilityToString(group.availability);

      const result = await suggestMultipleTimeOptions({
        generalAvailability: availabilityString,
        venues,
        memberConstraints: memberConstraints.length > 0 ? memberConstraints : undefined,
        location: group.locationBase, // Pass location for timezone detection
      });

      res.json(result);
    } catch (error: any) {
      console.error('[Suggest Time] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Send an itinerary as a proposal to the group
  app.post("/api/itineraries/:id/send", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(sendItinerarySchema, req.body, res);
      if (!validatedData) return;

      const { isPrimary, eventDate, eventDates, autoScheduleConfig } = validatedData;
      const userId = await getUserId(req);
      
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Handle multiple event dates by creating proposed time slots
      if (eventDates && Array.isArray(eventDates) && eventDates.length > 1) {
        console.log(`[Send Itinerary Multi-Date] Creating 1 event with ${eventDates.length} time slot options`);
        
        // Update the itinerary to proposed status with the first date as the primary eventDate
        const firstDate = new Date(eventDates[0]);
        const updates: UpdateItinerary = {
          status: 'proposed',
          eventDate: firstDate,
          isPrimary: isPrimary || false,
        };
        
        await storage.updateItinerary(req.params.id, updates);
        
        // Delete any existing time slots to prevent duplicates (in case of retry/resubmit)
        await db
          .delete(proposedTimeSlots)
          .where(eq(proposedTimeSlots.itineraryId, req.params.id));
        
        // Create proposed time slots for each date option
        for (const dateStr of eventDates) {
          await storage.createProposedTimeSlot({
            itineraryId: req.params.id,
            proposedDateTime: new Date(dateStr),
          });
        }
        
        // Delete existing invites (in case of retry)
        await db
          .delete(itineraryInvites)
          .where(eq(itineraryInvites.itineraryId, req.params.id));
        
        // Create invites for members
        const members = await storage.getGroupMembers(group.id);
        console.log(`[Send Itinerary Multi-Date] Found ${members.length} members for group ${group.id}`);
        
        for (const member of members) {
          const inviteToken = crypto.randomUUID();

          await db.insert(itineraryInvites).values({
            itineraryId: req.params.id,
            memberId: member.id,
            inviteToken,
          });
        }

        // Send in-app notifications to all invited members
        try {
          await notifyEventInvite({
            itineraryId: req.params.id,
            groupId: group.id,
            eventName: itinerary.name || 'New Event',
            memberIds: members.map(m => m.id),
          });
        } catch (notifError) {
          console.error('[Send Itinerary Multi-Date] Failed to send notifications:', notifError);
        }

        console.log(`[Send Itinerary Multi-Date] Created 1 event with ${eventDates.length} time options for members to vote on`);
        
        // Return the updated itinerary
        const updatedItinerary = await storage.getItinerary(req.params.id);
        return res.json(updatedItinerary);
      }

      const updates: UpdateItinerary = {
        status: 'proposed',
        isPrimary: isPrimary || false,
      };

      // If event date is provided, set it up and send invites
      if (eventDate) {
        const date = new Date(eventDate);

        // Use adaptive timeline if no config provided
        let scheduleConfig: import('./adaptive-timeline').AdaptiveScheduleConfig;
        if (autoScheduleConfig) {
          // Use provided config if specified - add defaults for required fields
          const { calculateAdaptiveTimeline } = await import('./adaptive-timeline');
          const defaultConfig = calculateAdaptiveTimeline(date, new Date());
          scheduleConfig = {
            ...defaultConfig,
            ...autoScheduleConfig,
          };
        } else {
          // Calculate adaptive timeline based on event date
          const { calculateAdaptiveTimeline } = await import('./adaptive-timeline');
          scheduleConfig = calculateAdaptiveTimeline(date, new Date());
        }
        console.log(`[Send Itinerary] Using ${scheduleConfig.timelineType} timeline: ${scheduleConfig.reasoning}`);

        // Calculate RSVP deadline based on timeline config
        const { calculateRsvpDeadline } = await import('./adaptive-timeline');
        const rsvpDeadline = calculateRsvpDeadline(date, scheduleConfig);

        updates.eventDate = date;
        updates.rsvpDeadline = rsvpDeadline;
        updates.autoScheduleConfig = scheduleConfig;
        updates.inviteSentAt = new Date();

        // Send initial invite emails immediately
        const members = await storage.getGroupMembers(group.id);

        console.log(`[Send Itinerary] Found ${members.length} members for group ${group.id}`);

        // Create itinerary-specific invite tokens for each member
        const memberInvites = new Map<string, string>(); // memberId -> inviteToken

        // Always create a generic shareable invite (memberId = null)
        // This allows organizers to share a single link where recipients choose their identity
        const shareableInviteToken = crypto.randomUUID();
        await db.insert(itineraryInvites).values({
          itineraryId: itinerary.id,
          memberId: null, // Generic invite - recipient picks their identity
          inviteToken: shareableInviteToken,
        });
        console.log(`[Send Itinerary] Created shareable invite token for itinerary ${itinerary.id}`);

        // Create individual invites for existing members (for direct links in emails)
        for (const member of members) {
          const inviteToken = crypto.randomUUID();

          // Store invite in database
          await db.insert(itineraryInvites).values({
            itineraryId: itinerary.id,
            memberId: member.id,
            inviteToken,
          });

          memberInvites.set(member.id, inviteToken);
        }

        // Send in-app notifications to all invited members
        if (members.length > 0) {
          try {
            await notifyEventInvite({
              itineraryId: itinerary.id,
              groupId: group.id,
              eventName: itinerary.name || 'New Event',
              memberIds: members.map(m => m.id),
            });
          } catch (notifError) {
            console.error('[Send Itinerary] Failed to send notifications:', notifError);
          }
        }
        
        // Collect recipients (members with emails + organizer)
        const recipients: string[] = [];
        const membersByEmail = new Map<string, typeof members[0]>();
        for (const member of members) {
          if (member.email) {
            recipients.push(member.email);
            membersByEmail.set(member.email, member);
          }
        }
        
        // If no members have emails, send to the group creator/organizer
        if (recipients.length === 0 && group.userId) {
          const user = await storage.getUser(group.userId);
          if (user?.email) {
            recipients.push(user.email);
            console.log(`[Send Itinerary] No members with emails, sending to organizer ${user.email}`);
          }
        }

        console.log(`[Send Itinerary] Sending to ${recipients.length} recipients`);

        // Get organizer info for email
        const organizerUser = group.userId ? await storage.getUser(group.userId) : null;
        const organizerName = organizerUser?.firstName || (organizerUser as any)?.username || 'Your friend';

        // Format date/time in Pacific timezone
        const pacificFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        const pacificTimeFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        const eventDateFormatted = pacificFormatter.format(date);
        const eventTimeFormatted = `${pacificTimeFormatter.format(date)} PT`;
        const rsvpDeadlineFormatted = pacificFormatter.format(rsvpDeadline);

        for (const email of recipients) {
          try {
            const member = membersByEmail.get(email);
            if (!member) continue;

            const inviteToken = memberInvites.get(member.id);
            if (!inviteToken) continue;

            // Create member-specific RSVP link with invite token
            const rsvpLink = `${req.headers.origin || 'http://localhost:5000'}/rsvp/${itinerary.id}/${inviteToken}`;

            const { sendItineraryInvite } = await import('./email-service');

            await sendItineraryInvite(
              { email, name: member.name || 'Member' },
              {
                groupName: group.name,
                organizerName,
                eventDate: eventDateFormatted,
                eventTime: eventTimeFormatted,
                venues: itinerary.items.map((item: ItineraryItem) => ({
                  name: item.venueName || 'Venue',
                  type: item.venueType || 'Activity',
                })),
                rsvpDeadline: rsvpDeadlineFormatted,
                rsvpLink,
              }
            );

            // Log the reminder
            await storage.logReminder({
              itineraryId: itinerary.id,
              reminderType: 'initial_invite',
              recipientEmail: email,
              emailStatus: 'sent',
            });

            console.log(`[Send Itinerary] Sent initial invite to ${email} for itinerary ${itinerary.id}`);
          } catch (emailError) {
            console.error(`[Send Itinerary] Failed to send email to ${email}:`, emailError);
            
            // Log failed attempt
            await storage.logReminder({
              itineraryId: itinerary.id,
              reminderType: 'initial_invite',
              recipientEmail: email,
              emailStatus: 'failed',
            });
          }
        }
      }

      const updatedItinerary = await storage.updateItinerary(req.params.id, updates);
      res.json(updatedItinerary);
    } catch (error: any) {
      console.error("[Send Itinerary] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

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

      // Count responses
      const yesCount = rsvps.filter(r => r.response === 'yes').length;
      const maybeCount = rsvps.filter(r => r.response === 'maybe').length;
      const noCount = rsvps.filter(r => r.response === 'no').length;
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

  // Send a backup itinerary linked to another itinerary
  app.post("/api/itineraries/:id/send-backup", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      const { backupForItineraryId } = req.body;
      const updates: UpdateItinerary = {
        status: 'proposed',
        isPrimary: false,
        backupForItineraryId: backupForItineraryId,
      };
      const itinerary = await storage.updateItinerary(req.params.id, updates);
      res.json(itinerary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get AI-suggested schedule for an itinerary
  app.get("/api/itineraries/:id/suggested-schedule", isAuthenticated, async (req, res) => {
    try {
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Get group info for member count
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const members = await storage.getGroupMembers(itinerary.groupId);
      const groupSize = members.length || 2; // Default to 2 if no members

      // Prepare venue info for AI
      const venueInfo = itinerary.items.map((item: ItineraryItem) => ({
        name: item.venueName || 'Venue',
        type: item.venueType,
        requiresReservation: item.venueType.toLowerCase().includes('fine') || 
                             item.venueType.toLowerCase().includes('upscale'),
      }));

      const { generateScheduleConfig } = await import('./ai-scheduling');
      const scheduleConfig = await generateScheduleConfig(venueInfo, groupSize);
      
      res.json(scheduleConfig);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Finalize an itinerary as "The Plan" and trigger next auto-event
  app.post("/api/itineraries/:id/finalize", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Validate venue hours if we have an event date
      if (itinerary.eventDate) {
        const group = await storage.getGroup(itinerary.groupId);
        const timezone = group?.timezone || 'America/Los_Angeles';

        const { checkVenueHours } = await import('./itinerary-validation');
        const hoursCheck = checkVenueHours(itinerary.items, new Date(itinerary.eventDate), timezone);

        // Return error if any venue is permanently closed or closed on that day
        if (hoursCheck.errors.length > 0) {
          return res.status(400).json({
            message: "Some venues may be closed at the scheduled time",
            errors: hoursCheck.errors,
            warnings: hoursCheck.warnings,
          });
        }

        // Log warnings but allow finalization
        if (hoursCheck.warnings.length > 0) {
          console.log(`[Finalize] Venue hours warnings for itinerary ${req.params.id}:`, hoursCheck.warnings);
        }
      }

      const updates: UpdateItinerary = {
        status: 'scheduled',
      };
      const updatedItinerary = await storage.updateItinerary(req.params.id, updates);

      // Log venue visits for rotation tracking
      if (itinerary.eventDate) {
        await storage.logVenueVisits(req.params.id, new Date(itinerary.eventDate));
      }

      // Update group's lastEventDate and nextEventDueDate
      if (itinerary.eventDate) {
        const group = await storage.getGroup(itinerary.groupId);
        if (group) {
          const eventDate = new Date(itinerary.eventDate);
          const meetingFrequency = group.meetingFrequency || 'monthly';
          const { addDays } = await import('date-fns');
          
          const frequencyDays: Record<string, number> = {
            'weekly': 7,
            'biweekly': 14,
            'monthly': 30,
            'bimonthly': 60,
          };
          
          const daysToAdd = frequencyDays[meetingFrequency] || 30;
          const nextDue = addDays(eventDate, daysToAdd);
          
          await storage.updateGroup(itinerary.groupId, {
            lastEventDate: eventDate,
            nextEventDueDate: nextDue,
          });

          // Maintain event pipeline after finalizing this event
          console.log(`[Finalize] Triggering pipeline maintenance after event finalization`);
          const { maintainEventPipeline } = await import('./auto-scheduler.js');
          await maintainEventPipeline(itinerary.groupId, storage);
        }
      }

      res.json(updatedItinerary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get proposed itineraries with RSVPs
  app.get("/api/groups/:groupId/proposed-itineraries", async (req, res) => {
    try {
      const proposedItineraries = await storage.getProposedItineraries(req.params.groupId);
      res.json(proposedItineraries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending auto-scheduled events for a group
  app.get("/api/groups/:groupId/auto-scheduled-events", async (req, res) => {
    try {
      const events = await storage.getPendingAutoScheduledEvents(req.params.groupId);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get auto-scheduled events timeline for a group (past 90 days + all future)
  app.get("/api/groups/:groupId/auto-scheduled-events/timeline", async (req, res) => {
    try {
      const events = await storage.getAutoScheduledEventsTimeline(req.params.groupId);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get auto-schedule queue with AI validation
  app.get("/api/groups/:groupId/auto-schedule-queue", async (req, res) => {
    try {
      const { generateAutoScheduleQueue } = await import("./smart-event-pairing");
      const queue = await generateAutoScheduleQueue(req.params.groupId, storage);
      res.json(queue);
    } catch (error: any) {
      console.error('[Auto-Schedule Queue] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Regenerate a queue event with different Favorites
  app.post("/api/groups/:groupId/auto-schedule-queue/regenerate", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ message: "eventId is required" });
      }

      console.log('[Regenerate Queue] Regenerating event:', eventId);

      // Track regeneration count in metadata
      const { queueEventMetadata } = await import('../shared/schema');

      // Check if metadata exists for this event
      const existingMetadata = await db
        .select()
        .from(queueEventMetadata)
        .where(
          and(
            eq(queueEventMetadata.groupId, groupId),
            eq(queueEventMetadata.eventId, eventId)
          )
        )
        .limit(1);

      let regenerationCount = 1;

      if (existingMetadata.length > 0) {
        // Increment existing count
        regenerationCount = existingMetadata[0].regenerationCount + 1;
        await db
          .update(queueEventMetadata)
          .set({
            regenerationCount,
            updatedAt: new Date(),
          })
          .where(eq(queueEventMetadata.id, existingMetadata[0].id));
      } else {
        // Create new metadata entry
        await db.insert(queueEventMetadata).values({
          groupId,
          eventId,
          regenerationCount: 1,
        });
      }

      console.log(`[Regenerate Queue] Regeneration count: ${regenerationCount}`);

      // Get the current queue to extract venues to exclude
      const { generateAutoScheduleQueue, regenerateQueueEvent } = await import("./smart-event-pairing");
      const currentQueue = await generateAutoScheduleQueue(groupId, storage);

      // Find the event being regenerated and extract its venue IDs
      const currentEvent = currentQueue.events.find(e => e.id === eventId);
      const excludeVenueIds = currentEvent?.venues.map(v => v.sourceId) || [];

      console.log('[Regenerate Queue] Excluding venue IDs:', excludeVenueIds);

      // Regenerate the event
      const newEvent = await regenerateQueueEvent(groupId, eventId, excludeVenueIds, storage);

      if (!newEvent) {
        return res.status(500).json({ message: 'Failed to regenerate event' });
      }

      // Add regeneration count to the new event
      const newEventWithCount = {
        ...newEvent,
        regenerationCount,
      };

      // Return updated queue with the new event replacing the old one
      const updatedEvents = currentQueue.events.map(e =>
        e.id === eventId ? newEventWithCount : e
      );

      res.json({ events: updatedEvents });
    } catch (error: any) {
      console.error('[Regenerate Queue] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve a queue event and create an itinerary
  app.post("/api/groups/:groupId/auto-schedule-queue/approve", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;
      const { queueEvent } = req.body; // Full queue event from frontend

      if (!queueEvent || !queueEvent.venues || queueEvent.venues.length === 0) {
        return res.status(400).json({ message: "Invalid queue event data" });
      }

      console.log('[Approve Queue] Creating itinerary from queue event:', queueEvent.id);

      // Generate name for the itinerary
      const { generateItineraryName } = await import("./ai-itinerary-naming");
      const group = await storage.getGroup(groupId);
      const itineraryName = await generateItineraryName(
        queueEvent.venues.map((v: any) => ({ name: v.venueName, type: v.venueType })),
        group?.locationBase || 'San Francisco'
      );

      // DEDUPLICATION: Check for existing proposed itineraries on the same date
      // This prevents duplicate itineraries if user clicks "Approve" multiple times
      const { deduplicateByDate } = await import('./itinerary-deduplication');
      const proposedEventDate = new Date(queueEvent.scheduledDate);
      await deduplicateByDate(groupId, proposedEventDate, 'Approve Queue');

      // Create proposed order (just the order they appear in the queue)
      const proposedOrder = queueEvent.venues.map((v: any) => v.sourceId);

      // Create the itinerary
      const itinerary = await storage.createItinerary(
        {
          groupId,
          name: itineraryName,
          status: 'proposed',
          eventDate: new Date(queueEvent.scheduledDate),
          aiValidationNotes: `Auto-generated from queue. AI validation score: ${queueEvent.aiValidationScore}/100. ${queueEvent.aiValidationReasoning}`,
          proposedOrder,
        },
        userId,
        queueEvent.venues.map((venue: any) => ({
          sourceType: venue.sourceType,
          sourceId: venue.sourceId,
        }))
      );

      console.log('[Approve Queue] Created itinerary:', itinerary.id);

      // Fetch full itinerary with items
      const fullItinerary = await storage.getItinerary(itinerary.id);

      res.json({
        itinerary: fullItinerary,
        message: 'Event approved and added to proposed itineraries',
      });
    } catch (error: any) {
      console.error('[Approve Queue] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create an RSVP for an itinerary
  app.post("/api/itineraries/:id/rsvps", async (req, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(createItineraryRsvpSchema, req.body, res);
      if (!validatedData) return;

      const { response, constraintText, memberId, userId, memberName } = validatedData;
      const rsvp = await storage.createRsvp({
        itineraryId: req.params.id,
        response,
        constraintText,
        memberId,
        userId,
        memberName,
      });
      res.json(rsvp);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Phase 1: Event invite RSVP (public endpoint - no auth required)
  // Simplified RSVP flow for event-by-event invites
  app.post("/api/itineraries/:id/rsvp", async (req, res) => {
    try {
      const { memberId, response, rsvpFeedback } = req.body;
      const { id: itineraryId } = req.params;

      // Validate required fields
      if (!memberId || !memberId.trim()) {
        return res.status(400).json({ message: "Member ID is required" });
      }
      if (!response || !["going", "maybe", "not_going"].includes(response)) {
        return res.status(400).json({ message: "Valid response required (going, maybe, or not_going)" });
      }

      // Verify member exists
      const member = await storage.getMember(memberId);
      if (!member) {
        console.log(`[Event Invite RSVP] Member not found: ${memberId}`);
        return res.status(404).json({ message: "Member not found" });
      }

      // Verify itinerary exists
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
        console.log(`[Event Invite RSVP] Itinerary not found: ${itineraryId}`);
        return res.status(404).json({ message: "Event not found" });
      }

      // For group events, verify the member belongs to the group
      if (itinerary.groupId && member.groupId !== itinerary.groupId) {
        console.log(`[Event Invite RSVP] Member ${memberId} (group: ${member.groupId}) not in event group: ${itinerary.groupId}`);
        return res.status(403).json({ message: "Member is not part of this group" });
      }

      // Check if RSVP already exists
      const existingRsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${itineraryId} AND member_id = ${memberId}`);

      let rsvp;
      const rsvpData: any = {
        response,
        rsvpFeedback: rsvpFeedback || null,
        updatedAt: new Date(),
      };

      if (existingRsvps.length > 0) {
        // Update existing RSVP - generate token if not exists
        const updateData: any = { ...rsvpData };
        if (!existingRsvps[0].guestToken) {
          updateData.guestToken = `member_${crypto.randomUUID()}`;
        }
        const updated = await db
          .update(rsvpsTable)
          .set(updateData)
          .where(sql`id = ${existingRsvps[0].id}`)
          .returning();
        rsvp = updated[0];
      } else {
        // Create new RSVP with token for later retrieval
        const rsvpToken = `member_${crypto.randomUUID()}`;
        const inserted = await db
          .insert(rsvpsTable)
          .values({
            itineraryId,
            memberId,
            guestToken: rsvpToken, // Reuse guestToken field for member RSVPs too
            ...rsvpData,
          })
          .returning();
        rsvp = inserted[0];
      }

      // Log event-specific feedback if provided
      if (rsvpFeedback && (rsvpFeedback.feedbackText || rsvpFeedback.alternativeDays || rsvpFeedback.alternativeTimes)) {
        console.log(`[Event Invite RSVP] Member ${member.name} (${memberId}) provided feedback for event ${itineraryId}:`, rsvpFeedback);
      }

      res.json(rsvp);
    } catch (error: any) {
      console.error('[Event Invite RSVP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Phase 3: Create/update guest RSVP for an itinerary (public endpoint - no auth required)
  app.post("/api/itineraries/:id/guest-rsvp", async (req, res) => {
    try {
      const { guestToken, guestName, guestEmail, response, rsvpFeedback } = req.body;
      const { id: itineraryId } = req.params;

      // Validate required fields
      if (!guestName || !guestName.trim()) {
        return res.status(400).json({ message: "Guest name is required" });
      }

      // Support both old format (yes/maybe/no) and new format (going/maybe/not_going)
      const validResponses = ["yes", "maybe", "no", "going", "not_going"];
      if (!response || !validResponses.includes(response)) {
        return res.status(400).json({ message: "Valid response required" });
      }

      // Normalize response to new format
      const normalizedResponse = response === "yes" ? "going" :
                                 response === "no" ? "not_going" :
                                 response;

      // Verify itinerary exists
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if updating existing guest RSVP (guestToken provided)
      let existingRsvp = null;
      if (guestToken) {
        const existing = await db
          .select()
          .from(rsvpsTable)
          .where(sql`guest_token = ${guestToken} AND itinerary_id = ${itineraryId}`);

        if (existing.length > 0) {
          existingRsvp = existing[0];
        }
      }

      let rsvp;
      if (existingRsvp) {
        // Update existing guest RSVP
        const updated = await db
          .update(rsvpsTable)
          .set({
            response: normalizedResponse,
            guestName: guestName.trim(),
            guestEmail: guestEmail?.trim() || null,
            rsvpFeedback: rsvpFeedback || null,
            updatedAt: new Date(),
          })
          .where(sql`id = ${existingRsvp.id}`)
          .returning();
        rsvp = updated[0];
      } else {
        // Create new guest RSVP
        const newGuestToken = guestToken || crypto.randomUUID() + crypto.randomUUID();

        const inserted = await db
          .insert(rsvpsTable)
          .values({
            itineraryId,
            isGuest: true,
            guestName: guestName.trim(),
            guestEmail: guestEmail?.trim() || null,
            guestToken: newGuestToken,
            response: normalizedResponse,
            rsvpFeedback: rsvpFeedback || null,
            memberName: null,
            memberId: null,
            userId: null,
          })
          .returning();
        rsvp = inserted[0];
      }

      // Log guest feedback if provided
      if (rsvpFeedback && (rsvpFeedback.feedbackText || rsvpFeedback.alternativeDays || rsvpFeedback.alternativeTimes)) {
        console.log(`[Guest RSVP] Guest ${guestName} provided feedback for event ${itineraryId}:`, rsvpFeedback);
      }

      res.json(rsvp);
    } catch (error: any) {
      console.error('[Guest RSVP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get guest RSVP and event details by guest token (public endpoint)
  app.get("/api/guest-rsvp/:guestToken", async (req, res) => {
    try {
      const { guestToken } = req.params;

      // Find the guest RSVP
      const [guestRsvp] = await db
        .select()
        .from(rsvpsTable)
        .where(eq(rsvpsTable.guestToken, guestToken))
        .limit(1);

      if (!guestRsvp) {
        return res.status(404).json({ message: "Guest RSVP not found" });
      }

      // Get the itinerary with items
      const itinerary = await storage.getItinerary(guestRsvp.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Get the group
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      res.json({
        rsvp: guestRsvp,
        itinerary,
        group,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update guest RSVP response (public endpoint)
  app.patch("/api/guest-rsvp/:guestToken", async (req, res) => {
    try {
      const { guestToken } = req.params;
      const { response } = req.body;

      if (!response || !["yes", "maybe", "no"].includes(response)) {
        return res.status(400).json({ message: "Valid response required (yes, maybe, or no)" });
      }

      // Find and update the guest RSVP
      const [updatedRsvp] = await db
        .update(rsvpsTable)
        .set({
          response,
          updatedAt: new Date(),
        })
        .where(eq(rsvpsTable.guestToken, guestToken))
        .returning();

      if (!updatedRsvp) {
        return res.status(404).json({ message: "Guest RSVP not found" });
      }

      res.json(updatedRsvp);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get RSVPs for an itinerary (with member names)
  app.get("/api/itineraries/:id/rsvps", async (req, res) => {
    try {
      const rsvps = await storage.getItineraryRsvps(req.params.id);

      // Enrich RSVPs with member names
      const enrichedRsvps = await Promise.all(
        rsvps.map(async (rsvp) => {
          let memberName = rsvp.memberName || rsvp.guestName;

          // If no name stored but has memberId, look up the member
          if (!memberName && rsvp.memberId) {
            const member = await storage.getMember(rsvp.memberId);
            memberName = member?.name || null;
          }

          return {
            ...rsvp,
            memberName: memberName || 'Unknown',
          };
        })
      );

      res.json(enrichedRsvps);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get invite summary with RSVP counts and shareable link
  app.get("/api/itineraries/:id/invite-summary", isAuthenticated, async (req, res) => {
    try {
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Get all invites for this itinerary
      const invites = await db
        .select()
        .from(itineraryInvites)
        .where(eq(itineraryInvites.itineraryId, req.params.id));

      // Get all RSVPs
      const rsvps = await storage.getItineraryRsvps(req.params.id);
      
      // Count RSVP responses
      const rsvpCounts = {
        yes: rsvps.filter(r => r.response === 'yes').length,
        maybe: rsvps.filter(r => r.response === 'maybe').length,
        no: rsvps.filter(r => r.response === 'no').length,
        pending: invites.length - rsvps.length,
      };

      // Get shareable link using first invite token
      const shareableLink = invites.length > 0 
        ? `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/rsvp/${itinerary.id}/${invites[0].inviteToken}`
        : null;

      res.json({
        itinerary,
        rsvpCounts,
        shareableLink,
        totalInvited: invites.length,
        totalResponses: rsvps.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get availability insights for an event (organizer only)
  // Analyzes RSVP availability feedback to suggest optimal reschedule times
  app.get("/api/itineraries/:id/availability-insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { id } = req.params;

      // Get the itinerary
      const itinerary = await storage.getItinerary(id);
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Only organizers can see availability insights
      if (itinerary.groupId) {
        const group = await storage.getGroup(itinerary.groupId);
        if (!group || group.userId !== userId) {
          return res.status(403).json({ message: "Only the organizer can view availability insights" });
        }
      } else if (itinerary.createdBy !== userId) {
        return res.status(403).json({ message: "Only the event creator can view availability insights" });
      }

      const insights = await analyzeEventAvailability(id);
      res.json(insights);
    } catch (error: any) {
      console.error('[Availability Insights] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

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
      res.status(500).json({ message: error.message });
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
      res.status(500).json({ message: error.message });
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
      res.status(500).json({ message: error.message });
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
      res.status(500).json({ message: error.message });
    }
  });

  // Get guest RSVP details by token (public endpoint)
  app.get("/api/guest-rsvp/:guestToken", async (req, res) => {
    try {
      const { guestToken } = req.params;

      // Find guest invite
      const [guestInvite] = await db
        .select()
        .from(guestInvites)
        .where(eq(guestInvites.guestToken, guestToken))
        .limit(1);

      if (!guestInvite) {
        return res.status(404).json({ message: "Guest invite not found" });
      }

      // Get itinerary details with items
      const itinerary = await storage.getItinerary(guestInvite.itineraryId);
      if (!itinerary || !itinerary.groupId) {
        return res.status(404).json({ message: "Event not found" });
      }

      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, guestInvite.itineraryId))
        .orderBy(itineraryItems.orderIndex);

      const group = await storage.getGroup(itinerary.groupId);

      // Build flattened attendee list (no guest/member distinction for guest view)
      const attendees: Array<{
        name: string;
        initials: string;
        response: string;
        isHost: boolean;
      }> = [];

      // Get group members
      const groupMembers = await db
        .select()
        .from(membersTable)
        .where(eq(membersTable.groupId, itinerary.groupId));

      // Get member RSVPs for this itinerary
      const memberRsvps = await db
        .select()
        .from(rsvpsTable)
        .where(
          and(
            eq(rsvpsTable.itineraryId, guestInvite.itineraryId),
            eq(rsvpsTable.isGuest, false)
          )
        );

      // Map member ID to RSVP response
      const memberRsvpMap = new Map(
        memberRsvps.map(r => [r.memberId, r.response])
      );

      // Add members to attendee list
      for (const member of groupMembers) {
        const name = member.name || 'Member';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const response = memberRsvpMap.get(member.id) || 'pending';

        attendees.push({
          name,
          initials,
          response,
          isHost: member.id === itinerary.hostMemberId,
        });
      }

      // Get guest RSVPs (other guests invited to this event)
      const guestRsvps = await db
        .select()
        .from(guestInvites)
        .where(eq(guestInvites.itineraryId, guestInvite.itineraryId));

      // Add guests to attendee list (flattened - no distinction)
      for (const guest of guestRsvps) {
        const name = guest.guestName || 'Guest';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        attendees.push({
          name,
          initials,
          response: guest.rsvpStatus || 'pending',
          isHost: false, // Guests can't be hosts
        });
      }

      res.json({
        guestInvite,
        itinerary,
        items,
        group: group ? { name: group.name, emoji: group.emoji } : null,
        attendees,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Submit guest RSVP (public endpoint)
  app.post("/api/guest-rsvp/:guestToken", async (req, res) => {
    try {
      const { guestToken } = req.params;
      const { response } = req.body;

      if (!response || !["yes", "maybe", "no"].includes(response)) {
        return res.status(400).json({ message: "Valid response required (yes, maybe, or no)" });
      }

      // Find guest invite
      const [guestInvite] = await db
        .select()
        .from(guestInvites)
        .where(eq(guestInvites.guestToken, guestToken))
        .limit(1);

      if (!guestInvite) {
        return res.status(404).json({ message: "Guest invite not found" });
      }

      // Update RSVP status on guest invite
      const [updated] = await db
        .update(guestInvites)
        .set({ rsvpStatus: response })
        .where(eq(guestInvites.guestToken, guestToken))
        .returning();

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Submit post-event feedback
  app.post("/api/itineraries/:id/post-event-feedback", isAuthenticated, async (req: any, res) => {
    try {

      // Validate request body
      const validatedData = safeParse(postEventFeedbackSchema, req.body, res);
      if (!validatedData) {

        return;
      }

      const userId = await getUserId(req);
      const { itineraryId } = { itineraryId: req.params.id };
      const {
        actuallyAttended,
        didNotAttendReason,
        // New simplified format (1-5 ratings)
        overallRating,
        venueRating,
        budgetRating,
        activityFit,
        timingRating,
        frequencyPreference,
        notes,
        // Legacy fields for backwards compatibility
        wouldReturnToVenue,
        venueVibe,
        groupEnjoyment,
        activityMatch,
        timingFeedback,
        improvementNotes,
        wouldDoAgain
      } = validatedData;

      // Get the itinerary to check group ownership
      const [itinerary] = await db
        .select()
        .from(itineraries)
        .where(eq(itineraries.id, itineraryId))
        .limit(1);

      if (!itinerary) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Handle both group-based events and standalone events
      let group = null;
      let isGroupOwner = false;
      let isEventOrganizer = false;

      if (itinerary.groupId) {
        // Group-based event: check group ownership
        group = await storage.getGroup(itinerary.groupId);
        if (!group) {
          return res.status(404).json({ message: "Group not found" });
        }
        isGroupOwner = group.userId === userId;
      } else {
        // Standalone event: check if user is the organizer
        isEventOrganizer = itinerary.organizerId === userId;
      }

      // Find the user's RSVP for this itinerary
      let rsvp = await db
        .select()
        .from(rsvpsTable)
        .where(
          and(
            eq(rsvpsTable.itineraryId, itineraryId),
            eq(rsvpsTable.userId, userId)
          )
        )
        .limit(1);

      // If no RSVP exists and user is the group owner or event organizer, create one
      if ((!rsvp || rsvp.length === 0) && (isGroupOwner || isEventOrganizer)) {
        rsvp = await db
          .insert(rsvpsTable)
          .values({
            itineraryId,
            userId,
            response: 'yes',
            isGuest: false,
          })
          .returning();
      }

      if (!rsvp || rsvp.length === 0) {
        return res.status(404).json({ message: "RSVP not found. You must RSVP to an event before leaving feedback." });
      }

      // Update the RSVP with post-event feedback
      const feedbackData: any = {
        actuallyAttended,
        submittedAt: new Date().toISOString(),
      };

      // Add fields based on whether they attended or not
      if (!actuallyAttended && didNotAttendReason) {
        feedbackData.didNotAttendReason = didNotAttendReason;
      }
      if (actuallyAttended) {
        // New simplified format (1-5 ratings)
        if (overallRating) feedbackData.overallRating = overallRating;
        if (venueRating) feedbackData.venueRating = venueRating;
        if (budgetRating) feedbackData.budgetRating = budgetRating;
        if (activityFit) feedbackData.activityFit = activityFit;
        if (timingRating) feedbackData.timingRating = timingRating;
        if (frequencyPreference) feedbackData.frequencyPreference = frequencyPreference;
        if (notes) feedbackData.notes = notes;
        // Legacy fields for backwards compatibility
        if (wouldReturnToVenue) feedbackData.wouldReturnToVenue = wouldReturnToVenue;
        if (venueVibe) feedbackData.venueVibe = venueVibe;
        if (groupEnjoyment) feedbackData.groupEnjoyment = groupEnjoyment;
        if (activityMatch) feedbackData.activityMatch = activityMatch;
        if (timingFeedback) feedbackData.timingFeedback = timingFeedback;
        if (improvementNotes) feedbackData.improvementNotes = improvementNotes;
        if (wouldDoAgain) feedbackData.wouldDoAgain = wouldDoAgain;
      }

      const updated = await db
        .update(rsvpsTable)
        .set({
          postEventFeedback: feedbackData,
          updatedAt: new Date(),
        })
        .where(eq(rsvpsTable.id, rsvp[0].id))
        .returning();

      // 🤖 LEARNING LOOP #1: Auto-blacklist venues based on feedback
      // Blacklist if: venueRating <= 2 (new format), or wouldReturnToVenue = "no" (legacy), or wouldDoAgain === 'no' (legacy)
      const shouldBlacklistVenue =
        (venueRating !== undefined && venueRating !== null && venueRating <= 2) ||
        wouldReturnToVenue === 'no' ||
        wouldDoAgain === 'no';

      // Group-specific learning features (only for group-based events)
      if (itinerary.groupId) {
        if (actuallyAttended && shouldBlacklistVenue) {
          try {
            // Get itinerary items to extract venue info
            const fetchedItems = await db
              .select()
              .from(itineraryItems)
              .where(eq(itineraryItems.itineraryId, itineraryId));

            for (const item of fetchedItems) {
              if (item.venueName) {
                const reason = venueRating && venueRating <= 2
                  ? `lowRating:${venueRating}`
                  : wouldReturnToVenue === 'no'
                    ? 'wouldNotReturn'
                    : 'wouldNotDoAgain';
                console.log(`🚫 Auto-blacklisting venue "${item.venueName}" (reason: ${reason})`);
                await storage.addRejectedVenue(itinerary.groupId, item.venueName);
              }
            }
          } catch (error) {
            console.error('[Auto-blacklist] Error adding rejected venue:', error);
            // Don't fail the request if blacklisting fails
          }
        }

        // 🎯 LEARNING: Log timing feedback for future scheduling improvements
        // New format: timingRating 1-2 = too early, 4-5 = too late, 3 = just right
        // Legacy format: timingFeedback enum
        if (timingRating && timingRating !== 3) {
          const timingDescription = timingRating <= 2 ? 'too_early' : 'too_late';
          console.log(`⏰ [Timing Feedback] Group ${itinerary.groupId}: ${timingDescription} (rating: ${timingRating})`);
        } else if (timingFeedback && timingFeedback !== 'just_right') {
          console.log(`⏰ [Timing Feedback] Group ${itinerary.groupId}: ${timingFeedback}`);
        }

        // 🎯 LEARNING: Log activity match feedback for activity selection
        // New format: activityFit 1-2 = not a good fit
        // Legacy format: activityMatch enum
        if (activityFit && activityFit <= 2) {
          console.log(`🔄 [Activity Feedback] Group ${itinerary.groupId}: wants different activities (fit rating: ${activityFit})`);
        } else if (activityMatch === 'try_something_different') {
          console.log(`🔄 [Activity Feedback] Group ${itinerary.groupId}: wants different activities`);
        }

        // 🎯 LEARNING: Log budget feedback
        if (budgetRating && budgetRating <= 2) {
          console.log(`💰 [Budget Feedback] Group ${itinerary.groupId}: too expensive (rating: ${budgetRating})`);
        }

        // 🎯 INSIGHT TRIGGER: Update group insights after post-event feedback
        // This is a significant data point - trigger update immediately
        triggerInsightUpdate(itinerary.groupId, 'post-event-feedback').catch(err => {
          console.error(`[Post Event Feedback] Insight update failed:`, err);
        });

        // 🔄 FREQUENCY LEARNING: Analyze frequency feedback and auto-adjust if needed
        // Import the frequency adjuster at the top of the file
        const { analyzeAndAdjustFrequency } = await import('./frequency-adjuster');
        analyzeAndAdjustFrequency(itinerary.groupId).then(result => {
          if (result && result.applied) {
            console.log(`[Frequency Adjuster] ✅ ${result.reason}`);
          } else if (result) {
            console.log(`[Frequency Adjuster] ℹ️  ${result.reason}`);
          }
        }).catch(err => {
          console.error(`[Frequency Adjuster] Error:`, err);
        });
      }

      res.json(updated[0]);
    } catch (error: any) {
      console.error('[Post Event Feedback] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get aggregated RSVP feedback for a group
  app.get("/api/groups/:groupId/feedback-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;

      // Verify user owns the group
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this group's feedback" });
      }

      // Get all itineraries for the group
      const itinerariesData = await db
        .select()
        .from(itineraries)
        .where(eq(itineraries.groupId, groupId));

      const itineraryIds = itinerariesData.map(i => i.id);
      
      if (itineraryIds.length === 0) {
        return res.json({
          totalResponses: 0,
          budgetConcerns: 0,
          timeConcerns: 0,
          locationConcerns: 0,
          activityTypeConcerns: 0,
          otherConcerns: 0,
          recentFeedback: [],
        });
      }

      // Get all RSVPs with feedback for this group's itineraries (exclude guests)
      const rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id IN (${sql.join(itineraryIds.map(id => sql`${id}`), sql`, `)}) AND rsvp_feedback IS NOT NULL AND (is_guest IS NULL OR is_guest = false)`);

      // Aggregate feedback
      let budgetConcerns = 0;
      let timeConcerns = 0;
      let locationConcerns = 0;
      let activityTypeConcerns = 0;
      let otherConcerns = 0;
      
      const recentFeedback: any[] = [];

      for (const rsvp of rsvps) {
        const feedback = rsvp.rsvpFeedback as any;
        if (!feedback) continue;

        if (feedback.budgetConcern) budgetConcerns++;
        if (feedback.timeConcern) timeConcerns++;
        if (feedback.locationConcern) locationConcerns++;
        if (feedback.activityTypeConcern) activityTypeConcerns++;
        if (feedback.otherConcern) otherConcerns++;

        // Add to recent feedback if it has a notes field
        if (feedback.notes) {
          const itinerary = itinerariesData.find(i => i.id === rsvp.itineraryId);
          recentFeedback.push({
            id: rsvp.id,
            itineraryName: itinerary?.name || 'Event',
            response: rsvp.response,
            feedback,
            createdAt: rsvp.createdAt,
          });
        }
      }

      // Sort recent feedback by date (newest first) and limit to 10
      recentFeedback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const limitedFeedback = recentFeedback.slice(0, 10);

      res.json({
        totalResponses: rsvps.length,
        budgetConcerns,
        timeConcerns,
        locationConcerns,
        activityTypeConcerns,
        otherConcerns,
        recentFeedback: limitedFeedback,
      });
    } catch (error: any) {
      console.error('[Get Feedback Summary] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get aggregated post-event feedback for a group
  app.get("/api/groups/:groupId/post-event-feedback-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;

      // Verify user owns the group
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this group's feedback" });
      }

      // Get all itineraries for the group
      const itinerariesData = await db
        .select()
        .from(itineraries)
        .where(eq(itineraries.groupId, groupId));

      const itineraryIds = itinerariesData.map(i => i.id);
      
      if (itineraryIds.length === 0) {
        return res.json({
          totalResponses: 0,
          averageRating: 0,
          moreFrequent: 0,
          justRight: 0,
          lessFrequent: 0,
          wouldDoAgainYes: 0,
          wouldDoAgainMaybe: 0,
          wouldDoAgainNo: 0,
          recentComments: [],
        });
      }

      // Get all RSVPs with post-event feedback for this group's itineraries (exclude guests)
      const rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id IN (${sql.join(itineraryIds.map(id => sql`${id}`), sql`, `)}) AND post_event_feedback IS NOT NULL AND (is_guest IS NULL OR is_guest = false)`);

      // Aggregate feedback
      let totalRating = 0;
      let ratingCount = 0;
      let moreFrequent = 0;
      let justRight = 0;
      let lessFrequent = 0;
      let wouldDoAgainYes = 0;
      let wouldDoAgainMaybe = 0;
      let wouldDoAgainNo = 0;
      
      const recentComments: any[] = [];

      for (const rsvp of rsvps) {
        const feedback = rsvp.postEventFeedback as any;
        if (!feedback) continue;

        // Aggregate ratings
        if (feedback.venueRating) {
          totalRating += feedback.venueRating;
          ratingCount++;
        }

        // Aggregate frequency preferences
        if (feedback.frequencyPreference === 'more_frequent') moreFrequent++;
        if (feedback.frequencyPreference === 'just_right') justRight++;
        if (feedback.frequencyPreference === 'less_frequent') lessFrequent++;

        // Aggregate repeat willingness
        if (feedback.wouldDoAgain === 'yes') wouldDoAgainYes++;
        if (feedback.wouldDoAgain === 'maybe') wouldDoAgainMaybe++;
        if (feedback.wouldDoAgain === 'no') wouldDoAgainNo++;

        // Add to recent comments if there are improvement notes
        if (feedback.improvementNotes && feedback.improvementNotes.trim()) {
          const itinerary = itinerariesData.find(i => i.id === rsvp.itineraryId);
          recentComments.push({
            id: rsvp.id,
            itineraryName: itinerary?.name || 'Event',
            rating: feedback.venueRating,
            notes: feedback.improvementNotes,
            submittedAt: feedback.submittedAt || rsvp.createdAt,
          });
        }
      }

      // Sort recent comments by date (newest first) and limit to 10
      recentComments.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      const limitedComments = recentComments.slice(0, 10);

      res.json({
        totalResponses: rsvps.length,
        averageRating: ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 0,
        moreFrequent,
        justRight,
        lessFrequent,
        wouldDoAgainYes,
        wouldDoAgainMaybe,
        wouldDoAgainNo,
        recentComments: limitedComments,
      });
    } catch (error: any) {
      console.error('[Get Post Event Feedback Summary] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending auto-scheduled event for a group
  app.get("/api/groups/:groupId/pending-auto-event", isAuthenticated, async (req, res) => {
    try {
      const pendingEvent = await storage.getPendingAutoScheduledEvent(req.params.groupId);
      res.json(pendingEvent || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Approve/finalize a pending auto-scheduled event
  app.post("/api/auto-schedule/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const event = await storage.getAutoScheduledEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Auto-scheduled event not found" });
      }

      // Mark event as approved (will be sent immediately)
      await storage.updateAutoScheduledEventStatus(req.params.id, 'approved');

      res.json({ success: true, message: "Event approved and will be sent to group" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Submit frequency feedback
  app.post("/api/frequency-feedback", isAuthenticated, async (req, res) => {
    try {
      const { groupId, feedback } = req.body;
      const userId = await getUserId(req);

      // Store feedback
      await storage.createFrequencyFeedback({
        groupId,
        userId,
        feedback,
      });

      // Check if we should adjust frequency
      const allFeedback = await storage.getGroupFrequencyFeedback(groupId);
      const total = allFeedback.length;
      
      if (total >= 3) {
        const moreOften = allFeedback.filter(f => f.feedback === 'more_often').length;
        const lessOften = allFeedback.filter(f => f.feedback === 'less_often').length;
        
        const threshold = total * 0.5;
        
        if (moreOften > threshold || lessOften > threshold) {
          const group = await storage.getGroup(groupId);
          if (group) {
            const current = group.meetingFrequency || 'monthly';
            const frequencies = ['weekly', 'biweekly', 'monthly', 'bimonthly'];
            const currentIndex = frequencies.indexOf(current);
            
            let newFrequency = current;
            if (moreOften > threshold && currentIndex > 0) {
              newFrequency = frequencies[currentIndex - 1];
            } else if (lessOften > threshold && currentIndex < frequencies.length - 1) {
              newFrequency = frequencies[currentIndex + 1];
            }
            
            if (newFrequency !== current) {
              await storage.updateGroup(groupId, { meetingFrequency: newFrequency });
              
              // Update nextEventDueDate based on new frequency
              if (group.lastEventDate) {
                const { addDays } = await import('date-fns');
                const frequencyDays: Record<string, number> = {
                  'weekly': 7,
                  'biweekly': 14,
                  'monthly': 30,
                  'bimonthly': 60,
                };
                const daysToAdd = frequencyDays[newFrequency] || 30;
                const nextDue = addDays(new Date(group.lastEventDate), daysToAdd);
                await storage.updateGroup(groupId, { nextEventDueDate: nextDue });
              }
            }
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== Standalone Events ====================

  // Get user's standalone events (with items and invitees for dashboard display)
  app.get("/api/standalone-events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      // Get events where user is organizer
      const organizerEvents = await storage.getUserStandaloneEvents(userId);

      // Get events where user was invited AND responded (RSVP'd)
      const invitedEvents = await storage.getStandaloneEventsUserRespondedTo(userId);

      // Merge and dedupe (organizer events take priority)
      const seenIds = new Set(organizerEvents.map(e => e.id));
      const events = [...organizerEvents];
      for (const event of invitedEvents) {
        if (!seenIds.has(event.id)) {
          events.push(event);
          seenIds.add(event.id);
        }
      }

      // Fetch items and invitees for each event
      const eventsWithDetails = await Promise.all(events.map(async (event) => {
        const items = await db
          .select()
          .from(itineraryItems)
          .where(eq(itineraryItems.itineraryId, event.id))
          .orderBy(itineraryItems.orderIndex);

        const invitees = await storage.getStandaloneEventInvitees(event.id);

        return {
          ...event,
          items: items.map(item => ({
            id: item.id,
            venueName: item.venueName,
            venueType: item.venueType,
            venueAddress: item.venueAddress,
            photoUrl: item.photoUrl,
            rating: item.rating,
            googlePlaceId: item.googlePlaceId,
          })),
          invitees,
        };
      }));

      res.json(eventsWithDetails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a standalone event
  app.post("/api/standalone-events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { name, eventDate, status = 'draft', timezone } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Event name is required" });
      }

      const event = await storage.createStandaloneEvent({
        name,
        eventDate: eventDate ? new Date(eventDate) : null,
        status,
        proposedOrder: [],
        timezone: timezone || null, // IANA timezone (e.g., "America/Los_Angeles")
      }, userId);

      res.json(event);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get a standalone event by ID
  app.get("/api/standalone-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const event = await storage.getStandaloneEvent(req.params.id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Only the organizer can view
      if (event.organizerId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this event" });
      }

      res.json(event);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a standalone event
  app.patch("/api/standalone-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const event = await storage.getStandaloneEvent(req.params.id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (event.organizerId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }

      const { name, eventDate, status } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (eventDate !== undefined) updates.eventDate = eventDate ? new Date(eventDate) : null;
      if (status !== undefined) updates.status = status;

      const updated = await storage.updateStandaloneEvent(req.params.id, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a standalone event
  app.delete("/api/standalone-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const event = await storage.getStandaloneEvent(req.params.id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (event.organizerId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this event" });
      }

      await storage.deleteStandaloneEvent(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== Standalone Event Invitees ====================

  // Add invitees to a standalone event
  app.post("/api/standalone-events/:id/invitees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const event = await storage.getStandaloneEvent(req.params.id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (event.organizerId !== userId) {
        return res.status(403).json({ message: "Not authorized to add invitees to this event" });
      }

      const { invitees } = req.body; // Array of { memberId, sourceGroupId, inviteeName, inviteeEmail, userId? }

      if (!Array.isArray(invitees) || invitees.length === 0) {
        return res.status(400).json({ message: "Invitees array is required" });
      }

      const added = [];
      for (const inv of invitees) {
        const invitee = await storage.addStandaloneEventInvitee({
          itineraryId: req.params.id,
          memberId: inv.memberId || null,
          userId: inv.userId || null,
          sourceGroupId: inv.sourceGroupId || null,
          inviteeName: inv.inviteeName || inv.name || 'Guest',
          inviteeEmail: inv.inviteeEmail || inv.email || null,
        });
        added.push(invitee);
      }

      res.json(added);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Remove an invitee from a standalone event
  app.delete("/api/standalone-events/:id/invitees/:inviteeId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const event = await storage.getStandaloneEvent(req.params.id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (event.organizerId !== userId) {
        return res.status(403).json({ message: "Not authorized to remove invitees from this event" });
      }

      await storage.removeStandaloneEventInvitee(req.params.inviteeId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send invites for a standalone event (mark as sent and optionally send emails)
  app.post("/api/standalone-events/:id/send-invites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const event = await storage.getStandaloneEvent(req.params.id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (event.organizerId !== userId) {
        return res.status(403).json({ message: "Not authorized to send invites for this event" });
      }

      // Update the event status to 'scheduled' (sent)
      await storage.updateStandaloneEvent(req.params.id, {
        status: 'scheduled',
        inviteSentAt: new Date(),
      });

      // Get invitees
      const invitees = await storage.getStandaloneEventInvitees(req.params.id);

      // TODO: Send actual email notifications to invitees with email addresses
      console.log(`[Standalone Event Send] Sent invites to ${invitees.length} invitees for event "${event.name}"`);

      res.json({
        success: true,
        inviteeCount: invitees.length,
        message: `Invites sent to ${invitees.length} people`
      });
    } catch (error: any) {
      console.error('[Standalone Event Send] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Public: Get event details by invite token (for invitee RSVP page)
  app.get("/api/standalone-invite/:inviteToken", async (req, res) => {
    try {
      const result = await storage.getStandaloneEventByInviteToken(req.params.inviteToken);

      if (!result) {
        return res.status(404).json({ message: "Invite not found" });
      }

      // Return limited info for public view
      res.json({
        eventName: result.event.name,
        eventDate: result.event.eventDate,
        inviteeName: result.invitee.inviteeName,
        rsvpStatus: result.invitee.rsvpStatus,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public: RSVP via invite token
  app.post("/api/standalone-invite/:inviteToken/rsvp", async (req, res) => {
    try {
      const { rsvpStatus } = req.body;

      if (!['yes', 'maybe', 'no'].includes(rsvpStatus)) {
        return res.status(400).json({ message: "Invalid RSVP status" });
      }

      const invitee = await storage.updateStandaloneEventInviteeRsvp(req.params.inviteToken, rsvpStatus);

      if (!invitee) {
        return res.status(404).json({ message: "Invite not found" });
      }

      res.json({ success: true, rsvpStatus: invitee.rsvpStatus });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get learning insights for a group (what the system has learned)
  app.get("/api/groups/:groupId/learning-insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;

      // Verify user has access to the group
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if user is group owner or member
      const isOwner = group.userId === userId;
      const members = await storage.getGroupMembers(groupId);
      const isMember = members.some(m => m.userId === userId);

      if (!isOwner && !isMember) {
        return res.status(403).json({ message: "Not authorized to view this group's insights" });
      }

      // Get rejected venues (auto-blacklisted)
      const rejectedVenues = group.rejectedVenues || [];

      // Get member constraints (auto-learned preferences)
      const memberConstraints = await Promise.all(
        members.map(async (member) => {
          const constraints = member.memberConstraints as any;
          return {
            memberId: member.id,
            memberName: member.name,
            budgetConcern: constraints?.budgetConcern || false,
            distanceConcern: constraints?.distanceConcern || false,
            scheduleConflicts: constraints?.scheduleConflicts || [],
            notes: constraints?.notes || null,
          };
        })
      );

      // Calculate engagement scores for all members
      const { calculateGroupEngagement } = await import('./member-learning');
      const engagementScores = await calculateGroupEngagement(groupId);

      // Get frequency adjustment info
      const frequencyFeedback = await storage.getGroupFrequencyFeedback(groupId);
      const moreOften = frequencyFeedback.filter(f => f.feedback === 'more_often').length;
      const lessOften = frequencyFeedback.filter(f => f.feedback === 'less_often').length;
      const justRight = frequencyFeedback.filter(f => f.feedback === 'just_right').length;

      res.json({
        groupId,
        groupName: group.name,
        learningInsights: {
          // Venue learning
          rejectedVenues: {
            count: rejectedVenues.length,
            venues: rejectedVenues,
            description: "Venues that have been auto-blacklisted due to low ratings or negative feedback",
          },

          // Member constraints learning
          memberConstraints: {
            count: memberConstraints.filter(m => m.budgetConcern || m.distanceConcern || m.scheduleConflicts.length > 0).length,
            constraints: memberConstraints.filter(m => m.budgetConcern || m.distanceConcern || m.scheduleConflicts.length > 0),
            description: "Member preferences auto-learned from RSVP patterns",
          },

          // Engagement tracking
          engagement: {
            totalMembers: members.length,
            active: engagementScores.filter(e => e.status === 'active').length,
            atRisk: engagementScores.filter(e => e.status === 'at-risk').length,
            inactive: engagementScores.filter(e => e.status === 'inactive').length,
            scores: engagementScores,
            description: "Member engagement based on RSVP response rates and attendance",
          },

          // Frequency learning
          frequency: {
            current: group.meetingFrequency || 'monthly',
            feedbackCount: frequencyFeedback.length,
            moreOften,
            lessOften,
            justRight,
            description: "Meeting frequency auto-adjusted based on member feedback",
          },
        },
      });
    } catch (error: any) {
      console.error('[Learning Insights] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== AVAILABILITY PULSE ENDPOINTS =====

  // Get active availability pulse for a group (with aggregated data)
  app.get("/api/groups/:groupId/availability-pulse", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user is a member
      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Get active pulse
      const pulseData = await storage.getActivePulseWithResponses(groupId);
      if (!pulseData) {
        return res.json({ pulse: null });
      }

      const { pulse, responses } = pulseData;

      // Get aggregated availability
      const { aggregated, totalResponses } = await storage.getAggregatedPulseAvailability(pulse.id);

      // Get current user's response if exists
      const myResponse = responses.find(r => r.memberId === member.id);

      res.json({
        pulse: {
          id: pulse.id,
          startDate: pulse.startDate,
          endDate: pulse.endDate,
          targetEventDate: pulse.targetEventDate,
          status: pulse.status,
          memberCount: pulse.memberCount,
          responseCount: pulse.responseCount,
          expiresAt: pulse.expiresAt,
        },
        aggregatedAvailability: aggregated,
        totalResponses,
        myResponse: myResponse ? {
          id: myResponse.id,
          availability: myResponse.availability,
          notes: myResponse.notes,
          responseToken: myResponse.responseToken,
          updatedAt: myResponse.updatedAt,
        } : null,
      });
    } catch (error: any) {
      console.error('[Availability Pulse] Error getting pulse:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new availability pulse for a group
  app.post("/api/groups/:groupId/availability-pulse", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const { targetEventDate, startDate, endDate } = req.body;
      const userId = await getUserId(req);

      // Verify user is the organizer
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only the organizer can create availability pulses" });
      }

      // Check if there's already an active pulse
      const existingPulse = await storage.getActivePulseForGroup(groupId);
      if (existingPulse) {
        return res.status(400).json({
          message: "An active availability pulse already exists for this group",
          existingPulseId: existingPulse.id
        });
      }

      // Get member count
      const groupMembers = await storage.getGroupMembers(groupId);

      // Calculate default dates if not provided
      const now = new Date();
      const target = targetEventDate ? new Date(targetEventDate) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks from now
      const pulseStartDate = startDate ? new Date(startDate) : new Date(target.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days before target
      const pulseEndDate = endDate ? new Date(endDate) : new Date(target.getTime() + 18 * 24 * 60 * 60 * 1000); // ~2.5 weeks after target (21 days total)
      const expiresAt = new Date(target.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days before target

      const pulse = await storage.createAvailabilityPulse({
        groupId,
        startDate: pulseStartDate,
        endDate: pulseEndDate,
        targetEventDate: target,
        memberCount: groupMembers.length,
        expiresAt,
        status: 'active',
      });

      // Create response tokens for each member so they can respond via email link
      for (const member of groupMembers) {
        await storage.getOrCreatePulseResponseForMember(
          pulse.id,
          member.id,
          member.userId || undefined
        );
      }

      res.json({
        success: true,
        pulse: {
          id: pulse.id,
          startDate: pulse.startDate,
          endDate: pulse.endDate,
          targetEventDate: pulse.targetEventDate,
          memberCount: pulse.memberCount,
          expiresAt: pulse.expiresAt,
        },
      });
    } catch (error: any) {
      console.error('[Availability Pulse] Error creating pulse:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Submit/update availability pulse response (authenticated)
  app.post("/api/availability-pulse/:pulseId/respond", isAuthenticated, async (req: any, res) => {
    try {
      const { pulseId } = req.params;
      const { availability, notes } = req.body;
      const userId = await getUserId(req);

      // Get the pulse
      const pulse = await storage.getAvailabilityPulse(pulseId);
      if (!pulse) {
        return res.status(404).json({ message: "Pulse not found" });
      }

      if (pulse.status !== 'active') {
        return res.status(400).json({ message: "This availability pulse is no longer active" });
      }

      // Get user's member record for this group
      const member = await storage.getGroupMemberByUserId(pulse.groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Get or create response for this member
      let response = await storage.getPulseResponse(pulseId, member.id);

      if (response) {
        // Update existing response
        response = await storage.updatePulseResponse(response.id, availability, notes);
      } else {
        // Create new response
        response = await storage.createPulseResponse({
          pulseId,
          memberId: member.id,
          userId,
          availability,
          notes,
        });
      }

      res.json({
        success: true,
        response: {
          id: response?.id,
          availability: response?.availability,
          notes: response?.notes,
          updatedAt: response?.updatedAt,
        },
      });
    } catch (error: any) {
      console.error('[Availability Pulse] Error submitting response:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get pulse response page data by token (public endpoint - for email links)
  app.get("/api/availability-pulse/:pulseId/respond/:responseToken", async (req, res) => {
    try {
      const { pulseId, responseToken } = req.params;

      // Get response with all related data
      const data = await storage.getPulseResponseWithDetails(responseToken);
      if (!data) {
        return res.status(404).json({ message: "Response not found" });
      }

      const { response, pulse, member, group } = data;

      // Verify pulse ID matches
      if (pulse.id !== pulseId) {
        return res.status(400).json({ message: "Invalid pulse/response combination" });
      }

      // Get aggregated availability for display
      const { aggregated, totalResponses } = await storage.getAggregatedPulseAvailability(pulseId);

      res.json({
        pulse: {
          id: pulse.id,
          startDate: pulse.startDate,
          endDate: pulse.endDate,
          targetEventDate: pulse.targetEventDate,
          status: pulse.status,
          memberCount: pulse.memberCount,
          expiresAt: pulse.expiresAt,
        },
        group: {
          name: group.name,
          emoji: group.emoji,
        },
        member: {
          name: member.name,
        },
        existingResponse: {
          availability: response.availability,
          notes: response.notes,
          updatedAt: response.updatedAt,
        },
        aggregatedAvailability: aggregated,
        totalResponses,
      });
    } catch (error: any) {
      console.error('[Availability Pulse] Error getting response page:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Submit pulse response by token (public endpoint - for email links)
  app.post("/api/availability-pulse/:pulseId/respond/:responseToken", async (req, res) => {
    try {
      const { pulseId, responseToken } = req.params;
      const { availability, notes } = req.body;

      // Get response by token
      const response = await storage.getPulseResponseByToken(responseToken);
      if (!response) {
        return res.status(404).json({ message: "Response not found" });
      }

      // Verify pulse ID matches
      if (response.pulseId !== pulseId) {
        return res.status(400).json({ message: "Invalid pulse/response combination" });
      }

      // Get the pulse to check status
      const pulse = await storage.getAvailabilityPulse(pulseId);
      if (!pulse || pulse.status !== 'active') {
        return res.status(400).json({ message: "This availability pulse is no longer active" });
      }

      // Update the response
      const updatedResponse = await storage.updatePulseResponse(response.id, availability, notes);

      res.json({
        success: true,
        response: {
          id: updatedResponse?.id,
          availability: updatedResponse?.availability,
          notes: updatedResponse?.notes,
          updatedAt: updatedResponse?.updatedAt,
        },
      });
    } catch (error: any) {
      console.error('[Availability Pulse] Error submitting response by token:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== CONFIDENCE CALIBRATION ENDPOINTS =====

  // Get confidence weights and calibration status for a group
  app.get("/api/groups/:groupId/confidence-weights", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user is a member
      const member = await storage.getGroupMemberByUserId(groupId, userId);
      if (!member) {
        return res.status(403).json({ message: "Not a member of this group" });
      }

      // Get weights
      const { groupConfidenceWeights, confidencePredictions } = await import('../shared/schema');
      const { isNotNull } = await import('drizzle-orm');

      const [weights] = await db
        .select()
        .from(groupConfidenceWeights)
        .where(eq(groupConfidenceWeights.groupId, groupId))
        .limit(1);

      if (!weights) {
        return res.status(404).json({ message: "No calibration data found for this group" });
      }

      // Get prediction statistics
      const [stats] = await db
        .select({
          totalPredictions: sql<number>`count(*)::int`,
          validatedPredictions: sql<number>`count(CASE WHEN ${confidencePredictions.actualConsensus} IS NOT NULL THEN 1 END)::int`,
          unusedPredictions: sql<number>`count(CASE WHEN ${confidencePredictions.usedForCalibration} = false AND ${confidencePredictions.actualConsensus} IS NOT NULL THEN 1 END)::int`,
          averageError: sql<number>`avg(${confidencePredictions.predictionError})`,
        })
        .from(confidencePredictions)
        .where(eq(confidencePredictions.groupId, groupId));

      res.json({
        weights: {
          venueQuality: weights.venueQualityWeight,
          timeConsensus: weights.timeConsensusWeight,
          groupEngagement: weights.groupEngagementWeight,
          patternMatch: weights.patternMatchWeight,
          swipeConsensus: weights.swipeConsensusWeight,
        },
        calibration: {
          count: weights.calibrationCount,
          lastCalibrationAt: weights.lastCalibrationAt,
          totalPredictions: weights.totalPredictions,
          meanAbsoluteError: weights.meanAbsoluteError,
          accuracyRate: weights.accuracyRate,
          autoCalibrationEnabled: weights.autoCalibrationEnabled,
        },
        predictions: {
          total: stats?.totalPredictions || 0,
          validated: stats?.validatedPredictions || 0,
          unused: stats?.unusedPredictions || 0,
          averageError: stats?.averageError ? Math.round(stats.averageError * 100) / 100 : null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching confidence weights:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Manually trigger calibration for a group (admin/organizer only)
  app.post("/api/groups/:groupId/calibrate", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = await getUserId(req);

      // Verify user is the group organizer
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only the organizer can trigger calibration" });
      }

      // Run calibration
      const { calibrateGroupWeights, shouldTriggerCalibration } = await import('./confidence-calibration');

      // Check if enough data
      if (!(await shouldTriggerCalibration(groupId))) {
        return res.status(400).json({
          message: "Not enough validated predictions for calibration (need 50+)",
        });
      }

      const result = await calibrateGroupWeights(groupId);

      if (!result) {
        return res.status(400).json({ message: "Calibration failed - insufficient data" });
      }

      res.json(result);
    } catch (error: any) {
      console.error('Error running calibration:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint: Calibrate all groups
  app.post("/api/admin/calibrate-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);

      // For now, any authenticated user can trigger this
      // In production, you'd want to check for admin role

      const { calibrateAllGroups } = await import('./confidence-calibration');
      const results = await calibrateAllGroups();

      res.json({
        totalGroups: results.length,
        results,
      });
    } catch (error: any) {
      console.error('Error calibrating all groups:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Remove a venue from the blacklist
  app.delete("/api/groups/:groupId/rejected-venues", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;
      const { venueName } = req.body;

      if (!venueName) {
        return res.status(400).json({ message: "Venue name is required" });
      }

      // Verify user is the group owner
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only the group owner can remove venues from the blacklist" });
      }

      // Remove the venue from the rejectedVenues array
      const currentRejected = group.rejectedVenues || [];
      const updatedRejected = currentRejected.filter(v => v !== venueName);

      // Update the group
      await db
        .update(groupsTable)
        .set({ rejectedVenues: updatedRejected })
        .where(eq(groupsTable.id, groupId));

      res.json({
        message: "Venue removed from blacklist",
        rejectedVenues: updatedRejected
      });
    } catch (error: any) {
      console.error('[Remove Rejected Venue] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Manually trigger next event scheduling with 3 itinerary options
  app.post("/api/groups/:groupId/schedule-next-event", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;
      const { allowMemberVoting = false } = req.body;

      // Verify user is the group owner
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only the group owner can schedule events" });
      }

      // Check if there's already a pending auto event
      const existingEvent = await storage.getPendingAutoScheduledEvent(groupId);
      if (existingEvent && existingEvent.status === 'pending_approval') {
        return res.status(400).json({ message: "There's already a pending event. Please approve or reject it first." });
      }

      // Generate 3 itinerary options
      const { selectBestItineraryForAutoSchedule } = await import('./auto-scheduler');
      const result = await selectBestItineraryForAutoSchedule(storage, group);

      if (!result.options || result.options.length === 0) {
        return res.status(400).json({
          message: "Unable to generate itinerary options. The group may not have enough venues or activities."
        });
      }

      // Create the auto-scheduled event with pending status
      const { addDays } = await import('date-fns');
      const proposedDate = group.nextEventDueDate ? new Date(group.nextEventDueDate) : addDays(new Date(), 7);
      const autoSendAt = addDays(proposedDate, -7); // Auto-send 7 days before proposed date (minimum lead time for RSVPs)

      const autoEvent = await storage.createAutoScheduledEvent({
        groupId,
        proposedDate,
        autoSendAt,
        status: 'pending_approval',
        allowMemberVoting,
      });

      // Note: Options are already validated and ordered by the AI Event Planning Agent
      // The agent uses specialized tools for diversity, time appropriateness, and logical flow
      // No additional validation needed - trust the agent's expertise
      console.log('[Schedule Next Event] Using agent-validated options (already ordered optimally)');

      // Store the 3 options
      const { itineraryOptions: itineraryOptionsTable } = await import('../shared/schema');
      const savedOptions = await Promise.all(
        result.options.map(async (option: any) => {
          const [saved] = await db.insert(itineraryOptionsTable).values({
            autoEventId: autoEvent.id,
            optionNumber: option.optionNumber,
            venues: option.venues,
            description: option.description,
            nearbySuggestions: option.nearbySuggestions || null,
          }).returning();
          return saved;
        })
      );

      res.json({
        autoEvent,
        options: savedOptions,
      });
    } catch (error: any) {
      console.error('[Schedule Next Event] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get itinerary options for an auto-scheduled event
  app.get("/api/auto-events/:eventId/options", isAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const userId = await getUserId(req);

      // Get the auto event
      const event = await storage.getAutoScheduledEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verify user has access to the group
      const group = await storage.getGroup(event.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const isOwner = group.userId === userId;
      const members = await storage.getGroupMembers(event.groupId);
      const isMember = members.some(m => m.userId === userId);

      if (!isOwner && !isMember) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Get the options
      const { itineraryOptions: itineraryOptionsTable, itineraryOptionVotes } = await import('../shared/schema');
      const options = await db
        .select()
        .from(itineraryOptionsTable)
        .where(eq(itineraryOptionsTable.autoEventId, eventId))
        .orderBy(itineraryOptionsTable.optionNumber);

      // Get vote counts for each option
      const optionsWithVotes = await Promise.all(
        options.map(async (option) => {
          const votes = await db
            .select()
            .from(itineraryOptionVotes)
            .where(eq(itineraryOptionVotes.optionId, option.id));

          return {
            ...option,
            voteCount: votes.length,
          };
        })
      );

      res.json({
        event,
        options: optionsWithVotes,
      });
    } catch (error: any) {
      console.error('[Get Itinerary Options] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Vote for an itinerary option (members only if voting is enabled)
  app.post("/api/auto-events/:eventId/vote", isAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const { optionId } = req.body;
      const userId = await getUserId(req);

      if (!optionId) {
        return res.status(400).json({ message: "Option ID is required" });
      }

      // Get the auto event
      const event = await storage.getAutoScheduledEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if voting is enabled
      if (!event.allowMemberVoting) {
        return res.status(403).json({ message: "Voting is not enabled for this event" });
      }

      // Verify user is a member
      const members = await storage.getGroupMembers(event.groupId);
      const member = members.find(m => m.userId === userId);
      if (!member) {
        return res.status(403).json({ message: "Only group members can vote" });
      }

      // Verify option exists and belongs to this event
      const { itineraryOptions: itineraryOptionsTable, itineraryOptionVotes } = await import('../shared/schema');
      const [option] = await db
        .select()
        .from(itineraryOptionsTable)
        .where(eq(itineraryOptionsTable.id, optionId));

      if (!option || option.autoEventId !== eventId) {
        return res.status(404).json({ message: "Invalid option" });
      }

      // Remove any existing vote from this member for this event
      await db
        .delete(itineraryOptionVotes)
        .where(
          and(
            eq(itineraryOptionVotes.autoEventId, eventId),
            eq(itineraryOptionVotes.memberId, member.id)
          )
        );

      // Add the new vote
      await db.insert(itineraryOptionVotes).values({
        optionId,
        autoEventId: eventId,
        memberId: member.id,
        userId,
      });

      res.json({ success: true, message: "Vote recorded" });
    } catch (error: any) {
      console.error('[Vote for Option] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Organizer selects an itinerary option
  app.post("/api/auto-events/:eventId/select-option", isAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const { optionId } = req.body;
      const userId = await getUserId(req);

      if (!optionId) {
        return res.status(400).json({ message: "Option ID is required" });
      }

      // Get the auto event
      const event = await storage.getAutoScheduledEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verify user is the group owner
      const group = await storage.getGroup(event.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only the group owner can select an option" });
      }

      // Use the shared approval logic
      const { approveAndCreateItinerary } = await import('./auto-approval');
      const result = await approveAndCreateItinerary(eventId, optionId, 'manual');

      if (!result.success) {
        return res.status(400).json({ message: result.error || 'Failed to approve option' });
      }

      res.json({
        success: true,
        message: "Option selected",
        itinerary: result.itinerary,
      });
    } catch (error: any) {
      console.error('[Select Option] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Regenerate itinerary options for an auto-scheduled event (Try Again)
  app.post("/api/auto-events/:eventId/regenerate-options", isAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const userId = await getUserId(req);

      // Get the auto event
      const event = await storage.getAutoScheduledEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verify user is the group owner
      const group = await storage.getGroup(event.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only the group owner can regenerate options" });
      }

      // Don't allow regeneration if an option has already been selected
      if (event.selectedOptionId) {
        return res.status(400).json({ message: "Cannot regenerate after an option has been selected" });
      }

      console.log(`[Regenerate Options] Starting for event ${eventId}`);

      // Delete existing options and votes
      const { itineraryOptions: itineraryOptionsTable, itineraryOptionVotes } = await import('../shared/schema');

      // Delete votes first (foreign key constraint)
      await db
        .delete(itineraryOptionVotes)
        .where(eq(itineraryOptionVotes.autoEventId, eventId));

      // Delete options
      await db
        .delete(itineraryOptionsTable)
        .where(eq(itineraryOptionsTable.autoEventId, eventId));

      console.log(`[Regenerate Options] Deleted old options, generating new ones...`);

      // Generate new options using the auto-scheduler
      const { selectBestItineraryForAutoSchedule } = await import('./auto-scheduler');
      const result = await selectBestItineraryForAutoSchedule(storage, group);

      if (!result.options || result.options.length === 0) {
        return res.status(500).json({ message: "Failed to generate new options" });
      }

      // Save new options
      const savedOptions = await Promise.all(
        result.options.map(async (option: any) => {
          const [saved] = await db.insert(itineraryOptionsTable).values({
            autoEventId: eventId,
            optionNumber: option.optionNumber,
            venues: option.venues,
            description: option.description,
            nearbySuggestions: option.nearbySuggestions || null,
          }).returning();
          return saved;
        })
      );

      console.log(`[Regenerate Options] Generated ${savedOptions.length} new option(s)`);

      // Fetch the new options with vote counts
      const optionsWithVotes = await Promise.all(
        savedOptions.map(async (option) => ({
          ...option,
          voteCount: 0, // New options have no votes
        }))
      );

      res.json({
        success: true,
        message: "New options generated",
        event,
        options: optionsWithVotes,
      });
    } catch (error: any) {
      console.error('[Regenerate Options] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate and retrieve group-level insights (budget, availability, activity types)
  app.get("/api/groups/:groupId/insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;
      const { regenerate } = req.query; // ?regenerate=true to force regeneration

      // Verify user has access to the group
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if user is group owner or member
      const isOwner = group.userId === userId;
      const members = await storage.getGroupMembers(groupId);
      const isMember = members.some(m => m.userId === userId);

      if (!isOwner && !isMember) {
        return res.status(403).json({ message: "Not authorized to view this group's insights" });
      }

      // Check if we need to regenerate insights
      const shouldRegenerate = regenerate === 'true' ||
        !group.preferenceInsights ||
        !group.lastInsightsUpdate ||
        (new Date().getTime() - new Date(group.lastInsightsUpdate).getTime()) > 7 * 24 * 60 * 60 * 1000; // 7 days

      let insights;
      if (shouldRegenerate) {
        console.log(`[Insights] Generating insights for group ${groupId}`);
        insights = await generateGroupInsights(groupId);
        await saveGroupInsights(groupId, insights);
      } else {
        insights = group.preferenceInsights;
      }

      // Also get time patterns from availability analyzer
      let timePatterns = null;
      try {
        timePatterns = await analyzeGroupTimePatterns(groupId);
      } catch (err) {
        console.error('[Group Insights] Error getting time patterns:', err);
      }

      res.json({
        groupId,
        insights,
        timePatterns,
      });
    } catch (error: any) {
      console.error('[Group Insights] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dismiss a specific insight
  app.post("/api/groups/:groupId/insights/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId } = req.params;
      const { insightType } = req.body; // 'budget', 'availability', 'activityTypes'

      // Verify user is group owner
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only group owners can dismiss insights" });
      }

      if (!['budget', 'availability', 'activityTypes'].includes(insightType)) {
        return res.status(400).json({ message: "Invalid insight type" });
      }

      await dismissInsight(groupId, insightType as 'budget' | 'availability' | 'activityTypes');

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Dismiss Insight] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Edit an insight suggestion
  app.patch("/api/groups/:groupId/insights/:insightType", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { groupId, insightType } = req.params;
      const { suggestion } = req.body;

      // Verify user is group owner
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only group owners can edit insights" });
      }

      if (!['budget', 'availability', 'activityTypes'].includes(insightType)) {
        return res.status(400).json({ message: "Invalid insight type" });
      }

      await editInsightSuggestion(groupId, insightType as 'budget' | 'availability' | 'activityTypes', suggestion);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Edit Insight] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to backfill coordinates for existing groups
  // Protected endpoint - requires admin access
  app.post("/api/admin/backfill-coordinates", isAuthenticated, requireAdmin(), async (req, res) => {
    try {
      const groups = await storage.getAllGroups();
      let backfilled = 0;
      let failed = 0;
      let skipped = 0;

      for (const group of groups) {
        // Skip if already has coordinates and timezone
        if (group.latitude && group.longitude && group.timezone) {
          skipped++;
          continue;
        }

        // Skip if no location to geocode
        if (!group.locationBase || group.locationBase.trim() === '') {
          skipped++;
          continue;
        }

        // Geocode the location and get timezone
        const geocoded = await geocodeLocation(group.locationBase);
        if (geocoded) {
          await storage.updateGroup(group.id, {
            latitude: geocoded.latitude.toString(),
            longitude: geocoded.longitude.toString(),
            timezone: geocoded.timezone,
          });
          console.log(`Backfilled coordinates and timezone for group ${group.id}: ${group.locationBase} -> (${geocoded.latitude}, ${geocoded.longitude}) timezone: ${geocoded.timezone}`);
          backfilled++;
        } else {
          console.warn(`Failed to geocode location for group ${group.id}: ${group.locationBase}`);
          failed++;
        }
      }

      res.json({
        success: true,
        message: `Backfilled ${backfilled} groups, ${skipped} already had coordinates, ${failed} failed to geocode`,
        backfilled,
        skipped,
        failed,
      });
    } catch (error: any) {
      console.error("Error backfilling coordinates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to get platform statistics
  // Protected endpoint - requires authentication and admin privileges
  app.get("/api/admin/stats", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin (currently only the platform owner)
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      // For now, only allow specific admin email
      // See TODO.md: "Admin Role Management" for planned database-driven role system
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const includeTestData = req.query.includeTestData === 'true';
      const stats = await storage.getAdminStats(includeTestData);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to check background job health
  app.get("/api/admin/job-health", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);

      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const jobHealth = getJobHealthStatus();

      // Calculate overall status
      const jobs = Object.values(jobHealth);
      const failingJobs = jobs.filter(j => j.status === 'failing').length;
      const degradedJobs = jobs.filter(j => j.status === 'degraded').length;

      const overallStatus = failingJobs > 0 ? 'failing' : degradedJobs > 0 ? 'degraded' : 'healthy';

      res.json({
        overallStatus,
        summary: {
          total: jobs.length,
          healthy: jobs.filter(j => j.status === 'healthy').length,
          degraded: degradedJobs,
          failing: failingJobs,
        },
        jobs: jobHealth,
      });
    } catch (error: any) {
      console.error("Error fetching job health:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to create database backup
  app.post("/api/admin/create-backup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const { notes } = req.body;
      const backup = await storage.createDatabaseBackup('manual', userId, notes);
      
      await storage.pruneDatabaseBackups(30);
      
      res.json({ 
        message: "Backup created successfully", 
        backup: {
          id: backup.id,
          backupType: backup.backupType,
          createdAt: backup.createdAt,
          notes: backup.notes,
          counts: backup.snapshotData.counts
        }
      });
    } catch (error: any) {
      console.error("Error creating backup:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to get all database backups
  app.get("/api/admin/backups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const backups = await storage.getAllDatabaseBackups();
      
      const backupsList = backups.map((b: any) => ({
        id: b.id,
        backupType: b.backupType,
        createdAt: b.createdAt,
        notes: b.notes,
        createdBy: b.createdBy,
        counts: b.snapshotData.counts
      }));
      
      res.json(backupsList);
    } catch (error: any) {
      console.error("Error fetching backups:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to restore database from backup
  app.post("/api/admin/restore/:backupId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const { backupId } = req.params;
      
      await storage.createDatabaseBackup('pre_restore', userId, `Backup before restoring to ${backupId}`);
      
      await storage.restoreDatabaseBackup(backupId);
      
      res.json({ message: "Database restored successfully" });
    } catch (error: any) {
      console.error("Error restoring backup:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to get list of test accounts
  // Protected endpoint - requires authentication and admin privileges
  app.get("/api/admin/test-accounts", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const testAccounts = await storage.getTestAccounts();
      res.json(testAccounts);
    } catch (error: any) {
      console.error("Error fetching test accounts:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to switch to a test account
  // Protected endpoint - requires authentication and admin privileges
  app.post("/api/admin/switch-user", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      // Validate request body
      const validatedData = safeParse(switchUserSchema, req.body, res);
      if (!validatedData) return;

      const { targetUserId } = validatedData;

      // Get the target user to verify they're a test account
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }

      // Verify it's a test account
      const isTestAccount = targetUser.email?.includes('@example.com') || targetUser.email?.includes('@test.com');
      if (!isTestAccount) {
        return res.status(403).json({ message: "Can only switch to test accounts" });
      }

      // Update the session to impersonate the target user
      req.user.claims.sub = targetUserId;
      req.user.claims.email = targetUser.email;
      
      res.json({ success: true, user: targetUser });
    } catch (error: any) {
      console.error("Error switching user:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to cache all uncached photos (migration)
  app.post("/api/admin/cache-photos", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      // Use only KEY_2 for migration
      const apiKey = process.env.GOOGLE_PLACES_API_KEY_2;
      if (!apiKey) {
        return res.status(500).json({ message: "GOOGLE_PLACES_API_KEY_2 not configured" });
      }

      // Get all activities with direct Google URLs
      const uncachedActivities = await db
        .select({
          id: activitiesTable.id,
          photoUrl: activitiesTable.photoUrl,
        })
        .from(activitiesTable)
        .where(sql`${activitiesTable.photoUrl} LIKE 'https://maps.googleapis.com/%'`);

      let successCount = 0;
      let errorCount = 0;
      const errors: Array<{ activityId: string; error: string }> = [];

      // Process in batches to avoid overwhelming the API
      const BATCH_SIZE = 10;
      for (let i = 0; i < uncachedActivities.length; i += BATCH_SIZE) {
        const batch = uncachedActivities.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (activity) => {
          try {
            // Extract photo_reference from URL
            const urlMatch = activity.photoUrl?.match(/photo_reference=([^&]+)/);
            if (!urlMatch) {
              throw new Error('Could not extract photo reference from URL');
            }
            
            const photoReference = urlMatch[1];
            
            // Check if already cached
            const existing = await db
              .select()
              .from(photosCache)
              .where(eq(photosCache.photoReference, photoReference))
              .limit(1);

            if (existing.length > 0 && new Date() < existing[0].expiresAt) {

              // Update activity to use proxy URL
              await db
                .update(activitiesTable)
                .set({ photoUrl: `/api/photos/${photoReference}` })
                .where(eq(activitiesTable.id, activity.id));
              
              successCount++;
              return;
            }

            // Download photo using KEY_2
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
            const photoResponse = await fetch(photoUrl);
            
            if (!photoResponse.ok) {
              throw new Error(`Failed to fetch photo: ${photoResponse.status}`);
            }

            const photoBuffer = await photoResponse.arrayBuffer();
            const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';
            const base64Data = Buffer.from(photoBuffer).toString('base64');

            // Cache the photo
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

            await db
              .insert(photosCache)
              .values({
                photoReference,
                imageData: base64Data,
                contentType,
                expiresAt,
              })
              .onConflictDoUpdate({
                target: photosCache.photoReference,
                set: {
                  imageData: base64Data,
                  contentType,
                  expiresAt,
                },
              });

            // Update activity to use proxy URL
            await db
              .update(activitiesTable)
              .set({ photoUrl: `/api/photos/${photoReference}` })
              .where(eq(activitiesTable.id, activity.id));

            successCount++;
          } catch (error: any) {
            console.error(`[Photo Migration] ✗ Error for activity ${activity.id}:`, error.message);
            errorCount++;
            errors.push({ activityId: activity.id, error: error.message });
          }
        }));

        // Log progress

        // Small delay between batches
        if (i + BATCH_SIZE < uncachedActivities.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      res.json({
        success: true,
        total: uncachedActivities.length,
        cached: successCount,
        errors: errorCount,
        errorDetails: errors.slice(0, 10), // Return first 10 errors
      });
    } catch (error: any) {
      console.error("Error in photo caching migration:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to backfill coordinates for voting_events (favorites)
  app.post("/api/admin/backfill-favorites-coordinates", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      // Get all voting_events with googlePlaceId but missing coordinates
      const votingEventsToBackfill = await db
        .select()
        .from(votingEventsTable)
        .where(
          and(
            sql`${votingEventsTable.googlePlaceId} IS NOT NULL`,
            or(
              sql`${votingEventsTable.latitude} IS NULL`,
              sql`${votingEventsTable.longitude} IS NULL`
            )
          )
        );

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      const errors: Array<{ eventId: string; title: string; error: string }> = [];

      // Process in batches to be API-friendly
      const BATCH_SIZE = 25;
      for (let i = 0; i < votingEventsToBackfill.length; i += BATCH_SIZE) {
        const batch = votingEventsToBackfill.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (event) => {
          try {
            if (!event.googlePlaceId) {
              skippedCount++;
              return;
            }

            // Fetch place details (uses cache if available)
            const placeDetails = await getPlaceDetails(event.googlePlaceId);
            
            if (!placeDetails || !placeDetails.location) {
              throw new Error('No location data in place details');
            }

            // Update the voting event with coordinates
            await db
              .update(votingEventsTable)
              .set({
                latitude: placeDetails.location.lat.toString(),
                longitude: placeDetails.location.lng.toString(),
              })
              .where(eq(votingEventsTable.id, event.id));

            successCount++;
          } catch (error: any) {
            console.error(`[Favorites Backfill] ✗ Error for "${event.title}":`, error.message);
            errorCount++;
            errors.push({ 
              eventId: event.id, 
              title: event.title,
              error: error.message 
            });
          }
        }));

        // Log progress

        // Small delay between batches to be nice to the API
        if (i + BATCH_SIZE < votingEventsToBackfill.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      res.json({
        success: true,
        message: `Backfilled ${successCount} favorites, ${skippedCount} skipped, ${errorCount} errors`,
        total: votingEventsToBackfill.length,
        updated: successCount,
        skipped: skippedCount,
        errors: errorCount,
        errorDetails: errors.slice(0, 10), // Return first 10 errors
      });
    } catch (error: any) {
      console.error("Error backfilling favorites coordinates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to audit and fix bad categorizations in curated_venues
  app.post("/api/admin/audit-venue-data", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      // Known incorrect categorizations to fix
      const corrections = [
        { name: 'Burma Silver Star Restaurant', correctCategory: 'meal', correctDescription: 'Burmese cuisine' },
        { name: 'Cooking Papa San Mateo', correctCategory: 'meal', correctDescription: 'Chinese restaurant' },
        { name: 'Crossfit Burlingame', correctCategory: 'experiences', correctDescription: 'CrossFit gym' },
        { name: 'LC Photo Booths', correctCategory: 'experiences', correctDescription: 'Photo booth rentals' },
        { name: 'Baklavastory.', correctCategory: 'dessert', correctDescription: 'Turkish baklava shop' },
      ];

      let updatedCount = 0;
      let activityUpdates = 0;

      for (const correction of corrections) {
        // Update curated_venues
        const result = await db
          .update(curatedVenues)
          .set({ 
            category: correction.correctCategory,
            description: correction.correctDescription 
          })
          .where(eq(curatedVenues.name, correction.name))
          .returning();

        if (result.length > 0) {
          updatedCount++;

        }

        // Also update any activities using this venue
        const activityResult = await db
          .update(activitiesTable)
          .set({ 
            description: correction.correctDescription 
          })
          .where(eq(activitiesTable.venueName, correction.name))
          .returning();

        if (activityResult.length > 0) {
          activityUpdates += activityResult.length;

        }
      }

      res.json({
        success: true,
        message: `Corrected ${updatedCount} curated venues and ${activityUpdates} activities`,
        corrections: corrections.map(c => c.name)
      });
    } catch (error: any) {
      console.error("Error auditing venue data:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to clean up invalid venues from curated_venues
  app.post("/api/admin/cleanup-curated-venues", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      // Get all curated venues
      const allVenues = await db.select().from(curatedVenues);

      let removedNonVenues = 0;
      let removedMissingPhotos = 0;
      let removedLowQuality = 0;
      let removedDuplicates = 0;
      let removedByRules = 0;

      // Track seen place IDs to remove duplicates
      const seenPlaceIds = new Set<string>();

      // Import deleted venues table and validation functions
      const { deletedVenues } = await import('@shared/schema');
      const { isObviouslyInvalidVenue, validateVenuesBatch } = await import('./openai');

      // PHASE 1: Apply cheap, rule-based filters (NO API CALLS)
      const venuesNeedingAI: any[] = [];
      const venuesToRemove: Array<{ venue: any; reasons: string[] }> = [];

      for (const venue of allVenues) {
        const reasons: string[] = [];

        // Check for duplicates by Google Place ID
        if (venue.googlePlaceId && seenPlaceIds.has(venue.googlePlaceId)) {
          reasons.push('Duplicate venue (same Google Place ID)');
          removedDuplicates++;
        } else if (venue.googlePlaceId) {
          seenPlaceIds.add(venue.googlePlaceId);
        }

        // Check for missing photos
        if (!venue.photoUrl) {
          reasons.push('No photo available');
          removedMissingPhotos++;
        }

        // Check for low quality (very low ratings or very few reviews)
        const rating = parseFloat(venue.rating || '0');
        const reviewCount = venue.reviewCount || 0;
        if (rating < 3.0 || reviewCount < 5) {
          reasons.push(`Low quality (${rating}★, ${reviewCount} reviews)`);
          removedLowQuality++;
        }

        // If already marked for removal, skip further validation
        if (reasons.length > 0) {
          venuesToRemove.push({ venue, reasons });
          continue;
        }

        // Apply rule-based filtering (FREE, instant)
        const googleTypes = venue.tags || [];
        const ruleCheck = isObviouslyInvalidVenue(
          venue.name,
          venue.address,
          Array.isArray(googleTypes) ? googleTypes : []
        );

        if (ruleCheck?.isInvalid) {
          reasons.push(`Rule-based filter: ${ruleCheck.reasoning}`);
          removedByRules++;
          removedNonVenues++;
          venuesToRemove.push({ venue, reasons });
        } else {
          // Venue passed all cheap filters - needs AI validation
          venuesNeedingAI.push(venue);
        }
      }

      // PHASE 2: Batched AI validation (50 venues per API call for more reliable JSON)
      if (venuesNeedingAI.length > 0) {
        const BATCH_SIZE = 50;
        const batches = [];
        for (let i = 0; i < venuesNeedingAI.length; i += BATCH_SIZE) {
          batches.push(venuesNeedingAI.slice(i, i + BATCH_SIZE));
        }

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];

          const batchInput = batch.map(v => ({
            id: v.id,
            name: v.name,
            address: v.address,
            googleTypes: Array.isArray(v.tags) ? v.tags : []
          }));

          const validationResults = await validateVenuesBatch(batchInput);

          // Process results
          for (const venue of batch) {
            const validation = validationResults.get(venue.id);
            if (validation && !validation.isValid) {
              venuesToRemove.push({
                venue,
                reasons: [`AI validation: ${validation.reasoning}`]
              });
              removedNonVenues++;
            }
          }
        }
      }

      // PHASE 3: Archive and delete all flagged venues

      for (const { venue, reasons } of venuesToRemove) {
        // Archive to deleted_venues table before deletion
        await db.insert(deletedVenues).values({
          venueData: venue as any,
          deletionReason: reasons.join('; '),
          deletedBy: userId,
        });

        // Delete from curated venues
        await db.delete(curatedVenues).where(eq(curatedVenues.id, venue.id));

        console.log(`[Venue Cleanup]    Reasons: ${reasons.join('; ')}`);
      }

      const totalRemoved = venuesToRemove.length;
      const remaining = allVenues.length - totalRemoved;

      res.json({
        success: true,
        message: `Cleaned up ${totalRemoved} invalid venues (${removedByRules} by rules, ${removedNonVenues - removedByRules} by AI batching)`,
        stats: {
          total: allVenues.length,
          removed: {
            nonVenues: removedNonVenues,
            ruleBasedFiltering: removedByRules,
            aiBatchValidation: removedNonVenues - removedByRules,
            missingPhotos: removedMissingPhotos,
            lowQuality: removedLowQuality,
            duplicates: removedDuplicates,
            total: totalRemoved,
          },
          remaining,
        }
      });
    } catch (error: any) {
      console.error("Error cleaning up curated venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to get deleted venues
  app.get("/api/admin/deleted-venues", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      // Import deleted venues table
      const { deletedVenues } = await import('@shared/schema');

      // Get all deleted venues, ordered by most recent first
      const deleted = await db.select()
        .from(deletedVenues)
        .orderBy(desc(deletedVenues.deletedAt))
        .limit(500); // Limit to 500 most recent

      res.json({
        success: true,
        deletedVenues: deleted,
      });
    } catch (error: any) {
      console.error("Error fetching deleted venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to clean up orphaned voting data from deleted groups
  app.post("/api/admin/cleanup-orphaned-voting-data", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);

      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      console.log("[Cleanup] Starting orphaned voting data cleanup...");
      const result = await storage.cleanupOrphanedVotingData();

      res.json({
        success: true,
        votingEventsDeleted: result.votingEventsDeleted,
        votesDeleted: result.votesDeleted,
        message: `Cleaned up ${result.votingEventsDeleted} orphaned voting events and ${result.votesDeleted} orphaned votes`
      });
    } catch (error: any) {
      console.error("Error cleaning up orphaned voting data:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to permanently delete a group and all associated data
  app.delete("/api/admin/groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);

      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const groupId = req.params.id;

      // Verify group exists before attempting deletion
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      console.log(`[Hard Delete] Admin ${user.email} permanently deleting group ${groupId} (${group.name})`);
      await storage.hardDeleteGroup(groupId);

      res.json({
        success: true,
        message: `Group "${group.name}" permanently deleted. Backup created for recovery if needed.`
      });
    } catch (error: any) {
      console.error("Error deleting group:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to recategorize all curated venues based on their Google types
  app.post("/api/admin/recategorize-venues", isAuthenticated, async (req: any, res) => {

    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);

      const adminEmails = getAdminEmails();

      if (!user || !adminEmails.includes(user.email || '')) {

        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      // Clear categorization cache to ensure all venues are re-evaluated with current logic
      const { categorizeVenue, clearCategorizationCache } = await import('./openai');
      clearCategorizationCache();

      // Get all curated venues
      const venues = await storage.getAllCuratedVenues();

      // Track category distribution before and after
      const CANONICAL_CATEGORIES = ['meal', 'cafes', 'drinks', 'dessert', 'experiences'];
      const categoriesBefore: Record<string, number> = {};
      const categoriesAfter: Record<string, number> = {};
      
      // Count existing categories
      venues.forEach(venue => {
        categoriesBefore[venue.category] = (categoriesBefore[venue.category] || 0) + 1;
      });

      console.log(`  Canonical: ${CANONICAL_CATEGORIES.map(c => `${c}=${categoriesBefore[c] || 0}`).join(', ')}`);
      const nonCanonical = Object.entries(categoriesBefore)
        .filter(([cat]) => !CANONICAL_CATEGORIES.includes(cat))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      console.log(`  Top 10 non-canonical: ${nonCanonical.map(([cat, count]) => `"${cat}"=${count}`).join(', ')}`);

      const changes: Array<{ id: string; name: string; oldCategory: string; newCategory: string }> = [];
      let checked = 0;
      let errors = 0;
      let forcedUpdates = 0; // Count venues updated just for being non-canonical

      // Process venues in batches to avoid overwhelming the system
      for (const venue of venues) {
        checked++;
        
        try {
          // Use Google types (stored in tags) to determine correct category
          const googleTypes = venue.tags || [];
          const correctCategory = await categorizeVenue(venue.name, '', googleTypes);

          // AGGRESSIVE: Recategorize if venue is not in canonical categories OR if category doesn't match
          const isNonCanonical = !CANONICAL_CATEGORIES.includes(venue.category);
          const needsUpdate = isNonCanonical || venue.category !== correctCategory;
          
          if (needsUpdate) {
            if (isNonCanonical && venue.category === correctCategory) {
              forcedUpdates++;
            }

            // Update the venue
            await storage.updateVenueCategory(venue.id, correctCategory);
            
            changes.push({
              id: venue.id,
              name: venue.name,
              oldCategory: venue.category,
              newCategory: correctCategory
            });

            // Track new category
            categoriesAfter[correctCategory] = (categoriesAfter[correctCategory] || 0) + 1;
          } else {
            // No change needed, count existing category
            categoriesAfter[venue.category] = (categoriesAfter[venue.category] || 0) + 1;
          }

          // Log progress every 100 venues
          if (checked % 100 === 0) {

          }
        } catch (error: any) {
          console.error(`[Venue Recategorization] Error processing ${venue.name}:`, error.message);
          errors++;
        }
      }

      console.log(`  Canonical: ${CANONICAL_CATEGORIES.map(c => `${c}=${categoriesAfter[c] || 0}`).join(', ')}`);
      const nonCanonicalAfter = Object.entries(categoriesAfter)
        .filter(([cat]) => !CANONICAL_CATEGORIES.includes(cat))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      if (nonCanonicalAfter.length > 0) {
        console.log(`  Remaining non-canonical: ${nonCanonicalAfter.map(([cat, count]) => `"${cat}"=${count}`).join(', ')}`);
      } else {
        console.log("  ✓ All venues now in canonical categories!");
      }

      res.json({
        success: true,
        message: `Recategorization complete: ${changes.length} venues updated (${forcedUpdates} non-canonical)`,
        stats: {
          totalVenues: venues.length,
          venuesChecked: checked,
          venuesUpdated: changes.length,
          nonCanonicalFixed: forcedUpdates,
          errors,
          categoriesBefore,
          categoriesAfter
        },
        changes: changes.slice(0, 100) // Limit to first 100 changes in response
      });
    } catch (error: any) {
      console.error("Error recategorizing venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Scraped venues comparison endpoints
  app.post("/api/admin/scraped-venues/upload", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const { venues } = req.body;
      if (!Array.isArray(venues) || venues.length === 0) {
        return res.status(400).json({ message: "Invalid request: venues array required" });
      }

      // Clear existing scraped data and insert new
      await storage.clearScrapedImport();
      await storage.insertScrapedVenues(venues);

      res.json({
        success: true,
        message: `Uploaded ${venues.length} scraped venues for comparison`,
        count: venues.length
      });
    } catch (error: any) {
      console.error("Error uploading scraped venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/scraped-venues/comparison", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const comparison = await storage.getScrapedVenuesComparison();

      res.json({
        success: true,
        ...comparison
      });
    } catch (error: any) {
      console.error("Error getting scraped venues comparison:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/scraped-venues/clear", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      await storage.clearScrapedImport();

      res.json({
        success: true,
        message: "Cleared all scraped venues"
      });
    } catch (error: any) {
      console.error("Error clearing scraped venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to get venue analytics (region x category breakdown)
  app.get("/api/admin/venue-analytics", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      // Get all active curated venues
      const allVenues = await db
        .select()
        .from(curatedVenues)
        .where(eq(curatedVenues.isActive, true));

      // Aggregate by region and category
      const analytics: Record<string, Record<string, number>> = {};
      const regions = new Set<string>();
      const categories = new Set<string>();
      
      let totalRating = 0;
      let totalReviewCount = 0;
      let venuesWithRatings = 0;

      for (const venue of allVenues) {
        const region = venue.region || 'unknown';
        const category = venue.category || 'unknown';
        
        regions.add(region);
        categories.add(category);

        if (!analytics[region]) {
          analytics[region] = {};
        }
        analytics[region][category] = (analytics[region][category] || 0) + 1;

        // Aggregate quality metrics
        if (venue.rating) {
          totalRating += parseFloat(venue.rating);
          venuesWithRatings++;
        }
        if (venue.reviewCount) {
          totalReviewCount += venue.reviewCount;
        }
      }

      // Calculate averages
      const avgRating = venuesWithRatings > 0 ? totalRating / venuesWithRatings : 0;
      const avgReviews = allVenues.length > 0 ? totalReviewCount / allVenues.length : 0;

      res.json({
        success: true,
        summary: {
          totalVenues: allVenues.length,
          totalRegions: regions.size,
          totalCategories: categories.size,
          avgRating: Math.round(avgRating * 10) / 10,
          avgReviewCount: Math.round(avgReviews),
        },
        breakdown: analytics,
        regions: Array.from(regions).sort(),
        categories: Array.from(categories).sort(),
      });
    } catch (error: any) {
      console.error("Error fetching venue analytics:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to get filtered venues by region and category
  app.get("/api/admin/venues-by-filter", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const { region, category } = req.query;

      if (!region || !category) {
        return res.status(400).json({ message: "Missing region or category parameter" });
      }

      // Get filtered venues
      const venues = await db
        .select()
        .from(curatedVenues)
        .where(
          and(
            eq(curatedVenues.region, region as string),
            eq(curatedVenues.category, category as string),
            eq(curatedVenues.isActive, true)
          )
        )
        .orderBy(desc(curatedVenues.rating));

      res.json({
        success: true,
        region,
        category,
        count: venues.length,
        venues: venues.map(v => ({
          id: v.id,
          name: v.name,
          address: v.address,
          rating: v.rating,
          reviewCount: v.reviewCount,
          priceLevel: v.priceLevel,
          photoUrl: v.photoUrl,
          googlePlaceId: v.googlePlaceId,
          source: v.source,
        })),
      });
    } catch (error: any) {
      console.error("Error fetching filtered venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to upload scraped venues for comparison
  app.post("/api/admin/scraped-venues/upload", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const { venues } = req.body;

      if (!venues || !Array.isArray(venues)) {
        return res.status(400).json({ message: "Invalid request: venues must be an array" });
      }

      if (venues.length === 0) {
        return res.status(400).json({ message: "Invalid request: venues array cannot be empty" });
      }

      // Clear existing scraped venues
      await storage.clearScrapedImport();

      // Insert new scraped venues
      await storage.insertScrapedVenues(venues);

      res.json({ success: true, count: venues.length });
    } catch (error: any) {
      console.error("Error uploading scraped venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to get scraped venues comparison
  app.get("/api/admin/scraped-venues/comparison", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const comparison = await storage.getScrapedVenuesComparison();
      res.json(comparison);
    } catch (error: any) {
      console.error("Error fetching scraped venues comparison:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to clear scraped venues import
  app.delete("/api/admin/scraped-venues/clear", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      await storage.clearScrapedImport();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error clearing scraped venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to import selected scraped venues to curated cache
  app.post("/api/admin/scraped-venues/import", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      const { venues } = req.body;
      if (!Array.isArray(venues)) {
        return res.status(400).json({ message: "venues must be an array" });
      }

      const imported = await storage.importScrapedVenues(venues);
      res.json({ success: true, imported });
    } catch (error: any) {
      console.error("Error importing scraped venues:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to get API call logs with filtering
  app.get("/api/admin/api-logs", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      // Parse query parameters for filtering
      const {
        service,
        method,
        cacheStatus,
        status,
        limit = '100',
        offset = '0',
      } = req.query;

      // Query the API logs table
      const apiCallLogsTable = (await import('@shared/schema')).apiCallLogs;

      // Apply filters
      const conditions: any[] = [];
      if (service) {
        conditions.push(eq(apiCallLogsTable.service, service as string));
      }
      if (method) {
        conditions.push(eq(apiCallLogsTable.method, method as string));
      }
      if (cacheStatus) {
        conditions.push(eq(apiCallLogsTable.cacheStatus, cacheStatus as string));
      }
      if (status) {
        conditions.push(eq(apiCallLogsTable.status, status as string));
      }

      // Apply pagination
      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      // Build and execute the query
      const baseQuery = db.select().from(apiCallLogsTable);
      const logs = await (conditions.length > 0
        ? baseQuery.where(and(...conditions)).orderBy(desc(apiCallLogsTable.createdAt)).limit(limitNum).offset(offsetNum)
        : baseQuery.orderBy(desc(apiCallLogsTable.createdAt)).limit(limitNum).offset(offsetNum));

      // Get total count for pagination
      const countBaseQuery = db.select({ count: sql<number>`count(*)` }).from(apiCallLogsTable);
      const totalResult = await (conditions.length > 0
        ? countBaseQuery.where(and(...conditions))
        : countBaseQuery);
      const total = Number(totalResult[0]?.count) || 0;

      res.json({
        logs,
        total,
        limit: limitNum,
        offset: offsetNum,
      });
    } catch (error: any) {
      console.error("Error fetching API logs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to get API cost estimates and usage breakdown
  app.get("/api/admin/api-costs", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = await getUserId(req);
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      // Get period parameter (default: total)
      const period = (req.query.period as string || 'total').toLowerCase();
      
      // Calculate date threshold based on period
      let dateThreshold: Date | null = null;
      let periodLabel = 'Total';
      
      if (period === 'daily') {
        dateThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
        periodLabel = 'Daily';
      } else if (period === 'monthly') {
        dateThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
        periodLabel = 'Monthly';
      } else if (period === 'quarterly') {
        dateThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Last 90 days
        periodLabel = 'Quarterly';
      }

      // Get database counts with date filtering
      let activitiesCount: number;
      let geocodingCacheCount: number;
      let photosCacheCount: number;
      let groupsCount: number;

      if (dateThreshold) {
        [activitiesCount, geocodingCacheCount, photosCacheCount, groupsCount] = await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(activitiesTable).where(gte(activitiesTable.createdAt, dateThreshold)).then(r => Number(r[0]?.count) || 0),
          db.select({ count: sql<number>`count(*)` }).from(geocodingCache).where(gte(geocodingCache.createdAt, dateThreshold)).then(r => Number(r[0]?.count) || 0),
          db.select({ count: sql<number>`count(*)` }).from(photosCache).where(gte(photosCache.createdAt, dateThreshold)).then(r => Number(r[0]?.count) || 0),
          db.select({ count: sql<number>`count(*)` }).from(groupsTable).where(gte(groupsTable.createdAt, dateThreshold)).then(r => Number(r[0]?.count) || 0),
        ]);
      } else {
        // No date filter for 'total'
        [activitiesCount, geocodingCacheCount, photosCacheCount, groupsCount] = await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(activitiesTable).then(r => Number(r[0]?.count) || 0),
          db.select({ count: sql<number>`count(*)` }).from(geocodingCache).then(r => Number(r[0]?.count) || 0),
          db.select({ count: sql<number>`count(*)` }).from(photosCache).then(r => Number(r[0]?.count) || 0),
          db.select({ count: sql<number>`count(*)` }).from(groupsTable).then(r => Number(r[0]?.count) || 0),
        ]);
      }

      // Get unique places count with date filtering
      const uniquePlaces = dateThreshold
        ? await db
            .selectDistinct({ placeId: activitiesTable.googlePlaceId })
            .from(activitiesTable)
            .where(and(
              sql`${activitiesTable.googlePlaceId} IS NOT NULL`,
              gte(activitiesTable.createdAt, dateThreshold)
            ))
        : await db
            .selectDistinct({ placeId: activitiesTable.googlePlaceId })
            .from(activitiesTable)
            .where(sql`${activitiesTable.googlePlaceId} IS NOT NULL`);
      
      const uniquePlacesCount = uniquePlaces.length;

      // Count activities with uncached photos (direct Google URLs)
      let uncachedPhotosCount: number;
      if (dateThreshold) {
        uncachedPhotosCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(activitiesTable)
          .where(and(
            sql`${activitiesTable.photoUrl} LIKE 'https://maps.googleapis.com/%'`,
            gte(activitiesTable.createdAt, dateThreshold)
          ))
          .then(r => Number(r[0]?.count) || 0);
      } else {
        uncachedPhotosCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(activitiesTable)
          .where(sql`${activitiesTable.photoUrl} LIKE 'https://maps.googleapis.com/%'`)
          .then(r => Number(r[0]?.count) || 0);
      }

      // Get cache statistics
      const cacheStats = getCacheStats();
      
      // Get API key usage statistics
      const { getApiKeyStats } = await import('./google-places');
      const apiKeyStats = getApiKeyStats();

      // Get actual API call counts from logs (if available) or fall back to estimates
      const apiCallLogsTable = (await import('@shared/schema')).apiCallLogs;

      // Query actual API call logs filtered by period
      const baseLogQuery = db.select().from(apiCallLogsTable);
      const apiLogs = await (dateThreshold
        ? baseLogQuery.where(gte(apiCallLogsTable.createdAt, dateThreshold))
        : baseLogQuery);
      
      // Count actual calls by method and cache status
      let actualTextSearchCalls = 0;
      let actualPlaceDetailsCalls = 0;
      let actualGeocodingCalls = 0;
      let actualPhotoCalls = 0;
      
      let cachedTextSearchCalls = 0;
      let cachedPlaceDetailsCalls = 0;
      let cachedGeocodingCalls = 0;
      
      if (apiLogs.length > 0) {
        // Use actual API call data
        for (const log of apiLogs) {
          if (log.service === 'google_places') {
            if (log.method === 'textSearch') {
              if (log.cacheStatus === 'miss') actualTextSearchCalls++;
              if (log.cacheStatus === 'hit') cachedTextSearchCalls++;
            } else if (log.method === 'placeDetails') {
              if (log.cacheStatus === 'miss') actualPlaceDetailsCalls++;
              if (log.cacheStatus === 'hit') cachedPlaceDetailsCalls++;
            } else if (log.method === 'placePhotos') {
              if (log.cacheStatus === 'miss') actualPhotoCalls++;
            } else if (log.method === 'geocoding') {
              if (log.cacheStatus === 'miss') actualGeocodingCalls++;
              if (log.cacheStatus === 'hit') cachedGeocodingCalls++;
            }
          }
        }
      } else {
        // Fall back to estimates if no logs available (legacy mode)
        actualTextSearchCalls = Math.floor(activitiesCount / 15);
        actualPlaceDetailsCalls = uniquePlacesCount;
        actualGeocodingCalls = groupsCount;
      }

      // Cost calculations (per 1,000 requests) - only count actual API calls (cache misses)
      const textSearchCost = (actualTextSearchCalls / 1000) * 17; // $17 per 1K
      const placeDetailsCost = (actualPlaceDetailsCalls / 1000) * 5; // $5 per 1K (Basic tier)
      const geocodingCost = (actualGeocodingCalls / 1000) * 5; // $5 per 1K
      const cachedPhotoCost = (actualPhotoCalls / 1000) * 7; // $7 per 1K
      
      // Estimate uncached photo cost separately (these are ongoing view costs, not API calls)
      const VIEWS_PER_PHOTO_PER_DAY = 12;
      let estimatedUncachedPhotoViews = 0;
      let uncachedPhotoPeriodLabel = '';
      
      if (period === 'daily') {
        estimatedUncachedPhotoViews = uncachedPhotosCount * VIEWS_PER_PHOTO_PER_DAY;
        uncachedPhotoPeriodLabel = 'per day';
      } else if (period === 'monthly') {
        estimatedUncachedPhotoViews = uncachedPhotosCount * VIEWS_PER_PHOTO_PER_DAY * 30;
        uncachedPhotoPeriodLabel = 'per month (30 days)';
      } else if (period === 'quarterly') {
        estimatedUncachedPhotoViews = uncachedPhotosCount * VIEWS_PER_PHOTO_PER_DAY * 90;
        uncachedPhotoPeriodLabel = 'per quarter (90 days)';
      } else {
        const daysSinceStart = 19;
        estimatedUncachedPhotoViews = uncachedPhotosCount * VIEWS_PER_PHOTO_PER_DAY * daysSinceStart;
        uncachedPhotoPeriodLabel = `over ${daysSinceStart} days`;
      }
      
      const uncachedPhotoCost = (estimatedUncachedPhotoViews / 1000) * 7; // $7 per 1K (ongoing views)

      const totalCost = textSearchCost + placeDetailsCost + geocodingCost + cachedPhotoCost + uncachedPhotoCost;

      // Calculate savings from caching
      const savedTextSearchCalls = cacheStats.searchHits;
      const savedPlaceDetailsCalls = cacheStats.placeDetailsHits;
      const savedGeocodingCalls = cacheStats.geocodeHits;
      
      const savedTextSearchCost = (savedTextSearchCalls / 1000) * 17;
      const savedPlaceDetailsCost = (savedPlaceDetailsCalls / 1000) * 5;
      const savedGeocodingCost = (savedGeocodingCalls / 1000) * 5;
      
      const totalSavings = savedTextSearchCost + savedPlaceDetailsCost + savedGeocodingCost;

      res.json({
        period: period,
        periodLabel: periodLabel,
        apiCalls: {
          textSearch: {
            estimated: actualTextSearchCalls,
            cached: cachedTextSearchCalls,
            cost: textSearchCost,
            pricePerThousand: 17,
            note: apiLogs.length > 0 ? 'Actual API calls (cache misses)' : 'Estimated (no logs yet)',
          },
          placeDetails: {
            estimated: actualPlaceDetailsCalls,
            cached: cachedPlaceDetailsCalls,
            cost: placeDetailsCost,
            pricePerThousand: 5,
            tier: 'Basic',
            note: apiLogs.length > 0 ? 'Actual API calls (cache misses)' : 'Estimated (no logs yet)',
          },
          geocoding: {
            estimated: actualGeocodingCalls,
            cached: cachedGeocodingCalls,
            cost: geocodingCost,
            pricePerThousand: 5,
            note: apiLogs.length > 0 ? 'Actual API calls (cache misses)' : 'Estimated (no logs yet)',
          },
          cachedPhotos: {
            estimated: actualPhotoCalls,
            cost: cachedPhotoCost,
            pricePerThousand: 7,
            note: apiLogs.length > 0 ? 'Actual photo downloads (one-time)' : 'Estimated downloads',
          },
          uncachedPhotos: {
            estimated: estimatedUncachedPhotoViews,
            cost: uncachedPhotoCost,
            pricePerThousand: 7,
            count: uncachedPhotosCount,
            note: `Estimated photo views ${uncachedPhotoPeriodLabel} (ongoing cost)`,
          },
        },
        totals: {
          estimatedCalls: actualTextSearchCalls + actualPlaceDetailsCalls + actualGeocodingCalls + actualPhotoCalls + estimatedUncachedPhotoViews,
          estimatedCost: totalCost,
          actualCallsAvailable: apiLogs.length > 0,
        },
        caching: {
          textSearchHits: cacheStats.searchHits,
          placeDetailsHits: cacheStats.placeDetailsHits,
          geocodingHits: cacheStats.geocodeHits,
          totalHits: cacheStats.totalHits,
          hitRate: cacheStats.hitRate,
          savedCost: totalSavings,
        },
        apiKeys: {
          key1Calls: apiKeyStats.key1Calls,
          key2Calls: apiKeyStats.key2Calls,
          totalCalls: apiKeyStats.totalCalls,
          key2Configured: apiKeyStats.key2Configured,
        },
        database: {
          activities: activitiesCount,
          uniquePlaces: uniquePlacesCount,
          groups: groupsCount,
          geocodingCacheSize: geocodingCacheCount,
          photosCacheSize: photosCacheCount,
        },
      });
    } catch (error: any) {
      console.error("Error fetching API costs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // NOTIFICATION ENDPOINTS
  // ============================================================================

  // Get user's notifications
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const { limit, offset, unreadOnly } = req.query;

      const notifications = await getUserNotifications(userId, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        unreadOnly: unreadOnly === 'true',
      });

      res.json(notifications);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      const count = await getUnreadCount(userId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Mark a notification as read
  app.post("/api/notifications/:id/mark-read", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await markAsRead(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await getUserId(req);
      await markAllAsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a notification
  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await deleteNotification(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // PLANNING INSIGHTS ENDPOINTS
  // ============================================

  // Get planning insights for a group
  app.get("/api/groups/:id/planning-insights", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = req.params.id;
      const userId = await getUserId(req);

      // Verify user has access to this group
      const group = await storage.getGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const members = await storage.getGroupMembers(groupId);
      const isMember = group.userId === userId || members.some(m => m.userId === userId);
      if (!isMember) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { getGroupInsights } = await import('./planning-agent');
      const insights = await getGroupInsights(groupId, userId);

      res.json(insights);
    } catch (error: any) {
      console.error("Error fetching planning insights:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dismiss a planning insight
  app.post("/api/planning-insights/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const insightId = req.params.id;
      const userId = await getUserId(req);

      const { dismissInsight } = await import('./planning-agent');
      await dismissInsight(insightId, userId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error dismissing insight:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Mark an insight as acted upon
  app.post("/api/planning-insights/:id/acted", isAuthenticated, async (req: any, res) => {
    try {
      const insightId = req.params.id;
      const { actionStatus, actionDetails } = req.body;

      const { markInsightActed } = await import('./planning-agent');
      await markInsightActed(insightId, actionStatus || 'user_acted', actionDetails);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking insight as acted:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Manually trigger planning agent for a group (for testing/debugging)
  app.post("/api/groups/:id/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const groupId = req.params.id;
      const userId = await getUserId(req);

      // Verify user is the group owner
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only group owner can trigger analysis" });
      }

      const { analyzeGroup } = await import('./planning-agent');
      const insightCount = await analyzeGroup(groupId);

      res.json({
        success: true,
        insightsGenerated: insightCount,
        message: insightCount > 0
          ? `Generated ${insightCount} new insight(s)`
          : 'No new insights to report'
      });
    } catch (error: any) {
      console.error("Error running planning agent:", error);
      res.status(500).json({ message: error.message });
    }
  });

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