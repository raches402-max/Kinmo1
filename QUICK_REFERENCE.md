# Google Maps URL Integration - Quick Reference

## Files to Modify

### 1. server/google-places.ts
**What:** Add URL parser function
**Lines:** Insert after imports, before `sessionCache` definition
**Size:** ~100 lines
**Complexity:** Low

**Add this interface:**
```typescript
export interface GoogleMapsUrlResult {
  type: 'place_id' | 'coordinates' | 'text_search' | 'unknown';
  placeId?: string;
  lat?: number;
  lng?: number;
  placeName?: string;
  rawUrl: string;
}
```

**Add this function:**
```typescript
export function detectAndParseGoogleMapsUrl(query: string): GoogleMapsUrlResult | null {
  // See full implementation in GOOGLE_MAPS_INTEGRATION_RESEARCH.md
}
```

---

### 2. server/routes.ts
**What:** Modify search-venues endpoint to use URL parser
**Lines:** ~4618-4659
**Size:** ~20 lines added
**Complexity:** Low

**Changes:**
```typescript
// After line 4634, add:
const parsedUrl = detectAndParseGoogleMapsUrl(searchQuery);

// Before calling searchPlaces(), check parsed URL and route appropriately
if (parsedUrl?.type === 'place_id') {
  const placeResult = await getPlaceDetails(parsedUrl.placeId!);
  results = placeResult ? [placeResult] : [];
} else if (parsedUrl?.type === 'coordinates') {
  results = await searchNearbyPlaces(
    parsedUrl.placeName || 'restaurant',
    { lat: parsedUrl.lat!, lng: parsedUrl.lng! },
    805
  );
} else {
  // Original text search logic
  results = await searchPlaces(...);
}
```

---

### 3. client/src/pages/group-detail.tsx
**What:** Optional - Add UI hint for Google Maps URLs
**Lines:** ~856 (search input)
**Size:** ~5 lines
**Complexity:** Optional

**Update placeholder:**
```typescript
placeholder="Search venues or paste a Google Maps link..."
```

**Optional visual feedback:**
```typescript
{venueSearchQuery.includes('google.com/maps') && (
  <div className="text-sm text-green-600">Google Maps URL detected</div>
)}
```

---

## Testing URLs

### Place ID Extraction (Most Common)
```
https://www.google.com/maps/place/Chick-fil-A/@37.7749,-122.4194,17z/data=!4m6!3m5!1sChIJK7c7FVZ9j4ARkJqt_g5FKSg!8m2!3d37.7749!4d-122.4194
```
Expected: Place ID `ChIJK7c7FVZ9j4ARkJqt_g5FKSg` extracted, direct lookup

### Coordinates Extraction
```
https://www.google.com/maps/search/cafe/@37.7749,-122.4194,15z
```
Expected: Coordinates 37.7749, -122.4194 extracted, nearby search

### Text Search Extraction
```
https://www.google.com/maps/search/coffee+shop+san+francisco
```
Expected: Text "coffee shop san francisco" extracted, text search

### Text Query (Fallback)
```
coffee shops
```
Expected: Original text search behavior, no URL parsing

---

## Key Functions (Already Exist)

```typescript
// In google-places.ts

// Get full details for a place ID (with caching)
export async function getPlaceDetails(placeId: string): Promise<PlaceResult | null>

// Search nearby places around coordinates
export async function searchNearbyPlaces(
  query: string,
  nearLocation: { lat: number; lng: number },
  radiusMeters: number = 805,
  minRating: number = 3.5
): Promise<PlaceResult[]>

// Original text search
export async function searchPlaces(
  query: string,
  location: string,
  radiusMiles: number = 2,
  coordinates?: { lat: number; lng: number },
  ...
): Promise<PlaceResult[]>
```

---

## URL Format Patterns

```
CID:      cid=(\d+)
Place ID: data=.*?!1s([^!]+)
Coords:   @([\d\.\-]+),([\d\.\-]+)
Search:   /maps/search/([^/]+)
Place:    /maps/place/([^/@]+)/
```

