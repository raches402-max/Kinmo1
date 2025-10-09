import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client({});

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  rating?: string;
  priceLevel?: string;
  photoUrl?: string;
  types: string[];
  location?: { lat: number; lng: number };
  review?: string; // Short positive review (80-100 chars)
}

export async function searchPlaces(
  query: string,
  location: string
): Promise<PlaceResult[]> {
  try {
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY is not set");
    }

    const response = await client.textSearch({
      params: {
        query: `${query} in ${location}`,
        key: process.env.GOOGLE_PLACES_API_KEY,
      },
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

// Helper function to select and format the best review
function selectBestReview(reviews?: any[]): string | undefined {
  if (!reviews || reviews.length === 0) return undefined;

  // Filter for positive reviews (4-5 stars)
  const positiveReviews = reviews.filter(r => r.rating >= 4);
  if (positiveReviews.length === 0) return undefined;

  // Sort by rating (highest first), then by text length (more detailed reviews)
  const sortedReviews = positiveReviews.sort((a, b) => {
    // Prioritize 5-star reviews
    if (b.rating !== a.rating) return b.rating - a.rating;
    // Then by text length (prefer longer, more detailed reviews)
    return (b.text?.length || 0) - (a.text?.length || 0);
  });

  const bestReview = sortedReviews[0];
  if (!bestReview.text) return undefined;

  // Ensure review is 80-100 chars
  let text = bestReview.text.trim();
  const authorName = bestReview.author_name || "Anonymous";

  // If too short, try to find a longer review
  if (text.length < 80) {
    const longerReview = positiveReviews.find(r => r.text && r.text.trim().length >= 80);
    if (longerReview && longerReview.text) {
      text = longerReview.text.trim();
    } else {
      // No review meets min length - skip this review
      return undefined;
    }
  }

  // Truncate to 80-100 chars at sentence or word boundary
  if (text.length > 100) {
    // Try to cut at sentence boundary
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences[0].length >= 80 && sentences[0].length <= 100) {
      text = sentences[0].trim();
    } else if (sentences && sentences[0].length < 80 && sentences.length > 1) {
      // Accumulate sentences until >= 80 chars
      let accumulated = sentences[0];
      for (let i = 1; i < sentences.length && accumulated.length < 80; i++) {
        accumulated += sentences[i];
      }
      if (accumulated.length <= 100) {
        text = accumulated.trim();
      } else {
        // Cut at word boundary within 80-100 range (max 97 chars + "..." = 100 total)
        text = text.substring(0, 97);
        const lastSpace = text.lastIndexOf(' ');
        if (lastSpace >= 80) {
          text = text.substring(0, lastSpace) + '...';
        } else {
          text = text.substring(0, 97) + '...';
        }
      }
    } else {
      // Cut at word boundary within 80-100 range (max 97 chars + "..." = 100 total)
      text = text.substring(0, 97);
      const lastSpace = text.lastIndexOf(' ');
      if (lastSpace >= 80) {
        text = text.substring(0, lastSpace) + '...';
      } else {
        text = text.substring(0, 97) + '...';
      }
    }
  }

  return `"${text}" - ${authorName}`;
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
        fields: ['place_id', 'name', 'formatted_address', 'rating', 'price_level', 'photos', 'types', 'reviews'],
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
