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
