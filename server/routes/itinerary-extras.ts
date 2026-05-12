/**
 * Itinerary Extras Routes
 *
 * Extracted from routes.ts. Covers itinerary items CRUD, time slots, invites,
 * sending/finalizing itineraries, guest lists, and availability insights.
 *
 * Routes:
 *   DELETE /api/itinerary-invites/:id                    — delete itinerary invite
 *   POST   /api/groups/:groupId/itineraries/validate     — validate and create itinerary
 *   DELETE /api/itinerary-items/:id                      — delete itinerary item
 *   PATCH  /api/itinerary-items/:id                      — update itinerary item
 *   POST   /api/itineraries/:id/items                    — add items to itinerary
 *   POST   /api/itineraries/:id/items/ad-hoc             — add ad-hoc venue to itinerary
 *   GET    /api/itineraries/:itineraryId/time-slots      — get time slots
 *   POST   /api/itineraries/:itineraryId/time-slots      — create time slots
 *   POST   /api/time-slots/:timeSlotId/vote              — vote for time slot
 *   DELETE /api/time-slots/:timeSlotId/vote              — remove time slot vote
 *   PATCH  /api/time-slots/:timeSlotId/select            — select time slot
 *   GET    /api/groups/:groupId/saved-itineraries        — get saved itineraries
 *   POST   /api/itineraries/:id/save                     — save itinerary
 *   POST   /api/itineraries/:id/duplicate                — duplicate itinerary
 *   POST   /api/itineraries/:id/send                     — send itinerary to group
 *   POST   /api/itineraries/:id/send-backup              — send backup itinerary
 *   POST   /api/itineraries/:id/finalize                 — finalize itinerary
 *   GET    /api/groups/:groupId/proposed-itineraries      — get proposed itineraries
 *   GET    /api/itineraries/:id/shareable-token           — get shareable invite token
 *   GET    /api/itineraries/:id/guest-list                — get guest list
 *   GET    /api/itineraries/:id/invite-summary            — get invite summary
 *   GET    /api/itineraries/:id/availability-insights     — get availability insights
 */

import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { isAuthenticated } from "../googleAuth";
import { requireItineraryAccess, getUserId } from "../authorization";
import { storage } from "../storage";
import { safeParse } from "../validation-middleware";
import { validateItinerary } from "../itinerary-validation";
import { searchPlaces, geocodeLocation, detectAndParseGoogleMapsUrl, getBestVenueType } from "../google-places";
import { analyzeEventAvailability } from "../availability-analyzer";
import { notifyEventInvite } from "../notifications";
import {
  itineraries,
  itineraryItems,
  itineraryInvites,
  rsvps as rsvpsTable,
  members as membersTable,
  proposedTimeSlots,
  users,
  userProfiles,
  type UpdateItinerary,
  type ItineraryItem,
} from "@shared/schema";
import {
  updateItineraryItemSchema,
  addItineraryItemsSchema,
  addAdHocVenueSchema,
  sendItinerarySchema,
  saveItinerarySchema,
} from "../validation-schemas";

// ============================================================================
// Local helpers (inlined from routes.ts — not yet exported)
// ============================================================================

function normalizeRsvpResponse(response: string | null | undefined): 'yes' | 'maybe' | 'no' | null {
  if (!response) return null;
  const r = response.toLowerCase();
  if (r === 'yes' || r === 'going') return 'yes';
  if (r === 'maybe') return 'maybe';
  if (r === 'no' || r === 'not_going') return 'no';
  return null;
}

function isPositiveRsvp(response: string | null | undefined): boolean {
  const normalized = normalizeRsvpResponse(response);
  return normalized === 'yes';
}

function isTentativeRsvp(response: string | null | undefined): boolean {
  const normalized = normalizeRsvpResponse(response);
  return normalized === 'maybe';
}

function isNegativeRsvp(response: string | null | undefined): boolean {
  const normalized = normalizeRsvpResponse(response);
  return normalized === 'no';
}

