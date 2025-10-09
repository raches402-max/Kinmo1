import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client({});

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

  // Take top 3 reviews to extract highlights
  const topReviews = sortedReviews.slice(0, 3);
  
  // Extract positive phrases from reviews
  const highlights: string[] = [];
  const positiveKeywords = ['great', 'excellent', 'amazing', 'fantastic', 'love', 'perfect', 'best', 'delicious', 'wonderful', 'awesome', 'recommend', 'favorite'];
  
  for (const review of topReviews) {
    if (!review.text) continue;
    
    // Split into sentences
    const sentences = review.text.match(/[^.!?]+[.!?]+/g) || [review.text];
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      // Check if sentence contains positive keywords
      if (positiveKeywords.some(keyword => lowerSentence.includes(keyword))) {
        // Clean up the sentence
        let highlight = sentence.trim()
          .replace(/^(i |we |they |the |this |it |very |really |so |such )/i, '') // Remove common prefixes
          .replace(/[.!?]+$/, ''); // Remove ending punctuation
        
        // Take first part before comma if too long
        if (highlight.length > 50) {
          const parts = highlight.split(',');
          highlight = parts[0].trim();
        }
        
        // Capitalize first letter
        highlight = highlight.charAt(0).toUpperCase() + highlight.slice(1);
        
        if (highlight.length >= 15 && highlight.length <= 60 && highlights.length < 3) {
          highlights.push(highlight);
        }
      }
      
      if (highlights.length >= 3) break;
    }
    
    if (highlights.length >= 3) break;
  }
  
  // If we couldn't extract enough highlights, use first sentence from best review
  if (highlights.length === 0 && topReviews[0]?.text) {
    const firstSentence = (topReviews[0].text.match(/[^.!?]+[.!?]/) || [topReviews[0].text])[0];
    let highlight = firstSentence.trim().replace(/[.!?]+$/, '');
    if (highlight.length > 60) {
      highlight = highlight.substring(0, 57) + '...';
    }
    highlights.push(highlight);
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
