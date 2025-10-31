import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "./db";
import { placesCache, searchCache, geocodingCache, curatedVenues } from "@shared/schema";
import { eq, and, or, sql as drizzleSql, like, desc } from "drizzle-orm";

// Legacy client for Geocoding and Timezone (still using old API)
const legacyClient = new Client({});

// Multi-key support for load balancing across API keys
// KEY_2 is now primary (handles 80% of traffic), KEY_1 is backup (20%)
let callCounter = 0;
const apiKeyUsageStats = {
  key1Calls: 0,
  key2Calls: 0,
};

/**
 * Get the next Google Places API key with weighted distribution
 * KEY_2 is primary (80% of calls), KEY_1 is backup (20% of calls)
 * This favors KEY_2 to distribute the load after migration
 */
function getNextApiKey(): string {
  const key1 = process.env.GOOGLE_PLACES_API_KEY;
  const key2 = process.env.GOOGLE_PLACES_API_KEY_2;

  // If neither key is set, throw error
  if (!key1 && !key2) {
    throw new Error("At least one of GOOGLE_PLACES_API_KEY or GOOGLE_PLACES_API_KEY_2 must be set");
  }

  // If only KEY_2 is configured, use it exclusively
  if (!key1 && key2) {
    apiKeyUsageStats.key2Calls++;
    return key2;
  }

  // If only KEY_1 is configured, use it exclusively
  if (key1 && !key2) {
    apiKeyUsageStats.key1Calls++;
    return key1;
  }

  // Both keys configured: Weighted distribution
  // KEY_2 gets 4 out of 5 calls (80%), KEY_1 gets 1 out of 5 (20%)
  callCounter++;
  const useKey2 = (callCounter % 5) !== 0; // Use KEY_2 unless it's every 5th call
  
  if (useKey2) {
    apiKeyUsageStats.key2Calls++;
    console.log(`[API Key] Using Key #2 PRIMARY (total calls: ${apiKeyUsageStats.key2Calls})`);
    return key2!;
  } else {
    apiKeyUsageStats.key1Calls++;
    console.log(`[API Key] Using Key #1 backup (total calls: ${apiKeyUsageStats.key1Calls})`);
    return key1!;
  }
}

/**
 * Get API key usage statistics
 */
export function getApiKeyStats() {
  return {
    ...apiKeyUsageStats,
    totalCalls: apiKeyUsageStats.key1Calls + apiKeyUsageStats.key2Calls,
    key2Configured: !!process.env.GOOGLE_PLACES_API_KEY_2,
  };
}

// Session-level cache for Google Places API results
// This dramatically reduces API calls by caching results during activity generation
interface PlacesCache {
  placeDetails: Map<string, PlaceResult | null>;
  searchResults: Map<string, PlaceResult[]>;
  nearbyResults: Map<string, PlaceResult[]>;
  geocodeResults: Map<string, GeocodeResult | null>;
  // Track actual cache hits/misses for metrics
  stats: {
    placeDetailsHits: number;
    placeDetailsMisses: number;
    searchHits: number;
    searchMisses: number;
    nearbyHits: number;
    nearbyMisses: number;
    geocodeHits: number;
    geocodeMisses: number;
  };
}

const sessionCache: PlacesCache = {
  placeDetails: new Map(),
  searchResults: new Map(),
  nearbyResults: new Map(),
  geocodeResults: new Map(),
  stats: {
    placeDetailsHits: 0,
    placeDetailsMisses: 0,
    searchHits: 0,
    searchMisses: 0,
    nearbyHits: 0,
    nearbyMisses: 0,
    geocodeHits: 0,
    geocodeMisses: 0,
  },
};

// Deep clone a PlaceResult to prevent cache mutation
function clonePlaceResult(result: PlaceResult): PlaceResult {
  return {
    ...result,
    types: [...result.types],
    location: result.location ? { ...result.location } : undefined,
  };
}

// Clear cache (call at the start of each generation session)
export function clearPlacesCache() {
  sessionCache.placeDetails.clear();
  sessionCache.searchResults.clear();
  sessionCache.nearbyResults.clear();
  sessionCache.geocodeResults.clear();
  sessionCache.stats = {
    placeDetailsHits: 0,
    placeDetailsMisses: 0,
    searchHits: 0,
    searchMisses: 0,
    nearbyHits: 0,
    nearbyMisses: 0,
    geocodeHits: 0,
    geocodeMisses: 0,
  };
  console.log('[Google Places Cache] Cache cleared');
}

// Get cache stats for monitoring (actual hits/misses)
export function getCacheStats() {
  const totalHits = sessionCache.stats.placeDetailsHits + sessionCache.stats.searchHits + sessionCache.stats.nearbyHits + sessionCache.stats.geocodeHits;
  const totalMisses = sessionCache.stats.placeDetailsMisses + sessionCache.stats.searchMisses + sessionCache.stats.nearbyMisses + sessionCache.stats.geocodeMisses;
  const totalCalls = totalHits + totalMisses;
  const hitRate = totalCalls > 0 ? ((totalHits / totalCalls) * 100).toFixed(1) : '0.0';
  
  return {
    placeDetailsHits: sessionCache.stats.placeDetailsHits,
    placeDetailsMisses: sessionCache.stats.placeDetailsMisses,
    searchHits: sessionCache.stats.searchHits,
    searchMisses: sessionCache.stats.searchMisses,
    nearbyHits: sessionCache.stats.nearbyHits,
    nearbyMisses: sessionCache.stats.nearbyMisses,
    geocodeHits: sessionCache.stats.geocodeHits,
    geocodeMisses: sessionCache.stats.geocodeMisses,
    totalHits,
    totalMisses,
    totalCalls,
    hitRate,
    apiCallsSaved: totalHits,
  };
}

// Database cache helpers (persistent caching)
async function getPlaceDetailsFromDB(placeId: string): Promise<PlaceResult | null> {
  try {
    const cached = await db
      .select()
      .from(placesCache)
      .where(eq(placesCache.placeId, placeId))
      .limit(1);

    if (cached.length === 0) {
      return null;
    }

    const cacheEntry = cached[0];
    
    // Check if cache is expired (30 days)
    if (cacheEntry.expiresAt < new Date()) {
      // Cache expired, delete it
      await db.delete(placesCache).where(eq(placesCache.placeId, placeId));
      console.log(`[DB Cache] Expired - Place Details for ${placeId}`);
      return null;
    }

    console.log(`[DB Cache] HIT - Place Details for ${placeId}`);
    return cacheEntry.placeData as PlaceResult;
  } catch (error) {
    console.error(`[DB Cache] Error reading Place Details for ${placeId}:`, error);
    return null;
  }
}

