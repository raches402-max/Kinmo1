import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "./db";
import { placesCache, searchCache, geocodingCache, curatedVenues, apiCallLogs } from "@shared/schema";
import { eq, and, or, sql as drizzleSql, like, desc, ilike, inArray } from "drizzle-orm";

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

/**
 * Log API call for cost tracking and monitoring
 * Cost estimates based on Google Maps Platform pricing (as of 2024)
 */
async function logApiCall(params: {
  service: string;
  method: string;
  cacheStatus: 'hit' | 'miss' | 'write';
  status: 'success' | 'error';
  responseTimeMs?: number;
  costEstimate?: number;
  parameters?: any;
  errorMessage?: string;
  metadata?: any;
}) {
  try {
    await db.insert(apiCallLogs).values({
      service: params.service,
      method: params.method,
      cacheStatus: params.cacheStatus,
      status: params.status,
      responseTimeMs: params.responseTimeMs,
      costEstimate: params.costEstimate ? params.costEstimate.toString() : null,
      parameters: params.parameters || null,
      errorMessage: params.errorMessage,
      metadata: params.metadata || null,
      createdAt: new Date(),
    });
  } catch (error) {
    // Don't let logging failures break the main flow
    console.error('[API Logging] Failed to log API call:', error);
  }
}

/**
 * Calculate cost estimate for Google Places API calls
 * Pricing: https://mapsplatform.google.com/pricing/
 */
function calculateGooglePlacesCost(method: string, resultCount?: number): number {
  const costs: Record<string, number> = {
    'textSearch': 0.032,        // Text Search (New): $32 per 1000 requests
    'nearbySearch': 0.032,      // Nearby Search (New): $32 per 1000 requests
    'placeDetails': 0.017,      // Place Details (Basic): $17 per 1000 requests
    'geocoding': 0.005,         // Geocoding: $5 per 1000 requests
    'timezone': 0.005,          // Timezone: $5 per 1000 requests
  };

  return costs[method] || 0;
}

/**
 * Map budgetMax to maximum allowed price level
 * Budget-to-Price-Level Mapping:
 * $0-30   → Level 1 ($) only
 * $31-60  → Levels 1-2 ($, $$)
 * $61-99  → Levels 1-3 ($, $$, $$$)
 * $100+   → All levels ($, $$, $$$, $$$$)
 */
export function getMaxPriceLevelForBudget(budgetMax: number): number {
  if (budgetMax <= 30) {
    console.log(`[Budget Mapping] $${budgetMax} → Max price level: 1 ($)`);
    return 1;
  }
  if (budgetMax <= 60) {
    console.log(`[Budget Mapping] $${budgetMax} → Max price level: 2 ($, $$)`);
    return 2;
  }
  if (budgetMax < 100) {
    console.log(`[Budget Mapping] $${budgetMax} → Max price level: 3 ($, $$, $$$)`);
    return 3;
  }
  console.log(`[Budget Mapping] $${budgetMax} → Max price level: 4 ($, $$, $$$, $$$$)`);
  return 4;
}

/**
 * Convert price level string to numeric value
 */
function priceLevelToNumber(priceLevel: string | undefined): number | null {
  if (!priceLevel) return null;
  
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
  
  return priceMap[priceLevel] || null;
}

/**
 * Filter venues by budget
 * Venues with missing price data:
 * - For budgets >= $40: Allow (benefit of doubt - most venues without data are moderate)
 * - For budgets < $40: Reject (safer for strict budget constraints)
 *
 * This is more permissive than the old $100 threshold, which was filtering out
 * too many good venues for moderate budgets like $60.
 */
export function filterByBudget(venues: PlaceResult[], budgetMax: number): PlaceResult[] {
  const maxPriceLevel = getMaxPriceLevelForBudget(budgetMax);

  return venues.filter(venue => {
    const priceNum = priceLevelToNumber(venue.priceLevel);

    // Handle missing price data - be more permissive for moderate+ budgets
    if (priceNum === null) {
      const allowed = budgetMax >= 40;
      if (!allowed) {
        console.log(`[Budget Filter] ❌ Filtering out "${venue.name}" - no price data (budget: $${budgetMax} < $40)`);
      } else {
        console.log(`[Budget Filter] ✓ Allowing "${venue.name}" - no price data but budget $${budgetMax} >= $40`);
      }
      return allowed;
    }

    // Filter by price level
    if (priceNum > maxPriceLevel) {
      const priceDisplay = '$'.repeat(priceNum);
      const maxDisplay = '$'.repeat(maxPriceLevel);
      console.log(`[Budget Filter] ❌ Filtering out "${venue.name}" - ${priceDisplay} exceeds budget $${budgetMax} (max: ${maxDisplay})`);
      return false;
    }

    // Venue passes filter
    const priceDisplay = '$'.repeat(priceNum);
    console.log(`[Budget Filter] ✓ Allowing "${venue.name}" - ${priceDisplay} within budget $${budgetMax}`);
    return true;
  });
}