async function getGroupMembersWithOrganizer(groupId: string, organizerUserId: string) {
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

  const organizerMemberRecord = regularMembers.find(m =>
    m.userId === organizerUserId ||
    (organizerEmail && m.email && m.email.toLowerCase() === organizerEmail.toLowerCase())
  );

  const filteredMembers = regularMembers.filter(m => {
    if (m.userId === organizerUserId) return false;
    if (organizerEmail && m.email && m.email.toLowerCase() === organizerEmail.toLowerCase()) return false;
    return true;
  });

  const organizer = {
    id: organizerMemberRecord?.id || `organizer-${organizerUserId}`,
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

// ============================================================================
// Router
// ============================================================================

const router = Router();

// Delete itinerary invite (for organizer to remove members)
router.delete("/itinerary-invites/:id", isAuthenticated, async (req: any, res) => {
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

// Validate and create itinerary
router.post("/groups/:groupId/itineraries/validate", isAuthenticated, async (req: any, res) => {
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
    const { deduplicateUnsentDrafts } = await import('../itinerary-deduplication');
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

// Delete itinerary item
router.delete("/itinerary-items/:id", isAuthenticated, async (req: any, res) => {
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
router.patch("/itinerary-items/:id", isAuthenticated, async (req: any, res) => {
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
router.post("/itineraries/:id/items", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
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
router.post("/itineraries/:id/items/ad-hoc", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
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
            const { calculateNameSimilarity } = await import('../google-places');
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
            const { calculateNameSimilarity } = await import('../google-places');
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
        const { validateVenuePlaceId } = await import('../google-places');

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

// Get time slots for an itinerary
router.get("/itineraries/:itineraryId/time-slots", async (req: any, res) => {
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
router.post("/itineraries/:itineraryId/time-slots", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
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
router.post("/time-slots/:timeSlotId/vote", async (req: any, res) => {
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
router.delete("/time-slots/:timeSlotId/vote", async (req: any, res) => {
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
router.patch("/time-slots/:timeSlotId/select", isAuthenticated, async (req: any, res) => {
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
router.get("/groups/:groupId/saved-itineraries", async (req, res) => {
  try {
    const savedItineraries = await storage.getSavedItineraries(req.params.groupId);
    res.json(savedItineraries);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Save an itinerary (creates a copy so the draft remains editable)
router.post("/itineraries/:id/save", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
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
      const { generateItineraryName } = await import('../ai-itinerary-naming');
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
router.post("/itineraries/:id/duplicate", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
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

// Send an itinerary as a proposal to the group
router.post("/itineraries/:id/send", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
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
      let scheduleConfig: import('../adaptive-timeline').AdaptiveScheduleConfig;
      if (autoScheduleConfig) {
        // Use provided config if specified - add defaults for required fields
        const { calculateAdaptiveTimeline } = await import('../adaptive-timeline');
        const defaultConfig = calculateAdaptiveTimeline(date, new Date());
        scheduleConfig = {
          ...defaultConfig,
          ...autoScheduleConfig,
        };
      } else {
        // Calculate adaptive timeline based on event date
        const { calculateAdaptiveTimeline } = await import('../adaptive-timeline');
        scheduleConfig = calculateAdaptiveTimeline(date, new Date());
      }
      console.log(`[Send Itinerary] Using ${scheduleConfig.timelineType} timeline: ${scheduleConfig.reasoning}`);

      // Calculate RSVP deadline based on timeline config
      const { calculateRsvpDeadline } = await import('../adaptive-timeline');
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

          const { sendItineraryInvite } = await import('../email-service');

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

// Send a backup itinerary linked to another itinerary
router.post("/itineraries/:id/send-backup", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
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

// Finalize an itinerary as "The Plan" and trigger next auto-event
router.post("/itineraries/:id/finalize", isAuthenticated, requireItineraryAccess(), async (req: any, res) => {
  try {
    const itinerary = await storage.getItinerary(req.params.id);
    if (!itinerary || !itinerary.groupId) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    // Validate venue hours if we have an event date
    if (itinerary.eventDate) {
      const group = await storage.getGroup(itinerary.groupId);
      const timezone = group?.timezone || 'America/Los_Angeles';

      const { checkVenueHours } = await import('../itinerary-validation');
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
        const { maintainEventPipeline } = await import('../auto-scheduler.js');
        await maintainEventPipeline(itinerary.groupId, storage);
      }
    }

    res.json(updatedItinerary);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get proposed itineraries with RSVPs
router.get("/groups/:groupId/proposed-itineraries", async (req, res) => {
  try {
    const proposedItineraries = await storage.getProposedItineraries(req.params.groupId);
    res.json(proposedItineraries);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get shareable invite token for an itinerary
// Returns the invite token where member_id IS NULL (the shareable one)
router.get("/itineraries/:id/shareable-token", async (req, res) => {
  try {
    const itineraryId = req.params.id;

    // Get the shareable invite (member_id = NULL)
    const [shareableInvite] = await db
      .select({ inviteToken: itineraryInvites.inviteToken })
      .from(itineraryInvites)
      .where(sql`itinerary_id = ${itineraryId} AND member_id IS NULL`);

    if (!shareableInvite) {
      return res.status(404).json({ message: "No shareable invite found for this event" });
    }

    res.json({ inviteToken: shareableInvite.inviteToken });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get guest list (RSVPs with names) for an itinerary (public - for RSVP page)
// Returns simplified RSVP data with member names for displaying who's coming
router.get("/itineraries/:id/guest-list", async (req, res) => {
  try {
    const itineraryId = req.params.id;

    // Verify itinerary exists
    const itinerary = await storage.getItinerary(itineraryId);
    if (!itinerary) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    // Get all RSVPs for this itinerary
    const rsvps = await db
      .select({
        id: rsvpsTable.id,
        response: rsvpsTable.response,
        memberId: rsvpsTable.memberId,
        guestName: rsvpsTable.guestName,
        additionalAttendees: rsvpsTable.additionalAttendees,
        numberOfKids: rsvpsTable.numberOfKids,
      })
      .from(rsvpsTable)
      .where(sql`itinerary_id = ${itineraryId}`);

    type AdditionalAttendee = { type?: 'member' | 'guest'; memberId?: string; name?: string };

    // Get member details for RSVPs with memberId
    const memberIds = rsvps
      .filter(r => r.memberId)
      .map(r => r.memberId as string);

    // Also get additional member IDs from the new additionalAttendees array
    const additionalMemberIds = rsvps.flatMap(r => {
      const attendees = Array.isArray(r.additionalAttendees)
        ? (r.additionalAttendees as AdditionalAttendee[])
        : [];

      return attendees
        .filter((attendee): attendee is AdditionalAttendee & { memberId: string } => attendee?.type === 'member' && typeof attendee.memberId === 'string')
        .map(attendee => attendee.memberId);
    });

    const allMemberIds = [...new Set([...memberIds, ...additionalMemberIds])];

    let membersMap: Record<string, { name: string | null; email: string | null }> = {};
    if (allMemberIds.length > 0) {
      const members = await db
        .select({ id: membersTable.id, name: membersTable.name, email: membersTable.email })
        .from(membersTable)
        .where(sql`id IN ${allMemberIds}`);

      membersMap = Object.fromEntries(members.map(m => [m.id, { name: m.name, email: m.email }]));
    }

    // Build guest list with names
    const guestList = rsvps.map(rsvp => {
      const member = rsvp.memberId ? membersMap[rsvp.memberId] : null;
      const additionalAttendees = Array.isArray(rsvp.additionalAttendees)
        ? (rsvp.additionalAttendees as AdditionalAttendee[])
        : [];
      const firstAdditionalAttendee = additionalAttendees[0];
      const additionalMember = firstAdditionalAttendee?.memberId
        ? membersMap[firstAdditionalAttendee.memberId]
        : null;

      return {
        id: rsvp.id,
        response: rsvp.response,
        name: member?.name || rsvp.guestName || member?.email || 'Someone',
        additionalName: additionalMember?.name || firstAdditionalAttendee?.name || additionalMember?.email || null,
        numberOfKids: rsvp.numberOfKids || 0,
      };
    });

    // Count responses
    const counts = {
      yes: guestList.filter(g => isPositiveRsvp(g.response)).length,
      maybe: guestList.filter(g => isTentativeRsvp(g.response)).length,
      no: guestList.filter(g => isNegativeRsvp(g.response)).length,
    };

    res.json({ guestList, counts });
  } catch (error: any) {
    console.error('[Guest List] Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get invite summary with RSVP counts and shareable link
router.get("/itineraries/:id/invite-summary", isAuthenticated, async (req, res) => {
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

    // Count RSVP responses (normalize for legacy values)
    const rsvpCounts = {
      yes: rsvps.filter(r => isPositiveRsvp(r.response)).length,
      maybe: rsvps.filter(r => isTentativeRsvp(r.response)).length,
      no: rsvps.filter(r => isNegativeRsvp(r.response)).length,
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
router.get("/itineraries/:id/availability-insights", isAuthenticated, async (req: any, res) => {
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

export default router;