async function savePlaceDetailsToDB(placeId: string, placeData: PlaceResult): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

    await db
      .insert(placesCache)
      .values({
        placeId,
        placeData: placeData as any,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: placesCache.placeId,
        set: {
          placeData: placeData as any,
          expiresAt,
        },
      });

    console.log(`[DB Cache] SAVED - Place Details for ${placeId} (expires in 30 days)`);
  } catch (error) {
    console.error(`[DB Cache] Error saving Place Details for ${placeId}:`, error);
  }
}

async function getSearchResultsFromDB(searchQuery: string, searchLocation: string, searchRadius: number): Promise<any[] | null> {
  try {
    const cached = await db
      .select()
      .from(searchCache)
      .where(
        and(
          eq(searchCache.searchQuery, searchQuery),
          eq(searchCache.searchLocation, searchLocation),
          eq(searchCache.searchRadius, searchRadius)
        )
      )
      .limit(1);

    if (cached.length === 0) {
      return null;
    }

    const cacheEntry = cached[0];
    
    // Check if cache is expired (24 hours)
    if (cacheEntry.expiresAt < new Date()) {
      // Cache expired, delete it
      await db.delete(searchCache).where(eq(searchCache.id, cacheEntry.id));
      console.log(`[DB Cache] Expired - Search results for "${searchQuery}" in ${searchLocation}`);
      return null;
    }

    console.log(`[DB Cache] HIT - Search results for "${searchQuery}" in ${searchLocation}`);
    // Returns full PlaceResult objects (or legacy string IDs for backwards compatibility)
    return cacheEntry.searchResults as any[];
  } catch (error) {
    console.error(`[DB Cache] Error reading search results:`, error);
    return null;
  }
}

async function saveSearchResultsToDB(searchQuery: string, searchLocation: string, searchRadius: number, results: PlaceResult[]): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

    await db
      .insert(searchCache)
      .values({
        searchQuery,
        searchLocation,
        searchRadius,
        searchResults: results as any,
        expiresAt,
      });

    console.log(`[DB Cache] SAVED - ${results.length} full search results for "${searchQuery}" in ${searchLocation} (expires in 24 hours)`);
  } catch (error) {
    console.error(`[DB Cache] Error saving search results:`, error);
  }
}

// Database cache helpers for geocoding (persistent caching with 30-day TTL)
async function getGeocodingFromDB(location: string): Promise<GeocodeResult | null> {
  try {
    const cached = await db
      .select()
      .from(geocodingCache)
      .where(eq(geocodingCache.location, location))
      .limit(1);

    if (cached.length === 0) {
      return null;
    }

    const cachedResult = cached[0];
    
    // Check if expired
    if (new Date() > cachedResult.expiresAt) {
      console.log(`[DB Cache] EXPIRED - Geocoding for "${location}"`);
      // Delete expired entry
      await db.delete(geocodingCache).where(eq(geocodingCache.location, location));
      return null;
    }

    console.log(`[DB Cache] HIT - Geocoding for "${location}" (expires: ${cachedResult.expiresAt.toISOString()})`);
    return {
      latitude: parseFloat(cachedResult.latitude as string),
      longitude: parseFloat(cachedResult.longitude as string),
      formattedAddress: cachedResult.formattedAddress,
      timezone: cachedResult.timezone || undefined,
    };
  } catch (error) {
    console.error(`[DB Cache] Error retrieving geocoding:`, error);
    return null;
  }
}

async function saveGeocodingToDB(location: string, result: GeocodeResult): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

    await db
      .insert(geocodingCache)
      .values({
        location,
        latitude: result.latitude.toString(),
        longitude: result.longitude.toString(),
        formattedAddress: result.formattedAddress,
        timezone: result.timezone || null,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: geocodingCache.location,
        set: {
          latitude: result.latitude.toString(),
          longitude: result.longitude.toString(),
          formattedAddress: result.formattedAddress,
          timezone: result.timezone || null,
          expiresAt,
        },
      });

    console.log(`[DB Cache] SAVED - Geocoding for "${location}" (expires in 30 days)`);
  } catch (error) {
    console.error(`[DB Cache] Error saving geocoding:`, error);
  }
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  timezone?: string;
}

export async function getTimezoneForLocation(lat: number, lng: number): Promise<string | null> {
  try {
    const apiKey = getNextApiKey();
    const timestamp = Math.floor(Date.now() / 1000);

    const response = await legacyClient.timezone({
      params: {
        location: { lat, lng },
        timestamp,
        key: apiKey,
      },
    });

    if (response.data.status === "OK" && response.data.timeZoneId) {
      return response.data.timeZoneId;
    }

    console.error(`Timezone lookup failed for coordinates: ${lat}, ${lng}. Status: ${response.data.status}`);
    return null;
  } catch (error) {
    console.error("Error looking up timezone:", error);
    return null;
  }
}

export async function geocodeLocation(location: string): Promise<GeocodeResult | null> {
  // Check session cache first (fastest)
  if (sessionCache.geocodeResults.has(location)) {
    sessionCache.stats.geocodeHits++;
    console.log(`[Session Cache] HIT - geocode for "${location}"`);
    return sessionCache.geocodeResults.get(location)!;
  }

  // Check database cache (persistent, 30-day TTL)
  const dbCached = await getGeocodingFromDB(location);
  if (dbCached) {
    // Add to session cache for faster future lookups
    sessionCache.geocodeResults.set(location, dbCached);
    sessionCache.stats.geocodeHits++;
    return dbCached;
  }

  sessionCache.stats.geocodeMisses++;
  console.log(`[API Call] MISS - fetching geocode for "${location}"`);

  try {
    const apiKey = getNextApiKey();

    const response = await legacyClient.geocode({
      params: {
        address: location,
        key: apiKey,
      },
    });

    if (!response.data.results || response.data.results.length === 0) {
      console.error(`Geocoding failed for location: ${location}`);
      sessionCache.geocodeResults.set(location, null);
      return null;
    }

    const result = response.data.results[0];
    const { lat, lng } = result.geometry.location;

    // Try to fetch timezone separately as a fallback (only if geocoding doesn't provide it)
    // This ensures we have timezone data even if the geocoding API doesn't provide it
    let timezone: string | undefined;
    try {
      const timezoneResult = await getTimezoneForLocation(lat, lng);
      timezone = timezoneResult || undefined;
    } catch (error) {
      console.warn(`Timezone lookup failed for ${location}, continuing without it:`, error);
    }

    const geocodeResult = {
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address,
      timezone,
    };

    // Save to both caches
    sessionCache.geocodeResults.set(location, geocodeResult);
    await saveGeocodingToDB(location, geocodeResult);
    
    return geocodeResult;
  } catch (error) {
    console.error("Error geocoding location:", error);
    sessionCache.geocodeResults.set(location, null);
    return null;
  }
}

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  rating?: string;
  reviewCount?: number; // Total number of Google reviews (user_ratings_total)
  priceLevel?: string;
  photoUrl?: string;
  types: string[];
  location?: { lat: number; lng: number };
  review?: string; // Short positive review (80-100 chars)
}

