// Reference: javascript_log_in_with_replit blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGroupSchema, insertMemberSchema, updateGroupSchema, updateMemberSchema, insertVotingEventSchema, updateVotingEventSchema, insertItinerarySchema, updateItinerarySchema, updateUserProfileSchema, activities as activitiesTable, groups as groupsTable, members as membersTable, itineraryInvites, guestInvites, rsvps as rsvpsTable, itineraries, itineraryItems, proposedTimeSlots, users, userProfiles, photosCache, geocodingCache, hostAssignments, curatedVenues, votingEvents as votingEventsTable, activitySwipes, activities, votingEvents, swipeSessions, type UpdateItinerary, type ItineraryItem } from "@shared/schema";
import { generateActivitySuggestions, generateSwipeConcepts, categorizeByTime, categorizeVenue, analyzePreferencePatterns, parseSchedulingPrompt, detectCategory } from "./openai";
import { searchPlaces, searchNearbyPlaces, geocodeLocation, clearPlacesCache, getCacheStats, getPlaceDetails, detectAndParseGoogleMapsUrl } from "./google-places";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  requireGroupOwnership,
  requireGroupAccess,
  requireItineraryAccess,
  requireVotingEventAccess,
  requireCollectionOwnership,
  requireMemberAccess,
  requireAdmin,
  getUserId
} from "./authorization";
import { validateItinerary } from "./itinerary-validation";
import { sendMemberWelcome, type EmailRecipient, type MemberWelcomeData } from "./email-service";
import { autoUpdateMemberConstraints, calculateEngagement } from "./member-learning";
import { generateGroupInsights, saveGroupInsights, dismissInsight, editInsightSuggestion } from "./group-insights";
import { triggerInsightUpdate, triggerInsightUpdateDebounced } from "./insight-triggers";
import { db } from "./db";
import { eq, sql, and, or, gte, desc, isNotNull } from "drizzle-orm";
import { format } from 'date-fns';
import { validate, safeParse } from './validation-middleware';
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
} from './validation-schemas';

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
    console.log(`[Feedback Tracking] Group ${groupId} feedback count: ${newCount}`);

    if (newCount > 0 && newCount % 15 === 0) {
      console.log(`[Feedback Tracking] Triggering insights analysis at ${newCount} feedback actions`);
      
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

          console.log(`[Feedback Tracking] Insights updated for group ${groupId}`);
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

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;

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

      // Not in cache or expired - download from Google using NEW Photos API
      console.log(`[Photo Cache v1] MISS - downloading ${photoName}`);
      
      const apiKey = process.env.GOOGLE_PLACES_API_KEY_2 || process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google API key not configured" });
      }

      // NEW Places API Photo Media endpoint
      // https://places.googleapis.com/v1/{photoName}/media?key=API_KEY&maxWidthPx=400
      const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400`;
      
      const photoResponse = await fetch(photoUrl, {
        headers: {
          'X-Goog-Api-Key': apiKey,
        },
      });

      if (!photoResponse.ok) {
        console.error(`[Photo Cache v1] Failed to fetch photo: ${photoResponse.status}`);
        return res.status(404).json({ message: "Photo not found" });
      }

      const photoBuffer = await photoResponse.arrayBuffer();
      const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';
      const base64Data = Buffer.from(photoBuffer).toString('base64');

      // Cache it (use photoName as key)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      await db
        .insert(photosCache)
        .values({
          photoReference: photoName,
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

      console.log(`[Photo Cache v1] SAVED - ${photoName} (expires in 30 days)`);

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
          console.log(`[Photo Cache] EXPIRED - ${photoReference}`);
          await db.delete(photosCache).where(eq(photosCache.photoReference, photoReference));
        } else {
          console.log(`[Photo Cache] HIT - ${photoReference}`);
          const imageBuffer = Buffer.from(cachedPhoto.imageData, 'base64');
          res.set('Content-Type', cachedPhoto.contentType);
          res.set('Cache-Control', 'public, max-age=2592000'); // 30 days
          return res.send(imageBuffer);
        }
      }

      // Not in cache or expired - download from Google
      console.log(`[Photo Cache] MISS - downloading ${photoReference}`);
      
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

      console.log(`[Photo Cache] SAVED - ${photoReference} (expires in 30 days)`);

      // Return the photo
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=2592000'); // 30 days
      res.send(Buffer.from(photoBuffer));

    } catch (error) {
      console.error("Error fetching photo:", error);
      res.status(500).json({ message: "Failed to fetch photo" });
    }
  });

  // Bulk import curated venues (admin only - for seeding SF data)
  app.post('/api/admin/import-venues', isAuthenticated, requireAdmin(), async (req, res) => {
    try {
      console.log('[Venue Import] Endpoint hit, body:', typeof req.body, Object.keys(req.body || {}));

      // Validate request body
      const validatedData = safeParse(importVenuesSchema, req.body, res);
      if (!validatedData) return;

      const { venues } = validatedData;

      console.log(`[Venue Import] Starting import of ${venues.length} venues`);

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
          const address = `${venue.street}, ${venue.city}, ${venue.state} ${venue.countryCode}`;

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
            console.log(`[Venue Import] Geocoding failed for ${venue.title}, using 0,0`);
          }

          // Insert venue
          await db.insert(curatedVenues).values({
            name: venue.title,
            address,
            latitude,
            longitude,
            category: mapCategory(venue.categoryName),
            rating: venue.totalScore?.toString() || null,
            reviewCount: venue.reviewsCount || null,
            priceLevel: null, // Not in source data
            photoUrl: null, // Will be populated on first use
            googlePlaceId: placeId,
            description: null,
            tags: [venue.categoryName], // Store original category as tag
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

      console.log(`[Venue Import] Complete: ${imported.length} imported, ${skipped.length} skipped`);

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
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      res.json(profile || { displayName: '', bio: '', emailNotifications: true });
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);

      // Return preferences-specific fields
      res.json({
        budget: profile?.budget || null,
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
      const userId = req.user.claims.sub;

      // Only allow updating preference fields
      const { budget, activityPreferences, personalAvailability, emailNotifications } = req.body;
      const updateData: any = {};

      if (budget !== undefined) updateData.budget = budget;
      if (activityPreferences !== undefined) updateData.activityPreferences = activityPreferences;
      if (personalAvailability !== undefined) updateData.personalAvailability = personalAvailability;
      if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;

      const profile = await storage.upsertUserProfile(userId, updateData);

      // Return preferences-specific fields
      res.json({
        budget: profile.budget,
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
      const userId = req.user.claims.sub;
      const { groupId } = req.params;

      // Verify user has access to this group
      await requireGroupAccess(userId, groupId);

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
      const userId = req.user.claims.sub;
      const { groupId } = req.params;

      // Verify user has access to this group
      await requireGroupAccess(userId, groupId);

      const {
        budgetOverrideMin,
        budgetOverrideMax,
        categoryPreferencesOverride,
        availabilityOverride,
        meetingFrequencyOverride,
      } = req.body;

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

  // Get user's groups
  app.get("/api/user/groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groups = await storage.getUserGroups(userId);
      res.json(groups);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Export user groups as backup (downloadable JSON)
  app.get("/api/user/groups/backup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const collections = await storage.getUserGroupCollections(userId);
      res.json(collections);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get member dashboard data (all groups, events, stats)
  app.get("/api/user/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

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

      // Get full group details for all groups
      const groups = await Promise.all(
        Array.from(allGroupIds).map(async (groupId) => {
          const [group] = await db
            .select()
            .from(groupsTable)
            .where(eq(groupsTable.id, groupId));

          if (!group) return null;

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
          attended: rsvp?.attended || false,
          venues: items.map(item => ({
            name: item.venueName,
            type: item.venueType,
          })),
        };

        totalInvited++;
        if (rsvp?.response) totalResponded++;
        if (rsvp?.attended) totalAttended++;

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
      const userId = req.user.claims.sub;
      const { name, orderIndex } = req.body;
      const collection = await storage.createGroupCollection(userId, { name, orderIndex });
      res.json(collection);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a group collection
  app.patch("/api/user/collections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { name } = req.body;
      
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
      const userId = req.user.claims.sub;
      
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
      const userId = req.user.claims.sub;
      const { collectionOrders } = req.body; // Array of { id, orderIndex }
      
      // Verify all collections belong to this user
      const userCollections = await storage.getUserGroupCollections(userId);
      const userCollectionIds = new Set(userCollections.map(c => c.id));
      const allOwned = collectionOrders.every((order: any) => userCollectionIds.has(order.id));
      
      if (!allOwned) {
        return res.status(403).json({ message: "You don't own all these collections" });
      }
      
      await storage.reorderGroupCollections(collectionOrders);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update group's collection assignment
  app.patch("/api/groups/:id/collection", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
  app.get("/api/user/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

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
          groupUserId: groupsTable.userId,
        })
        .from(itineraryInvites)
        .leftJoin(itineraries, eq(itineraryInvites.itineraryId, itineraries.id))
        .leftJoin(groupsTable, eq(itineraries.groupId, groupsTable.id));

      // Filter to only invites relevant to this user
      const verifiedInvites = [];
      const seenItineraryIds = new Set<string>();
      
      for (const invite of invitesQuery) {
        // Check if user is the group organizer
        const isGroupOrganizer = invite.groupUserId === userId;
        
        if (isGroupOrganizer) {
          // User owns the group - only add once per itinerary (deduplicate)
          if (!seenItineraryIds.has(invite.itineraryId)) {
            verifiedInvites.push({ ...invite, isOrganizer: true });
            seenItineraryIds.add(invite.itineraryId);
          }
        } else if (invite.memberId) {
          // Not the organizer - check if they're a claimed member
          const member = await storage.getMember(invite.memberId);
          if (member && member.userId === userId) {
            verifiedInvites.push({ ...invite, isOrganizer: false });
          }
        }
      }

      // Fetch RSVP status and itinerary items for each invite
      const events = await Promise.all(verifiedInvites.map(async (invite) => {
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

        // Get group members for hosting info
        const groupMembers = await db
          .select({
            id: membersTable.id,
            name: membersTable.name,
            email: membersTable.email,
            openToHosting: membersTable.openToHosting,
          })
          .from(membersTable)
          .where(eq(membersTable.groupId, invite.groupId));

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
        const detailedRsvps = [];

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
          
          if (name && r.response) {
            rsvpSummary[r.response as 'yes' | 'maybe' | 'no'].push(name);
            
            // Add detailed RSVP info
            detailedRsvps.push({
              name,
              response: r.response,
              additionalAttendees: r.additionalAttendees || [],
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

        // Add guest invites to detailed RSVPs
        for (const gi of allGuestInvites) {
          // Only add if they have responded (to avoid duplicating pending invites)
          if (gi.rsvpStatus && gi.rsvpStatus !== null) {
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

        return {
          inviteId: invite.inviteId,
          inviteToken: invite.inviteToken,
          itineraryId: invite.itineraryId,
          itineraryName: invite.itineraryName,
          eventDate: invite.eventDate,
          status: invite.status,
          groupId: invite.groupId,
          groupName: invite.groupName,
          groupEmoji: invite.groupEmoji,
          isOrganizer: invite.isOrganizer,
          hostMemberId: itinerary?.hostMemberId || null,
          hostMemberName,
          currentUserMemberId,
          currentUserOpenToHosting,
          members: groupMembers.map(m => ({
            id: m.id,
            name: m.name,
            email: m.email,
            openToHosting: m.openToHosting || false,
          })),
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

      // Add draft itineraries (auto-created for scheduled groups)
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
        .where(
          and(
            eq(itineraries.status, 'draft'),
            eq(itineraries.isSaved, false),
            sql`${itineraries.groupId} IN (SELECT id FROM groups WHERE user_id = ${userId})`
          )
        );

      // Convert draft itineraries to event format
      const draftEvents = await Promise.all(draftItineraries.map(async (draft) => {
        // Get itinerary items
        const items = await db
          .select()
          .from(itineraryItems)
          .where(eq(itineraryItems.itineraryId, draft.itineraryId))
          .orderBy(itineraryItems.orderIndex);

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
          members: [],
          rsvp: null,
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
          })),
          isVirtual: false, // Draft itineraries are real, not virtual
          meetingFrequency: null,
        };
      }));

      // Add virtual future events for recurring groups with auto-schedule enabled
      const userGroups = await db
        .select()
        .from(groupsTable)
        .where(
          and(
            eq(groupsTable.userId, userId),
            eq(groupsTable.autoScheduleEnabled, true),
            isNotNull(groupsTable.nextEventDueDate)
          )
        );

      const virtualEvents = [];
      for (const group of userGroups) {
        if (!group.nextEventDueDate || !group.meetingFrequency) continue;

        // Calculate next 2 future event dates
        const { calculateFutureEventDates } = await import('./auto-scheduler');
        const futureDates = calculateFutureEventDates(
          new Date(group.nextEventDueDate),
          group.meetingFrequency,
          2
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

        for (const date of futureDates) {
          const dateStr = date.toISOString().split('T')[0];

          // Skip if a real event or draft itinerary already exists for this date
          if (existingEventDates.has(dateStr) || draftEventDates.has(dateStr)) continue;

          // Create virtual event object
          virtualEvents.push({
            inviteId: `virtual-${group.id}-${dateStr}`,
            inviteToken: null,
            itineraryId: null,
            itineraryName: `${group.name}`,
            eventDate: date.toISOString(),
            status: 'virtual' as any, // Special status to indicate this is a placeholder
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
          });
        }
      }

      // Merge real events, draft itineraries, and virtual events
      const allEvents = [...events, ...draftEvents, ...virtualEvents];

      // Sort by event date (upcoming first, then past)
      allEvents.sort((a, b) => {
        if (!a.eventDate && !b.eventDate) return 0;
        if (!a.eventDate) return 1;
        if (!b.eventDate) return -1;
        return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
      });

      res.json(allEvents);
    } catch (error: any) {
      console.error('[User Events] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's pending hosting requests
  app.get("/api/user/hosting-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

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
      const userId = req.user.claims.sub;

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
      generateAndStoreActivities(group.id, validatedGroup);

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
          
          // Use fallback chain: budgetOverride → global profile budget
          if (memberPrefs?.budgetOverride) {
            memberBudgets.push(memberPrefs.budgetOverride);
          } else {
            // Try global profile
            const profile = await storage.getUserProfile(member.userId);
            if (profile?.budget) {
              memberBudgets.push(profile.budget);
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
      res.json({ ...updatedGroup, geocodingResult });
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

  // Pause automation for a group
  app.post("/api/groups/:id/pause-automation", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const { pauseType, value } = req.body;
      const updates: any = {
        automationPaused: true,
      };

      if (pauseType === 'events' && typeof value === 'number') {
        // Pause for N events
        updates.automationPauseEventsRemaining = value;
        updates.automationPausedUntil = null;
      } else if (pauseType === 'until' && value) {
        // Pause until specific date
        updates.automationPausedUntil = new Date(value);
        updates.automationPauseEventsRemaining = null;
      } else {
        return res.status(400).json({ message: "Invalid pause parameters" });
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
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Update itinerary to proposed status
      const { addDays } = await import('date-fns');
      const eventDate = new Date(event.proposedDate);
      const rsvpDeadline = addDays(eventDate, -3);

      await storage.updateItinerary(itinerary.id, {
        status: 'proposed',
        eventDate: event.proposedDate,
        rsvpDeadline,
        autoScheduleConfig: {
          inviteAdvanceDays: 14,
          rsvpWindowDays: 11,
          reminders: [
            { type: 'gentle_nudge', daysBeforeDeadline: 7 },
            { type: 'final_call', daysBeforeDeadline: 1 },
            { type: 'day_before', daysBeforeEvent: 1 }
          ]
        }
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

  // Trigger auto-schedule for a group (manually create pending event if within window)
  app.post("/api/groups/:id/trigger-auto-schedule", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (!group.autoScheduleEnabled) {
        return res.status(400).json({ message: "Auto-scheduling is not enabled for this group" });
      }

      if (!group.userId) {
        return res.status(400).json({ message: "Group must have an owner" });
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
        console.log('[Auto-Schedule] Auto-itinerary enabled - creating combinations from activities');
        selection = await selectBestItineraryForAutoSchedule(storage, group);
      } else {
        // Auto-itinerary disabled - only use existing saved itineraries
        console.log('[Auto-Schedule] Auto-itinerary disabled - checking for saved itineraries');
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
        return res.status(400).json({ message: "No viable itineraries or activities to schedule" });
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
            name: `${originalItinerary.name} (Auto-Scheduled)`,
            status: "draft",
          },
          group.userId,
          originalItems.map(item => ({
            sourceType: item.sourceType,
            sourceId: item.sourceId
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
            name: "Upcoming Hangout",
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
            name: `Auto-scheduled event for ${group.name}`,
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

        console.log(`[Auto-Schedule] Created itinerary ${itineraryId} with ${members.length} invites for options flow`);
      } else {
        return res.status(400).json({ message: "No valid selection" });
      }

      // Validate and optimize itinerary ordering using AI (only if itinerary was created)
      if (itineraryId) {
        console.log(`[Manual Trigger] Validating itinerary order with AI...`);
        try {
          const { validateItinerary } = await import('./itinerary-validation.js');
          const itineraryWithItems = await storage.getItinerary(itineraryId);
          if (!itineraryWithItems) {
            throw new Error('Itinerary not found for validation');
          }
          const itineraryItems = itineraryWithItems.items;

          // Prepare venues for validation
          const venuesForValidation = itineraryItems.map(item => ({
            sourceType: item.sourceType,
            sourceId: item.sourceId,
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

            console.log(`[Manual Trigger] ✅ AI validation complete: ${validation.validationNotes || 'Order optimized'}`);
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
        if (!itinerary) {
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

        console.log(`[Manual Trigger] Using aggregated availability from ${aggregatedAvailability.memberCount} members`);

        // Convert to text format for AI
        const availabilityString = convertAvailabilityToText(
          aggregatedAvailability.grid,
          aggregatedAvailability.conflicts,
          aggregatedAvailability.memberCount
        );

        console.log(`[Manual Trigger] Availability string: "${availabilityString}"`);
        console.log(`[Manual Trigger] Venues: ${JSON.stringify(venues)}`);

        // Use AI to find optimal time
        const timeResult = await suggestOptimalTime({
          generalAvailability: availabilityString,
          venues,
          location: group.locationBase,
          meetingFrequency: group.meetingFrequency || undefined,
          timezone: group.timezone || undefined,
        });

        proposedDate = timeResult.eventDate;
        console.log(`[Manual Trigger] AI suggested optimal time: ${proposedDate.toISOString()}, reasoning: ${timeResult.reasoning}`);
      } catch (err) {
        console.error('[Manual Trigger] AI time suggestion failed, using fallback:', err);
        proposedDate = group.nextEventDueDate ? new Date(group.nextEventDueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      }

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
      console.log('[Auto-Schedule] Calculating confidence score...');
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
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const slotKey = `${dayNames[dayOfWeek]}-${timePeriod}`;
      const membersAvailable = availability.grid[slotKey] || 0;
      const totalMembers = availability.memberCount;

      const confidenceResult = await calculateEventConfidence(
        storage,
        group.id,
        venuesForConfidence,
        proposedDate,
        membersAvailable,
        totalMembers
      );

      console.log('[Auto-Schedule] Confidence calculated:', {
        score: confidenceResult.score,
        factors: confidenceResult.factors,
        summary: confidenceResult.plainLanguageSummary,
      });

      // Determine initial status based on confidence
      // ≥80: auto-approve immediately
      // <80: pending (requires organizer review or will auto-send after 48hrs)
      const shouldAutoApprove = confidenceResult.score >= 80;
      const initialStatus = shouldAutoApprove ? 'auto_approved' : 'pending';
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
        console.log(`[Auto-Schedule] Updated itinerary ${itineraryId} with eventDate: ${proposedDate.toISOString()}`);
      }

      // Create itineraryOptions if we have options (for member voting and auto-approval)
      if ('options' in selection && selection.options && selection.options.length > 0) {
        console.log(`[Auto-Schedule] Creating ${selection.options.length} itinerary options`);
        const { itineraryOptions } = await import('@shared/schema');

        for (const option of selection.options) {
          await db.insert(itineraryOptions).values({
            autoEventId: pendingEvent.id,
            optionNumber: option.optionNumber,
            venues: option.venues, // Already in correct format from selectBestItineraryForAutoSchedule
            description: option.description,
          });
        }
        console.log('[Auto-Schedule] ✅ Itinerary options created');
      }

      // If auto-approved (≥80% confidence), immediately create the itinerary
      if (shouldAutoApprove) {
        console.log('[Auto-Schedule] High confidence (≥80%) - auto-approving event');
        const { approveAndCreateItinerary } = await import('./auto-approval.js');
        const approvalResult = await approveAndCreateItinerary(
          pendingEvent.id,
          null, // Let it determine best option
          'auto'
        );

        if (approvalResult.success) {
          console.log('[Auto-Schedule] ✅ Event auto-approved and itinerary created');
        } else {
          console.error('[Auto-Schedule] ❌ Auto-approval failed:', approvalResult.error);
        }
      } else if (requiresReview) {
        console.log('[Auto-Schedule] ⚠️  Low confidence (<60%) - flagged for organizer review');
      } else {
        console.log('[Auto-Schedule] ⏳ Medium confidence (60-79%) - pending organizer approval');
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

  // Get group by shareable link
  app.get("/api/groups/by-link/:shareableLink", async (req, res) => {
    try {
      const group = await storage.getGroupByShareableLink(req.params.shareableLink);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      res.json(group);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get group members
  app.get("/api/groups/:id/members", async (req, res) => {
    try {
      const members = await storage.getGroupMembers(req.params.id);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get group activities
  app.get("/api/groups/:id/activities", async (req, res) => {
    try {
      const activities = await storage.getGroupActivities(req.params.id);
      res.json(activities);
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

      // First fetch the activity to check ownership
      const activities = await storage.getAllGroupActivities(''); // We'll use a workaround
      const activity = activities.find(a => a.id === req.params.activityId);

      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      // Verify user owns the group
      const userId = getUserId(req);
      const group = await storage.getGroup(activity.groupId);

      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You don't have access to this activity" });
      }

      const updatedActivity = await storage.updateActivityFeedback(req.params.activityId, feedback);

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
      const userId = getUserId(req);

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
        ...validatedData,
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
      const userId = getUserId(req);

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
      const userId = getUserId(req);

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
      const userId = getUserId(req);

      // Get session to verify group membership
      const sessionData = await db
        .select()
        .from(swipeSessions)
        .where(eq(swipeSessions.id, sessionId))
        .limit(1);

      if (sessionData.length === 0) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Verify user is organizer
      const group = await storage.getGroup(sessionData[0].groupId);
      if (!group || group.organizerId !== userId) {
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
      const userId = getUserId(req);

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
      const userId = getUserId(req);

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
      const userId = getUserId(req);

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
      const userId = getUserId(req);

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
      const userId = getUserId(req);

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
      const userId = getUserId(req);

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
      const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';
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

  // Join a group
  app.post("/api/groups/:id/join", async (req, res) => {
    try {
      // Validate request body
      const validatedData = safeParse(joinGroupSchema, req.body, res);
      if (!validatedData) return;

      const { name, email, availability, preferences } = validatedData;

      const memberData = {
        groupId: req.params.id,
        name: name || null,
        email: email || null,
        availability: availability || null,
        preferences: preferences || null,
        isOrganizer: false,
        invitationSent: false,
        hasJoined: true,
      };

      const member = await storage.createMember(memberData);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get individual member by ID (requires authentication)
  app.get("/api/members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      res.json(member);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update member (requires authentication - user must be group owner OR the member themselves)
  app.patch("/api/members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
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
      const userId = getUserId(req);
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
        const itinerary = await storage.getItinerary(invite.itineraryId);
        if (!itinerary) {
          return res.status(404).json({ message: "Itinerary not found" });
        }
        
        // Get group to find organizer
        const group = await storage.getGroup(itinerary.groupId);
        if (!group) {
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
      });
    } catch (error: any) {
      console.error('[Verify Invite] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Claim a member identity (no auth required)
  app.post("/api/members/:id/claim", async (req, res) => {
    try {
      const { claimToken } = req.body;
      
      if (!claimToken) {
        return res.status(400).json({ message: "Claim token required" });
      }

      // Check if member exists and if already claimed
      const existingMember = await storage.getMember(req.params.id);
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
      const member = await storage.updateMember(req.params.id, {
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
      const userId = req.user.claims.sub;

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

  // Event Hosting Routes

  // Toggle member hosting availability (authenticated or via claim token)
  app.patch("/api/members/:id/hosting-toggle", requireMemberAccess(), async (req: any, res) => {
    try {
      const { openToHosting, claimToken } = req.body;
      const userId = req.user?.claims?.sub;

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
      const userId = req.user?.claims?.sub;

      if (!userId && !claimToken) {
        return res.status(401).json({ message: "Authentication or claim token required" });
      }

      // Get the itinerary to find the group
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary) {
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
      const userId = req.user?.claims?.sub;

      if (!userId && !claimToken) {
        return res.status(401).json({ message: "Authentication or claim token required" });
      }

      // Get the itinerary
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary) {
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
      const userId = req.user?.claims?.sub;

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
      const userId = req.user?.claims?.sub;

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
      const userId = req.user?.claims?.sub;

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
      const userId = req.user?.claims?.sub;

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
      const userId = req.user.claims.sub;

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

  // Get member's events (pending invitations, upcoming, past)
  // Supports both authenticated users and unclaimed members via claim token
  app.get("/api/members/me/events", async (req: any, res) => {
    try {
      const { claimToken } = req.query;
      const userId = req.user?.claims?.sub;

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
        const group = groupsById.get(itinerary.groupId);
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
    try {
      // Validate request body
      const validatedData = safeParse(createRsvpSchema, req.body, res);
      if (!validatedData) return;

      const { itineraryId, inviteToken, response, rsvpFeedback, claimedMemberId, guestName, additionalAttendees, numberOfKids } = validatedData;

      // Verify invite token
      const invites = await db
        .select()
        .from(itineraryInvites)
        .where(sql`invite_token = ${inviteToken}`);

      if (invites.length === 0) {
        return res.status(401).json({ message: "Invalid invite token" });
      }

      const invite = invites[0];

      // Verify the invite is for this specific itinerary (critical security check)
      if (invite.itineraryId !== itineraryId) {
        return res.status(403).json({ message: "This invite is not valid for this itinerary" });
      }

      // Fetch itinerary to verify it exists
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Determine which member to use
      let memberId = claimedMemberId || invite.memberId;
      
      // If guest RSVP, memberId should be null
      if (guestName && !claimedMemberId) {
        memberId = null;
      }

      // For member RSVPs, verify member exists
      if (memberId) {
        const member = await storage.getMember(memberId);
        if (!member) {
          return res.status(404).json({ message: "Member not found" });
        }
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
        // Update existing RSVP
        const updated = await db
          .update(rsvpsTable)
          .set(rsvpData)
          .where(sql`id = ${existingRsvps[0].id}`)
          .returning();
        rsvp = updated[0];
      } else {
        // Create new RSVP
        const inserted = await db
          .insert(rsvpsTable)
          .values({
            itineraryId,
            memberId: memberId || null,
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
      if (memberId && rsvpFeedback) {
        autoUpdateMemberConstraints(memberId, itinerary.groupId).catch(err => {
          console.error(`[RSVP] Pattern analysis failed:`, err);
        });

        // 🎯 INSIGHT TRIGGER: Update group insights after RSVP with feedback
        // Debounced to avoid excessive regeneration (max once per 6 hours)
        triggerInsightUpdateDebounced(itinerary.groupId, 'rsvp-collected', 6).catch(err => {
          console.error(`[RSVP] Insight update failed:`, err);
        });
      }

      res.json(rsvp);
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
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Fetch RSVP
      const rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(
          sql`itinerary_id = ${itineraryId} AND member_id = ${memberId}`
        );

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
    try {
      // Validate request body
      const validatedData = safeParse(organizerRsvpSchema, req.body, res);
      if (!validatedData) return;

      const userId = req.user.claims.sub;
      const { itineraryId } = req.params;
      const { response, rsvpFeedback } = validatedData;

      // Verify itinerary exists and user is the group owner
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      if (group.userId !== userId) {
        return res.status(403).json({ message: "Only the group organizer can use this endpoint" });
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

      res.json(rsvp);
    } catch (error: any) {
      console.error('[Organizer RSVP] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve a pending guest RSVP (organizer only)
  app.post("/api/rsvps/:rsvpId/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      if (!itinerary) {
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
      const userId = req.user.claims.sub;
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
      if (!itinerary) {
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
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { response } = req.body;

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
      if (!itinerary) {
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
      const userId = req.user.claims.sub;
      const { id } = req.params;

      // Get the invite
      const [invite] = await db
        .select()
        .from(itineraryInvites)
        .where(eq(itineraryInvites.id, id));

      if (!invite) {
        return res.status(404).json({ message: "Invite not found" });
      }

      // Get the itinerary and verify the user is the organizer
      const itinerary = await storage.getItinerary(invite.itineraryId);
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      const group = await storage.getGroup(itinerary.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only the organizer can remove invites" });
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
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a voting event (authenticated) - enriches with Google Places data
  app.post("/api/voting-events", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
            const place = places[0];
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
            console.log(`[Voting Event] Enriched "${validatedEvent.title}" with Google Places data:`, {
              name: place.name,
              rating: place.rating,
              reviewCount: place.reviewCount,
              address: place.address,
            });
          } else {
            enrichmentStatus = 'no_results';
            console.log(`[Voting Event] No Google Places results for "${validatedEvent.title}"`);
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
        console.log(`[Voting Event] Skipping enrichment check for "${validatedEvent.title}"`);
      }

      // Check for duplicates (unless explicitly allowing duplicates)
      const allowDuplicate = req.body.allowDuplicate === true;
      if (!allowDuplicate && enrichedEvent.googlePlaceId) {
        const existingEvents = await storage.getGroupVotingEvents(validatedEvent.groupId);
        const duplicate = existingEvents.find(e => e.googlePlaceId === enrichedEvent.googlePlaceId);

        if (duplicate) {
          console.log(`[Voting Event] Duplicate detected: "${validatedEvent.title}" (Google Place ID: ${enrichedEvent.googlePlaceId})`);
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

      const userId = req.user.claims.sub;
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
  app.delete("/api/voting-events/:id", isAuthenticated, requireVotingEventAccess(), async (req: any, res) => {
    try {
      const event = await storage.getVotingEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const userId = req.user.claims.sub;
      if (event.createdBy !== userId) {
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

      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

      console.log(`[Category Regen] Regenerating ${category} for group ${req.params.id}`);
      console.log(`[Category Regen] Avoiding ${currentVenueNames?.length || 0} current venues`);
      console.log(`[Category Regen] Preserving ${checkedActivityIds?.length || 0} checked activities`);

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
      console.log(`[Category Regen] Need ${neededCount} new activities (have ${checkedCount} checked)`);

      if (neededCount <= 0) {
        console.log(`[Category Regen] Category already has 3 cards (all checked), skipping regeneration`);
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
      console.log(`[Category Regen] Found ${seenVenueNames.length} seen venues to exclude from suggestions`);

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
        console.log(`[Category Regen] Attempt ${attempt}/${maxAttempts}: Need ${neededCount - allValidActivities.length} more venues`);

        // Refresh group data to get latest rejected venues
        const refreshedGroup = await storage.getGroup(req.params.id);
        if (!refreshedGroup) {
          return res.status(404).json({ message: "Group not found" });
        }
        const rejectedVenues = refreshedGroup.rejectedVenues || [];
        const rejectedSet = new Set(rejectedVenues.map(v => v.toLowerCase()));
        console.log(`[Category Regen] Blacklisted venues: ${rejectedVenues.length}`);

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

        console.log(`[Category Regen] Attempt ${attempt}: Got ${suggestions.length} suggestions for ${category}`);

        // Filter out rejected venues AND disabled categories before calling Google Places
        const filteredSuggestions = suggestions.filter(s => {
          const normalized = s.venueName.trim().toLowerCase();
          
          // Skip blacklisted venues
          if (rejectedSet.has(normalized)) {
            console.log(`[Category Regen] Skipping blacklisted venue: ${s.venueName}`);
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
            console.log(`[Category Regen] Skipping ${s.venueName} (${s.venueType}) - ${detectedCategory} category is disabled`);
            return false;
          }
          
          return true;
        });
        console.log(`[Category Regen] After category + blacklist filter: ${filteredSuggestions.length}/${suggestions.length} suggestions`);

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
            console.log(`[Category Regen] Rejecting ${suggestion.venueName} - no Google Places results found (fake venue)`);
            await storage.addRejectedVenue(req.params.id, suggestion.venueName);
            return null;
          }

          const searchRadius = refreshedGroup.searchRadius || 2;
          const qualityFiltered = places.filter(place => {
            const rating = parseFloat(place.rating || '0');
            const reviewCount = place.reviewCount || 0;

            // Stricter quality requirements to ensure legitimacy
            if (searchRadius <= 2) {
              return rating >= 3.5 && reviewCount >= 20;
            } else if (searchRadius <= 10) {
              return rating >= 3.8 && reviewCount >= 50;
            } else if (searchRadius <= 30) {
              return rating >= 4.0 && reviewCount >= 100;
            } else {
              return rating >= 4.2 && reviewCount >= 150;
            }
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
              console.log(`[Category Regen] ❌ Best curated match "${bestMatch.place.name}" has low similarity (${bestMatch.similarity.toFixed(2)}) to AI suggestion "${suggestion.venueName}" - falling back to API`);
              return null; // This will trigger API fallback in searchPlaces
            }

            const place = bestMatch.place;
            console.log(`[Category Regen] ✅ Matched "${place.name}" to AI suggestion "${suggestion.venueName}" with ${(bestMatch.similarity * 100).toFixed(0)}% similarity`);

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
              console.log(`[Category Regen] Rejecting ${place.name} - missing critical data (rating: ${place.rating}, address: ${!!place.address})`);
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
          console.log(`[Category Regen] Skipping ${suggestion.venueName} - failed quality/budget filters (not a fake venue)`);
          return null;
        })
      );

        const validActivities = enrichedActivities.filter(a => a !== null);
        console.log(`[Category Regen] Attempt ${attempt}: Got ${validActivities.length} enriched activities`);

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
            console.log(`[Category Regen] Added unique venue: ${activity.venueName} (${allValidActivities.length}/${neededCount})`);
          }
        }

        console.log(`[Category Regen] After attempt ${attempt}: Have ${allValidActivities.length}/${neededCount} venues`);
      }

      console.log(`[Category Regen] Retry complete: Collected ${allValidActivities.length}/${neededCount} valid activities`);

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

      console.log(`[Category Regen] Category has ${checkedCount} checked activities, ${uncheckedActivities.length} unchecked`);

      // Delete unchecked activities
      for (const activity of uncheckedActivities) {
        await db.delete(activitiesTable).where(eq(activitiesTable.id, activity.id));
      }
      console.log(`[Category Regen] Deleted ${uncheckedActivities.length} unchecked activities`);

      // Insert new activities to reach exactly 3 total for this category
      const newActivities = [];
      console.log(`[Category Regen] Inserting ${Math.min(neededCount, allValidActivities.length)}/${neededCount} new activities`);

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
      console.log(`[Category Regen] Created ${newActivities.length} new activities. Category now has ${finalCount}/3 cards`);

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

      // Verify user owns this group
      const userId = req.user.claims.sub;
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this group" });
      }

      // Fetch member group preferences for fallback chain
      const memberPreferences = await storage.getMemberGroupPreferences(userId, req.params.id);
      
      // Fetch global user profile for fallback chain
      const userProfile = await storage.getUserProfile(userId);

      // Implement preference fallback chain for all preferences:
      // 1. Member group preferences (budgetOverride, categoryPreferencesOverride, availabilityOverride)
      // 2. Global user profile (budget, activityPreferences, personalAvailability)
      // 3. Group defaults (budgetMax, enabled categories, availability)
      const effectiveBudget = memberPreferences?.budgetOverride ?? userProfile?.budget ?? group.budgetMax;
      const effectiveCategories = memberPreferences?.categoryPreferencesOverride ?? userProfile?.activityPreferences ?? null;
      const effectiveAvailability = memberPreferences?.availabilityOverride ?? userProfile?.personalAvailability ?? group.availability;
      
      console.log(`[Category Generate] Preference fallback chain:`);
      console.log(`  Budget: ${effectiveBudget} (member: ${memberPreferences?.budgetOverride}, profile: ${userProfile?.budget}, group: ${group.budgetMax})`);
      console.log(`  Categories: ${effectiveCategories ? JSON.stringify(effectiveCategories) : 'null'} (member: ${memberPreferences?.categoryPreferencesOverride ? 'set' : 'null'}, profile: ${userProfile?.activityPreferences ? 'set' : 'null'})`);
      console.log(`  Availability: ${effectiveAvailability ? 'set' : 'null'} (member: ${memberPreferences?.availabilityOverride ? 'set' : 'null'}, profile: ${userProfile?.personalAvailability ? 'set' : 'null'}, group: ${group.availability ? 'set' : 'null'})`);

      // Validate request body
      const validatedData = safeParse(generateCategorySchema, req.body, res);
      if (!validatedData) return;

      const { categories, category, location, radius, count = 9, sortBy = 'rating', tempInstructions } = validatedData;

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
            console.log(`[Category Generate] Filtered categories based on user preferences: ${originalCount} → ${categoriesToProcess.length}`);
          }
        } else {
          // No explicit categories requested, use user's preferred categories
          categoriesToProcess = effectiveCategories;
          console.log(`[Category Generate] Using user's preferred categories: ${categoriesToProcess.join(', ')}`);
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

      console.log(`[Category Generate] Generating ${categoriesToProcess.length} categories for group ${req.params.id}: ${categoriesToProcess.join(', ')}`);
      console.log(`[Category Generate] Location: ${location?.address || group.locationBase}`);
      console.log(`[Category Generate] Radius: ${radius || group.searchRadius || 2}mi`);
      if (tempInstructions) {
        console.log(`[Category Generate] Custom instructions: "${tempInstructions}"`);
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
        console.log(`[Category Generate] Geocoding custom location: ${location.address}`);
        const geocoded = await geocodeLocation(location.address);
        if (geocoded) {
          coordinates = { lat: geocoded.latitude, lng: geocoded.longitude };
          console.log(`[Category Generate] Geocoded to: ${geocoded.latitude}, ${geocoded.longitude}`);
        } else {
          console.log(`[Category Generate] Geocoding failed, proceeding without coordinates`);
        }
      } else if (group.latitude && group.longitude) {
        // Use group's stored coordinates
        coordinates = { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) };
      }

      // Get existing activities to avoid duplicates
      const existingActivities = await storage.getGroupActivities(req.params.id);
      const existingVenueNames = existingActivities.map(a => a.venueName);

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
        console.log(`[Category Generate] Processing category: ${currentCategory}`);
        
        let searchQuery = categorySearchQueries[currentCategory] || currentCategory;
        
        // If custom instructions provided, append them to refine the search
        if (tempInstructions && tempInstructions.trim()) {
          searchQuery = `${tempInstructions.trim()} ${searchQuery}`;
          console.log(`[Category Generate] Enhanced search with custom instructions: "${searchQuery} in ${searchLocation}"`);
        } else {
          console.log(`[Category Generate] Direct Google search: "${searchQuery} in ${searchLocation}"`);
        }

        // Search Google Places directly (no AI needed!)
        // Apply budget filter using preference fallback chain
        const places = await searchPlaces(
          `${searchQuery} in ${searchLocation}`,
          searchLocation,
          searchRadius,
          coordinates,
          false, // skipCurated
          undefined, // venueType
          effectiveBudget || undefined // Apply effective budget from fallback chain
        );

        console.log(`[Category Generate] Got ${places.length} places from Google for ${currentCategory}`);

        if (places.length === 0) {
          resultsByCategory[currentCategory] = [];
          continue;
        }

        // Process and filter Google Places results
        const enrichedActivities = await Promise.all(
          places.map(async (place) => {
            // Skip if already in existing activities
            if (existingVenueNames.includes(place.name)) {
              console.log(`[Category Generate] Skipping duplicate: ${place.name}`);
              return null;
            }

            // Relaxed quality filtering for category-specific searches
            const rating = parseFloat(place.rating || '0');
            const reviewCount = place.reviewCount || 0;
            
            // Ensure minimum quality (3.5★ + 10 reviews) regardless of radius
            if (rating < 3.5 || reviewCount < 10) {
              console.log(`[Category Generate] Skipping ${place.name} - quality filter (${rating}★, ${reviewCount} reviews)`);
              return null;
            }

            // Only include venues with complete data
            if (!place.rating || !place.address || !place.photoUrl) {
              console.log(`[Category Generate] Skipping ${place.name} - missing data`);
              return null;
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

            // Skip AI categorization - trust Google's results for category searches
            // Google already filtered to bars/restaurants/etc based on our search query
            
            return {
              venueName: place.name,
              venueAddress: place.address,
              city: place.city || null,
              venueType: place.types[0] || 'venue',
              description: place.review || '',
              googlePlaceId: place.placeId,
              latitude: place.location?.lat?.toString() || null,
              longitude: place.location?.lng?.toString() || null,
              rating: place.rating,
              reviewCount: place.reviewCount || null,
              priceLevel: place.priceLevel,
              photoUrl: place.photoUrl,
              googleReview: place.review || null,
              category: currentCategory, // Use the requested category directly
              distanceFromGroupBase: distanceFromBase,
            };
          })
        );

        // Filter out nulls (filtered items)
        let validActivities = enrichedActivities.filter(a => a !== null);

        // Sort based on mode: distance for multi-venue outings, rating for single destinations
        if (sortBy === 'distance') {
          validActivities.sort((a, b) => {
            const distA = a.distanceFromGroupBase || 999;
            const distB = b.distanceFromGroupBase || 999;
            return distA - distB;
          });
          console.log(`[Category Generate] Sorted ${currentCategory} by distance`);
        } else {
          validActivities.sort((a, b) => {
            const ratingA = parseFloat(a.rating || '0');
            const ratingB = parseFloat(b.rating || '0');
            return ratingB - ratingA; // Highest rating first
          });
          console.log(`[Category Generate] Sorted ${currentCategory} by rating`);
        }

        // Return ALL results for pagination (don't limit to count)
        // Users can now scroll through dozens of venues without extra API calls
        console.log(`[Category Generate] Returning all ${validActivities.length} ${currentCategory} venues for pagination`);
        
        resultsByCategory[currentCategory] = validActivities;
        allResults.push(...validActivities);

        // Save search to history for quick re-access
        try {
          await storage.saveCategorySearch({
            groupId: req.params.id,
            category: currentCategory,
            searchLocation,
            searchRadius,
            results: validActivities,
          });
          console.log(`[Category Generate] Saved search to history for ${currentCategory}`);
        } catch (err) {
          console.error(`[Category Generate] Failed to save search history for ${currentCategory}:`, err);
          // Non-critical, continue
        }
      }

      console.log(`[Category Generate] Completed. Total: ${allResults.length} venues across ${categoriesToProcess.length} categories`);
      
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

  // Get recent category searches for a group
  app.get("/api/groups/:id/category-search-history", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Verify user owns this group
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      if (group.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this group" });
      }

      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ message: "Prompt is required" });
      }

      console.log(`[AI Scheduling] Processing prompt for group ${req.params.id}: "${prompt}"`);

      // Parse the natural language prompt
      const schedulingParams = await parseSchedulingPrompt(prompt, group.locationBase);
      
      console.log(`[AI Scheduling] Parsed params:`, schedulingParams);

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

      const searchQuery = `${schedulingParams.activityType} ${categorySearchQueries[schedulingParams.category] || ''}`;
      console.log(`[AI Scheduling] Searching: "${searchQuery} in ${searchLocation}"`);

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

      console.log(`[AI Scheduling] Found ${places.length} places`);

      if (places.length === 0) {
        return res.status(404).json({ message: "No venues found matching your criteria" });
      }

      // Get existing activities to avoid duplicates
      const existingActivities = await storage.getGroupActivities(req.params.id);
      const existingVenueNames = existingActivities.map(a => a.venueName);

      // Process and filter places (take top 3-5 venues)
      const topVenues = places
        .filter(place => !existingVenueNames.includes(place.name))
        .filter(place => {
          const rating = parseFloat(place.rating || '0');
          const reviewCount = place.reviewCount || 0;
          return rating >= 3.5 && reviewCount >= 10 && place.address && place.photoUrl;
        })
        .sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'))
        .slice(0, 3);

      if (topVenues.length === 0) {
        return res.status(404).json({ message: "No quality venues found" });
      }

      console.log(`[AI Scheduling] Selected ${topVenues.length} venues for event`);

      // Generate 2-3 date/time options based on timeframe and constraints
      const timeOptions = generateTimeOptions(
        schedulingParams.timeframe || 'next week',
        schedulingParams.dayConstraints || 'any',
        schedulingParams.timePreference,
        group.timezone || 'America/Los_Angeles'
      );

      console.log(`[AI Scheduling] Generated ${timeOptions.length} time options`);

      // Create activities from the top venues
      const createdActivities = [];
      for (const place of topVenues) {
        const activityCategory = await categorizeVenue(place.name, place.types[0] || 'venue');
        const newActivity = await storage.createActivity({
          groupId: req.params.id,
          venueName: place.name,
          venueAddress: place.address,
          city: place.city || null,
          venueType: place.types[0] || 'venue',
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
          inviteToken: null,
          timingRecommendations: timeOptions.length > 1 ? 'Vote for your preferred time' : null,
          proposedOrder,
          eventDate: new Date(timeOptions[0].eventDate), // Set default to first time option
        },
        userId, // Passed separately, not in the object!
        items
      );

      console.log(`[AI Scheduling] Created itinerary ${itinerary.id} with ${items.length} venues`);

      // Create time slot options for voting
      for (const option of timeOptions) {
        await storage.createProposedTimeSlot({
          itineraryId: itinerary.id,
          proposedDateTime: new Date(option.eventDate), // Use proposedDateTime, not eventDate
          label: `${option.dayLabel} ${option.timeLabel}`,
        });
      }

      console.log(`[AI Scheduling] Created ${timeOptions.length} time slots for voting`);

      res.json({
        itinerary,
        venues: createdActivities,
        timeOptions,
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

      console.log(`[AI Insights] Analyzing preference patterns for group ${req.params.id}`);

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

      console.log(`[AI Insights] Feedback data: ${notThisFeedback.length} not-this, ${votingFeedback.length} voting, ${likedConcepts.length} likes, ${passedConcepts.length} passes`);

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

      console.log(`[AI Insights] Generated and saved ${patterns.length} patterns for group ${req.params.id}`);

      res.json({ patterns });
    } catch (error: any) {
      console.error("[AI Insights] Error:", error);
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

  // Create voting event from category search result (when user hearts a venue)
  app.post("/api/groups/:id/activities/from-category-result", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Any authenticated user can add to group favorites (not just owner)
      const userId = req.user.claims.sub;

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
      const userId = req.user.claims.sub;
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

      // Filter out venues user has already voted on
      const unvotedEvents = votingEvents.filter(event => !votedEventIds.has(event.id));

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
          console.log(`[Swipe Deck] Filtering out cafe voting event: "${event.title}"`);
          return false;
        }
        
        if (group.mealEnabled === false && (venueType.includes('restaurant') || venueType.includes('dining') || venueType.includes('food'))) {
          console.log(`[Swipe Deck] Filtering out meal voting event: "${event.title}"`);
          return false;
        }
        
        if (group.drinksEnabled === false && (venueType.includes('bar') || venueType.includes('brewery') || venueType.includes('pub') || venueType.includes('wine'))) {
          console.log(`[Swipe Deck] Filtering out drinks voting event: "${event.title}"`);
          return false;
        }
        
        if (group.dessertEnabled === false && (venueType.includes('dessert') || venueType.includes('ice cream') || venueType.includes('boba') || venueType.includes('bakery'))) {
          console.log(`[Swipe Deck] Filtering out dessert voting event: "${event.title}"`);
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
            console.log(`[Swipe Deck] Searching for "${concept.searchQuery}" near ${group.locationBase}`);
            
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
                console.log(`[Swipe Deck] ✅ Found venue: "${place.name}" (${place.rating}⭐, ${place.reviewCount} reviews, types: ${place.types?.join(', ')})`);
                
                // Skip if we already have this place
                if (existingPlaceIds.has(place.placeId)) {
                  console.log(`[Swipe Deck] Skipping duplicate place: ${place.name}`);
                  return null;
                }

                // Filter out places from disabled categories
                const placeTypes = (place.types || []).map(t => t.toLowerCase()).join(' ');
                const placeName = place.name.toLowerCase();
                
                if (group.cafeEnabled === false) {
                  if (placeTypes.includes('cafe') || placeTypes.includes('coffee') || placeName.includes('cafe') || placeName.includes('coffee')) {
                    console.log(`[Swipe Deck] ❌ Filtering out cafe from Google Places: "${place.name}"`);
                    return null;
                  }
                }
                
                if (group.mealEnabled === false) {
                  if (placeTypes.includes('restaurant') || placeTypes.includes('food')) {
                    console.log(`[Swipe Deck] ❌ Filtering out restaurant from Google Places: "${place.name}"`);
                    return null;
                  }
                }
                
                if (group.drinksEnabled === false) {
                  if (placeTypes.includes('bar') || placeTypes.includes('night_club') || placeTypes.includes('liquor_store')) {
                    console.log(`[Swipe Deck] ❌ Filtering out bar/drinks from Google Places: "${place.name}"`);
                    return null;
                  }
                }
                
                if (group.dessertEnabled === false) {
                  if (placeTypes.includes('bakery') || placeTypes.includes('ice_cream') || placeName.includes('dessert') || placeName.includes('boba')) {
                    console.log(`[Swipe Deck] ❌ Filtering out dessert from Google Places: "${place.name}"`);
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
                  venueType: place.types?.[0] || concept.conceptType,
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
        deck = [...deck, ...validConcepts];
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
      const userId = req.user.claims.sub;

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
                  location = { lat: geocoded.lat, lng: geocoded.lng };
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

      const validVenues = venuesWithDetails.filter(Boolean);

      if (validVenues.length === 0) {
        return res.status(400).json({ message: "No valid venues found" });
      }

      // Validate itinerary with AI
      const validation = await validateItinerary(validVenues);

      if (!validation.isValid) {
        return res.status(400).json({
          message: validation.validationNotes,
          issues: validation.issues,
        });
      }

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

  // Simple places search (for ad-hoc venue dialog)
  app.get("/api/places/search", async (req, res) => {
    try {
      const { query } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.json({ results: [] });
      }

      // Use a default location (Bay Area) for context
      const searchQuery = query.trim();
      const defaultLocation = "San Francisco Bay Area";
      const defaultRadius = 25; // miles

      const results = await searchPlaces(searchQuery, defaultLocation, defaultRadius, undefined, false, undefined, undefined, undefined, true, true);

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

      console.log(`[SEARCH VENUES] Received request - GroupID: ${groupId}, Query: "${query}"`);

      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        console.log(`[SEARCH VENUES] Query too short, returning empty results`);
        return res.json({ results: [] });
      }

      // Get group location for context
      const group = await storage.getGroup(groupId);
      if (!group) {
        console.log(`[SEARCH VENUES] Group not found: ${groupId}`);
        return res.status(404).json({ message: "Group not found" });
      }

      // Use Google Places Text Search with group location as context
      const searchQuery = query.trim();
      const location = group.locationBase;
      const radius = group.searchRadius || 10;
      const coordinates = group.latitude && group.longitude
        ? { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) }
        : undefined;

      console.log(`[SEARCH VENUES] Searching: "${searchQuery}" in ${location} (radius: ${radius} miles)`);

      const results = await searchPlaces(searchQuery, location, radius, coordinates, false, undefined, group.budgetMax, undefined, true, true);

      console.log(`[SEARCH VENUES] Found ${results.length} results`);

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

      console.log(`[SEARCH VENUES] Returning ${limitedResults.length} results to frontend`);
      if (limitedResults.length > 0) {
        console.log(`[SEARCH VENUES] First result: ${limitedResults[0].name}`);
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
        proposedTimeSlots: timeSlotsWithVotes,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete itinerary item
  app.delete("/api/itinerary-items/:id", async (req, res) => {
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
      if (!itinerary) {
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

      // Verify itinerary exists
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
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
            // Override name and address if parsed from URL
            if (parsedPlace.name) name = parsedPlace.name;
            if (parsedPlace.address) address = parsedPlace.address;
          }
        } catch (error) {
          console.error('[Add Ad-hoc Venue] Error parsing Google Maps URL:', error);
          // Continue with manual address if URL parsing fails
        }
      }

      // Fetch Google Places details if placeId is provided
      if (googlePlaceId) {
        try {
          const placeDetails = await getPlaceDetails(googlePlaceId);
          if (placeDetails) {
            // Use Google Places data to enrich the venue
            if (!address) address = placeDetails.address;
            if (!venueType && placeDetails.types && placeDetails.types.length > 0) {
              venueType = placeDetails.types[0];
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
            latitude = geocoded.lat.toString();
            longitude = geocoded.lng.toString();
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
      const { proposedOrder } = req.body; // New array of sourceIds
      const itineraryId = req.params.id;

      // Get the current itinerary to map sourceIds to item IDs
      const currentItinerary = await storage.getItinerary(itineraryId);
      if (!currentItinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Map sourceIds to item IDs for ordering
      const sourceIdToItemId = new Map(
        currentItinerary.items.map((item: ItineraryItem) => [item.sourceId, item.id])
      );
      const orderedItemIds = proposedOrder
        .map((sourceId: string) => sourceIdToItemId.get(sourceId))
        .filter((id: string | undefined) => id !== undefined);

      // Update the order indices in the database
      await storage.updateItineraryItemOrder(itineraryId, orderedItemIds);

      // Also update the itinerary's proposedOrder field
      const itinerary = await storage.updateItinerary(itineraryId, {
        proposedOrder,
      });

      res.json(itinerary);
    } catch (error: any) {
      console.error("[Update Order] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete itinerary
  app.delete("/api/itineraries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const itineraryId = req.params.id;
      const userId = req.user.claims.sub;
      
      // Get the itinerary and verify authorization
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
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
      
      await storage.deleteItinerary(itineraryId);
      res.json({ message: "Itinerary deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
        userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
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
        userId = req.user.claims.sub;
      }
      
      if (!userId && !memberId) {
        return res.status(400).json({ message: "Either userId or memberId is required" });
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
      
      let userId = null;
      let memberId = null;
      
      if (req.user) {
        userId = req.user.claims.sub;
      } else if (req.body.memberId) {
        memberId = req.body.memberId;
      }
      
      if (!userId && !memberId) {
        return res.status(400).json({ message: "Either userId or memberId is required" });
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
      const userId = req.user.claims.sub;
      
      const timeSlot = await storage.getTimeSlot(timeSlotId);
      if (!timeSlot) {
        return res.status(404).json({ message: "Time slot not found" });
      }
      
      const itinerary = await storage.getItinerary(timeSlot.itineraryId);
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }
      
      const group = await storage.getGroup(itinerary.groupId);
      if (!group || group.userId !== userId) {
        return res.status(403).json({ message: "Only the group organizer can select a time slot" });
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
      const userId = req.user.claims.sub;
      
      // Get the original itinerary with items
      const original = await storage.getItinerary(req.params.id);
      if (!original) {
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
      const itemsData = original.items.map((item: ItineraryItem) => ({
        sourceType: item.sourceType as 'activity' | 'voting_event',
        sourceId: item.sourceId
      }));

      const savedItinerary = await storage.createItinerary(
        {
          groupId: original.groupId,
          name,
          status: 'saved',
          isSaved: true,
          aiValidationNotes: original.aiValidationNotes,
          timingRecommendations: timingRecommendations || null,
          proposedOrder: original.proposedOrder,
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
      const userId = req.user.claims.sub;
      
      // Get the original itinerary with items
      const original = await storage.getItinerary(req.params.id);
      if (!original) {
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
      const itemsData = original.items.map((item: ItineraryItem) => ({
        sourceType: item.sourceType as 'activity' | 'voting_event',
        sourceId: item.sourceId
      }));

      const duplicatedItinerary = await storage.createItinerary(
        {
          groupId: original.groupId,
          name: `${original.name} (Copy)`,
          status: 'draft',
          isSaved: false,
          aiValidationNotes: original.aiValidationNotes,
          proposedOrder: original.proposedOrder,
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
      if (!itinerary) {
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
        console.log('[Suggest Time] Using venues from request body (cart state)');
      } else {
        venues = itinerary.items.map((item: ItineraryItem) => ({
          name: item.venueName,
          type: item.venueType,
        }));
        console.log('[Suggest Time] Using venues from saved itinerary');
      }

      const { suggestMultipleTimeOptions, convertAvailabilityToString } = await import('./ai-time-picker');
      
      // Convert availability object to natural language string
      const availabilityString = convertAvailabilityToString(group.availability);
      
      console.log('[Suggest Time] Group availability object:', JSON.stringify(group.availability));
      console.log('[Suggest Time] Converted to string:', availabilityString);
      console.log('[Suggest Time] Venues:', JSON.stringify(venues));
      console.log('[Suggest Time] Location:', group.locationBase);
      
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
      const userId = req.user.claims.sub;
      
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary) {
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
        
        // Setup schedule config with defaults if not provided
        const scheduleConfig = autoScheduleConfig || {
          inviteAdvanceDays: 14,
          rsvpWindowDays: 11,
          reminders: [
            { type: 'gentle_nudge', daysBeforeDeadline: 7 },
            { type: 'final_call', daysBeforeDeadline: 1 },
            { type: 'day_before', daysBeforeEvent: 1 }
          ]
        };
        
        const rsvpDeadline = new Date(date);
        rsvpDeadline.setDate(date.getDate() - (scheduleConfig.inviteAdvanceDays - scheduleConfig.rsvpWindowDays));

        updates.eventDate = date;
        updates.rsvpDeadline = rsvpDeadline;
        updates.autoScheduleConfig = scheduleConfig;
        updates.inviteSentAt = new Date();

        // Send initial invite emails immediately
        const members = await storage.getGroupMembers(group.id);

        console.log(`[Send Itinerary] Found ${members.length} members for group ${group.id}`);
        
        // Create itinerary-specific invite tokens for each member
        const memberInvites = new Map<string, string>(); // memberId -> inviteToken
        
        // If there are no members, create a special invite for the organizer
        if (members.length === 0) {
          const inviteToken = crypto.randomUUID();
          
          // Create a pseudo-member ID for the organizer (use group's userId)
          const organizerPseudoMemberId = `organizer-${group.userId}`;
          
          // Store invite in database with a special marker
          await db.insert(itineraryInvites).values({
            itineraryId: itinerary.id,
            memberId: null, // No actual member record yet
            inviteToken,
          });
          
          memberInvites.set(organizerPseudoMemberId, inviteToken);
          console.log(`[Send Itinerary] Created invite for organizer (no members yet)`);
        } else {
          // Create invites for existing members
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
        if (recipients.length === 0) {
          const user = await storage.getUser(group.userId);
          if (user?.email) {
            recipients.push(user.email);
            console.log(`[Send Itinerary] No members with emails, sending to organizer ${user.email}`);
          }
        }

        console.log(`[Send Itinerary] Sending to ${recipients.length} recipients`);

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
                organizerName: 'Organizer',
                eventDate: date.toLocaleDateString(),
                eventTime: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                venues: itinerary.items.map((item: ItineraryItem) => ({
                  name: item.venueName || 'Venue',
                  type: item.venueType || 'Activity',
                })),
                rsvpDeadline: rsvpDeadline.toLocaleDateString(),
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
      console.log(`[Auto-Reschedule] Checking if reschedule needed for itinerary ${itineraryId}`);
      
      // Get itinerary
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary || !itinerary.eventDate) {
        console.log(`[Auto-Reschedule] Itinerary not found or no event date`);
        return;
      }

      // Check if already exceeded max reschedule attempts
      const rescheduleAttempts = itinerary.rescheduleAttempts || 0;
      if (rescheduleAttempts >= 2) {
        console.log(`[Auto-Reschedule] Max reschedule attempts (2) reached`);
        return;
      }

      // Get all RSVPs (exclude guests - only member feedback affects reschedule decisions)
      const rsvps = await db
        .select()
        .from(rsvpsTable)
        .where(sql`itinerary_id = ${itineraryId} AND (is_guest IS NULL OR is_guest = false)`);

      if (rsvps.length === 0) {
        console.log(`[Auto-Reschedule] No RSVPs yet`);
        return;
      }

      // Count responses
      const yesCount = rsvps.filter(r => r.response === 'yes').length;
      const maybeCount = rsvps.filter(r => r.response === 'maybe').length;
      const noCount = rsvps.filter(r => r.response === 'no').length;
      const totalResponses = rsvps.length;

      console.log(`[Auto-Reschedule] RSVP counts - Yes: ${yesCount}, Maybe: ${maybeCount}, No: ${noCount}`);

      // Trigger reschedule if:
      // 1. More than 50% said "no" or "maybe"
      // 2. At least 3 people responded (to avoid premature rescheduling)
      const negativeResponses = noCount + maybeCount;
      const shouldReschedule = totalResponses >= 3 && (negativeResponses / totalResponses) > 0.5;

      if (!shouldReschedule) {
        console.log(`[Auto-Reschedule] Reschedule not needed yet`);
        return;
      }

      console.log(`[Auto-Reschedule] Triggering reschedule (${negativeResponses}/${totalResponses} negative responses)`);

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
        console.log(`[Auto-Reschedule] Another process already started reschedule, skipping`);
        return;
      }

      console.log(`[Auto-Reschedule] Lock acquired, proceeding with reschedule`);

      // Analyze feedback patterns
      const feedback = rsvps
        .map(r => r.rsvpFeedback)
        .filter((f): f is NonNullable<typeof f> => f != null);

      const constraints = {
        avoidDays: [] as string[],
        preferEarlier: 0,
        preferLater: 0,
        avoidThisWeek: false,
      };

      for (const f of feedback) {
        if (f?.tryEarlier) constraints.preferEarlier++;
        if (f?.tryLater) constraints.preferLater++;
        if (f?.notThisWeek) constraints.avoidThisWeek = true;
        if (f?.unavailableOn && Array.isArray(f.unavailableOn)) {
          constraints.avoidDays.push(...f.unavailableOn);
        }
      }

      console.log(`[Auto-Reschedule] Feedback constraints:`, constraints);

      // Get group and venue info for AI
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        console.log(`[Auto-Reschedule] Group not found`);
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
        console.log(`[Auto-Reschedule] AI could not find alternative time`);
        
        // Clear in-progress flag
        await storage.updateItinerary(itineraryId, {
          autoScheduleConfig: {
            ...(itinerary.autoScheduleConfig as object || {}),
            rescheduleInProgress: false,
          },
        });
        
        return;
      }

      console.log(`[Auto-Reschedule] New time suggested: ${result.suggestedTime}, reasoning: ${result.reasoning}`);

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
          const rsvpLink = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/rsvp/${itineraryId}/${inviteToken}`;
          
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

          console.log(`[Auto-Reschedule] Sent reschedule email to ${member.email}`);
        } catch (emailError) {
          console.error(`[Auto-Reschedule] Failed to send email to ${member.email}:`, emailError);
        }
      }

      console.log(`[Auto-Reschedule] Reschedule complete for itinerary ${itineraryId}`);
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
      if (!itinerary) {
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
      if (!itinerary) {
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

      // Return updated queue with the new event replacing the old one
      const updatedEvents = currentQueue.events.map(e =>
        e.id === eventId ? newEvent : e
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
        group?.location || 'San Francisco'
      );

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

  // Create a guest RSVP for an itinerary (public endpoint - no auth required)
  app.post("/api/itineraries/:id/guest-rsvp", async (req, res) => {
    try {
      const { guestName, guestEmail, response } = req.body;
      const { id: itineraryId } = req.params;

      // Validate required fields
      if (!guestName || !guestName.trim()) {
        return res.status(400).json({ message: "Guest name is required" });
      }
      if (!response || !["yes", "maybe", "no"].includes(response)) {
        return res.status(400).json({ message: "Valid response required (yes, maybe, or no)" });
      }

      // Verify itinerary exists and is sent (not proposed)
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (itinerary.status !== "sent") {
        return res.status(400).json({ message: "This event is not yet finalized" });
      }

      // Generate unique guest token for RSVP link
      const guestToken = crypto.randomBytes(32).toString('hex');

      // Create guest RSVP
      const rsvp = await db
        .insert(rsvpsTable)
        .values({
          itineraryId,
          isGuest: true,
          guestName: guestName.trim(),
          guestEmail: guestEmail?.trim() || null,
          guestToken,
          response,
          memberName: null,
          memberId: null,
          userId: null,
        })
        .returning();

      res.json(rsvp[0]);
    } catch (error: any) {
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
      if (!itinerary) {
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

  // Get RSVPs for an itinerary
  app.get("/api/itineraries/:id/rsvps", async (req, res) => {
    try {
      const rsvps = await storage.getItineraryRsvps(req.params.id);
      res.json(rsvps);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get invite summary with RSVP counts and shareable link
  app.get("/api/itineraries/:id/invite-summary", isAuthenticated, async (req, res) => {
    try {
      const itinerary = await storage.getItinerary(req.params.id);
      if (!itinerary) {
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

  // Create guest invite for an itinerary
  app.post("/api/itineraries/:itineraryId/guest-invites", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itineraryId } = req.params;
      const { guestName } = req.body;

      if (!guestName || !guestName.trim()) {
        return res.status(400).json({ message: "Guest name is required" });
      }

      // Verify itinerary exists and user is authorized (group owner)
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
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
      const userId = req.user.claims.sub;
      const { itineraryId } = req.params;

      // Verify itinerary exists and user is authorized
      const itinerary = await storage.getItinerary(itineraryId);
      if (!itinerary) {
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
      if (!itinerary) {
        return res.status(404).json({ message: "Event not found" });
      }

      const items = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.itineraryId, guestInvite.itineraryId))
        .orderBy(itineraryItems.orderIndex);

      const group = await storage.getGroup(itinerary.groupId);

      res.json({
        guestInvite,
        itinerary,
        items,
        group: group ? { name: group.name, emoji: group.emoji } : null,
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
      if (!validatedData) return;

      const userId = req.user.claims.sub;
      const { itineraryId } = { itineraryId: req.params.id };
      const { actuallyAttended, venueRating, frequencyPreference, wouldDoAgain, improvementNotes } = validatedData;

      // Get the itinerary to check group ownership
      const [itinerary] = await db
        .select()
        .from(itineraries)
        .where(eq(itineraries.id, itineraryId))
        .limit(1);

      if (!itinerary) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Get the group to check ownership
      const group = await storage.getGroup(itinerary.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const isGroupOwner = group.userId === userId;

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

      // If no RSVP exists and user is the group owner, create one
      if ((!rsvp || rsvp.length === 0) && isGroupOwner) {
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
      const updated = await db
        .update(rsvpsTable)
        .set({
          postEventFeedback: {
            actuallyAttended,
            venueRating,
            frequencyPreference,
            wouldDoAgain,
            improvementNotes,
            submittedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(rsvpsTable.id, rsvp[0].id))
        .returning();

      // 🤖 LEARNING LOOP #1: Auto-blacklist low-rated venues
      // If venue rated ≤2 stars OR "would not do again", add to rejected list
      if (venueRating !== undefined && venueRating !== null && (venueRating <= 2 || wouldDoAgain === 'no')) {
        try {
          // Get itinerary items to extract venue info
          const itineraryItems = itinerary.items as any[] || [];

          for (const item of itineraryItems) {
            if (item.venueName) {
              console.log(`🚫 Auto-blacklisting venue "${item.venueName}" (rating: ${venueRating}, wouldDoAgain: ${wouldDoAgain})`);
              await storage.addRejectedVenue(itinerary.groupId, item.venueName);
            }
          }
        } catch (error) {
          console.error('[Auto-blacklist] Error adding rejected venue:', error);
          // Don't fail the request if blacklisting fails
        }
      }

      // 🎯 INSIGHT TRIGGER: Update group insights after post-event feedback
      // This is a significant data point - trigger update immediately
      triggerInsightUpdate(itinerary.groupId, 'post-event-feedback').catch(err => {
        console.error(`[Post Event Feedback] Insight update failed:`, err);
      });

      res.json(updated[0]);
    } catch (error: any) {
      console.error('[Post Event Feedback] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get aggregated RSVP feedback for a group
  app.get("/api/groups/:groupId/feedback-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      await storage.updateAutoScheduledEvent(req.params.id, {
        approvedByOrganizer: true,
      });

      res.json({ success: true, message: "Event approved and will be sent to group" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Submit frequency feedback
  app.post("/api/frequency-feedback", isAuthenticated, async (req, res) => {
    try {
      const { groupId, feedback } = req.body;
      const userId = req.user.claims.sub;

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

  // Get learning insights for a group (what the system has learned)
  app.get("/api/groups/:groupId/learning-insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // ===== CONFIDENCE CALIBRATION ENDPOINTS =====

  // Get confidence weights and calibration status for a group
  app.get("/api/groups/:groupId/confidence-weights", isAuthenticated, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = getUserId(req);

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
      const userId = getUserId(req);

      // Verify user is the group organizer
      const group = await storage.getGroup(groupId);
      if (!group || group.organizerId !== userId) {
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
      const userId = req.user.claims.sub;

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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const autoSendAt = addDays(proposedDate, -3); // Auto-send 3 days before proposed date if no action

      const autoEvent = await storage.createAutoScheduledEvent({
        groupId,
        proposedDate,
        autoSendAt,
        status: 'pending_approval',
        allowMemberVoting,
      });

      // Validate each option with AI to ensure logical ordering
      console.log('[Schedule Next Event] Validating options with AI...');
      const { validateItinerary } = await import('./itinerary-validation.js');

      for (let i = 0; i < result.options.length; i++) {
        const option = result.options[i];
        try {
          // Validate the venue order for this option
          const validation = await validateItinerary(option.venues);

          if (validation.proposedOrder && validation.proposedOrder.length > 0) {
            // Reorder venues based on AI recommendation
            const reorderedVenues = validation.proposedOrder.map(sourceId =>
              option.venues.find(v => v.sourceId === sourceId)
            ).filter(Boolean);

            result.options[i].venues = reorderedVenues;
            console.log(`[Schedule Next Event] ✅ Validated option ${i + 1}: ${validation.validationNotes || 'Order optimized'}`);
          }
        } catch (validationError: any) {
          // Log but don't fail - validation is optional enhancement
          console.log(`[Schedule Next Event] ⚠️  AI validation failed for option ${i + 1}, using original order:`, validationError.message);
        }
      }

      // Store the 3 options
      const { itineraryOptions: itineraryOptionsTable } = await import('../shared/schema');
      const savedOptions = await Promise.all(
        result.options.map(async (option) => {
          const [saved] = await db.insert(itineraryOptionsTable).values({
            autoEventId: autoEvent.id,
            optionNumber: option.optionNumber,
            venues: option.venues,
            description: option.description,
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
      const userId = req.user.claims.sub;

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
      const userId = req.user.claims.sub;

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
      const userId = req.user.claims.sub;

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

  // Generate and retrieve group-level insights (budget, availability, activity types)
  app.get("/api/groups/:groupId/insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

      res.json({
        groupId,
        insights,
      });
    } catch (error: any) {
      console.error('[Group Insights] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dismiss a specific insight
  app.post("/api/groups/:groupId/insights/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
  // Protected endpoint - requires authentication
  app.post("/api/admin/backfill-coordinates", isAuthenticated, async (req, res) => {
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // For now, only allow specific admin email
      // TODO: Add admin role to user profile for better scalability
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

  // Admin endpoint to create database backup
  app.post("/api/admin/create-backup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

      console.log('[Photo Migration] Starting photo caching migration using KEY_2...');

      // Get all activities with direct Google URLs
      const uncachedActivities = await db
        .select({
          id: activitiesTable.id,
          photoUrl: activitiesTable.photoUrl,
        })
        .from(activitiesTable)
        .where(sql`${activitiesTable.photoUrl} LIKE 'https://maps.googleapis.com/%'`);

      console.log(`[Photo Migration] Found ${uncachedActivities.length} activities with uncached photos`);

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
              console.log(`[Photo Migration] Already cached: ${photoReference}`);
              
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

            console.log(`[Photo Migration] ✓ Cached and updated: ${photoReference}`);
            successCount++;
          } catch (error: any) {
            console.error(`[Photo Migration] ✗ Error for activity ${activity.id}:`, error.message);
            errorCount++;
            errors.push({ activityId: activity.id, error: error.message });
          }
        }));

        // Log progress
        console.log(`[Photo Migration] Progress: ${Math.min(i + BATCH_SIZE, uncachedActivities.length)}/${uncachedActivities.length} processed`);
        
        // Small delay between batches
        if (i + BATCH_SIZE < uncachedActivities.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`[Photo Migration] Complete! Success: ${successCount}, Errors: ${errorCount}`);

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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      console.log('[Favorites Backfill] Starting coordinate backfill for voting_events...');

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

      console.log(`[Favorites Backfill] Found ${votingEventsToBackfill.length} favorites missing coordinates`);

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

            console.log(`[Favorites Backfill] ✓ Updated "${event.title}" with coordinates (${placeDetails.location.lat}, ${placeDetails.location.lng})`);
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
        console.log(`[Favorites Backfill] Progress: ${Math.min(i + BATCH_SIZE, votingEventsToBackfill.length)}/${votingEventsToBackfill.length} processed`);
        
        // Small delay between batches to be nice to the API
        if (i + BATCH_SIZE < votingEventsToBackfill.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`[Favorites Backfill] Complete! Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);

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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      console.log(`[Data Audit] Starting venue data audit and correction...`);

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
          console.log(`[Data Audit] ✓ Updated curated venue: ${correction.name} → ${correction.correctCategory}`);
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
          console.log(`[Data Audit] ✓ Updated ${activityResult.length} activities for: ${correction.name}`);
        }
      }

      console.log(`[Data Audit] Complete! Updated ${updatedCount} curated venues and ${activityUpdates} activities`);

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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      const adminEmails = getAdminEmails();
      if (!user || !adminEmails.includes(user.email || '')) {
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      console.log(`[Venue Cleanup] Starting smart cleanup (rule-based + batched AI)...`);

      // Get all curated venues
      const allVenues = await db.select().from(curatedVenues);
      console.log(`[Venue Cleanup] Found ${allVenues.length} total venues`);

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

      console.log(`[Venue Cleanup] Rule-based filtering caught ${removedByRules} obvious non-social venues`);
      console.log(`[Venue Cleanup] ${venuesNeedingAI.length} venues need AI validation`);

      // PHASE 2: Batched AI validation (50 venues per API call for more reliable JSON)
      if (venuesNeedingAI.length > 0) {
        const BATCH_SIZE = 50;
        const batches = [];
        for (let i = 0; i < venuesNeedingAI.length; i += BATCH_SIZE) {
          batches.push(venuesNeedingAI.slice(i, i + BATCH_SIZE));
        }

        console.log(`[Venue Cleanup] Processing ${batches.length} AI batches (max ${BATCH_SIZE} venues each)`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`[Venue Cleanup] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} venues)`);

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
      console.log(`[Venue Cleanup] Removing ${venuesToRemove.length} venues...`);
      for (const { venue, reasons } of venuesToRemove) {
        // Archive to deleted_venues table before deletion
        await db.insert(deletedVenues).values({
          venueData: venue as any,
          deletionReason: reasons.join('; '),
          deletedBy: userId,
        });

        // Delete from curated venues
        await db.delete(curatedVenues).where(eq(curatedVenues.id, venue.id));
        
        console.log(`[Venue Cleanup] ❌ Removed: ${venue.name}`);
        console.log(`[Venue Cleanup]    Reasons: ${reasons.join('; ')}`);
      }

      const totalRemoved = venuesToRemove.length;
      const remaining = allVenues.length - totalRemoved;

      console.log(`[Venue Cleanup] Complete!`);
      console.log(`[Venue Cleanup] - Removed ${removedByRules} non-social venues (rule-based, FREE)`);
      console.log(`[Venue Cleanup] - Removed ${removedNonVenues - removedByRules} non-social venues (AI batched)`);
      console.log(`[Venue Cleanup] - Removed ${removedMissingPhotos} venues without photos`);
      console.log(`[Venue Cleanup] - Removed ${removedLowQuality} low-quality venues`);
      console.log(`[Venue Cleanup] - Removed ${removedDuplicates} duplicates`);
      console.log(`[Venue Cleanup] - ${remaining} venues remaining`);

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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
    console.log("[Venue Recategorization] ===== ENDPOINT CALLED =====");
    try {
      // Check if user is admin
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      console.log(`[Venue Recategorization] User check: userId=${userId}, user=${user?.email || 'null'}`);
      
      const adminEmails = getAdminEmails();
      console.log(`[Venue Recategorization] Admin emails: ${adminEmails.join(', ')}`);
      if (!user || !adminEmails.includes(user.email || '')) {
        console.log(`[Venue Recategorization] UNAUTHORIZED: User is not admin`);
        return res.status(403).json({ message: "Unauthorized: Admin access required" });
      }

      console.log("[Venue Recategorization] ✓ Auth passed. Starting recategorization of all curated venues...");

      // Clear categorization cache to ensure all venues are re-evaluated with current logic
      const { categorizeVenue, clearCategorizationCache } = await import('./openai');
      clearCategorizationCache();

      // Get all curated venues
      const venues = await storage.getAllCuratedVenues();
      console.log(`[Venue Recategorization] Checking ${venues.length} venues...`);

      // Track category distribution before and after
      const CANONICAL_CATEGORIES = ['meal', 'cafes', 'drinks', 'dessert', 'experiences'];
      const categoriesBefore: Record<string, number> = {};
      const categoriesAfter: Record<string, number> = {};
      
      // Count existing categories
      venues.forEach(venue => {
        categoriesBefore[venue.category] = (categoriesBefore[venue.category] || 0) + 1;
      });

      console.log("[Venue Recategorization] Category distribution BEFORE:");
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
            
            console.log(`[Venue Recategorization] ${venue.name}: "${venue.category}" → "${correctCategory}"${isNonCanonical ? ' (non-canonical)' : ''}`);
            
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
            console.log(`[Venue Recategorization] Progress: ${checked}/${venues.length} venues checked, ${changes.length} changes made`);
          }
        } catch (error: any) {
          console.error(`[Venue Recategorization] Error processing ${venue.name}:`, error.message);
          errors++;
        }
      }

      console.log("[Venue Recategorization] Category distribution AFTER:");
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

      console.log(`[Venue Recategorization] Complete! Checked ${checked} venues, made ${changes.length} changes (${forcedUpdates} were non-canonical), ${errors} errors`);

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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      
      let query = db.select().from(apiCallLogsTable);
      
      // Apply filters
      const conditions = [];
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
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      // Order by most recent first
      query = query.orderBy(desc(apiCallLogsTable.createdAt));
      
      // Apply pagination
      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);
      query = query.limit(limitNum).offset(offsetNum);
      
      const logs = await query;
      
      // Get total count for pagination
      let countQuery = db.select({ count: sql<number>`count(*)` }).from(apiCallLogsTable);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const totalResult = await countQuery;
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
      const userId = req.user.claims.sub;
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
      let logQuery = db.select().from(apiCallLogsTable);
      if (dateThreshold) {
        logQuery = logQuery.where(gte(apiCallLogsTable.createdAt, dateThreshold));
      }
      
      const apiLogs = await logQuery;
      
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

  const httpServer = createServer(app);

  return httpServer;
}

// Helper function to generate and store activities
async function generateAndStoreActivities(groupId: string, groupData: any) {
  try {
    // Update status to generating
    await storage.updateGroupStatus(groupId, "generating");

    console.log(`[AI Generation] Starting for group ${groupId}`);
    console.log(`[AI Generation] Group data:`, JSON.stringify(groupData, null, 2));

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
    console.log(`[AI Generation] Found ${seenVenueNames.length} seen venues to exclude from suggestions`);

    console.log(`[AI Generation] Found ${previousFeedback.length} activities with feedback`);
    console.log(`[AI Generation] Found ${votingFeedback.length} favorites with voting data`);
    console.log(`[AI Generation] Found ${likedConcepts.length} liked concepts from swipe sessions`);
    console.log(`[AI Generation] Found ${passedConcepts.length} passed concepts from swipe sessions`);
    console.log(`[AI Generation] Found ${memberConstraints.length} members with constraints`);
    console.log(`[AI Generation] Found ${previouslySuggestedVenues.length} previously suggested venues to avoid`);

    // Archive old activities before generating new ones (preserves feedback for AI)
    await storage.archiveGroupActivities(groupId);
    console.log(`[AI Generation] Archived existing activities for group ${groupId}`);

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

      console.log(`[AI Generation] Checking balance for enabled categories: ${enabledCategories.join(', ')}`);
      console.log(`[AI Generation] Current counts:`, categoryCounts);

      // All ENABLED categories must have at least 3 cards
      return enabledCategories.every(cat => categoryCounts[cat] >= 3);
    };

    while (!hasBalancedDistribution(allUniqueActivities) && attempt < maxAttempts) {
      attempt++;
      const attemptStart = Date.now();
      const needed = 20 - allUniqueActivities.length;
      console.log(`[AI Generation] Attempt ${attempt}/${maxAttempts}: Need ${needed} more unique activities (have ${allUniqueActivities.length})`);

      // Refresh group data to get latest rejected venues
      const refreshedGroup = await storage.getGroup(groupId);
      if (!refreshedGroup) {
        throw new Error("Group not found during generation");
      }
      const rejectedVenues = refreshedGroup.rejectedVenues || [];
      const rejectedSet = new Set(rejectedVenues.map(v => v.toLowerCase()));
      console.log(`[AI Generation] Blacklisted venues: ${rejectedVenues.length}`);

      // Get group insights for AI context
      const groupInsights = refreshedGroup.preferenceInsights || undefined;

      // Update progress in database so frontend can display it
      await storage.updateGroupStatus(groupId, "generating", `Generating suggestions (attempt ${attempt} of ${maxAttempts})`);

      // Generate AI suggestions with feedback and list of venues to avoid
      // Add 120-second timeout to prevent infinite hanging
      const aiPromptStart = Date.now();
      const suggestions = await Promise.race([
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
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('AI generation timed out after 180 seconds')), 180000)
        )
      ]);

      const aiPromptEnd = Date.now();
      console.log(`[AI Generation] Attempt ${attempt}: AI prompt took ${((aiPromptEnd - aiPromptStart) / 1000).toFixed(1)}s`);
      console.log(`[AI Generation] Attempt ${attempt}: Received ${suggestions.length} suggestions from OpenAI`);

      // Filter out rejected venues AND disabled categories BEFORE calling Google Places
      // (Duplicate checking happens after Google Places returns actual venue names)
      console.log(`[Category Filter] Group settings: meal=${groupData.mealEnabled}, cafe=${groupData.cafeEnabled}, drinks=${groupData.drinksEnabled}, dessert=${groupData.dessertEnabled}, exp=${groupData.experiencesEnabled}`);
      
      const filteredSuggestions = suggestions.filter(s => {
        const normalized = s.venueName.trim().toLowerCase();
        
        // Skip blacklisted venues
        if (rejectedSet.has(normalized)) {
          console.log(`[API Optimization] Skipping blacklisted venue: ${s.venueName}`);
          return false;
        }
        
        // CRITICAL: Skip disabled categories to save API quota
        // Detect category using keyword matching on venue name/type
        const detectedCategory = detectCategory(s.venueName, s.venueType);
        console.log(`[Category Filter] "${s.venueName}" (${s.venueType}) → detected as "${detectedCategory}"`);
        
        // Check if this category is disabled
        const categoryEnabled = 
          (detectedCategory === 'meal' && (groupData.mealEnabled ?? true)) ||
          (detectedCategory === 'cafes' && (groupData.cafeEnabled ?? true)) ||
          (detectedCategory === 'drinks' && (groupData.drinksEnabled ?? true)) ||
          (detectedCategory === 'dessert' && (groupData.dessertEnabled ?? true)) ||
          (detectedCategory === 'experiences' && (groupData.experiencesEnabled ?? true));
        
        console.log(`[Category Filter] "${s.venueName}" → category="${detectedCategory}", enabled=${categoryEnabled}`);
        
        if (!categoryEnabled) {
          console.log(`[API Optimization] ❌ FILTERED OUT: ${s.venueName} (${s.venueType}) - ${detectedCategory} category is disabled`);
          return false;
        }
        
        console.log(`[API Optimization] ✅ KEEPING: ${s.venueName} - ${detectedCategory} category is enabled`);
        return true;
      });
      console.log(`[AI Generation] After category + blacklist filter: ${filteredSuggestions.length}/${suggestions.length} suggestions`);

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
            console.log(`[AI Generation] Rejecting ${suggestion.venueName} - no Google Places results found (fake venue)`);
            await storage.addRejectedVenue(groupId, suggestion.venueName);
            return null;
          }

          // Apply quality filtering based on search radius
          // Farther venues must have higher ratings and review counts
          const searchRadius = groupData.searchRadius || 2;
          const qualityFiltered = places.filter(place => {
            const rating = parseFloat(place.rating || '0');
            const reviewCount = place.reviewCount || 0;

            // Relaxed quality requirements for better activity variety:
            // < 2 miles (Nearby): 3.5+ stars, 10+ reviews
            // < 10 miles (Citywide): 3.5+ stars, 15+ reviews
            // < 30 miles (Special Trip): 3.7+ stars, 25+ reviews
            // < 50 miles (Road Trip): 3.9+ stars, 40+ reviews

            if (searchRadius <= 2) {
              return rating >= 3.5 && reviewCount >= 10;
            } else if (searchRadius <= 10) {
              return rating >= 3.5 && reviewCount >= 15;
            } else if (searchRadius <= 30) {
              return rating >= 3.7 && reviewCount >= 25;
            } else {
              return rating >= 3.9 && reviewCount >= 40;
            }
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
                console.log(`[Drinks Filter] ❌ Rejecting ${place.name} - has BOTH bar and restaurant types: ${types.join(', ')}`);
                return false;
              }
              
              if (hasRestaurantType) {
                console.log(`[Drinks Filter] ❌ Rejecting ${place.name} - has restaurant type: ${types.join(', ')}`);
                return false;
              }
              return true;
            });
            
            if (drinksFiltered.length < budgetFiltered.length) {
              console.log(`[Drinks Filter] Filtered out ${budgetFiltered.length - drinksFiltered.length} restaurants from drinks category`);
            }
          }
          
          // Only use venues that meet quality AND budget standards
          let finalPlaces = drinksFiltered;

          // Check if we have curated venues - use TYPE-BASED matching instead of name matching
          let useCuratedVenue = false;
          let curatedPlace = null;
          
          if (finalPlaces.length > 0) {
            // STRATEGY: Use any high-quality curated venue instead of requiring name match
            // Since AI suggests specific names but we want to maximize cache hits,
            // we'll use the best-rated cached venue of the right type
            
            // First, try exact/fuzzy name match (faster when AI suggests known venues)
            const rankedPlaces = finalPlaces.map(place => ({
              place,
              similarity: calculateNameSimilarity(suggestion.venueName, place.name)
            })).sort((a, b) => b.similarity - a.similarity);

            const bestMatch = rankedPlaces[0];
            const SIMILARITY_THRESHOLD = 0.6;

            // Try name matching first
            if (bestMatch.similarity >= SIMILARITY_THRESHOLD) {
              console.log(`[Venue Matching] ✅ Matched "${bestMatch.place.name}" to AI suggestion "${suggestion.venueName}" with ${(bestMatch.similarity * 100).toFixed(0)}% similarity`);
              curatedPlace = bestMatch.place;
              useCuratedVenue = true;
            } else {
              // No good name match - use TYPE-BASED matching instead
              // Return highest-rated venue from our cache (already filtered by type during search)
              const bestRatedPlace = finalPlaces.sort((a, b) => 
                (parseFloat(b.rating || '0') - parseFloat(a.rating || '0'))
              )[0];
              
              console.log(`[Venue Matching] 🎯 TYPE-BASED MATCH: Using cached "${bestRatedPlace.name}" (${bestRatedPlace.rating}⭐) for AI suggestion "${suggestion.venueName}" (${suggestion.venueType})`);
              curatedPlace = bestRatedPlace;
              useCuratedVenue = true;
            }
          }

          if (useCuratedVenue && curatedPlace) {
            // CRITICAL: Only include venues with verified Google Places data
            // Note: photoUrl is optional - we can fetch it later on-demand
            if (!curatedPlace.rating || !curatedPlace.address) {
              console.log(`[AI Generation] Rejecting ${curatedPlace.name} - missing critical data (rating: ${curatedPlace.rating}, address: ${!!curatedPlace.address})`);
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
            console.log(`[API Fallback] Calling Google Places API for "${suggestion.venueName}"`);
            
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
              console.log(`[API Fallback] Google Places API returned no results for "${suggestion.venueName}" - likely fake venue`);
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
            console.log(`[API Fallback] After relevance filter: ${relevantPlaces.length}/${apiPlaces.length} places passed`);
            
            // Apply quality filters (RELAXED thresholds for better results)
            console.log(`[API Fallback] Applying quality filter (searchRadius: ${searchRadius})`);
            const apiQualityFiltered = relevantPlaces.filter(place => {
              const rating = parseFloat(place.rating || '0');
              const reviewCount = place.reviewCount || 0;
              
              let passed = false;
              let minRating = 0;
              let minReviews = 0;
              
              // VERY RELAXED fallback thresholds - prioritize variety
              if (searchRadius <= 2) {
                minRating = 3.3;
                minReviews = 5; // Very relaxed for nearby venues
                passed = rating >= minRating && reviewCount >= minReviews;
              } else if (searchRadius <= 10) {
                minRating = 3.5;
                minReviews = 10; // Relaxed for citywide
                passed = rating >= minRating && reviewCount >= minReviews;
              } else if (searchRadius <= 30) {
                minRating = 3.7;
                minReviews = 20; // Relaxed for special trips
                passed = rating >= minRating && reviewCount >= minReviews;
              } else {
                minRating = 3.8;
                minReviews = 30; // Relaxed for road trips
                passed = rating >= minRating && reviewCount >= minReviews;
              }
              
              if (!passed) {
                console.log(`[Quality Filter] ❌ REJECTED "${place.name}" - rating: ${rating} (min: ${minRating}), reviews: ${reviewCount} (min: ${minReviews})`);
              }
              
              return passed;
            });
            console.log(`[API Fallback] After quality filter: ${apiQualityFiltered.length}/${relevantPlaces.length} places passed`);
            
            const apiBudgetFiltered = apiQualityFiltered.filter(place => {
              const priceLevelRaw = parseInt(place.priceLevel || '0');
              // If NaN (missing price data), treat as 0 (cheapest) for budgets >= $100, otherwise reject
              const priceLevel = isNaN(priceLevelRaw) ? (groupData.budgetMax >= 100 ? 0 : 999) : priceLevelRaw;
              const budgetMax = groupData.budgetMax;
              
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
            console.log(`[API Fallback] After budget filter: ${apiBudgetFiltered.length}/${apiQualityFiltered.length} places passed`);
            
            // Apply drinks filter to API results too
            let apiDrinksFiltered = apiBudgetFiltered;
            if (detectedCategory === 'drinks') {
              console.log(`[API Fallback] Applying drinks filter to ${apiBudgetFiltered.length} places`);
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
                  console.log(`[Drinks Filter] ❌ REJECTED "${place.name}" - has restaurant type (types: ${types.join(', ')})`);
                  return false;
                }
                return true;
              });
              console.log(`[API Fallback] After drinks filter: ${apiDrinksFiltered.length}/${apiBudgetFiltered.length} places passed`);
            }
            
            if (apiDrinksFiltered.length === 0) {
              console.log(`[API Fallback] All API results also filtered out for "${suggestion.venueName}" - no suitable venues found`);
              return null;
            }
            
            // Use the first result from API (they're already sorted by relevance)
            const apiPlace = apiDrinksFiltered[0];
            console.log(`[API Fallback] ✅ Using "${apiPlace.name}" from Google Places API for suggestion "${suggestion.venueName}"`);
            
            // CRITICAL: Only include venues with verified Google Places data
            // Note: photoUrl is optional - we can fetch it later on-demand
            if (!apiPlace.rating || !apiPlace.address) {
              console.log(`[API Fallback] Rejecting ${apiPlace.name} - missing critical data (rating: ${apiPlace.rating}, address: ${!!apiPlace.address})`);
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
      console.log(`[AI Generation] Attempt ${attempt}: Google Places search took ${((googleSearchEnd - googleSearchStart) / 1000).toFixed(1)}s`);
      console.log(`[AI Generation] Attempt ${attempt}: Created ${activitiesData.length} activities from Google Places`);

      // Filter out null activities (from failed Google Places searches)
      const validActivities = activitiesData.filter((a: any) => a !== null);
      console.log(`[AI Generation] After filtering nulls: ${validActivities.length} valid activities`);

      // First, categorize all new activities in batches
      const categorizationStart = Date.now();
      const uncategorized = validActivities.filter((a: any) => !a.category);
      for (let i = 0; i < uncategorized.length; i += batchSize) {
        const batch = uncategorized.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (activity: any) => {
            activity.category = await categorizeVenue(activity.venueName, activity.venueType);
          })
        );
      }
      const categorizationEnd = Date.now();
      console.log(`[AI Generation] Attempt ${attempt}: AI categorization took ${((categorizationEnd - categorizationStart) / 1000).toFixed(1)}s for ${uncategorized.length} venues`);

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
          console.log(`[AI Generation] Added unique venue: ${activity.venueName} [${category.toUpperCase()}] (${currentCategoryCounts[category]}/3 in category)`);
        } else if (seenVenues.has(venueKey)) {
          console.log(`[AI Generation] Skipping duplicate venue: ${activity.venueName}`);
        } else if (category && currentCategoryCounts[category] >= 3) {
          console.log(`[AI Generation] Skipping ${activity.venueName} - ${category.toUpperCase()} category already has 3 cards`);
        }
      }

      console.log(`[AI Generation] After attempt ${attempt}: Have ${allUniqueActivities.length}/15 unique activities`);

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

        console.log(`[AI Generation] 📊 Current category distribution after attempt ${attempt}:`, categoryCounts);

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
          console.log(`[AI Generation] ⚠️ Underrepresented ENABLED categories (< 3 cards): ${underrepresentedCategories.join(', ')}`);
          // Set target categories for next attempt
          targetCategories = underrepresentedCategories;
          console.log(`[AI Generation] 🎯 Next attempt will target: ${targetCategories.join(', ')}`);
        } else {
          console.log(`[AI Generation] ✅ All ENABLED categories have at least 3 cards - balanced distribution achieved!`);
        }
      }

      const attemptEnd = Date.now();
      console.log(`[AI Generation] 🏁 Attempt ${attempt} total time: ${((attemptEnd - attemptStart) / 1000).toFixed(1)}s`);
    }

    // Store the unique activities (up to 15)
    if (allUniqueActivities.length > 0) {
      console.log(`[AI Generation] Categorizing ${allUniqueActivities.length} activities with AI...`);

      // Add AI categorization to each activity in parallel (for any not yet categorized)
      await Promise.all(
        allUniqueActivities.map(async (activity: any) => {
          if (!activity.category) {
            activity.category = await categorizeVenue(activity.venueName, activity.venueType);
          }
        })
      );

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

      console.log(`[AI Generation] Final category distribution:`, finalCategoryCounts);
      console.log(`[AI Generation] Storing ${allUniqueActivities.length} unique activities`);
      await storage.createActivities(allUniqueActivities);
      
      // Mark venues as seen in the database to prevent repetitive suggestions
      const venuesToMark = allUniqueActivities.map(a => ({
        venueName: a.venueName,
        googlePlaceId: a.googlePlaceId || undefined,
        category: a.category
      }));
      await storage.markVenuesAsSeen(groupId, venuesToMark);
      console.log(`[AI Generation] Marked ${venuesToMark.length} venues as seen for group ${groupId}`);
    } else {
      console.warn(`[AI Generation] WARNING: No unique activities generated after ${maxAttempts} attempts`);
    }

    console.log(`[AI Generation] Successfully stored activities for group ${groupId}`);
    
    // Log cache stats to show optimization impact
    const cacheStats = getCacheStats();
    console.log(`[API Optimization] ━━━ Cache Performance Summary ━━━`);
    console.log(`[API Optimization] Total API calls: ${cacheStats.totalCalls}`);
    console.log(`[API Optimization] Cache hits: ${cacheStats.totalHits} (${cacheStats.hitRate}%)`);
    console.log(`[API Optimization] Cache misses: ${cacheStats.totalMisses}`);
    console.log(`[API Optimization] ✅ API calls saved: ${cacheStats.apiCallsSaved}`);
    console.log(`[API Optimization] Breakdown:`);
    console.log(`[API Optimization]   - placeDetails: ${cacheStats.placeDetailsHits} hits / ${cacheStats.placeDetailsMisses} misses`);
    console.log(`[API Optimization]   - textSearch: ${cacheStats.searchHits} hits / ${cacheStats.searchMisses} misses`);
    console.log(`[API Optimization]   - nearbySearch: ${cacheStats.nearbyHits} hits / ${cacheStats.nearbyMisses} misses`);

    // Update status to completed
    console.log(`[AI Generation] Updating group status to completed...`);
    await storage.updateGroupStatus(groupId, "completed");
    console.log(`[AI Generation] ✅ Group status updated to completed`);
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