/**
 * Calculate similarity between two venue names
 * Returns a score between 0 (no match) and 1 (exact match)
 * Uses Levenshtein distance for fuzzy matching
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;

  // Normalize names: lowercase, remove special chars, trim
  const normalize = (str: string) => str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 1.0;

  // Levenshtein distance
  const distance = (s1: string, s2: string): number => {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  };

  const dist = distance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);

  // Convert distance to similarity (0-1)
  return maxLen === 0 ? 0 : 1 - (dist / maxLen);
}

/**
 * Validate that a Place ID's data matches the expected venue name
 * Returns validation result with warnings if there's a mismatch
 */
export interface VenueValidationResult {
  isValid: boolean;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  placeDetails: PlaceResult | null;
}

export async function validateVenuePlaceId(
  expectedName: string,
  placeId: string
): Promise<VenueValidationResult> {
  const warnings: string[] = [];

  try {
    const placeDetails = await getPlaceDetails(placeId);

    if (!placeDetails) {
      return {
        isValid: false,
        confidence: 'low',
        warnings: ['Failed to fetch place details from Google Places API'],
        placeDetails: null
      };
    }

    const similarity = calculateNameSimilarity(expectedName, placeDetails.name);

    // Determine confidence level based on name similarity
    let confidence: 'high' | 'medium' | 'low';
    let isValid = true;

    if (similarity >= 0.8) {
      confidence = 'high';
    } else if (similarity >= 0.5) {
      confidence = 'medium';
      warnings.push(
        `Venue name mismatch: Expected "${expectedName}" but Place ID points to "${placeDetails.name}" (${Math.round(similarity * 100)}% match)`
      );
    } else {
      confidence = 'low';
      isValid = false;
      warnings.push(
        `Significant venue mismatch: Expected "${expectedName}" but Place ID points to "${placeDetails.name}" (${Math.round(similarity * 100)}% match)`
      );
    }

    // Additional validation: Check for tour operators in types
    const suspiciousTypes = ['travel_agency', 'tour_operator', 'tourist_attraction'];
    const hasSuspiciousType = placeDetails.types?.some(type => suspiciousTypes.includes(type));

    if (hasSuspiciousType && confidence !== 'high') {
      warnings.push(
        `Warning: Place ID points to a ${placeDetails.types?.find(t => suspiciousTypes.includes(t))}, which may not be the intended venue`
      );
    }

    return {
      isValid,
      confidence,
      warnings,
      placeDetails
    };
  } catch (error) {
    return {
      isValid: false,
      confidence: 'low',
      warnings: [`Error validating Place ID: ${error}`],
      placeDetails: null
    };
  }
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
  city?: string; // City extracted from addressComponents
  rating?: string;
  reviewCount?: number; // Total number of Google reviews (user_ratings_total)
  priceLevel?: string;
  photoUrl?: string;
  types: string[];
  location?: { lat: number; lng: number };
  review?: string; // Short positive review (80-100 chars)
  distance?: number; // Distance in miles from search location
  openingHours?: any; // Google Places opening hours (periods, weekday_text)
  businessStatus?: string; // OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY
}