// Helper function to calculate distance between two coordinates in miles using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Search curated venues (cache-first strategy)
 * Returns pre-loaded venues that match the query and location
 * STRICT GEOGRAPHIC VALIDATION: Only returns results if location is confirmed to be within SF
 */
async function searchCuratedVenues(
  query: string,
  location: string,
  radiusMiles: number = 2,
  coordinates?: { lat: number; lng: number },
  maxResults: number = 15,
  venueType?: string
): Promise<PlaceResult[]> {
  try {
    console.log(`[Curated Search] Searching for "${query}" in ${location}`);

    // CRITICAL: Strict geographic validation
    // Only use curated SF venues if we can confirm the search is for SF
    const locationLower = location.toLowerCase();
    const isSFLocation = locationLower.includes('san francisco') || 
                         locationLower.includes('sf') || 
                         locationLower.includes(' sf ') ||
                         locationLower.includes('sf,');
    
    // SF bounding box (approximate): lat 37.7-37.85, lng -122.52 to -122.35
    const SF_BOUNDS = {
      latMin: 37.7,
      latMax: 37.85,
      lngMin: -122.52,
      lngMax: -122.35
    };
    
    // Geographic validation: Require EITHER string match OR coordinates within SF bounds
    let isValidSFSearch = false;
    
    if (isSFLocation) {
      // Location string explicitly mentions SF
      isValidSFSearch = true;
      console.log(`[Curated Search] ✓ Location string matches SF: "${location}"`);
    } else if (coordinates) {
      // Check if coordinates fall within SF bounding box
      const inSFBounds = coordinates.lat >= SF_BOUNDS.latMin &&
                         coordinates.lat <= SF_BOUNDS.latMax &&
                         coordinates.lng >= SF_BOUNDS.lngMin &&
                         coordinates.lng <= SF_BOUNDS.lngMax;
      
      if (inSFBounds) {
        isValidSFSearch = true;
        console.log(`[Curated Search] ✓ Coordinates within SF bounds: ${coordinates.lat}, ${coordinates.lng}`);
      } else {
        console.log(`[Curated Search] ✗ Coordinates outside SF bounds: ${coordinates.lat}, ${coordinates.lng}`);
      }
    } else {
      console.log(`[Curated Search] ✗ No SF location match and no coordinates provided`);
    }
    
    // If not a valid SF search, skip curated venues entirely
    if (!isValidSFSearch) {
      console.log(`[Curated Search] Skipping curated venues - not a SF search`);
      return [];
    }

    // Build category filter based on query
    const queryLower = query.toLowerCase();
    let categoryFilter: string | null = null;
    
    if (queryLower.includes('bar') || queryLower.includes('drink') || queryLower.includes('cocktail') || queryLower.includes('wine') || queryLower.includes('beer') || queryLower.includes('brewery')) {
      categoryFilter = 'drinks';
    } else if (queryLower.includes('restaurant') || queryLower.includes('food') || queryLower.includes('dining') || queryLower.includes('eat')) {
      categoryFilter = 'meal';
    } else if (queryLower.includes('cafe') || queryLower.includes('coffee')) {
      categoryFilter = 'cafes';
    } else if (queryLower.includes('dessert') || queryLower.includes('ice cream') || queryLower.includes('bakery')) {
      categoryFilter = 'dessert';
    } else if (queryLower.includes('museum') || queryLower.includes('concert') || queryLower.includes('theater') || queryLower.includes('experience')) {
      categoryFilter = 'experiences';
    }

    // Build SQL query
    const conditions = [];
    
    // Filter by active status AND region (always require san_francisco)
    conditions.push(eq(curatedVenues.isActive, true));
    conditions.push(eq(curatedVenues.region, 'san_francisco'));
    
    // Filter by category if detected
    if (categoryFilter) {
      conditions.push(eq(curatedVenues.category, categoryFilter));
    }

    // Query curated venues
    let results = await db
      .select()
      .from(curatedVenues)
      .where(and(...conditions))
      .orderBy(desc(curatedVenues.rating))
      .limit(maxResults * 2); // Get more for filtering by distance
    
    // Apply venue type filtering if provided (post-SQL filter on tags array)
    if (venueType && results.length > 0) {
      console.log(`[Curated Search] Filtering by venue type: "${venueType}"`);
      
      // Normalize venue type for matching (lowercase, replace spaces with underscores)
      const normalizedType = venueType.toLowerCase().replace(/\s+/g, '_');
      
      // First try exact tag match
      const exactMatches = results.filter(venue => 
        venue.tags && venue.tags.some(tag => tag.includes(normalizedType))
      );
      
      if (exactMatches.length > 0) {
        console.log(`[Curated Search] Found ${exactMatches.length} exact type matches for "${venueType}"`);
        results = exactMatches;
      } else {
        // Fallback: fuzzy match on venue types
        // Map venue type to common tag patterns
        const typeKeywords = normalizedType.split('_');
        const fuzzyMatches = results.filter(venue => 
          venue.tags && venue.tags.some(tag => 
            typeKeywords.some(keyword => tag.includes(keyword))
          )
        );
        
        if (fuzzyMatches.length > 0) {
          console.log(`[Curated Search] Found ${fuzzyMatches.length} fuzzy type matches for "${venueType}"`);
          results = fuzzyMatches;
        } else {
          console.log(`[Curated Search] No type matches found for "${venueType}", using category filter only`);
        }
      }
    }

    // Filter by distance if coordinates provided
    if (coordinates && results.length > 0) {
      results = results
        .map(venue => ({
          ...venue,
          distance: calculateDistance(
            coordinates.lat,
            coordinates.lng,
            parseFloat(venue.latitude),
            parseFloat(venue.longitude)
          )
        }))
        .filter(venue => venue.distance <= radiusMiles)
        .sort((a, b) => (b.rating ? parseFloat(b.rating) : 0) - (a.rating ? parseFloat(a.rating) : 0))
        .slice(0, maxResults);
    }

    // Convert to PlaceResult format and fetch photos on-demand
    const placeResults: PlaceResult[] = await Promise.all(results.map(async (venue) => {
      let photoUrl = venue.photoUrl || undefined;
      
      // If no photo URL cached, fetch from Google Places API
      if (!photoUrl && venue.googlePlaceId) {
        try {
          console.log(`[Curated Search] Fetching photo for ${venue.name} (${venue.googlePlaceId})`);
          const placeDetails = await getPlaceDetails(venue.googlePlaceId);
          
          if (placeDetails?.photoUrl) {
            photoUrl = placeDetails.photoUrl;
            
            // Update the database with the photo URL for future use
            await db
              .update(curatedVenues)
              .set({ photoUrl })
              .where(eq(curatedVenues.id, venue.id));
            console.log(`[Curated Search] Cached photo for ${venue.name}`);
          }
        } catch (error) {
          console.error(`[Curated Search] Failed to fetch photo for ${venue.name}:`, error);
        }
      }
      
      return {
        placeId: venue.googlePlaceId || `curated_${venue.id}`,
        name: venue.name,
        address: venue.address,
        rating: venue.rating || undefined,
        reviewCount: venue.reviewCount || undefined,
        priceLevel: venue.priceLevel ? `PRICE_LEVEL_${['', 'INEXPENSIVE', 'MODERATE', 'EXPENSIVE', 'VERY_EXPENSIVE'][venue.priceLevel]}` : undefined,
        photoUrl,
        types: venue.tags || [],
        location: {
          lat: parseFloat(venue.latitude),
          lng: parseFloat(venue.longitude)
        }
      };
    }));

    console.log(`[Curated Search] Found ${placeResults.length} curated venues`);
    return placeResults;
    
  } catch (error) {
    console.error('[Curated Search] Error:', error);
    return [];
  }
}