---

## Return Format (Same for All)

```typescript
interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  city?: string;
  rating?: string;
  reviewCount?: number;
  priceLevel?: string;
  photoUrl?: string;
  types: string[];
  location?: { lat: number; lng: number };
}

// Endpoint returns top 10:
{
  results: PlaceResult[]
}
```

---

## Performance Expectations

| Operation | Cache | API Call |
|-----------|-------|----------|
| Place ID lookup (hit) | 1-10ms | - |
| Place ID lookup (miss) | - | 200-500ms |
| Nearby search (hit) | 20-50ms | - |
| Nearby search (miss) | - | 300-600ms |
| Text search (hit) | 50-100ms | - |
| Text search (miss) | - | 400-800ms |

---

## Error Handling

```typescript
// If URL parsing returns null → treat as text search
if (parsedUrl === null) {
  results = await searchPlaces(searchQuery, ...);
}

// If Place ID lookup returns null → empty results
if (placeResult === null) {
  results = [];
}

// If Nearby search returns [] → return empty array
// If Text search returns [] → return empty array
```

---

## Backward Compatibility

Text search continues to work:
- `searchVenues.ts` endpoint signature unchanged
- Return format unchanged
- No breaking changes to frontend

---

## Import Statements

In routes.ts, add import at top:
```typescript
import { detectAndParseGoogleMapsUrl } from "./google-places";
```

---

## Common URL Patterns Users Will Share

### Shared from browser location bar
```
https://www.google.com/maps/place/Chick-fil-A/@37.7749,-122.4194,17z/data=!4m6!3m5!1sChIJK7c7FVZ9j4ARkJqt_g5FKSg!8m2!3d37.7749!4d-122.4194?entry=ttu
```
Your parser extracts: Place ID

### Shared from "Share" button in Maps app
```
https://maps.app.goo.gl/ABC123DEFGH456JKL
```
Your parser recognizes as: Shortened link, falls back to text search

### Shared from search results
```
https://www.google.com/maps/search/coffee/@37.7749,-122.4194,15z
```
Your parser extracts: Coordinates

---

## Logging to Add

In your URL parser:
```typescript
console.log(`[URL Parser] Detected: ${parsedUrl.type}`);
console.log(`[URL Parser] Extracted: placeId=${parsedUrl.placeId}, lat=${parsedUrl.lat}, lng=${parsedUrl.lng}`);
```

In search endpoint:
```typescript
console.log(`[Search] Detected Google Maps URL: ${parsedUrl.type}`);
```

---

## Quick Deployment

1. Update google-places.ts (add 100 lines)
2. Update routes.ts (modify 20 lines)
3. Deploy

Optional later:
4. Update group-detail.tsx (add 5 lines)

---

## Troubleshooting

**Issue:** URL parsing returns null but should extract something
**Solution:** Check URL format matches patterns in GOOGLE_MAPS_INTEGRATION_RESEARCH.md

**Issue:** Place ID lookup returns null
**Solution:** Verify Place ID is valid format, check API key permissions

**Issue:** Results different between Place ID lookup and text search
**Solution:** Expected - Place ID gives exact result, text search returns multiple

**Issue:** Coordinates not being extracted
**Solution:** Check URL contains @LAT,LNG pattern before any ? or #

---

## Files Already Checked

These functions already exist and work:
- `getPlaceDetails()` - ready to use
- `searchNearbyPlaces()` - ready to use
- `searchPlaces()` - ready to use
- `geocodeLocation()` - ready to use
- Caching infrastructure - ready to use

---

## Next Steps

1. Read full implementation in GOOGLE_MAPS_INTEGRATION_RESEARCH.md
2. Copy URL parser function to google-places.ts
3. Copy search endpoint modification to routes.ts
4. Test with the provided test URLs
5. (Optional) Add UI polish to group-detail.tsx
6. Deploy!