// Helper function to extract city from Google Places addressComponents
function extractCityFromAddressComponents(addressComponents: any[]): string | undefined {
  if (!addressComponents || !Array.isArray(addressComponents)) {
    return undefined;
  }

  // Try to find locality (city) - most common
  const locality = addressComponents.find(component => 
    component.types?.includes('locality')
  );
  if (locality?.longText) {
    return locality.longText;
  }

  // Fallback: try sublocality (neighborhood in large cities)
  const sublocality = addressComponents.find(component => 
    component.types?.includes('sublocality') || component.types?.includes('sublocality_level_1')
  );
  if (sublocality?.longText) {
    return sublocality.longText;
  }

  // Fallback: try administrative_area_level_3 (smaller administrative division)
  const adminLevel3 = addressComponents.find(component => 
    component.types?.includes('administrative_area_level_3')
  );
  if (adminLevel3?.longText) {
    return adminLevel3.longText;
  }

  return undefined;
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
 * Shuffle array using Fisher-Yates algorithm for randomization
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Search curated venues (cache-first strategy)
 * Returns pre-loaded venues that match the query and location
 * GEOGRAPHIC VALIDATION: Only returns results if location is confirmed to be within Bay Area
 * VARIETY OPTIMIZATION: Prioritizes fresh (unseen) venues and randomizes results
 */
async function searchCuratedVenues(
  query: string,
  location: string,
  radiusMiles: number = 30,
  coordinates?: { lat: number; lng: number },
  maxResults: number = 15,
  venueType?: string,
  seenVenues?: string[]
): Promise<PlaceResult[]> {
  try {
    console.log(`[Curated Search] Searching for "${query}" in ${location}`);

    // Geographic validation for Bay Area
    // Use curated venues if search is for SF Bay Area
    const locationLower = location.toLowerCase();
    const isBayAreaLocation = locationLower.includes('san francisco') ||
                              locationLower.includes('sf') ||
                              locationLower.includes(' sf ') ||
                              locationLower.includes('sf,') ||
                              locationLower.includes('san mateo') ||
                              locationLower.includes('oakland') ||
                              locationLower.includes('san jose') ||
                              locationLower.includes('bay area');

    // Bay Area bounding box (approximate): covers SF, Oakland, San Mateo, San Jose
    const BAY_AREA_BOUNDS = {
      latMin: 37.2,
      latMax: 38.0,
      lngMin: -122.6,
      lngMax: -121.5
    };

    // Geographic validation: Require EITHER string match OR coordinates within Bay Area bounds
    let isValidBayAreaSearch = false;

    if (isBayAreaLocation) {
      // Location string explicitly mentions Bay Area city
      isValidBayAreaSearch = true;
      console.log(`[Curated Search] ✓ Location string matches Bay Area: "${location}"`);
    } else if (coordinates) {
      // Check if coordinates fall within Bay Area bounding box
      const inBayAreaBounds = coordinates.lat >= BAY_AREA_BOUNDS.latMin &&
                              coordinates.lat <= BAY_AREA_BOUNDS.latMax &&
                              coordinates.lng >= BAY_AREA_BOUNDS.lngMin &&
                              coordinates.lng <= BAY_AREA_BOUNDS.lngMax;

      if (inBayAreaBounds) {
        isValidBayAreaSearch = true;
        console.log(`[Curated Search] ✓ Coordinates within Bay Area bounds: ${coordinates.lat}, ${coordinates.lng}`);
      } else {
        console.log(`[Curated Search] ✗ Coordinates outside Bay Area bounds: ${coordinates.lat}, ${coordinates.lng}`);
      }
    } else {
      console.log(`[Curated Search] ✗ No Bay Area location match and no coordinates provided`);
    }

    // If not a valid Bay Area search, skip curated venues entirely
    if (!isValidBayAreaSearch) {
      console.log(`[Curated Search] Skipping curated venues - not a Bay Area search`);
      return [];
    }

    // Build category filter based on query
    // IMPORTANT: Skip category filtering if query looks like a specific venue name
    // e.g., "Tang Bar" should search for venues named "Tang Bar", not all bars
    // A specific venue name typically has multiple words where the first word isn't a category keyword
    const queryLower = query.toLowerCase();
    const queryWords = query.trim().split(/\s+/);
    const firstWord = queryWords[0]?.toLowerCase() || '';

    // Category keywords that when they START a query indicate a category search
    const categoryKeywords = ['bar', 'bars', 'restaurant', 'restaurants', 'cafe', 'cafes',
                              'coffee', 'drinks', 'food', 'dining', 'dessert', 'museum',
                              'concert', 'theater', 'experience', 'brewery', 'wine', 'beer'];

    // If query has multiple words and doesn't start with a category keyword,
    // it's likely a specific venue name - skip category filtering
    const looksLikeVenueName = queryWords.length >= 2 && !categoryKeywords.includes(firstWord);

    let categoryFilter: string | null = null;

    if (!looksLikeVenueName) {
      // Only apply category filtering for generic searches like "bars" or "restaurant"
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
    } else {
      console.log(`[Curated Search] Skipping category filter - query "${query}" looks like a specific venue name`);
    }

    // Build SQL query
    const conditions = [];

    // Filter by active status only (regions are now actual city names)
    conditions.push(eq(curatedVenues.isActive, true));
    
    // Text search for venue name with flexible token-based matching
    // Normalize search terms to handle apostrophes, possessives, and plurals
    const normalizeWord = (word: string): string[] => {
      const variants: string[] = [word];

      // Strip possessive 's (e.g., "lovely's" → "lovely")
      if (word.endsWith("'s")) {
        variants.push(word.slice(0, -2));
      }

      // Handle plural "ies" → "y" (e.g., "lovelies" → "lovely")
      if (word.endsWith('ies') && word.length > 4) {
        variants.push(word.slice(0, -3) + 'y');
      }

      // Handle plural "s" (e.g., "dumplings" → "dumpling")
      if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
        variants.push(word.slice(0, -1));
      }

      return variants;
    };

    // Split query into words and normalize each word
    const searchWords = query.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    if (searchWords.length > 0) {
      if (looksLikeVenueName && searchWords.length >= 2) {
        // For specific venue names like "Tang Bar", use AND logic
        // Each word must have at least one variant match
        const wordConditions: any[] = [];
        for (const word of searchWords) {
          const variants = normalizeWord(word);
          // Any variant of this word must match (OR within word variants)
          wordConditions.push(or(...variants.map(v => ilike(curatedVenues.name, `%${v}%`))));
        }
        // ALL words must match (AND between words)
        conditions.push(and(...wordConditions));
        console.log(`[Curated Search] Using AND logic for venue name: "${query}" (${searchWords.length} words)`);
      } else {
        // For category searches like "bars", use OR logic for flexibility
        const nameConditions: any[] = [];
        for (const word of searchWords) {
          const variants = normalizeWord(word);
          for (const variant of variants) {
            nameConditions.push(ilike(curatedVenues.name, `%${variant}%`));
          }
        }
        conditions.push(or(...nameConditions));
      }
    } else {
      // Fallback to exact matching for very short queries
      conditions.push(ilike(curatedVenues.name, `%${query}%`));
    }
    
    // Filter by category if detected (optional - enhances results)
    if (categoryFilter) {
      console.log(`[Curated Search] Category filter detected: "${categoryFilter}"`);
      conditions.push(eq(curatedVenues.category, categoryFilter));
    }

    // Query curated venues
    // Use large limit (200) to ensure shuffle has diverse pool and support pagination
    let results = await db
      .select()
      .from(curatedVenues)
      .where(and(...conditions))
      .orderBy(desc(curatedVenues.rating))
      .limit(200); // Large pool for shuffle variety and pagination support
    
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
        .filter(venue => venue.distance <= radiusMiles);
      // Don't slice yet - we'll shuffle first for variety, then slice
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
        },
        distance: (venue as any).distance || undefined
      };
    }));

    // VARIETY OPTIMIZATION: Separate fresh vs seen venues, randomize both, prioritize fresh
    if (seenVenues && seenVenues.length > 0) {
      const seenVenuesLower = new Set(seenVenues.map(v => v.toLowerCase()));
      
      // Separate into fresh (unseen) and seen venues
      const freshVenues = placeResults.filter(v => !seenVenuesLower.has(v.name.toLowerCase()));
      const seenVenuesList = placeResults.filter(v => seenVenuesLower.has(v.name.toLowerCase()));
      
      console.log(`[Curated Search] Found ${placeResults.length} venues: ${freshVenues.length} fresh, ${seenVenuesList.length} seen`);
      
      // Randomize both groups
      const shuffledFresh = shuffleArray(freshVenues);
      const shuffledSeen = shuffleArray(seenVenuesList);
      
      // Prioritize fresh venues, use seen as fallback, limit to maxResults
      const finalResults = [...shuffledFresh, ...shuffledSeen].slice(0, maxResults);
      
      console.log(`[Curated Search] Returning ${finalResults.length} venues (${Math.min(shuffledFresh.length, maxResults)} fresh prioritized)`);
      return finalResults;
    } else {
      // No seen venues tracking, just randomize for variety
      const shuffled = shuffleArray(placeResults);
      console.log(`[Curated Search] Found ${shuffled.length} curated venues (randomized for variety)`);
      return shuffled.slice(0, maxResults);
    }
    
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
          openingHours: venue.openingHours || null,
          businessStatus: venue.businessStatus || null,
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

