/**
 * Custom MCP-style tools for the AI Event Assistant
 *
 * These tools allow the AI agent to search venues, view the itinerary,
 * and add/remove venues during a chat session.
 */

import { db } from "./db";
import { storage } from "./storage";
import { searchPlaces, getPlaceDetails, geocodeLocation } from "./google-places";
import { eq, sql, and, isNull, desc, gte } from "drizzle-orm";
import { votingEvents, activities, itineraryItems, curatedVenues, votes, autoScheduledEvents, itineraries, rsvps, members } from "@shared/schema";
import { z } from "zod";
import { suggestMultipleTimeOptions, convertAvailabilityToString } from "./ai-time-picker";

// Tool definition types
interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

// Helper: Calculate distance between two coordinates in miles
function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Tool definitions for Claude
export const agentTools: ToolDefinition[] = [
  {
    name: "resolveLocation",
    description: "Convert a place name, address, or landmark to coordinates. Use this FIRST when user mentions a location by name (e.g., 'near Double Standard', 'in the Marina').",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Place name, address, or landmark (e.g., 'Double Standard', 'Marina District SF', '123 Main St')"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "searchVenues",
    description: "Search for venues using Google Places API. Use this to discover new restaurants, bars, cafes, or experiences near a location.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'craft beer bars', 'Italian restaurants', 'fun activities')"
        },
        latitude: {
          type: "number",
          description: "Latitude of search center"
        },
        longitude: {
          type: "number",
          description: "Longitude of search center"
        },
        radiusMeters: {
          type: "number",
          description: "Search radius in meters (default: 1609 for 1 mile)"
        }
      },
      required: ["query", "latitude", "longitude"]
    }
  },
  {
    name: "getGroupFavorites",
    description: "Get venues that this group has favorited/liked in the past. Only use these when contextually relevant (same area, compatible category).",
    input_schema: {
      type: "object",
      properties: {
        groupId: {
          type: "string",
          description: "The group ID"
        },
        category: {
          type: "string",
          description: "Optional filter by category (e.g., 'bar', 'restaurant')"
        },
        nearLatitude: {
          type: "number",
          description: "Optional: only return favorites near this latitude"
        },
        nearLongitude: {
          type: "number",
          description: "Optional: only return favorites near this longitude"
        },
        maxDistanceMiles: {
          type: "number",
          description: "Optional: maximum distance in miles from the location (default: 1)"
        }
      },
      required: ["groupId"]
    }
  },
  {
    name: "getCurrentItinerary",
    description: "Get the current state of the itinerary including all venues already added.",
    input_schema: {
      type: "object",
      properties: {
        itineraryId: {
          type: "string",
          description: "The itinerary ID"
        }
      },
      required: ["itineraryId"]
    }
  },
  {
    name: "addVenueToItinerary",
    description: "Add a venue to the itinerary. This actually modifies the user's event. Always confirm with the user before using this.",
    input_schema: {
      type: "object",
      properties: {
        itineraryId: {
          type: "string",
          description: "The itinerary ID"
        },
        venueName: {
          type: "string",
          description: "Name of the venue"
        },
        venueAddress: {
          type: "string",
          description: "Address of the venue"
        },
        venueType: {
          type: "string",
          description: "Type of venue (e.g., 'bar', 'restaurant', 'cafe')"
        },
        googlePlaceId: {
          type: "string",
          description: "Optional Google Place ID"
        },
        latitude: {
          type: "string",
          description: "Optional latitude"
        },
        longitude: {
          type: "string",
          description: "Optional longitude"
        },
        photoUrl: {
          type: "string",
          description: "Optional photo URL"
        },
        rating: {
          type: "string",
          description: "Optional rating"
        },
        notes: {
          type: "string",
          description: "Optional notes about this venue"
        }
      },
      required: ["itineraryId", "venueName", "venueType"]
    }
  },
  {
    name: "removeVenueFromItinerary",
    description: "Remove a venue from the itinerary by its ID.",
    input_schema: {
      type: "object",
      properties: {
        itineraryId: {
          type: "string",
          description: "The itinerary ID"
        },
        itemId: {
          type: "string",
          description: "The itinerary item ID to remove"
        }
      },
      required: ["itineraryId", "itemId"]
    }
  },
  {
    name: "getGroupPreferences",
    description: "Get the group's preferences and settings to understand what they like.",
    input_schema: {
      type: "object",
      properties: {
        groupId: {
          type: "string",
          description: "The group ID"
        }
      },
      required: ["groupId"]
    }
  },
  {
    name: "getVenueDetails",
    description: "Get detailed information about a specific venue including hours, phone, and reviews.",
    input_schema: {
      type: "object",
      properties: {
        placeId: {
          type: "string",
          description: "Google Place ID"
        }
      },
      required: ["placeId"]
    }
  },
  // ============================================================================
  // Phase 2: Pipeline Observation & Influence Tools
  // ============================================================================
  {
    name: "getUpcomingEvents",
    description: "Get upcoming events (both scheduled and pending) for a group. Shows what's in the pipeline and their status.",
    input_schema: {
      type: "object",
      properties: {
        groupId: {
          type: "string",
          description: "The group ID"
        },
        includeAutoScheduled: {
          type: "boolean",
          description: "Include pending auto-scheduled events (default: true)"
        }
      },
      required: ["groupId"]
    }
  },
  {
    name: "getEventRsvpStatus",
    description: "Get RSVP status for an event - who has responded, who hasn't, and their responses.",
    input_schema: {
      type: "object",
      properties: {
        itineraryId: {
          type: "string",
          description: "The itinerary/event ID"
        }
      },
      required: ["itineraryId"]
    }
  },
  {
    name: "getMemberAvailability",
    description: "Get availability for all members in a group - their general weekly availability patterns.",
    input_schema: {
      type: "object",
      properties: {
        groupId: {
          type: "string",
          description: "The group ID"
        }
      },
      required: ["groupId"]
    }
  },
  {
    name: "suggestEventTimes",
    description: "Get AI-suggested time options for an event based on group availability, venue type, and constraints.",
    input_schema: {
      type: "object",
      properties: {
        groupId: {
          type: "string",
          description: "The group ID"
        },
        venueTypes: {
          type: "array",
          items: { type: "string" },
          description: "Types of venues (e.g., ['bar', 'restaurant'])"
        },
        constraints: {
          type: "string",
          description: "Optional constraints (e.g., 'prefer weekends', 'avoid Thursdays')"
        }
      },
      required: ["groupId"]
    }
  },
  {
    name: "rescheduleEvent",
    description: "Change the date/time of an existing event. Updates the itinerary with a new event date.",
    input_schema: {
      type: "object",
      properties: {
        itineraryId: {
          type: "string",
          description: "The itinerary/event ID to reschedule"
        },
        newDate: {
          type: "string",
          description: "New date in ISO format (YYYY-MM-DDTHH:MM:SS)"
        },
        reason: {
          type: "string",
          description: "Reason for rescheduling (for notification)"
        }
      },
      required: ["itineraryId", "newDate"]
    }
  },
  {
    name: "sendRsvpReminder",
    description: "Send a reminder to members who haven't responded to an event invitation.",
    input_schema: {
      type: "object",
      properties: {
        itineraryId: {
          type: "string",
          description: "The itinerary/event ID"
        },
        message: {
          type: "string",
          description: "Optional custom message to include"
        }
      },
      required: ["itineraryId"]
    }
  },
  {
    name: "analyzeSchedulingConflicts",
    description: "Check for potential scheduling conflicts - times when members are busy or have overlapping events.",
    input_schema: {
      type: "object",
      properties: {
        groupId: {
          type: "string",
          description: "The group ID"
        },
        proposedDate: {
          type: "string",
          description: "Proposed date to check (ISO format)"
        }
      },
      required: ["groupId", "proposedDate"]
    }
  }
];