/**
 * Auto-cache high-quality API results in curated venues table
 * This creates a "self-learning" system where the cache grows over time
 * Caches venues from ANY location (not just SF)
 */
async function autoCacheApiResults(
  apiResults: PlaceResult[],
  location: string,
  coordinates?: { lat: number; lng: number }
): Promise<void> {
  try {
    // Helper to detect region from coordinates
    const detectRegion = (lat: number, lng: number): string => {
      // San Francisco bounding box
      if (lat >= 37.7 && lat <= 37.85 && lng >= -122.52 && lng <= -122.35) {
        return 'san_francisco';
      }
      // Oakland bounding box (approximate)
      if (lat >= 37.7 && lat <= 37.85 && lng >= -122.35 && lng <= -122.15) {
        return 'oakland';
      }
      // San Jose bounding box (approximate)
      if (lat >= 37.25 && lat <= 37.45 && lng >= -122.05 && lng <= -121.75) {
        return 'san_jose';
      }
      // Default to bay_area for other Bay Area locations
      if (lat >= 37.2 && lat <= 38.0 && lng >= -122.6 && lng <= -121.5) {
        return 'bay_area';
      }
      // Generic location based on coordinates
      return 'other';
    };
    
    // Filter for high-quality venues only (minimum 100 reviews, 4.0+ rating)
    const highQualityVenues = apiResults.filter(venue => {
      const hasGoodReviews = (venue.reviewCount || 0) >= 100;
      const hasGoodRating = parseFloat(venue.rating || '0') >= 4.0;
      const hasLocation = venue.location && venue.location.lat && venue.location.lng;
      const hasPlaceId = venue.placeId && !venue.placeId.startsWith('curated_');
      
      return hasGoodReviews && hasGoodRating && hasLocation && hasPlaceId;
    });
    
    if (highQualityVenues.length === 0) {
      console.log(`[Auto-Cache] No high-quality venues to cache`);
      return;
    }
    
    console.log(`[Auto-Cache] Processing ${highQualityVenues.length} high-quality venues`);
    
    // Check which venues already exist
    const existingPlaceIds = await db
      .select({ googlePlaceId: curatedVenues.googlePlaceId })
      .from(curatedVenues)
      .where(
        or(...highQualityVenues.map(v => eq(curatedVenues.googlePlaceId, v.placeId)))
      );
    
    const existingIds = new Set(existingPlaceIds.map(r => r.googlePlaceId));
    const newVenues = highQualityVenues.filter(v => !existingIds.has(v.placeId));
    
    if (newVenues.length === 0) {
      console.log(`[Auto-Cache] All venues already cached`);
      return;
    }
    
    // Insert new venues
    for (const venue of newVenues) {
      try {
        // Validate venue has coordinates
        if (!venue.location) {
          console.log(`[Auto-Cache] ⚠️  Skipping ${venue.name} - no coordinates`);
          continue;
        }
        
        // Detect the region based on venue's actual coordinates
        const venueRegion = detectRegion(venue.location.lat, venue.location.lng);
        
        // Convert price level from string to number (1-4)
        let priceLevelNum: number | null = null;
        if (venue.priceLevel) {
          const priceMap: Record<string, number> = {
            '$': 1,
            '$$': 2,
            '$$$': 3,
            '$$$$': 4,
            'PRICE_LEVEL_INEXPENSIVE': 1,
            'PRICE_LEVEL_MODERATE': 2,
            'PRICE_LEVEL_EXPENSIVE': 3,
            'PRICE_LEVEL_VERY_EXPENSIVE': 4
          };
          priceLevelNum = priceMap[venue.priceLevel] || null;
        }
        
        // Detect category from types
        let category = 'experiences'; // default
        const types = venue.types || [];
        const typesStr = types.join(' ').toLowerCase();
        
        if (typesStr.includes('bar') || typesStr.includes('night_club') || typesStr.includes('liquor')) {
          category = 'drinks';
        } else if (typesStr.includes('restaurant') || typesStr.includes('meal') || typesStr.includes('food')) {
          category = 'meal';
        } else if (typesStr.includes('cafe') || typesStr.includes('coffee')) {
          category = 'cafes';
        } else if (typesStr.includes('bakery') || typesStr.includes('dessert') || typesStr.includes('ice_cream')) {
          category = 'dessert';
        }
        
        await db.insert(curatedVenues).values({
          name: venue.name,
          address: venue.address,
          latitude: venue.location!.lat.toString(),
          longitude: venue.location!.lng.toString(),
          category,
          rating: venue.rating || null,
          reviewCount: venue.reviewCount || null,
          priceLevel: priceLevelNum,
          photoUrl: venue.photoUrl || null,
          googlePlaceId: venue.placeId,
          tags: venue.types || [],
          region: venueRegion,
          source: 'api_auto',
          isActive: true,
          lastRefreshed: new Date()
        });
        
        console.log(`[Auto-Cache] ✅ Cached new venue: ${venue.name} in ${venueRegion} (${venue.placeId})`);
      } catch (insertError) {
        // Ignore duplicate key errors (race condition)
        if (!(insertError as any)?.message?.includes('duplicate')) {
          console.error(`[Auto-Cache] Failed to cache ${venue.name}:`, insertError);
        }
      }
    }
    
    console.log(`[Auto-Cache] Successfully cached ${newVenues.length} new venues`);
  } catch (error) {
    console.error('[Auto-Cache] Error:', error);
  }
}

