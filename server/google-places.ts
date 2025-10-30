import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "./db";
import { placesCache, searchCache, geocodingCache } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const client = new Client({});

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

  if (!key1) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set");
  }

  // If only one key is configured, use it
  if (!key2) {
    apiKeyUsageStats.key1Calls++;
    return key1;
  }

  // Weighted distribution: KEY_2 gets 4 out of 5 calls (80%), KEY_1 gets 1 out of 5 (20%)
  callCounter++;
  const useKey2 = (callCounter % 5) !== 0; // Use KEY_2 unless it's every 5th call
  
  if (useKey2) {
    apiKeyUsageStats.key2Calls++;
    console.log(`[API Key] Using Key #2 PRIMARY (total calls: ${apiKeyUsageStats.key2Calls})`);
    return key2;
  } else {
    apiKeyUsageStats.key1Calls++;
    console.log(`[API Key] Using Key #1 backup (total calls: ${apiKeyUsageStats.key1Calls})`);
    return key1;
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

    const response = await client.timezone({
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

    const response = await client.geocode({
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

export async function searchPlaces(
  query: string,
  location: string,
  radiusMiles: number = 2,
  coordinates?: { lat: number; lng: number }
): Promise<PlaceResult[]> {
  // Create cache key from search parameters
  const cacheKey = `${query}|${location}|${radiusMiles}|${coordinates?.lat}|${coordinates?.lng}`;
  
  // Check session cache first (fastest)
  if (sessionCache.searchResults.has(cacheKey)) {
    sessionCache.stats.searchHits++;
    console.log(`[Session Cache] HIT - searchPlaces for "${query}"`);
    const cached = sessionCache.searchResults.get(cacheKey)!;
    // Return deep copy to prevent mutation
    return cached.map(result => clonePlaceResult(result));
  }

  // Check database cache (persistent, 24-hour TTL)
  // NOTE: DB cache now stores full results, not just place IDs
  const dbCachedResults = await getSearchResultsFromDB(query, location, radiusMiles);
  if (dbCachedResults && dbCachedResults.length > 0) {
    console.log(`[DB Cache] HIT - full search results for "${query}" (${dbCachedResults.length} cached results)`);
    
    // Parse cached results as PlaceResult array
    const results: PlaceResult[] = dbCachedResults.map((cachedId: any) => {
      // Handle both old format (string IDs) and new format (full objects)
      if (typeof cachedId === 'string') {
        // Legacy format - would need to fetch details, but we're migrating away from this
        return null;
      }
      return cachedId as PlaceResult;
    }).filter((r): r is PlaceResult => r !== null);
    
    if (results.length > 0) {
      // Cache in session for immediate reuse
      sessionCache.searchResults.set(cacheKey, results.map(r => clonePlaceResult(r)));
      sessionCache.stats.searchHits++;
      
      return results.map(result => clonePlaceResult(result));
    }
  }

  sessionCache.stats.searchMisses++;
  console.log(`[API Call] MISS - fetching searchPlaces for "${query}"`);

  try {
    const apiKey = getNextApiKey();

    // Convert miles to meters (1 mile = 1609.34 meters)
    const radiusMeters = Math.round(radiusMiles * 1609.34);

    // If coordinates are provided, use them for more precise search
    const searchParams: any = {
      query: coordinates ? query : `${query} in ${location}`,
      key: apiKey,
    };
    
    if (coordinates) {
      searchParams.location = coordinates;
      searchParams.radius = radiusMeters;
    }

    const response = await client.textSearch({
      params: searchParams,
    });

    if (!response.data.results || response.data.results.length === 0) {
      sessionCache.searchResults.set(cacheKey, []);
      return [];
    }

    console.log(`[Google Places] Got ${response.data.results.length} results from API`);

    // Process ALL results (up to 20 from Google), not just the first one
    // OPTIMIZATION: Use Text Search data directly instead of calling getPlaceDetails for each result
    // This saves 20x API calls per search (was calling Place Details for every result)
    const results: PlaceResult[] = [];
    const MIN_REVIEWS = 50;
    
    for (const place of response.data.results.slice(0, 20)) {
      // Check if place is within radius (if coordinates provided)
      const placeLocation = place.geometry?.location;
      if (coordinates && placeLocation) {
        const distance = calculateDistance(
          coordinates.lat,
          coordinates.lng,
          placeLocation.lat,
          placeLocation.lng
        );
        
        if (distance > radiusMiles) {
          console.log(`[Google Places] Filtering out "${place.name}" - ${distance.toFixed(2)} miles away (radius: ${radiusMiles} miles)`);
          continue; // Skip this place, but keep processing others
        }
      }
      
      // Filter out places with fewer than 50 reviews
      // Use user_ratings_total directly from Text Search response
      if (!place.user_ratings_total || place.user_ratings_total < MIN_REVIEWS) {
        console.log(`[Google Places] Filtering out "${place.name}" - only ${place.user_ratings_total || 0} reviews (minimum: ${MIN_REVIEWS})`);
        continue;
      }
      
      // Build result from Text Search data (no additional API call needed!)
      let photoUrl: string | undefined;
      if (place.photos && place.photos.length > 0) {
        const photoReference = place.photos[0].photo_reference;
        // Use proxy endpoint to cache photos and reduce API costs
        photoUrl = `/api/photos/${photoReference}`;
      }

      const location = placeLocation 
        ? { lat: placeLocation.lat, lng: placeLocation.lng }
        : undefined;

      results.push({
        placeId: place.place_id || "",
        name: place.name || query,
        address: place.formatted_address || "",
        rating: place.rating?.toString(),
        reviewCount: place.user_ratings_total,
        priceLevel: place.price_level ? '$'.repeat(place.price_level) : undefined,
        photoUrl,
        types: place.types || [],
        location,
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
    
    // Return original (caller can mutate without affecting cache)
    return results;
  } catch (error) {
    console.error("Error searching Google Places:", error);
    // Cache empty result to avoid retrying failed searches
    sessionCache.searchResults.set(cacheKey, []);
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

    const response = await client.placesNearby({
      params: {
        location: nearLocation,
        radius: radiusMeters,
        keyword: query,
        key: apiKey,
      },
    });

    if (!response.data.results || response.data.results.length === 0) {
      sessionCache.nearbyResults.set(cacheKey, []);
      return [];
    }

    const results: PlaceResult[] = [];
    const MIN_REVIEWS = 50;
    for (const place of response.data.results) {
      // Filter by minimum rating
      if (!place.rating || place.rating < minRating) {
        continue;
      }
      
      // Filter by minimum review count
      if (!place.user_ratings_total || place.user_ratings_total < MIN_REVIEWS) {
        console.log(`[Google Places] Filtering out "${place.name}" - only ${place.user_ratings_total || 0} reviews (minimum: ${MIN_REVIEWS})`);
        continue;
      }
      
      let photoUrl: string | undefined;
      if (place.photos && place.photos.length > 0) {
        const photoReference = place.photos[0].photo_reference;
        // Use proxy endpoint to cache photos and reduce API costs
        photoUrl = `/api/photos/${photoReference}`;
      }

      results.push({
        placeId: place.place_id || "",
        name: place.name || query,
        address: place.vicinity || "",
        rating: place.rating?.toString(),
        priceLevel: place.price_level?.toString(),
        photoUrl,
        types: place.types || [],
      });

      if (results.length >= 2) break;
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

    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        key: apiKey,
        fields: ['place_id', 'name', 'formatted_address', 'rating', 'user_ratings_total', 'price_level', 'photos', 'types'],
      },
    });

    const place = response.data.result;
    if (!place) {
      sessionCache.placeDetails.set(placeId, null);
      return null;
    }

    let photoUrl: string | undefined;
    if (place.photos && place.photos.length > 0) {
      const photoReference = place.photos[0].photo_reference;
      // Use proxy endpoint to cache photos and reduce API costs
      photoUrl = `/api/photos/${photoReference}`;
    }

    const result = {
      placeId: place.place_id || "",
      name: place.name || "",
      address: place.formatted_address || "",
      rating: place.rating?.toString(),
      reviewCount: place.user_ratings_total,
      priceLevel: place.price_level?.toString(),
      photoUrl,
      types: place.types || [],
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
