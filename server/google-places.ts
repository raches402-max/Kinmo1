import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client({});

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
      return null;
    }

    const result = response.data.results[0];
    const { lat, lng } = result.geometry.location;

    // Fetch timezone for the coordinates
    const timezone = await getTimezoneForLocation(lat, lng);

    return {
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formatted_address,
      timezone: timezone || undefined,
    };
  } catch (error) {
    console.error("Error geocoding location:", error);
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

export async function searchPlaces(
  query: string,
  location: string,
  radiusMiles: number = 2,
  coordinates?: { lat: number; lng: number }
): Promise<PlaceResult[]> {
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
      return [];
    }

    // Get first result
    const place = response.data.results[0];
    
    // Fetch full details including reviews if we have a place ID
    if (place.place_id) {
      const detailedPlace = await getPlaceDetails(place.place_id);
      if (detailedPlace) {
        // Add location from text search (not in place details)
        const placeLocation = place.geometry?.location 
          ? { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
          : undefined;
        
        return [{
          ...detailedPlace,
          location: placeLocation,
        }];
      }
    }

    // Fallback to basic data if details fetch fails
    let photoUrl: string | undefined;
    if (place.photos && place.photos.length > 0) {
      const photoReference = place.photos[0].photo_reference;
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    }

    const placeLocation = place.geometry?.location 
      ? { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
      : undefined;

    return [{
      placeId: place.place_id || "",
      name: place.name || query,
      address: place.formatted_address || "",
      rating: place.rating?.toString(),
      priceLevel: place.price_level?.toString(),
      photoUrl,
      types: place.types || [],
      location: placeLocation,
    }];
  } catch (error) {
    console.error("Error searching Google Places:", error);
    // Return empty array instead of throwing to allow the app to continue
    return [];
  }
}

export async function searchNearbyPlaces(
  query: string,
  nearLocation: { lat: number; lng: number },
  radiusMeters: number = 805,
  minRating: number = 3.5
): Promise<PlaceResult[]> {
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
      return [];
    }

    const results: PlaceResult[] = [];
    for (const place of response.data.results) {
      if (place.rating && place.rating >= minRating) {
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
    }

    return results;
  } catch (error) {
    console.error("Error searching nearby places:", error);
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
  try {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        key: process.env.GOOGLE_PLACES_API_KEY,
        fields: ['place_id', 'name', 'formatted_address', 'rating', 'user_ratings_total', 'price_level', 'photos', 'types', 'reviews'],
      },
    });

    const place = response.data.result;
    if (!place) return null;

    let photoUrl: string | undefined;
    if (place.photos && place.photos.length > 0) {
      const photoReference = place.photos[0].photo_reference;
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    }

    // Select best review
    const review = selectBestReview(place.reviews);

    return {
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
  } catch (error) {
    console.error("Error getting place details:", error);
    return null;
  }
}
