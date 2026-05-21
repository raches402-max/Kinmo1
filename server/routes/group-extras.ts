/**
 * Group Extras Routes
 *
 * Miscellaneous group-related routes:
 *   PATCH  /api/groups/:id/collection          — assign group to a collection
 *   PATCH  /api/groups/reorder                  — reorder groups within a collection
 *   POST   /api/voting-events                   — create voting event with Google Places enrichment
 *   POST   /api/groups/:id/quick-event          — create a quick event from available venues
 *   GET    /api/groups/:id/category-search-history — recent category searches
 *   POST   /api/groups/:id/add-venues-to-library — save venues to activities
 *   POST   /api/groups/:id/send-invitations     — send email invitations to members
 *
 * MIGRATED FROM: server/routes.ts
 */

import { safeError } from "../lib/safe-error";
import { Router } from "express";
import { storage } from "../storage";
import { insertVotingEventSchema } from "@shared/schema";
import { isAuthenticated } from "../googleAuth";
import { fail } from "../lib/responses";
import {
  requireGroupOwnership,
  getUserId,
} from "../authorization";
import { searchPlaces, calculateNameSimilarity } from "../google-places";
import type { TrustSource } from "../trust-state";

const router = Router();

// ── Assign group to collection ─────────────────────────────────────────────

router.patch("/groups/:id/collection", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = await getUserId(req);
    const { collectionId, orderIndex } = req.body;

    // Verify user owns the group
    const group = await storage.getGroup(id);
    if (!group || group.userId !== userId) {
      return fail(res, 404, "Group not found");
    }

    // If collectionId is provided, verify user owns that collection too
    if (collectionId) {
      const collections = await storage.getUserGroupCollections(userId);
      const collection = collections.find(c => c.id === collectionId);
      if (!collection) {
        return fail(res, 404, "Collection not found");
      }
    }

    await storage.updateGroupCollectionAssignment(id, collectionId, orderIndex);
    res.json({ success: true });
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

// ── Reorder groups within a collection or uncategorized ────────────────────

router.patch("/groups/reorder", isAuthenticated, async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const { groupOrders } = req.body; // Array of { id, orderIndex }

    // Verify all groups belong to this user
    const userGroups = await storage.getUserGroups(userId);
    const userGroupIds = new Set(userGroups.map(g => g.id));
    const allOwned = groupOrders.every((order: any) => userGroupIds.has(order.id));

    if (!allOwned) {
      return fail(res, 403, "You don't own all these groups");
    }

    await storage.reorderGroupsInCollection(groupOrders);
    res.json({ success: true });
  } catch (error: any) {
    fail(res, 500, safeError(error));
  }
});

// ── Create voting event (with Google Places enrichment) ────────────────────

router.post("/voting-events", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    const validatedEvent = insertVotingEventSchema.parse(req.body);
    const skipEnrichmentCheck = req.body.skipEnrichmentCheck === true;

    // Get the group to know the location for Google Places search
    const group = await storage.getGroup(validatedEvent.groupId);
    if (!group) {
      return fail(res, 404, "Group not found");
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

    // Trust source: if Google enrichment matched a place above the similarity threshold,
    // the (name, placeId) pair is already vetted by Google → google_search.
    // Otherwise the user is creating a venue from a placeId/name pair we haven't checked → manual.
    // Skipped enrichment paths come in with a placeId from the frontend's own search result, so
    // they're treated as google_search (the placeId arrived alongside the name from Google).
    const trustSource: TrustSource =
      enrichmentStatus === 'success' || (skipEnrichmentCheck && req.body.googlePlaceId)
        ? 'google_search'
        : 'manual';
    const event = await storage.createVotingEvent(enrichedEvent, userId, trustSource);
    res.json({ event, enrichmentStatus });
  } catch (error: any) {
    fail(res, 400, error.message);
  }
});

// ── Quick event creation ───────────────────────────────────────────────────

router.post("/groups/:id/quick-event", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return fail(res, 404, "Group not found");
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
    fail(res, 500, safeError(error));
  }
});

// ── Get recent category searches for a group ───────────────────────────────

router.get("/groups/:id/category-search-history", isAuthenticated, async (req: any, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return fail(res, 404, "Group not found");
    }

    // Verify user owns this group
    const userId = await getUserId(req);
    if (group.userId !== userId) {
      return fail(res, 403, "Not authorized to access this group");
    }

    const limit = parseInt(req.query.limit as string) || 5;
    const searches = await storage.getRecentCategorySearches(req.params.id, limit);

    res.json(searches);
  } catch (error: any) {
    console.error("[Category Search History] Error:", error);
    fail(res, 500, safeError(error));
  }
});

// ── Add selected venues to the library (save to activities) ────────────────

router.post("/groups/:id/add-venues-to-library", isAuthenticated, async (req: any, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return fail(res, 404, "Group not found");
    }

    // Verify user owns this group
    const userId = await getUserId(req);
    if (group.userId !== userId) {
      return fail(res, 403, "Not authorized to modify this group");
    }

    const { category, searchLocation, searchRadius, selectedVenues } = req.body;

    if (!category || !selectedVenues || !Array.isArray(selectedVenues)) {
      return fail(res, 400, "Missing required fields: category, selectedVenues");
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
      }, 'google_search');
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
    fail(res, 500, safeError(error));
  }
});

// ── Send email invitations to group members ────────────────────────────────

router.post("/groups/:id/send-invitations", isAuthenticated, requireGroupOwnership(), async (req: any, res) => {
  try {
    const group = await storage.getGroup(req.params.id);
    if (!group) {
      return fail(res, 404, "Group not found");
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
    fail(res, 500, safeError(error));
  }
});

export default router;
