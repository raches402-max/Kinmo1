/**
 * Custom MCP-style tools for the AI Event Assistant
 *
 * These tools allow the AI agent to search venues, view the itinerary,
 * and add/remove venues during a chat session.
 */

import { db } from "./db";
import { storage } from "./storage";
import { searchPlaces, getPlaceDetails, geocodeLocation } from "./google-places";
import { eq, sql, and, isNull, desc } from "drizzle-orm";
import { votingEvents, activities, itineraryItems, curatedVenues, votes } from "@shared/schema";
import { z } from "zod";

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