/**
 * Interface for Google Maps URL parsing results
 */
export interface GoogleMapsUrlResult {
  type: 'place_id' | 'coordinates' | 'text_search' | 'share_link' | 'unknown';
  placeId?: string;
  lat?: number;
  lng?: number;
  placeName?: string;
  rawUrl: string;
}

/**
 * Detect and parse Google Maps URLs to extract place IDs, coordinates, or search text
 * Supports various Google Maps URL formats:
 * - Place URLs with place IDs: maps.google.com/maps/place/Name/@lat,lng/data=!4m6!3m5!1sPlaceID
 * - Coordinate URLs: maps.google.com/maps/search/@lat,lng
 * - Text search URLs: maps.google.com/maps/search/coffee+shops
 * - Legacy CID URLs: maps.google.com?cid=123456789
 * - Shortened URLs: maps.app.goo.gl/ABC123
 *
 * @param query - User input that might be a Google Maps URL
 * @returns Parsed URL result or null if not a Google Maps URL
 */
export async function detectAndParseGoogleMapsUrl(query: string): Promise<GoogleMapsUrlResult | null> {
  // Return null if not a URL-like string
  if (!query.includes('google.com/maps') && !query.includes('goo.gl/maps') && !query.includes('maps.app.goo.gl')) {
    return null;
  }

  try {
    const url = new URL(query);

    // Pattern 1: CID-based URLs (maps.google.com?cid=NUMERIC_ID)
    // This is a legacy format that we'll treat as text search
    const cidMatch = url.search.match(/cid=(\d+)/);
    if (cidMatch) {
      console.log(`[URL Parser] Detected CID-based URL (legacy format)`);
      return {
        type: 'text_search',
        placeName: cidMatch[1],
        rawUrl: query,
      };
    }

    // Pattern 2: Data-based Place IDs (most common modern format)
    // Google Maps stores place ID in the `data` parameter
    // Format: data=!4m6!3m5!1s{PLACE_ID}!...
    // The data can be in query params OR in the pathname (e.g., /data=!3m1!...)
    let dataParam = url.searchParams.get('data') || url.search;

    // Also check pathname for /data=... pattern
    if (!dataParam || !dataParam.includes('!1s')) {
      const pathDataMatch = url.pathname.match(/\/data=([^?]*)/);
      if (pathDataMatch) {
        dataParam = pathDataMatch[1];
      }
    }

    if (dataParam) {
      // Try to find ChIJ format Place ID first (most reliable)
      const placeIdMatch = dataParam.match(/!1s([^!&]+)/);
      if (placeIdMatch && placeIdMatch[1]) {
        const potentialPlaceId = placeIdMatch[1];
        // Validate that this looks like a real place ID
        // Only accept ChIJ format for direct place ID lookup
        // (0x format is deprecated and not supported by new Places API)
        if (potentialPlaceId.length > 10 && potentialPlaceId.startsWith('ChIJ')) {
          console.log(`[URL Parser] Detected Place ID (ChIJ format): ${potentialPlaceId}`);
          return {
            type: 'place_id',
            placeId: potentialPlaceId,
            rawUrl: query,
          };
        }
      }

      // Try to extract shortcode Place IDs (format: !16s/g/SHORTCODE or !16s%2Fg%2FSHORTCODE)
      // These are newer format Place IDs that need to be prefixed with ChIJ
      const shortcodeMatch = dataParam.match(/!16s(?:%2F|\/)[gG](?:%2F|\/)([A-Za-z0-9_-]+)/);
      if (shortcodeMatch && shortcodeMatch[1]) {
        const shortcode = shortcodeMatch[1];
        // Convert shortcode to Place ID by searching with coordinates + name
        console.log(`[URL Parser] Detected shortcode Place ID format: ${shortcode}`);
        // We'll need to use coordinates + text search for this
        // Return null here to fall through to coordinate extraction
      }
    }

    // Pattern 3: Coordinate extraction from @ notation
    // Example: https://www.google.com/maps/place/Cafe/@37.7749,-122.4194,17z/...
    const pathMatch = url.pathname.match(/@([\d\.\-]+),([\d\.\-]+)/);
    if (pathMatch) {
      const lat = parseFloat(pathMatch[1]);
      const lng = parseFloat(pathMatch[2]);

      // Validate coordinates are within valid ranges
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        // Try to extract place name from the path
        const placeMatch = url.pathname.match(/\/maps\/place\/([^/@]+)/);
        const placeName = placeMatch ? decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ') : undefined;

        // Check if we already found a ChIJ format place ID in the data param
        const placeIdInData = dataParam?.match(/!1s(ChIJ[^!&]+)/);

        console.log(`[URL Parser] Detected coordinates: ${lat}, ${lng}${placeName ? ` for ${placeName}` : ''}`);

        // If we have a place name, use coordinates type (which will do a text search with the name)
        // This handles both old 0x format place IDs and missing place IDs
        return {
          type: placeIdInData ? 'place_id' : 'coordinates',
          placeId: placeIdInData ? placeIdInData[1] : undefined,
          lat,
          lng,
          placeName,
          rawUrl: query,
        };
      }
    }

    // Pattern 4: Text search URLs
    // Example: https://www.google.com/maps/search/coffee+shop+san+francisco
    if (url.pathname.includes('/maps/search/')) {
      const searchMatch = url.pathname.match(/\/maps\/search\/([^/]+)/);
      if (searchMatch) {
        const searchText = decodeURIComponent(searchMatch[1]).replace(/\+/g, ' ');
        console.log(`[URL Parser] Detected text search: ${searchText}`);
        return {
          type: 'text_search',
          placeName: searchText,
          rawUrl: query,
        };
      }
    }

    // Pattern 5: Place name extraction (fallback)
    // Example: https://www.google.com/maps/place/Chick-fil-A/@37.777,-122.419
    const placeNameMatch = url.pathname.match(/\/maps\/place\/([^/@]+)/);
    if (placeNameMatch) {
      const placeName = decodeURIComponent(placeNameMatch[1]).replace(/\+/g, ' ');
      console.log(`[URL Parser] Detected place name: ${placeName}`);

      return {
        type: 'text_search',
        placeName,
        rawUrl: query,
      };
    }

    // Pattern 6: Shortened share links
    // Example: https://maps.app.goo.gl/ABC123
    // Follow the redirect to get the full URL, then parse it
    if (url.hostname.includes('goo.gl') || url.hostname.includes('maps.app.goo.gl')) {
      console.log(`[URL Parser] Detected shortened share link, following redirect...`);
      try {
        // Follow the redirect to get the full URL
        const response = await fetch(query, {
          method: 'HEAD',
          redirect: 'follow'
        });

        const fullUrl = response.url;
        console.log(`[URL Parser] Shortened link resolved to: ${fullUrl}`);

        // Recursively parse the full URL
        return await detectAndParseGoogleMapsUrl(fullUrl);
      } catch (error) {
        console.error(`[URL Parser] Failed to follow redirect for shortened link:`, error);
        // Fall back to treating it as a share_link
        return {
          type: 'share_link',
          rawUrl: query,
        };
      }
    }

    console.log(`[URL Parser] Could not parse Google Maps URL format`);
    return null;
  } catch (error) {
    console.error(`[URL Parser] Failed to parse URL: ${query}`, error);
    return null;
  }
}