// Tool execution handlers
export async function executeAgentTool(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  try {
    switch (toolName) {
      case "resolveLocation":
        return await handleResolveLocation(args as { query: string });
      case "searchVenues":
        return await handleSearchVenues(args as { query: string; latitude: number; longitude: number; radiusMeters?: number });
      case "getGroupFavorites":
        return await handleGetGroupFavorites(args as { groupId: string; category?: string; nearLatitude?: number; nearLongitude?: number; maxDistanceMiles?: number });
      case "getCurrentItinerary":
        return await handleGetCurrentItinerary(args as { itineraryId: string });
      case "addVenueToItinerary":
        return await handleAddVenueToItinerary(args as { itineraryId: string; venueName: string; venueAddress?: string; venueType: string; googlePlaceId?: string; latitude?: string; longitude?: string; photoUrl?: string; rating?: string; notes?: string });
      case "removeVenueFromItinerary":
        return await handleRemoveVenueFromItinerary(args as { itineraryId: string; itemId: string });
      case "getGroupPreferences":
        return await handleGetGroupPreferences(args as { groupId: string });
      case "getVenueDetails":
        return await handleGetVenueDetails(args as { placeId: string });
      // Phase 2 tools
      case "getUpcomingEvents":
        return await handleGetUpcomingEvents(args as { groupId: string; includeAutoScheduled?: boolean });
      case "getEventRsvpStatus":
        return await handleGetEventRsvpStatus(args as { itineraryId: string });
      case "getMemberAvailability":
        return await handleGetMemberAvailability(args as { groupId: string });
      case "suggestEventTimes":
        return await handleSuggestEventTimes(args as { groupId: string; venueTypes?: string[]; constraints?: string });
      case "rescheduleEvent":
        return await handleRescheduleEvent(args as { itineraryId: string; newDate: string; reason?: string });
      case "sendRsvpReminder":
        return await handleSendRsvpReminder(args as { itineraryId: string; message?: string });
      case "analyzeSchedulingConflicts":
        return await handleAnalyzeSchedulingConflicts(args as { groupId: string; proposedDate: string });
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error: any) {
    console.error(`[Agent Tool] Error executing ${toolName}:`, error);
    return JSON.stringify({ error: error.message || "Tool execution failed" });
  }
}

// Tool handlers

async function handleResolveLocation(args: { query: string }): Promise<string> {
  try {
    // First try geocoding for addresses
    const geocodeResult = await geocodeLocation(args.query);
    if (geocodeResult) {
      return JSON.stringify({
        name: geocodeResult.formattedAddress || args.query,
        address: geocodeResult.formattedAddress,
        latitude: geocodeResult.latitude,
        longitude: geocodeResult.longitude,
        source: "geocoding"
      });
    }

    // Fall back to places search for business names
    const results = await searchPlaces(args.query, "", 50000);
    if (results && results.length > 0) {
      const place = results[0];
      return JSON.stringify({
        name: place.name || args.query,
        address: place.address,
        latitude: place.location?.lat,
        longitude: place.location?.lng,
        placeId: place.placeId,
        source: "places"
      });
    }

    return JSON.stringify({ error: "Location not found", query: args.query });
  } catch (error: any) {
    return JSON.stringify({ error: error.message, query: args.query });
  }
}

async function handleSearchVenues(args: {
  query: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}): Promise<string> {
  try {
    const locationStr = `${args.latitude},${args.longitude}`;
    const radius = args.radiusMeters || 1609; // Default 1 mile

    const results = await searchPlaces(args.query, locationStr, radius);

    if (!results || results.length === 0) {
      return JSON.stringify({ venues: [], count: 0, message: "No venues found" });
    }

    const venues = results.slice(0, 8).map((place) => ({
      name: place.name,
      address: place.address,
      placeId: place.placeId,
      rating: place.rating,
      priceLevel: place.priceLevel,
      category: place.types?.[0] || "unknown",
      latitude: place.location?.lat,
      longitude: place.location?.lng,
      photoUrl: place.photoUrl || null
    }));

    return JSON.stringify({ venues, count: venues.length });
  } catch (error: any) {
    return JSON.stringify({ error: error.message, venues: [] });
  }
}

async function handleGetGroupFavorites(args: {
  groupId: string;
  category?: string;
  nearLatitude?: number;
  nearLongitude?: number;
  maxDistanceMiles?: number;
}): Promise<string> {
  try {
    // Get voting events (favorites) for the group
    const favorites = await db
      .select({
        id: votingEvents.id,
        name: votingEvents.title,
        address: votingEvents.venueAddress,
        category: votingEvents.venueType,
        placeId: votingEvents.googlePlaceId,
        rating: votingEvents.rating,
        priceLevel: votingEvents.priceLevel,
        photoUrl: votingEvents.photoUrl,
        latitude: votingEvents.latitude,
        longitude: votingEvents.longitude,
      })
      .from(votingEvents)
      .where(eq(votingEvents.groupId, args.groupId))
      .orderBy(desc(votingEvents.createdAt));

    let filtered = favorites;

    // Filter by category if specified
    if (args.category) {
      const categoryLower = args.category.toLowerCase();
      filtered = filtered.filter(f =>
        f.category?.toLowerCase().includes(categoryLower)
      );
    }

    // Filter by location if specified
    if (args.nearLatitude != null && args.nearLongitude != null) {
      const maxDist = args.maxDistanceMiles || 1.0;
      filtered = filtered.filter(f => {
        if (!f.latitude || !f.longitude) return false;
        const dist = calculateDistanceMiles(
          args.nearLatitude!,
          args.nearLongitude!,
          parseFloat(f.latitude),
          parseFloat(f.longitude)
        );
        return dist <= maxDist;
      });
    }

    const favoritesData = filtered.slice(0, 10).map(f => ({
      name: f.name,
      address: f.address,
      category: f.category,
      placeId: f.placeId,
      rating: f.rating,
      priceLevel: f.priceLevel,
      photoUrl: f.photoUrl,
      isFavorite: true
    }));

    return JSON.stringify({
      favorites: favoritesData,
      count: favoritesData.length,
      totalInGroup: favorites.length
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message, favorites: [] });
  }
}

async function handleGetCurrentItinerary(args: { itineraryId: string }): Promise<string> {
  try {
    const itinerary = await storage.getItinerary(args.itineraryId);
    if (!itinerary) {
      return JSON.stringify({ error: "Itinerary not found" });
    }

    const items = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, args.itineraryId))
      .orderBy(itineraryItems.orderIndex);

    const venues = items.map(item => ({
      id: item.id,
      name: item.venueName,
      address: item.venueAddress,
      category: item.venueType,
      latitude: item.latitude,
      longitude: item.longitude,
      orderIndex: item.orderIndex,
      notes: item.notes,
      placeId: item.googlePlaceId
    }));

    return JSON.stringify({
      itinerary: {
        id: itinerary.id,
        name: itinerary.name,
        eventDate: itinerary.eventDate,
        groupId: itinerary.groupId,
        status: itinerary.status
      },
      venues,
      venueCount: venues.length
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

async function handleAddVenueToItinerary(args: {
  itineraryId: string;
  venueName: string;
  venueAddress?: string;
  venueType: string;
  googlePlaceId?: string;
  latitude?: string;
  longitude?: string;
  photoUrl?: string;
  rating?: string;
  notes?: string;
}): Promise<string> {
  try {
    // Get current max order index
    const existingItems = await db
      .select({ orderIndex: itineraryItems.orderIndex })
      .from(itineraryItems)
      .where(eq(itineraryItems.itineraryId, args.itineraryId))
      .orderBy(desc(itineraryItems.orderIndex))
      .limit(1);

    const nextOrderIndex = existingItems.length > 0 ? existingItems[0].orderIndex + 1 : 0;

    const result = await db.insert(itineraryItems).values({
      itineraryId: args.itineraryId,
      sourceType: "ad_hoc",
      sourceId: null,
      venueName: args.venueName,
      venueAddress: args.venueAddress || "",
      venueType: args.venueType,
      googlePlaceId: args.googlePlaceId || null,
      latitude: args.latitude || null,
      longitude: args.longitude || null,
      photoUrl: args.photoUrl || null,
      rating: args.rating || null,
      notes: args.notes || null,
      orderIndex: nextOrderIndex
    }).returning();

    return JSON.stringify({
      success: true,
      itemId: result[0].id,
      message: `Added "${args.venueName}" to itinerary at position ${nextOrderIndex + 1}`
    });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function handleRemoveVenueFromItinerary(args: {
  itineraryId: string;
  itemId: string;
}): Promise<string> {
  try {
    // Verify item belongs to this itinerary
    const item = await db
      .select()
      .from(itineraryItems)
      .where(
        and(
          eq(itineraryItems.id, args.itemId),
          eq(itineraryItems.itineraryId, args.itineraryId)
        )
      )
      .limit(1);

    if (item.length === 0) {
      return JSON.stringify({ success: false, error: "Item not found in this itinerary" });
    }

    await db.delete(itineraryItems).where(eq(itineraryItems.id, args.itemId));

    return JSON.stringify({
      success: true,
      message: `Removed "${item[0].venueName}" from itinerary`
    });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function handleGetGroupPreferences(args: { groupId: string }): Promise<string> {
  try {
    const group = await storage.getGroup(args.groupId);
    if (!group) {
      return JSON.stringify({ error: "Group not found" });
    }

    return JSON.stringify({
      preferences: {
        name: group.name,
        locationBase: group.locationBase,
        latitude: group.latitude,
        longitude: group.longitude,
        budgetMin: group.budgetMin,
        budgetMax: group.budgetMax,
        searchRadius: group.searchRadius,
        meetingFrequency: group.meetingFrequency,
        closenessLevel: group.closenessLevel,
        noveltyPreference: group.noveltyPreference,
        activityCategories: group.activityCategories,
        mealEnabled: group.mealEnabled,
        cafeEnabled: group.cafeEnabled,
        drinksEnabled: group.drinksEnabled,
        dessertEnabled: group.dessertEnabled,
        experiencesEnabled: group.experiencesEnabled,
        additionalInstructions: group.additionalInstructions,
        timezone: group.timezone
      }
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

async function handleGetVenueDetails(args: { placeId: string }): Promise<string> {
  try {
    const details = await getPlaceDetails(args.placeId);
    if (!details) {
      return JSON.stringify({ error: "Venue details not found" });
    }

    return JSON.stringify({
      name: details.name,
      address: details.address,
      rating: details.rating,
      priceLevel: details.priceLevel,
      hours: details.openingHours?.weekday_text,
      review: details.review
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

// ============================================================================
// Phase 2: Pipeline Observation & Influence Handlers
// ============================================================================

async function handleGetUpcomingEvents(args: {
  groupId: string;
  includeAutoScheduled?: boolean;
}): Promise<string> {
  try {
    const includeAuto = args.includeAutoScheduled !== false;
    const now = new Date();

    // Get scheduled itineraries (filter out rejected status as soft delete)
    const upcomingItineraries = await db
      .select()
      .from(itineraries)
      .where(
        and(
          eq(itineraries.groupId, args.groupId),
          gte(itineraries.eventDate, now)
        )
      )
      .orderBy(itineraries.eventDate)
      .limit(10);

    // Get auto-scheduled pending events if requested
    let pendingEvents: any[] = [];
    if (includeAuto) {
      pendingEvents = await db
        .select()
        .from(autoScheduledEvents)
        .where(
          and(
            eq(autoScheduledEvents.groupId, args.groupId),
            gte(autoScheduledEvents.proposedDate, now)
          )
        )
        .orderBy(autoScheduledEvents.proposedDate)
        .limit(5);
    }

    // Format itineraries
    const events = upcomingItineraries.map(it => ({
      id: it.id,
      type: "scheduled",
      name: it.name,
      eventDate: it.eventDate,
      status: it.status,
      rsvpDeadline: it.rsvpDeadline,
    }));

    // Format pending auto events
    const pending = pendingEvents.map(pe => ({
      id: pe.id,
      type: "pending_auto",
      itineraryId: pe.itineraryId,
      proposedDate: pe.proposedDate,
      status: pe.status,
      autoSendAt: pe.autoSendAt,
      confidenceScore: pe.confidenceScore,
      requiresReview: pe.requiresReview,
      reviewReason: pe.reviewReason,
    }));

    return JSON.stringify({
      upcomingEvents: events,
      pendingAutoEvents: pending,
      totalUpcoming: events.length,
      totalPending: pending.length
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

async function handleGetEventRsvpStatus(args: { itineraryId: string }): Promise<string> {
  try {
    // Get the itinerary
    const itinerary = await storage.getItinerary(args.itineraryId);
    if (!itinerary) {
      return JSON.stringify({ error: "Event not found" });
    }

    // Get RSVPs
    const eventRsvps = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.itineraryId, args.itineraryId));

    // Get group members if this is a group event
    let groupMembers: any[] = [];
    if (itinerary.groupId) {
      groupMembers = await db
        .select()
        .from(members)
        .where(eq(members.groupId, itinerary.groupId));
    }

    // Build response summary
    const responded = eventRsvps.map(r => ({
      memberName: r.memberName || r.guestName || "Unknown",
      response: r.response,
      isGuest: r.isGuest,
      updatedAt: r.updatedAt,
    }));

    const respondedMemberIds = new Set(eventRsvps.map(r => r.memberId).filter(Boolean));
    const notResponded = groupMembers
      .filter(m => !respondedMemberIds.has(m.id))
      .map(m => ({ memberId: m.id, memberName: m.name }));

    const yesCount = eventRsvps.filter(r => r.response === "yes").length;
    const maybeCount = eventRsvps.filter(r => r.response === "maybe").length;
    const noCount = eventRsvps.filter(r => r.response === "no").length;

    return JSON.stringify({
      eventName: itinerary.name,
      eventDate: itinerary.eventDate,
      rsvpDeadline: itinerary.rsvpDeadline,
      summary: {
        yes: yesCount,
        maybe: maybeCount,
        no: noCount,
        notResponded: notResponded.length,
        totalMembers: groupMembers.length
      },
      responded,
      notResponded,
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

async function handleGetMemberAvailability(args: { groupId: string }): Promise<string> {
  try {
    const availability = await storage.getGroupMembersAvailability(args.groupId);

    // Summarize availability patterns
    const dayPatterns: Record<string, { morning: number; afternoon: number; evening: number }> = {
      monday: { morning: 0, afternoon: 0, evening: 0 },
      tuesday: { morning: 0, afternoon: 0, evening: 0 },
      wednesday: { morning: 0, afternoon: 0, evening: 0 },
      thursday: { morning: 0, afternoon: 0, evening: 0 },
      friday: { morning: 0, afternoon: 0, evening: 0 },
      saturday: { morning: 0, afternoon: 0, evening: 0 },
      sunday: { morning: 0, afternoon: 0, evening: 0 },
    };

    let membersWithAvailability = 0;

    for (const member of availability) {
      if (member.availability) {
        membersWithAvailability++;
        for (const [day, slots] of Object.entries(member.availability)) {
          const dayLower = day.toLowerCase();
          if (dayPatterns[dayLower]) {
            if (slots.morning) dayPatterns[dayLower].morning++;
            if (slots.afternoon) dayPatterns[dayLower].afternoon++;
            if (slots.evening) dayPatterns[dayLower].evening++;
          }
        }
      }
    }

    // Find best slots (most members available)
    const bestSlots: Array<{ day: string; period: string; count: number }> = [];
    for (const [day, slots] of Object.entries(dayPatterns)) {
      if (slots.morning > 0) bestSlots.push({ day, period: "morning", count: slots.morning });
      if (slots.afternoon > 0) bestSlots.push({ day, period: "afternoon", count: slots.afternoon });
      if (slots.evening > 0) bestSlots.push({ day, period: "evening", count: slots.evening });
    }
    bestSlots.sort((a, b) => b.count - a.count);

    return JSON.stringify({
      totalMembers: availability.length,
      membersWithAvailability,
      memberDetails: availability.map(m => ({
        name: m.memberName,
        hasAvailability: !!m.availability,
        availability: m.availability
      })),
      patterns: dayPatterns,
      bestSlots: bestSlots.slice(0, 5),
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

async function handleSuggestEventTimes(args: {
  groupId: string;
  venueTypes?: string[];
  constraints?: string;
}): Promise<string> {
  try {
    const group = await storage.getGroup(args.groupId);
    if (!group) {
      return JSON.stringify({ error: "Group not found" });
    }

    // Get group availability
    const availabilityString = group.availability
      ? convertAvailabilityToString(group.availability)
      : undefined;

    // Build venues array for time picker
    const venues = (args.venueTypes || ["restaurant"]).map(type => ({
      name: type,
      type: type
    }));

    // Build member constraints
    const memberConstraints: string[] = [];
    if (args.constraints) {
      memberConstraints.push(args.constraints);
    }

    // Call the existing time picker
    const result = await suggestMultipleTimeOptions({
      generalAvailability: availabilityString,
      venues,
      memberConstraints: memberConstraints.length > 0 ? memberConstraints : undefined,
      location: group.locationBase || undefined,
      timezone: group.timezone || undefined,
      meetingFrequency: group.meetingFrequency || undefined,
    });

    return JSON.stringify({
      options: result.options.map(opt => ({
        date: opt.eventDate,
        dayLabel: opt.dayLabel,
        timeLabel: opt.timeLabel,
      })),
      groupAvailability: availabilityString,
      venueTypes: args.venueTypes || ["restaurant"],
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

async function handleRescheduleEvent(args: {
  itineraryId: string;
  newDate: string;
  reason?: string;
}): Promise<string> {
  try {
    const itinerary = await storage.getItinerary(args.itineraryId);
    if (!itinerary) {
      return JSON.stringify({ error: "Event not found" });
    }

    const oldDate = itinerary.eventDate;
    const newDate = new Date(args.newDate);

    if (isNaN(newDate.getTime())) {
      return JSON.stringify({ error: "Invalid date format" });
    }

    // Update the itinerary
    await db
      .update(itineraries)
      .set({
        eventDate: newDate
      })
      .where(eq(itineraries.id, args.itineraryId));

    return JSON.stringify({
      success: true,
      eventId: args.itineraryId,
      eventName: itinerary.name,
      oldDate: oldDate,
      newDate: newDate.toISOString(),
      reason: args.reason || "Rescheduled via AI assistant",
      message: `Event "${itinerary.name}" has been rescheduled`
    });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function handleSendRsvpReminder(args: {
  itineraryId: string;
  message?: string;
}): Promise<string> {
  try {
    const itinerary = await storage.getItinerary(args.itineraryId);
    if (!itinerary) {
      return JSON.stringify({ error: "Event not found" });
    }

    // Get RSVPs and members to find who hasn't responded
    const eventRsvps = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.itineraryId, args.itineraryId));

    const respondedMemberIds = new Set(eventRsvps.map(r => r.memberId).filter(Boolean));

    let membersToRemind: any[] = [];
    if (itinerary.groupId) {
      const groupMembers = await db
        .select()
        .from(members)
        .where(eq(members.groupId, itinerary.groupId));

      membersToRemind = groupMembers.filter(m => !respondedMemberIds.has(m.id));
    }

    // Note: In a real implementation, this would trigger actual reminder emails
    // For now, we just return the list of members who would be reminded

    return JSON.stringify({
      success: true,
      eventName: itinerary.name,
      eventDate: itinerary.eventDate,
      membersToRemind: membersToRemind.map(m => m.name),
      reminderCount: membersToRemind.length,
      customMessage: args.message || null,
      note: "Reminder would be sent to these members (implementation pending)"
    });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}

async function handleAnalyzeSchedulingConflicts(args: {
  groupId: string;
  proposedDate: string;
}): Promise<string> {
  try {
    const proposedDate = new Date(args.proposedDate);
    if (isNaN(proposedDate.getTime())) {
      return JSON.stringify({ error: "Invalid date format" });
    }

    // Get group availability
    const memberAvailability = await storage.getGroupMembersAvailability(args.groupId);

    // Check day of week
    const dayOfWeek = proposedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hour = proposedDate.getHours();
    const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    // Check each member's availability for this day/time
    const conflicts: Array<{ memberName: string; reason: string }> = [];
    const available: string[] = [];

    for (const member of memberAvailability) {
      if (!member.availability) {
        // No availability set - assume available
        available.push(member.memberName);
        continue;
      }

      const dayAvail = member.availability[dayOfWeek] || member.availability[dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)];

      if (!dayAvail) {
        conflicts.push({
          memberName: member.memberName,
          reason: `Not available on ${dayOfWeek}s`
        });
      } else if (!dayAvail[period]) {
        conflicts.push({
          memberName: member.memberName,
          reason: `Not available ${dayOfWeek} ${period}s`
        });
      } else {
        available.push(member.memberName);
      }
    }

    // Check for existing events on the same day
    const startOfDay = new Date(proposedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(proposedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingEvents = await db
      .select()
      .from(itineraries)
      .where(
        and(
          eq(itineraries.groupId, args.groupId),
          gte(itineraries.eventDate, startOfDay)
        )
      );

    const sameDay = existingEvents.filter(e =>
      e.eventDate && e.eventDate <= endOfDay
    );

    return JSON.stringify({
      proposedDate: proposedDate.toISOString(),
      dayOfWeek,
      period,
      availabilityConflicts: conflicts,
      membersAvailable: available,
      availableCount: available.length,
      conflictCount: conflicts.length,
      existingEventsOnDay: sameDay.map(e => ({
        name: e.name,
        date: e.eventDate
      })),
      recommendation: conflicts.length === 0
        ? "This time works for everyone with availability set!"
        : conflicts.length < available.length
          ? `${available.length} of ${memberAvailability.length} members can make this time`
          : "Consider a different time - most members have conflicts"
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}