export async function searchPlaces(
  query: string,
  location: string,
  radiusMiles: number = 2,
  coordinates?: { lat: number; lng: number },
  skipCurated: boolean = false
): Promise<PlaceResult[]> {
  // CACHE-FIRST STRATEGY: Check curated venues FIRST (10-50ms for SF searches)
  // Skip curated search if explicitly requested (e.g., when curated filtering failed)
  let curatedResults: PlaceResult[] = [];
  
  if (!skipCurated) {
    curatedResults = await searchCuratedVenues(query, location, radiusMiles, coordinates, 15);
    
    if (curatedResults.length >= 15) {
      // We have enough curated venues, return immediately (skip API call)
      console.log(`[Cache-First] Returning ${curatedResults.length} curated venues (NO API CALL NEEDED)`);
      return curatedResults;
    }
    
    // If we have some curated results but not enough, we'll merge them with API results later
    if (curatedResults.length > 0) {
      console.log(`[Cache-First] Found ${curatedResults.length} curated venues, will supplement with API results`);
    }
  } else {
    console.log(`[API Fallback] Skipping curated search, going directly to Google Places API for "${query}"`);
  }
  
  // Create cache key from search parameters
  const cacheKey = `${query}|${location}|${radiusMiles}|${coordinates?.lat}|${coordinates?.lng}`;
  
  // Skip ALL caching when skipCurated is true (force fresh API call)
  if (!skipCurated) {
    // Check session cache (fastest for repeated searches)
    if (sessionCache.searchResults.has(cacheKey)) {
      sessionCache.stats.searchHits++;
      console.log(`[Session Cache] HIT - searchPlaces for "${query}"`);
      const cached = sessionCache.searchResults.get(cacheKey)!;
      
      // Merge with curated results if any
      if (curatedResults.length > 0) {
        const curatedPlaceIds = new Set(curatedResults.map(r => r.placeId));
        const uniqueCached = cached.filter(r => !curatedPlaceIds.has(r.placeId));
        const combined = [...curatedResults, ...uniqueCached].slice(0, 20);
        console.log(`[Cache-First] Combined ${curatedResults.length} curated + ${uniqueCached.length} cached = ${combined.length} total`);
        return combined.map(result => clonePlaceResult(result));
      }
      
      // Return deep copy to prevent mutation
      return cached.map(result => clonePlaceResult(result));
    }

    // Check database cache (persistent, 24-hour TTL)
    const dbCachedResults = await getSearchResultsFromDB(query, location, radiusMiles);
    if (dbCachedResults && dbCachedResults.length > 0) {
      console.log(`[DB Cache] HIT - full search results for "${query}" (${dbCachedResults.length} cached results)`);
      
      // Parse cached results as PlaceResult array
      const results: PlaceResult[] = dbCachedResults.map((cachedId: any) => {
        if (typeof cachedId === 'string') {
          return null;
        }
        return cachedId as PlaceResult;
      }).filter((r): r is PlaceResult => r !== null);
      
      if (results.length > 0) {
        // Merge with curated results
        if (curatedResults.length > 0) {
          const curatedPlaceIds = new Set(curatedResults.map(r => r.placeId));
          const uniqueDb = results.filter(r => !curatedPlaceIds.has(r.placeId));
          const combined = [...curatedResults, ...uniqueDb].slice(0, 20);
          sessionCache.searchResults.set(cacheKey, combined.map(r => clonePlaceResult(r)));
          console.log(`[Cache-First] Combined ${curatedResults.length} curated + ${uniqueDb.length} DB = ${combined.length} total`);
          return combined.map(result => clonePlaceResult(result));
        }
        
        // Cache in session for immediate reuse
        sessionCache.searchResults.set(cacheKey, results.map(r => clonePlaceResult(r)));
        sessionCache.stats.searchHits++;
        
        return results.map(result => clonePlaceResult(result));
      }
    }
  }

  sessionCache.stats.searchMisses++;
  console.log(`[API Call] Calling Google API for "${query}"`);

  try {
    const apiKey = getNextApiKey();

    // Convert miles to meters (1 mile = 1609.34 meters)
    const radiusMeters = Math.round(radiusMiles * 1609.34);

    // NEW PLACES API: Use POST with JSON body and headers
    const endpoint = 'https://places.googleapis.com/v1/places:searchText';
    
    // Build request body
    const requestBody: any = {
      textQuery: coordinates ? query : `${query} in ${location}`,
      maxResultCount: 20,
    };
    
    if (coordinates) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: coordinates.lat,
            longitude: coordinates.lng,
          },
          radius: radiusMeters,
        },
      };
    }

    // NEW API requires field mask in header
    // Only request fields we actually use to minimize costs
    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.rating',
      'places.userRatingCount',
      'places.priceLevel',
      'places.photos',
      'places.types',
      'places.location',
    ].join(',');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorDetails = `Status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error) {
          errorDetails = `${errorJson.error.status || response.status}: ${errorJson.error.message || 'Unknown error'}`;
        }
      } catch {
        // If JSON parsing fails, fall back to text
        const errorText = await response.text();
        errorDetails = `${response.status}: ${errorText}`;
      }
      console.error(`[Google Places API] Text Search Error:`, errorDetails);
      sessionCache.searchResults.set(cacheKey, []);
      return [];
    }

    const data = await response.json();

    if (!data.places || data.places.length === 0) {
      sessionCache.searchResults.set(cacheKey, []);
      return [];
    }

    console.log(`[Google Places] Got ${data.places.length} results from NEW API`);

    // Process ALL results (up to 20 from Google), not just the first one
    // OPTIMIZATION: Use Text Search data directly instead of calling getPlaceDetails for each result
    // This saves 20x API calls per search (was calling Place Details for every result)
    const results: PlaceResult[] = [];
    const MIN_REVIEWS = 50;
    
    for (const place of data.places) {
      // NEW API: Extract location from place object
      const placeLocation = place.location ? {
        lat: place.location.latitude,
        lng: place.location.longitude,
      } : undefined;
      
      // Check if place is within radius (if coordinates provided)
      if (coordinates && placeLocation) {
        const distance = calculateDistance(
          coordinates.lat,
          coordinates.lng,
          placeLocation.lat,
          placeLocation.lng
        );
        
        if (distance > radiusMiles) {
          console.log(`[Google Places] Filtering out "${place.displayName?.text || 'Unknown'}" - ${distance.toFixed(2)} miles away (radius: ${radiusMiles} miles)`);
          continue; // Skip this place, but keep processing others
        }
      }
      
      // Filter out places with fewer than 50 reviews
      // NEW API: userRatingCount instead of user_ratings_total
      if (!place.userRatingCount || place.userRatingCount < MIN_REVIEWS) {
        console.log(`[Google Places] Filtering out "${place.displayName?.text || 'Unknown'}" - only ${place.userRatingCount || 0} reviews (minimum: ${MIN_REVIEWS})`);
        continue;
      }
      
      // Build result from Text Search data (no additional API call needed!)
      let photoUrl: string | undefined;
      if (place.photos && place.photos.length > 0) {
        // NEW API: photos have a 'name' field (resource identifier)
        // Format: places/PLACE_ID/photos/PHOTO_ID
        const photoName = place.photos[0].name;
        if (photoName) {
          // Encode the full photo name for the proxy endpoint
          photoUrl = `/api/photos/v1/${encodeURIComponent(photoName)}`;
        }
      }

      // NEW API: priceLevel is a string enum like "PRICE_LEVEL_MODERATE"
      let priceLevel: string | undefined;
      if (place.priceLevel) {
        const levelMap: Record<string, string> = {
          'PRICE_LEVEL_FREE': 'Free',
          'PRICE_LEVEL_INEXPENSIVE': '$',
          'PRICE_LEVEL_MODERATE': '$$',
          'PRICE_LEVEL_EXPENSIVE': '$$$',
          'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
        };
        priceLevel = levelMap[place.priceLevel] || place.priceLevel;
      }

      results.push({
        placeId: place.id || "",
        name: place.displayName?.text || query,
        address: place.formattedAddress || "",
        rating: place.rating?.toString(),
        reviewCount: place.userRatingCount,
        priceLevel,
        photoUrl,
        types: place.types || [],
        location: placeLocation,
      });
    }

    console.log(`[Google Places] Processed ${results.length} valid results`);

    // Cache in session for immediate reuse
    sessionCache.searchResults.set(cacheKey, results.map(r => clonePlaceResult(r)));
    
    // Cache full results in database for 24 hours (async, don't wait)
    // OPTIMIZATION: Store complete results instead of just place IDs to avoid re-fetching
    if (results.length > 0) {
      saveSearchResultsToDB(query, location, radiusMiles, results as any).catch(err => 
        console.error(`Failed to cache search results in DB for "${query}":`, err)
      );
    }
    
    // AUTO-CACHE: Save high-quality API results to curated venues (async, don't wait)
    // This creates a "self-learning" system where the cache grows automatically
    if (results.length > 0) {
      autoCacheApiResults(results, location, coordinates).catch(err =>
        console.error(`[Auto-Cache] Failed to cache API results:`, err)
      );
    }
    
    // CACHE-FIRST: Merge curated results with API results
    if (curatedResults.length > 0) {
      const curatedPlaceIds = new Set(curatedResults.map(r => r.placeId));
      const uniqueApiResults = results.filter(r => !curatedPlaceIds.has(r.placeId));
      const combined = [...curatedResults, ...uniqueApiResults].slice(0, 20);
      console.log(`[Cache-First] Final: ${curatedResults.length} curated + ${uniqueApiResults.length} API = ${combined.length} total`);
      return combined;
    }
    
    // Return original (caller can mutate without affecting cache)
    return results;
  } catch (error) {
    console.error("Error searching Google Places:", error);
    // Cache empty result to avoid retrying failed searches
    sessionCache.searchResults.set(cacheKey, []);
    
    // Even if API fails, return curated results if we have them
    if (curatedResults.length > 0) {
      console.log(`[Cache-First] API failed, returning ${curatedResults.length} curated venues as fallback`);
      return curatedResults;
    }
    
    return [];
  }
}

export async function searchNearbyPlaces(
  query: string,
  nearLocation: { lat: number; lng: number },
  radiusMeters: number = 805,
  minRating: number = 3.5
): Promise<PlaceResult[]> {
  // Create cache key from search parameters
  const cacheKey = `${query}|${nearLocation.lat}|${nearLocation.lng}|${radiusMeters}|${minRating}`;
  
  // Check cache first
  if (sessionCache.nearbyResults.has(cacheKey)) {
    sessionCache.stats.nearbyHits++;
    console.log(`[Google Places Cache] HIT - searchNearbyPlaces for "${query}"`);
    const cached = sessionCache.nearbyResults.get(cacheKey)!;
    // Return deep copy to prevent mutation
    return cached.map(result => clonePlaceResult(result));
  }

  sessionCache.stats.nearbyMisses++;
  console.log(`[Google Places Cache] MISS - fetching searchNearbyPlaces for "${query}"`);

  try {
    const apiKey = getNextApiKey();

    // NEW PLACES API: Use Nearby Search endpoint
    const endpoint = 'https://places.googleapis.com/v1/places:searchNearby';
    
    const requestBody = {
      locationRestriction: {
        circle: {
          center: {
            latitude: nearLocation.lat,
            longitude: nearLocation.lng,
          },
          radius: radiusMeters,
        },
      },
      maxResultCount: 20,
      rankPreference: 'RELEVANCE',
    };

    // Add includedTypes if we can parse the query
    // This helps narrow down results
    if (query && query.length > 0) {
      // Common type mapping for queries
      const typeMap: Record<string, string[]> = {
        restaurant: ['restaurant'],
        cafe: ['cafe'],
        bar: ['bar'],
        coffee: ['cafe'],
        food: ['restaurant', 'cafe'],
        shopping: ['shopping_mall', 'store'],
        entertainment: ['movie_theater', 'amusement_park', 'bowling_alley'],
      };
      
      const lowerQuery = query.toLowerCase();
      for (const [keyword, types] of Object.entries(typeMap)) {
        if (lowerQuery.includes(keyword)) {
          (requestBody as any).includedTypes = types;
          break;
        }
      }
    }

    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.rating',
      'places.userRatingCount',
      'places.priceLevel',
      'places.photos',
      'places.types',
      'places.location',
    ].join(',');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorDetails = `Status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error) {
          errorDetails = `${errorJson.error.status || response.status}: ${errorJson.error.message || 'Unknown error'}`;
        }
      } catch {
        // If JSON parsing fails, fall back to text
        const errorText = await response.text();
        errorDetails = `${response.status}: ${errorText}`;
      }
      console.error(`[Google Places API] Nearby Search Error:`, errorDetails);
      sessionCache.nearbyResults.set(cacheKey, []);
      return [];
    }

    const data = await response.json();

    if (!data.places || data.places.length === 0) {
      sessionCache.nearbyResults.set(cacheKey, []);
      return [];
    }

    const results: PlaceResult[] = [];
    const MIN_REVIEWS = 50;
    for (const place of data.places) {
      // Filter by minimum rating
      if (!place.rating || place.rating < minRating) {
        continue;
      }
      
      // Filter by minimum review count (NEW API: userRatingCount)
      if (!place.userRatingCount || place.userRatingCount < MIN_REVIEWS) {
        console.log(`[Google Places] Filtering out "${place.displayName?.text || 'Unknown'}" - only ${place.userRatingCount || 0} reviews (minimum: ${MIN_REVIEWS})`);
        continue;
      }
      
      let photoUrl: string | undefined;
      if (place.photos && place.photos.length > 0) {
        // NEW API: photos have a 'name' field (resource identifier)
        const photoName = place.photos[0].name;
        if (photoName) {
          photoUrl = `/api/photos/v1/${encodeURIComponent(photoName)}`;
        }
      }

      // NEW API: priceLevel is a string enum
      let priceLevel: string | undefined;
      if (place.priceLevel) {
        const levelMap: Record<string, string> = {
          'PRICE_LEVEL_FREE': 'Free',
          'PRICE_LEVEL_INEXPENSIVE': '$',
          'PRICE_LEVEL_MODERATE': '$$',
          'PRICE_LEVEL_EXPENSIVE': '$$$',
          'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
        };
        priceLevel = levelMap[place.priceLevel] || place.priceLevel;
      }

      const placeLocation = place.location ? {
        lat: place.location.latitude,
        lng: place.location.longitude,
      } : undefined;

      results.push({
        placeId: place.id || "",
        name: place.displayName?.text || query,
        address: place.formattedAddress || "",
        rating: place.rating?.toString(),
        reviewCount: place.userRatingCount,
        priceLevel,
        photoUrl,
        types: place.types || [],
        location: placeLocation,
      });
    }

    // Cache clones to prevent mutations from affecting cached data
    sessionCache.nearbyResults.set(cacheKey, results.map(r => clonePlaceResult(r)));
    // Return originals (caller can mutate without affecting cache)
    return results;
  } catch (error) {
    console.error("Error searching nearby places:", error);
    // Cache empty result to avoid retrying failed searches
    sessionCache.nearbyResults.set(cacheKey, []);
    return [];
  }
}