export async function searchPlaces(
  query: string,
  location: string,
  radiusMiles: number = 2,
  coordinates?: { lat: number; lng: number },
  skipCurated: boolean = false,
  venueType?: string,
  budgetMax?: number,
  seenVenues?: string[],
  forceComprehensiveSearch: boolean = false,
  userDirected: boolean = false
): Promise<PlaceResult[]> {
  // GOOGLE MAPS URL DETECTION: Check if query is a Google Maps URL
  const urlResult = await detectAndParseGoogleMapsUrl(query);

  if (urlResult) {
    console.log(`[URL Parser] Detected Google Maps URL:`, urlResult);

    // Handle place_id type - directly fetch the specific place
    if (urlResult.type === 'place_id' && urlResult.placeId) {
      console.log(`[URL Parser] Fetching place details for place ID: ${urlResult.placeId}`);
      const placeDetails = await getPlaceDetails(urlResult.placeId);
      if (placeDetails) {
        return [placeDetails];
      }
      // If place details fetch failed, fall through to normal search
      console.log(`[URL Parser] Failed to fetch place details, falling back to normal search`);
    }

    // Handle coordinates type - use extracted coordinates and place name
    if (urlResult.type === 'coordinates' && urlResult.lat && urlResult.lng) {
      console.log(`[URL Parser] Using coordinates (${urlResult.lat}, ${urlResult.lng}) with place name: ${urlResult.placeName || 'none'}`);
      // Override coordinates with extracted values
      coordinates = { lat: urlResult.lat, lng: urlResult.lng };
      // Use place name if available, otherwise keep original query
      if (urlResult.placeName) {
        query = urlResult.placeName;
      }
    }

    // Handle text_search type - use extracted place name
    if (urlResult.type === 'text_search' && urlResult.placeName) {
      console.log(`[URL Parser] Using extracted place name for text search: ${urlResult.placeName}`);
      query = urlResult.placeName;
    }

    // For share_link or unknown types, continue with original query
    // The detectAndParseGoogleMapsUrl should have already tried to follow redirects
  }

  // CACHE-FIRST STRATEGY: Check curated venues FIRST (10-50ms for SF searches)
  // Skip curated search if explicitly requested (e.g., when curated filtering failed)
  let curatedResults: PlaceResult[] = [];
  
  if (!skipCurated) {
    // Request up to 100 results from cache to support pagination
    curatedResults = await searchCuratedVenues(query, location, radiusMiles, coordinates, 100, venueType, seenVenues);
    
    if (curatedResults.length >= 9 && !forceComprehensiveSearch) {
      // We have enough curated venues, return ALL of them (skip API call)
      // This allows users to paginate through many results without extra API costs
      // NOTE: Skip this optimization if forceComprehensiveSearch is true (for user-initiated searches)
      console.log(`[Cache-First] Returning ALL ${curatedResults.length} curated venues for pagination (NO API CALL NEEDED)`);
      // Apply budget filter if provided (only filter if budgetMax is a real number and not user-directed)
      if (!userDirected && budgetMax != null && typeof budgetMax === 'number') {
        const filtered = filterByBudget(curatedResults, budgetMax);
        console.log(`[Budget Filter] ${curatedResults.length} → ${filtered.length} venues after budget filter ($${budgetMax})`);
        return filtered;
      }
      return curatedResults;
    }

    // If forceComprehensiveSearch is true and we have 9+ curated results, log that we're calling API anyway
    if (curatedResults.length >= 9 && forceComprehensiveSearch) {
      console.log(`[Comprehensive Search] Found ${curatedResults.length} curated venues but forceComprehensiveSearch=true, will also call Google API for complete results`);
    }
    
    // If we have some curated results but not enough (<9), we'll merge them with API results
    if (curatedResults.length > 0) {
      console.log(`[Cache-First] Found only ${curatedResults.length} curated venues (need 9+), will supplement with API results`);
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
      // Log cache hit (no API cost)
      await logApiCall({
        service: 'google_places',
        method: 'textSearch',
        cacheStatus: 'hit',
        status: 'success',
        responseTimeMs: 0,
        costEstimate: 0,
        parameters: { query, location, radiusMiles },
        metadata: { cacheType: 'session' },
      });
      const cached = sessionCache.searchResults.get(cacheKey)!;
      
      // Merge with curated results if any
      if (curatedResults.length > 0) {
        const curatedPlaceIds = new Set(curatedResults.map(r => r.placeId));
        const uniqueCached = cached.filter(r => !curatedPlaceIds.has(r.placeId));
        // Shuffle session cache results for variety
        const shuffledCached = shuffleArray(uniqueCached);
        const combined = [...curatedResults, ...shuffledCached].slice(0, 20);
        console.log(`[Cache-First] Combined ${curatedResults.length} curated + ${shuffledCached.length} cached (shuffled) = ${combined.length} total`);
        // Apply budget filter if provided (only filter if budgetMax is a real number and not user-directed)
        if (!userDirected && budgetMax != null && typeof budgetMax === 'number') {
          const filtered = filterByBudget(combined, budgetMax);
          console.log(`[Budget Filter] ${combined.length} → ${filtered.length} venues after budget filter ($${budgetMax})`);
          return filtered.map(result => clonePlaceResult(result));
        }
        return combined.map(result => clonePlaceResult(result));
      }
      
      // Return deep copy to prevent mutation, shuffled for variety
      const results = shuffleArray(cached.map(result => clonePlaceResult(result)));
      console.log(`[Session Cache] Returning ${results.length} results (shuffled for variety)`);
      // Apply budget filter if provided (only filter if budgetMax is a real number and not user-directed)
      if (!userDirected && budgetMax != null && typeof budgetMax === 'number') {
        const filtered = filterByBudget(results, budgetMax);
        console.log(`[Budget Filter] ${results.length} → ${filtered.length} venues after budget filter ($${budgetMax})`);
        return filtered;
      }
      return results;
    }

    // Check database cache (persistent, 24-hour TTL)
    const dbCachedResults = await getSearchResultsFromDB(query, location, radiusMiles);
    if (dbCachedResults && dbCachedResults.length > 0) {
      console.log(`[DB Cache] HIT - full search results for "${query}" (${dbCachedResults.length} cached results)`);
      // Log cache hit (no API cost)
      await logApiCall({
        service: 'google_places',
        method: 'textSearch',
        cacheStatus: 'hit',
        status: 'success',
        responseTimeMs: 0,
        costEstimate: 0,
        parameters: { query, location, radiusMiles },
        metadata: { cacheType: 'database', resultCount: dbCachedResults.length },
      });

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
          // Apply budget filter if provided (only filter if budgetMax is a real number and not user-directed)
          if (!userDirected && budgetMax != null && typeof budgetMax === 'number') {
            const filtered = filterByBudget(combined, budgetMax);
            console.log(`[Budget Filter] ${combined.length} → ${filtered.length} venues after budget filter ($${budgetMax})`);
            return filtered.map(result => clonePlaceResult(result));
          }
          return combined.map(result => clonePlaceResult(result));
        }
        
        // Cache in session for immediate reuse
        sessionCache.searchResults.set(cacheKey, results.map(r => clonePlaceResult(r)));
        sessionCache.stats.searchHits++;

        // Apply budget filter if provided (only filter if budgetMax is a real number and not user-directed)
        const toReturn = results.map(result => clonePlaceResult(result));
        if (!userDirected && budgetMax != null && typeof budgetMax === 'number') {
          const filtered = filterByBudget(toReturn, budgetMax);
          console.log(`[Budget Filter] ${toReturn.length} → ${filtered.length} venues after budget filter ($${budgetMax})`);
          return filtered;
        }
        return toReturn;
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
    // When we have coordinates, use locationBias for geographic filtering
    // This keeps the query clean for exact name matching (e.g., "Tang Bar" instead of "Tang Bar in San Francisco")
    // Only append location text when coordinates are NOT available
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
      'places.addressComponents',
      'places.rating',
      'places.userRatingCount',
      'places.priceLevel',
      'places.photos',
      'places.types',
      'places.location',
      'places.currentOpeningHours', // +$0.003 per call (Atmosphere fields)
      'places.businessStatus', // Same SKU as currentOpeningHours
    ].join(',');

    const startTime = Date.now();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(requestBody),
    });
    const responseTimeMs = Date.now() - startTime;

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
      // Log API call failure
      await logApiCall({
        service: 'google_places',
        method: 'textSearch',
        cacheStatus: 'miss',
        status: 'error',
        responseTimeMs,
        costEstimate: calculateGooglePlacesCost('textSearch'),
        parameters: { query, location, radiusMiles },
        errorMessage: errorDetails,
      });
      // Don't cache empty results for user-directed searches (allow retry)
      if (!userDirected) {
        sessionCache.searchResults.set(cacheKey, []);
      }
      return [];
    }

    const data = await response.json();

    if (!data.places || data.places.length === 0) {
      // Don't cache empty results for user-directed searches (allow retry)
      if (!userDirected) {
        sessionCache.searchResults.set(cacheKey, []);
      }
      return [];
    }

    console.log(`[Google Places] Got ${data.places.length} results from NEW API`);

    // Log successful API call
    await logApiCall({
      service: 'google_places',
      method: 'textSearch',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: calculateGooglePlacesCost('textSearch'),
      parameters: { query, location, radiusMiles },
      metadata: { resultCount: data.places.length },
    });

    // Process ALL results (up to 20 from Google), not just the first one
    // OPTIMIZATION: Use Text Search data directly instead of calling getPlaceDetails for each result
    // This saves 20x API calls per search (was calling Place Details for every result)
    const results: PlaceResult[] = [];

    // REMOVED MIN_REVIEWS = 50 filter - was too aggressive and conflicted with downstream filters
    // Quality filtering now handled consistently in routes.ts with context-aware thresholds (10-15 reviews)
    // This filter was causing high-quality venues with 15-49 reviews to be filtered out,
    // then fallback logic would accept venues with only 5 reviews (creating worse results)

    for (const place of data.places) {
      // NEW API: Extract location from place object
      const placeLocation = place.location ? {
        lat: place.location.latitude,
        lng: place.location.longitude,
      } : undefined;
      
      // Check if place is within radius (if coordinates provided)
      // Skip distance filter for user-directed searches - user knows what they want
      if (!userDirected && coordinates && placeLocation) {
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
      
      // REMOVED: Aggressive 50-review filter - now handled by downstream context-aware filters
      // This allows venues with 15-49 reviews to pass through, improving quality
      // if (!userDirected && (!place.userRatingCount || place.userRatingCount < MIN_REVIEWS)) {
      //   console.log(`[Google Places] Filtering out "${place.displayName?.text || 'Unknown'}" - only ${place.userRatingCount || 0} reviews (minimum: ${MIN_REVIEWS})`);
      //   continue;
      // }
      
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

      // Extract city from addressComponents
      const city = extractCityFromAddressComponents(place.addressComponents);

      results.push({
        placeId: place.id || "",
        name: place.displayName?.text || query,
        address: place.formattedAddress || "",
        city,
        rating: place.rating?.toString(),
        reviewCount: place.userRatingCount,
        priceLevel,
        photoUrl,
        types: place.types || [],
        location: placeLocation,
        openingHours: place.currentOpeningHours || undefined,
        businessStatus: place.businessStatus || undefined,
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
      // Apply budget filter if provided (only filter if budgetMax is a real number and not user-directed)
      if (!userDirected && budgetMax != null && typeof budgetMax === 'number') {
        const filtered = filterByBudget(combined, budgetMax);
        console.log(`[Budget Filter] ${combined.length} → ${filtered.length} venues after budget filter ($${budgetMax})`);
        return filtered;
      }
      return combined;
    }
    
    // Return original (caller can mutate without affecting cache)
    // Apply budget filter if provided (only filter if budgetMax is a real number and not user-directed)
    if (!userDirected && budgetMax != null && typeof budgetMax === 'number') {
      const filtered = filterByBudget(results, budgetMax);
      console.log(`[Budget Filter] ${results.length} → ${filtered.length} venues after budget filter ($${budgetMax})`);
      return filtered;
    }
    return results;
  } catch (error) {
    console.error("Error searching Google Places:", error);
    // Cache empty result to avoid retrying failed searches (skip for user-directed)
    if (!userDirected) {
      sessionCache.searchResults.set(cacheKey, []);
    }
    
    // Even if API fails, return curated results if we have them
    if (curatedResults.length > 0) {
      console.log(`[Cache-First] API failed, returning ${curatedResults.length} curated venues as fallback`);
      // Apply budget filter if provided (only filter if budgetMax is a real number and not user-directed)
      if (!userDirected && budgetMax != null && typeof budgetMax === 'number') {
        const filtered = filterByBudget(curatedResults, budgetMax);
        console.log(`[Budget Filter] ${curatedResults.length} → ${filtered.length} venues after budget filter ($${budgetMax})`);
        return filtered;
      }
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
      'places.addressComponents',
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

      // Extract city from addressComponents
      const city = extractCityFromAddressComponents(place.addressComponents);

      results.push({
        placeId: place.id || "",
        name: place.displayName?.text || query,
        address: place.formattedAddress || "",
        city,
        rating: place.rating?.toString(),
        reviewCount: place.userRatingCount,
        priceLevel,
        photoUrl,
        types: place.types || [],
        location: placeLocation,
        openingHours: place.currentOpeningHours || undefined,
        businessStatus: place.businessStatus || undefined,
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
    // Log cache hit
    await logApiCall({
      service: 'google_places',
      method: 'placeDetails',
      cacheStatus: 'hit',
      status: 'success',
      responseTimeMs: 0,
      costEstimate: 0,
      parameters: { placeId },
      metadata: { cacheType: 'session' },
    });
    const cached = sessionCache.placeDetails.get(placeId);
    // Return deep copy to prevent mutation
    return cached ? clonePlaceResult(cached) : null;
  }

  // Check database cache (persistent, 30-day TTL)
  const dbCached = await getPlaceDetailsFromDB(placeId);
  if (dbCached) {
    // Log cache hit
    await logApiCall({
      service: 'google_places',
      method: 'placeDetails',
      cacheStatus: 'hit',
      status: 'success',
      responseTimeMs: 0,
      costEstimate: 0,
      parameters: { placeId },
      metadata: { cacheType: 'database', placeName: dbCached.name },
    });
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
      'addressComponents',
      'rating',
      'userRatingCount',
      'priceLevel',
      'photos',
      'types',
      'location',
    ].join(',');

    const startTime = Date.now();
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    });
    const responseTimeMs = Date.now() - startTime;

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
      // Log API call failure
      await logApiCall({
        service: 'google_places',
        method: 'placeDetails',
        cacheStatus: 'miss',
        status: 'error',
        responseTimeMs,
        costEstimate: calculateGooglePlacesCost('placeDetails'),
        parameters: { placeId },
        errorMessage: errorDetails,
      });
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

    // Extract city from addressComponents
    const city = extractCityFromAddressComponents(place.addressComponents);

    const result = {
      placeId: place.id || "",
      name: place.displayName?.text || "",
      address: place.formattedAddress || "",
      city,
      rating: place.rating?.toString(),
      reviewCount: place.userRatingCount,
      priceLevel,
      photoUrl,
      types: place.types || [],
      location: placeLocation,
    };

    // Log successful API call
    await logApiCall({
      service: 'google_places',
      method: 'placeDetails',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: calculateGooglePlacesCost('placeDetails'),
      parameters: { placeId },
      metadata: { placeName: result.name },
    });

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
