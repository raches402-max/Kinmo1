/**
 * Google Places API Stub for V2
 *
 * This stub replaces live Google Places API calls with no-ops or cached-data-only responses.
 * Use this when:
 *   - Running locally without Google Places API keys
 *   - Running in CI/staging
 *   - V2 development before replacing Places with an alternative
 *
 * To use: In routes.ts, replace imports from "./google-places" with "./google-places-stub"
 * (Or swap at the import level once we're ready to fully cut over.)
 */

export interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  vicinity?: string;
  geometry?: { location: { lat: number; lng: number } };
  rating?: number;
  price_level?: number;
  types?: string[];
  photos?: Array<{ photo_reference: string; height: number; width: number }>;
  website?: string;
  formatted_phone_number?: string;
  opening_hours?: { open_now?: boolean; weekday_text?: string[] };
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
  placeId?: string;
}

export interface GoogleMapsUrlResult {
  placeId?: string;
  name?: string;
  lat?: number;
  lng?: number;
  query?: string;
}

export interface VenueValidationResult {
  isValid: boolean;
  reason?: string;
  placeDetails?: PlaceResult;
}

// No-op stubs — return empty/null so routes gracefully degrade
export async function searchPlaces(): Promise<PlaceResult[]> {
  console.log("[google-places-stub] searchPlaces called — stub mode, returning []");
  return [];
}

export async function searchNearbyPlaces(): Promise<PlaceResult[]> {
  console.log("[google-places-stub] searchNearbyPlaces called — stub mode, returning []");
  return [];
}

export async function searchNearbyByTypes(): Promise<PlaceResult[]> {
  console.log("[google-places-stub] searchNearbyByTypes called — stub mode, returning []");
  return [];
}

export async function geocodeLocation(_location: string): Promise<GeocodeResult | null> {
  console.log("[google-places-stub] geocodeLocation called — stub mode, returning null");
  return null;
}

export async function getPlaceDetails(_placeId: string): Promise<PlaceResult | null> {
  console.log("[google-places-stub] getPlaceDetails called — stub mode, returning null");
  return null;
}

export async function detectAndParseGoogleMapsUrl(_query: string): Promise<GoogleMapsUrlResult | null> {
  return null;
}

export async function validateVenuePlaceId(_placeId: string): Promise<VenueValidationResult> {
  return { isValid: false, reason: "Google Places API not configured (stub mode)" };
}

export async function getBestVenueType(_types: string[], _placeId?: string): Promise<string> {
  return "restaurant";
}

export function getBestVenueTypeSync(_types: string[]): string {
  return "restaurant";
}

export function getApiKeyStats() {
  return { key1Calls: 0, key2Calls: 0, stubMode: true };
}

export function clearPlacesCache() {
  // no-op
}

export function getCacheStats() {
  return { size: 0, stubMode: true };
}

export function getMaxPriceLevelForBudget(_budgetMax: number): number {
  return 4;
}

export function filterByBudget(venues: PlaceResult[], _budgetMax: number): PlaceResult[] {
  return venues;
}

export function calculateNameSimilarity(name1: string, name2: string): number {
  return name1.toLowerCase() === name2.toLowerCase() ? 1 : 0;
}

export async function getTimezoneForLocation(_lat: number, _lng: number): Promise<string | null> {
  return null;
}
