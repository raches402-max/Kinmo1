import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client({});

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

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  timezone?: string;
}

export async function getTimezoneForLocation(lat: number, lng: number): Promise<string | null> {
  try {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const response = await client.timezone({
      params: {
        location: { lat, lng },
        timestamp,
        key: process.env.GOOGLE_PLACES_API_KEY,
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
  // Check cache first
  if (sessionCache.geocodeResults.has(location)) {
    sessionCache.stats.geocodeHits++;
    console.log(`[Google Places Cache] HIT - geocode for "${location}"`);
    return sessionCache.geocodeResults.get(location)!;
  }

  sessionCache.stats.geocodeMisses++;
  console.log(`[Google Places Cache] MISS - fetching geocode for "${location}"`);

  try {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const response = await client.geocode({
      params: {
        address: location,
        key: process.env.GOOGLE_PLACES_API_KEY,
      },
    });

    if (!response.data.results || response.data.results.length === 0) {
      console.error(`Geocoding failed for location: ${location}`);
      sessionCache.geocodeResults.set(location, null);
      return null;
    }

    const result = response.data.results[0];
    const { lat, lng } = result.geometry.location;

    // Fetch timezone for the coordinates
    const timezone = await getTimezoneForLocation(lat, lng);

    const geocodeResult = {
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address,
      timezone: timezone || undefined,
    };

    // Cache the result
    sessionCache.geocodeResults.set(location, geocodeResult);
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
  
  // Check cache first
  if (sessionCache.searchResults.has(cacheKey)) {
    sessionCache.stats.searchHits++;
    console.log(`[Google Places Cache] HIT - searchPlaces for "${query}"`);
    const cached = sessionCache.searchResults.get(cacheKey)!;
    // Return deep copy to prevent mutation
    return cached.map(result => clonePlaceResult(result));
  }

  sessionCache.stats.searchMisses++;
  console.log(`[Google Places Cache] MISS - fetching searchPlaces for "${query}"`);

  try {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    // Convert miles to meters (1 mile = 1609.34 meters)
    const radiusMeters = Math.round(radiusMiles * 1609.34);

    // If coordinates are provided, use them for more precise search
    const searchParams: any = {
      query: coordinates ? query : `${query} in ${location}`,
      key: process.env.GOOGLE_PLACES_API_KEY,
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
    const results: PlaceResult[] = [];
    
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
      
      // Fetch full details including reviews if we have a place ID
      if (place.place_id) {
        const detailedPlace = await getPlaceDetails(place.place_id);
        if (detailedPlace) {
          // Filter out places with fewer than 50 reviews
          const MIN_REVIEWS = 50;
          if (!detailedPlace.reviewCount || detailedPlace.reviewCount < MIN_REVIEWS) {
            console.log(`[Google Places] Filtering out "${detailedPlace.name}" - only ${detailedPlace.reviewCount || 0} reviews (minimum: ${MIN_REVIEWS})`);
            continue;
          }
          
          // Add location from text search (not in place details)
          const placeLocationCoords = placeLocation 
            ? { lat: placeLocation.lat, lng: placeLocation.lng }
            : undefined;
          
          results.push({
            ...detailedPlace,
            location: placeLocationCoords,
          });
          continue; // Successfully added detailed place
        }
      }

      // Fallback to basic data if details fetch fails
      let photoUrl: string | undefined;
      if (place.photos && place.photos.length > 0) {
        const photoReference = place.photos[0].photo_reference;
        photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
      }

      const fallbackLocation = placeLocation 
        ? { lat: placeLocation.lat, lng: placeLocation.lng }
        : undefined;

      results.push({
        placeId: place.place_id || "",
        name: place.name || query,
        address: place.formatted_address || "",
        rating: place.rating?.toString(),
        priceLevel: place.price_level?.toString(),
        photoUrl,
        types: place.types || [],
        location: fallbackLocation,
      });
    }

    console.log(`[Google Places] Processed ${results.length} valid results`);

    // Cache a clone to prevent mutations from affecting cached data
    sessionCache.searchResults.set(cacheKey, results.map(r => clonePlaceResult(r)));
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
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const response = await client.placesNearby({
      params: {
        location: nearLocation,
        radius: radiusMeters,
        keyword: query,
        key: process.env.GOOGLE_PLACES_API_KEY,
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
        photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
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
  // Check cache first
  if (sessionCache.placeDetails.has(placeId)) {
    sessionCache.stats.placeDetailsHits++;
    console.log(`[Google Places Cache] HIT - placeDetails for ${placeId}`);
    const cached = sessionCache.placeDetails.get(placeId);
    // Return deep copy to prevent mutation
    return cached ? clonePlaceResult(cached) : null;
  }

  sessionCache.stats.placeDetailsMisses++;
  console.log(`[Google Places Cache] MISS - fetching placeDetails for ${placeId}`);

  try {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        key: process.env.GOOGLE_PLACES_API_KEY,
        fields: ['place_id', 'name', 'formatted_address', 'rating', 'user_ratings_total', 'price_level', 'photos', 'types', 'reviews', 'business_status'],
      },
    });

    const place = response.data.result;
    if (!place) {
      sessionCache.placeDetails.set(placeId, null);
      return null;
    }

    // Filter out permanently closed businesses
    if (place.business_status === 'CLOSED_PERMANENTLY') {
      console.log(`[Google Places] Filtering out permanently closed business: ${place.name}`);
      sessionCache.placeDetails.set(placeId, null);
      return null;
    }

    let photoUrl: string | undefined;
    if (place.photos && place.photos.length > 0) {
      const photoReference = place.photos[0].photo_reference;
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    }

    // Select best review
    const review = selectBestReview(place.reviews);

    const result = {
      placeId: place.place_id || "",
      name: place.name || "",
      address: place.formatted_address || "",
      rating: place.rating?.toString(),
      reviewCount: place.user_ratings_total,
      priceLevel: place.price_level?.toString(),
      photoUrl,
      types: place.types || [],
      review,
    };

    // Cache a clone to prevent mutations from affecting cached data
    sessionCache.placeDetails.set(placeId, clonePlaceResult(result));

    // Return the original (caller can mutate this without affecting cache)
    return result;
  } catch (error) {
    console.error("Error getting place details:", error);
    sessionCache.placeDetails.set(placeId, null);
    return null;
  }
}