// Helper function to create a summary of positive review highlights
function selectBestReview(reviews?: any[]): string | undefined {
  if (!reviews || reviews.length === 0) return undefined;

  // Filter for positive reviews (4-5 stars)
  const positiveReviews = reviews.filter(r => r.rating >= 4 && r.text);
  if (positiveReviews.length === 0) return undefined;

  // Sort by rating (highest first), then by text length (more detailed reviews)
  const sortedReviews = positiveReviews.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return (b.text?.length || 0) - (a.text?.length || 0);
  });

  // Take top 5 reviews to extract highlights
  const topReviews = sortedReviews.slice(0, 5);
  
  // Extract key phrases about food, service, atmosphere, etc.
  const highlights: string[] = [];
  const highlightPatterns = [
    // Food quality patterns
    /(?:the |their |has |serves? )?(amazing|excellent|delicious|incredible|outstanding|fantastic|perfect|fresh|authentic|flavorful) (food|dishes?|meals?|cuisine|menu|options?|selection)/i,
    /(best|great|amazing|delicious|excellent) (pizza|burger|pasta|sushi|tacos?|sandwiches?|desserts?|coffee|drinks?|cocktails?|breakfast|brunch|dinner)/i,
    
    // Service patterns
    /(friendly|excellent|great|attentive|amazing|wonderful|fantastic) (service|staff|servers?|waiters?|team)/i,
    /(staff|service|team) (?:is |was |are |were )?(so |very )?(friendly|helpful|attentive|excellent|amazing|great)/i,
    
    // Atmosphere patterns
    /(cozy|beautiful|amazing|great|nice|perfect|lovely|wonderful) (atmosphere|ambiance|vibe|setting|place|location|spot|space|interior|decor)/i,
    /(atmosphere|ambiance|vibe) (?:is |was )?(so |very )?(cozy|beautiful|amazing|great|nice|perfect)/i,
    
    // General positive patterns
    /(highly recommend|must try|definitely recommend|worth (?:the |a )?visit|can't recommend enough)/i,
    /(love|loved) (?:the |this )?(place|restaurant|spot|food|experience)/i,
  ];
  
  for (const review of topReviews) {
    if (!review.text) continue;
    
    const text = review.text.toLowerCase();
    
    // Try each pattern
    for (const pattern of highlightPatterns) {
      const match = text.match(pattern);
      if (match) {
        // Clean and format the matched text
        let highlight = match[0].trim()
          .replace(/^(the |their |has |have |had |serves? |is |was |are |were |so |very )/i, '')
          .replace(/[.!?,;]+$/, '');
        
        // Capitalize first letter
        highlight = highlight.charAt(0).toUpperCase() + highlight.slice(1);
        
        // Avoid duplicates
        const isDuplicate = highlights.some(h => 
          h.toLowerCase().includes(highlight.toLowerCase()) || 
          highlight.toLowerCase().includes(h.toLowerCase())
        );
        
        if (!isDuplicate && highlight.length >= 10 && highlight.length <= 50) {
          highlights.push(highlight);
          if (highlights.length >= 3) break;
        }
      }
    }
    
    if (highlights.length >= 3) break;
  }
  
  // If we couldn't extract highlights with patterns, look for any strong positive phrases
  if (highlights.length < 2) {
    const positiveWords = ['amazing', 'excellent', 'fantastic', 'incredible', 'outstanding', 'delicious', 'perfect', 'best'];
    
    for (const review of topReviews) {
      if (!review.text) continue;
      
      const sentences = review.text.match(/[^.!?]+[.!?]+/g) || [review.text];
      
      for (const sentence of sentences) {
        const lower = sentence.toLowerCase();
        
        if (positiveWords.some(word => lower.includes(word))) {
          let highlight = sentence.trim()
            .replace(/^(i |we |they |the |this |it |very |really |so |such |and |but )/i, '')
            .replace(/[.!?]+$/, '');
          
          // Take first clause if too long
          if (highlight.length > 45) {
            const parts = highlight.split(/,| and | but /);
            highlight = parts[0].trim();
          }
          
          highlight = highlight.charAt(0).toUpperCase() + highlight.slice(1);
          
          const isDuplicate = highlights.some(h => 
            h.toLowerCase().includes(highlight.toLowerCase()) || 
            highlight.toLowerCase().includes(h.toLowerCase())
          );
          
          if (!isDuplicate && highlight.length >= 12 && highlight.length <= 50) {
            highlights.push(highlight);
            if (highlights.length >= 3) break;
          }
        }
      }
      
      if (highlights.length >= 3) break;
    }
  }
  
  // Return highlights as bullet-separated string
  return highlights.length > 0 ? highlights.join(' • ') : undefined;
}

