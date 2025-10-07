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
    
    let photoUrl: string | undefined;
    if (place.photos && place.photos.length > 0) {
      const photoReference = place.photos[0].photo_reference;
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    }

    return [{
      placeId: place.place_id || "",
      name: place.name || query,
      address: place.formatted_address || "",
      rating: place.rating?.toString(),
      priceLevel: place.price_level?.toString(),
      photoUrl,
      types: place.types || [],
    }];
  } catch (error) {
    console.error("Error searching Google Places:", error);
    // Return empty array instead of throwing to allow the app to continue
    return [];
  }
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
      },
    });

    const place = response.data.result;
    if (!place) return null;

    let photoUrl: string | undefined;
    if (place.photos && place.photos.length > 0) {
      const photoReference = place.photos[0].photo_reference;
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    }

    return {
      placeId: place.place_id || "",
      name: place.name || "",
      address: place.formatted_address || "",
      rating: place.rating?.toString(),
      priceLevel: place.price_level?.toString(),
      photoUrl,
      types: place.types || [],
    };
  } catch (error) {
    console.error("Error getting place details:", error);
    return null;
  }
}