export async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  // Check session cache first (fastest)
  if (sessionCache.placeDetails.has(placeId)) {
    sessionCache.stats.placeDetailsHits++;
    console.log(`[Session Cache] HIT - placeDetails for ${placeId}`);
    const cached = sessionCache.placeDetails.get(placeId);
    // Return deep copy to prevent mutation
    return cached ? clonePlaceResult(cached) : null;
  }

  // Check database cache (persistent, 30-day TTL)
  const dbCached = await getPlaceDetailsFromDB(placeId);
  if (dbCached) {
    // Add to session cache for faster future lookups
    sessionCache.placeDetails.set(placeId, clonePlaceResult(dbCached));
    sessionCache.stats.placeDetailsHits++;
    return clonePlaceResult(dbCached);
  }

  sessionCache.stats.placeDetailsMisses++;
  console.log(`[API Call] MISS - fetching placeDetails for ${placeId}`);

  try {
    const apiKey = getNextApiKey();

    // NEW PLACES API: Use Place Details endpoint
    // Endpoint format: GET https://places.googleapis.com/v1/places/{PLACE_ID}
    const endpoint = `https://places.googleapis.com/v1/places/${placeId}`;
    
    // Field mask for Place Details (no 'places.' prefix for this endpoint)
    const fieldMask = [
      'id',
      'displayName',
      'formattedAddress',
      'rating',
      'userRatingCount',
      'priceLevel',
      'photos',
      'types',
      'location',
    ].join(',');

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    if (!response.ok) {
      let errorDetails = `Status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error) {
          errorDetails = `${errorJson.error.status || response.status}: ${errorJson.error.message || 'Unknown error'}`;
        }
      } catch {
        // If JSON parsing fails, fall back to text
        const errorText = await response.text();
        errorDetails = `${response.status}: ${errorText}`;
      }
      console.error(`[Google Places API] Place Details Error:`, errorDetails);
      sessionCache.placeDetails.set(placeId, null);
      return null;
    }

    const place = await response.json();
    if (!place || !place.id) {
      sessionCache.placeDetails.set(placeId, null);
      return null;
    }

    let photoUrl: string | undefined;
    if (place.photos && place.photos.length > 0) {
      // NEW API: photos have a 'name' field (resource identifier)
      const photoName = place.photos[0].name;
      if (photoName) {
        photoUrl = `/api/photos/v1/${encodeURIComponent(photoName)}`;
      }
    }

    // NEW API: priceLevel is a string enum
    let priceLevel: string | undefined;
    if (place.priceLevel) {
      const levelMap: Record<string, string> = {
        'PRICE_LEVEL_FREE': 'Free',
        'PRICE_LEVEL_INEXPENSIVE': '$',
        'PRICE_LEVEL_MODERATE': '$$',
        'PRICE_LEVEL_EXPENSIVE': '$$$',
        'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
      };
      priceLevel = levelMap[place.priceLevel] || place.priceLevel;
    }

    const placeLocation = place.location ? {
      lat: place.location.latitude,
      lng: place.location.longitude,
    } : undefined;

    const result = {
      placeId: place.id || "",
      name: place.displayName?.text || "",
      address: place.formattedAddress || "",
      rating: place.rating?.toString(),
      reviewCount: place.userRatingCount,
      priceLevel,
      photoUrl,
      types: place.types || [],
      location: placeLocation,
    };

    // Cache in session for immediate reuse
    sessionCache.placeDetails.set(placeId, clonePlaceResult(result));
    
    // Cache in database for 30 days (async, don't wait)
    savePlaceDetailsToDB(placeId, result).catch(err => 
      console.error(`Failed to cache Place Details in DB for ${placeId}:`, err)
    );

    // Return the original (caller can mutate this without affecting cache)
    return result;
  } catch (error) {
    console.error("Error getting place details:", error);
    sessionCache.placeDetails.set(placeId, null);
    return null;
  }
}
