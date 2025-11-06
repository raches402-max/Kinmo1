# Google Maps URL Integration Research

## 1. Google Maps URL Format Analysis

### Common Google Maps URL Formats

**Format 1: Maps Place Search (CID-based)**
```
https://www.google.com/maps/place/?cid=PLACE_CID
https://maps.google.com/maps?cid=PLACE_CID
Example: https://www.google.com/maps/place/?cid=7484027789456789
```
- Contains `cid=` parameter with a numeric ID
- This is a legacy format (CID = Civic ID)
- Not reliable as primary identifier

**Format 2: Maps Place ID (Modern Format)**
```
https://www.google.com/maps/place/PLACE_NAME/@LAT,LNG,ZOOM/data=!4m6!3m5!1s0x1234567:0x123456789!8m2!3d37.7749!4d-122.4194?entry=s
```
- Contains place name and coordinates
- Place ID is embedded: `0x1234567:0x123456789`
- URL structure: `@LAT,LNG,ZOOM/data=!4m6!3m5!1s{PLACE_ID}`

**Format 3: Maps Search by Coordinates**
```
https://www.google.com/maps/search/restaurant/@37.7749,-122.4194,15z
https://maps.google.com/?q=loc:37.7749,-122.4194
```
- Contains coordinates after `@`
- Can search by location or place ID

**Format 4: Maps Text Search**
```
https://www.google.com/maps/search/coffee+shop+san+francisco
```
- Simple text search format
- No place ID included

**Format 5: Direct Place URL (Modern)**
```
https://www.google.com/maps/place/Chick-fil-A/@37.777,-122.419,17z/data=!4m6!3m5!1s0x80858f7c7d8c7d8d:0xd8f8c7d8d8c7d8d8!8m2!3d37.777!4d-122.419
```
- Includes place name and place ID in `data` parameter
- Place ID format: `0xHEXADECIMAL:0xHEXADECIMAL`

**Format 6: Google Maps Share Link**
```
https://maps.app.goo.gl/SHARE_CODE
https://goo.gl/maps/SHARE_CODE
```
- Shortened URL with share code
- Requires URL expansion to get actual place info

### Place ID Extraction Patterns

| URL Type | Place ID Location | Pattern |
|----------|-------------------|---------|
| CID Format | `cid=NUMERIC_ID` | `cid=(\d+)` |
| Data Format | In `data=` param | `!1s([^!]+)` or `data=.*?1s([^!]+)` |
| Coordinates | In `@` notation | `@([\d\.\-,]+,[\d\.\-,]+)` |
| Place name | In path or query | `/maps/place/([^/@]+)/` |

---

## 2. Google Places API Place ID Handling

### Using Google Places API v2 (New API)

The codebase is already using Google Places API v2, which supports:

**Getting Place Details by Place ID:**
```typescript
GET https://places.googleapis.com/v1/places/{PLACE_ID}
```

Headers required:
```
X-Goog-Api-Key: {API_KEY}
X-Goog-FieldMask: id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,photos,types
```

Example Place ID formats accepted:
- `ChIJIQBpAG2ahYAR_6128GltTXQ` (Google Places IDs)
- `0xHEX:0xHEX` (Older format, may not work with v2)

### Existing Functions

The codebase already has:

1. **`getPlaceDetails(placeId: string)`** in `/home/runner/workspace/server/google-places.ts`
   - Accepts a place ID
   - Returns full `PlaceResult` object
   - Caches results (session + database, 30-day TTL)
   - Handles photo URLs, ratings, price levels, etc.

2. **`searchPlaces(query, location, radius, ...)`**
   - Currently requires text query
   - Could be enhanced to detect URLs

3. **`geocodeLocation(location: string)`**
   - Converts address to coordinates
   - Already caches results

### Key Code Section (google-places.ts lines 1618-1750)

```typescript
export async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  // Check session cache first (fastest)
  if (sessionCache.placeDetails.has(placeId)) {
    sessionCache.stats.placeDetailsHits++;
    console.log(`[Session Cache] HIT - placeDetails for ${placeId}`);
    const cached = sessionCache.placeDetails.get(placeId);
    return cached ? clonePlaceResult(cached) : null;
  }

  // Check database cache (persistent, 30-day TTL)
  const dbCached = await getPlaceDetailsFromDB(placeId);
  if (dbCached) {
    sessionCache.placeDetails.set(placeId, clonePlaceResult(dbCached));
    sessionCache.stats.placeDetailsHits++;
    return clonePlaceResult(dbCached);
  }

  sessionCache.stats.placeDetailsMisses++;
  console.log(`[API Call] MISS - fetching placeDetails for ${placeId}`);

  try {
    const apiKey = getNextApiKey();
    
    // NEW PLACES API: Place Details endpoint
    const endpoint = `https://places.googleapis.com/v1/places/${placeId}`;
    
    const fieldMask = [
      'id', 'displayName', 'formattedAddress', 'addressComponents',
      'rating', 'userRatingCount', 'priceLevel', 'photos', 'types', 'location'
    ].join(',');

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    });
    
    // ... Processing and caching
  }
}
```

**Status:** This function is production-ready! Already:
- Uses Google Places API v2
- Has multi-layer caching (session + database)
- Returns standardized `PlaceResult` format
- Handles photos, ratings, prices, etc.

---

## 3. Current Search Flow

### Server Endpoint (routes.ts lines 4618-4659)
```typescript
app.get("/api/groups/:groupId/search-venues", async (req, res) => {
  const { query } = req.query;
  
  // Use Google Places Text Search with group location as context
  const searchQuery = query.trim();
  const location = group.locationBase;
  const radius = group.searchRadius || 10;
  
  const results = await searchPlaces(
    searchQuery, 
    location, 
    radius, 
    coordinates, 
    false, 
    undefined, 
    group.budgetMax, 
    undefined, 
    true
  );
  
  return top 10 results with: placeId, name, address, photoUrl, rating, reviewCount, types
});
```

### Client-Side Implementation (group-detail.tsx lines 850-879)
```typescript
const { data: venueSearchResults = [] } = useQuery<any[]>({
  queryKey: ["/api/groups", groupId, "search-venues", debouncedVenueSearchQuery.trim()],
  queryFn: async () => {
    if (!debouncedVenueSearchQuery.trim() || debouncedVenueSearchQuery.trim().length < 2) {
      return [];
    }
    const response = await fetch(`/api/groups/${groupId}/search-venues?query=${encodeURIComponent(debouncedVenueSearchQuery.trim())}`);
    const data = await response.json();
    return data.results || [];
  },
  enabled: !!groupId && debouncedVenueSearchQuery.trim().length >= 2,
  staleTime: 30000, // Cache for 30 seconds
});
```

---

## 4. Implementation Plan

### Phase 1: URL Detection & Parsing (Backend)

**Location:** Add new function in `/home/runner/workspace/server/google-places.ts`

```typescript
export interface GoogleMapsUrlResult {
  type: 'place_id' | 'coordinates' | 'text_search' | 'share_link' | 'unknown';
  placeId?: string;
  lat?: number;
  lng?: number;
  placeName?: string;
  rawUrl: string;
}

export function detectAndParseGoogleMapsUrl(query: string): GoogleMapsUrlResult | null {
  // Return null if not a URL-like string
  if (!query.includes('google.com/maps') && !query.includes('goo.gl/maps') && !query.includes('maps.app.goo.gl')) {
    return null;
  }

  try {
    const url = new URL(query);
    
    // Pattern 1: CID-based URLs (maps.google.com?cid=NUMERIC_ID)
    const cidMatch = url.search.match(/cid=(\d+)/);
    if (cidMatch) {
      return {
        type: 'text_search',
        placeName: cidMatch[1],
        rawUrl: query,
      };
    }
    
    // Pattern 2: Data-based Place IDs
    // Google Maps stores place ID in the `data` parameter
    // Format: data=!4m6!3m5!1s{PLACE_ID}!...
    const dataParam = url.searchParams.get('data');
    if (dataParam) {
      const placeIdMatch = dataParam.match(/!1s([^!]+)/);
      if (placeIdMatch) {
        return {
          type: 'place_id',
          placeId: placeIdMatch[1],
          rawUrl: query,
        };
      }
    }
    
    // Pattern 3: Coordinate extraction from @ notation
    // Example: https://www.google.com/maps/place/Cafe/@37.7749,-122.4194,17z/...
    const pathMatch = url.pathname.match(/@([\d\.\-]+),([\d\.\-]+)/);
    if (pathMatch) {
      const lat = parseFloat(pathMatch[1]);
      const lng = parseFloat(pathMatch[2]);
      
      // Try to extract place ID from data param
      const placeIdMatch = url.search.match(/!1s([^!]+)/);
      
      return {
        type: placeIdMatch ? 'place_id' : 'coordinates',
        placeId: placeIdMatch ? placeIdMatch[1] : undefined,
        lat,
        lng,
        rawUrl: query,
      };
    }
    
    // Pattern 4: Text search URLs
    // Example: https://www.google.com/maps/search/coffee+shop+san+francisco
    if (url.pathname.includes('/maps/search/')) {
      const searchMatch = url.pathname.match(/\/maps\/search\/([^/]+)/);
      if (searchMatch) {
        return {
          type: 'text_search',
          placeName: decodeURIComponent(searchMatch[1]).replace(/\+/g, ' '),
          rawUrl: query,
        };
      }
    }
    
    // Pattern 5: Place name extraction
    // Example: https://www.google.com/maps/place/Chick-fil-A/@37.777,-122.419
    const placeMatch = url.pathname.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch) {
      const placeName = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
      
      // Try to get coordinates from @ notation
      const coordMatch = url.pathname.match(/@([\d\.\-]+),([\d\.\-]+)/);
      
      return {
        type: 'coordinates',
        placeName,
        lat: coordMatch ? parseFloat(coordMatch[1]) : undefined,
        lng: coordMatch ? parseFloat(coordMatch[2]) : undefined,
        rawUrl: query,
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[URL Parser] Failed to parse URL: ${query}`, error);
    return null;
  }
}
```

### Phase 2: Enhanced Search Handler

**Location:** Modify `/home/runner/workspace/server/routes.ts` - search-venues endpoint

```typescript
app.get("/api/groups/:groupId/search-venues", async (req, res) => {
  try {
    const { query } = req.query;
    const { groupId } = req.params;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.json({ results: [] });
    }

    const group = await storage.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const searchQuery = query.trim();
    const location = group.locationBase;
    const radius = group.searchRadius || 10;
    const coordinates = group.latitude && group.longitude
      ? { lat: parseFloat(group.latitude), lng: parseFloat(group.longitude) }
      : undefined;

    // NEW: Check if input is a Google Maps URL
    const parsedUrl = detectAndParseGoogleMapsUrl(searchQuery);
    
    let results = [];
    
    if (parsedUrl) {
      console.log(`[Search] Detected Google Maps URL: ${parsedUrl.type}`);
      
      switch (parsedUrl.type) {
        case 'place_id':
          // Direct place ID lookup
          const placeResult = await getPlaceDetails(parsedUrl.placeId!);
          if (placeResult) {
            results = [placeResult];
          }
          break;
          
        case 'coordinates':
          // Search around coordinates
          results = await searchNearbyPlaces(
            parsedUrl.placeName || 'restaurant',
            { lat: parsedUrl.lat!, lng: parsedUrl.lng! },
            805 // ~0.5 miles
          );
          break;
          
        case 'text_search':
          // Text search
          results = await searchPlaces(
            parsedUrl.placeName || searchQuery,
            location,
            radius,
            coordinates,
            false,
            undefined,
            group.budgetMax,
            undefined,
            true
          );
          break;
      }
    } else {
      // Original text search flow
      results = await searchPlaces(
        searchQuery,
        location,
        radius,
        coordinates,
        false,
        undefined,
        group.budgetMax,
        undefined,
        true
      );
    }

    const limitedResults = results.slice(0, 10).map(place => ({
      placeId: place.placeId,
      name: place.name,
      address: place.address,
      photoUrl: place.photoUrl,
      rating: place.rating,
      reviewCount: place.reviewCount,
      types: place.types || [],
    }));

    res.json({ results: limitedResults });
  } catch (error: any) {
    console.error("Error searching venues:", error);
    res.status(500).json({ message: error.message });
  }
});
```

### Phase 3: Client UI Enhancement (Optional)

**Location:** Modify `/home/runner/workspace/client/src/pages/group-detail.tsx`

Add helper text or icon to search input:
```typescript
<div className="relative">
  <input
    value={venueSearchQuery}
    onChange={(e) => setVenueSearchQuery(e.target.value)}
    placeholder="Search venues or paste a Google Maps link..."
    className="..."
  />
  {venueSearchQuery.includes('google.com/maps') && (
    <div className="text-sm text-green-600 flex items-center gap-2">
      <MapPin size={14} /> Google Maps URL detected
    </div>
  )}
</div>
```

---

## 5. Implementation Checklist

### Backend Changes
- [ ] Add `detectAndParseGoogleMapsUrl()` function
- [ ] Add `expandShareLink()` helper for shortened URLs (optional, uses API)
- [ ] Enhance `/api/groups/:groupId/search-venues` endpoint
- [ ] Add logging for URL detection
- [ ] Add tests for URL parsing

### Frontend Changes (Optional)
- [ ] Add placeholder text mentioning Google Maps URLs
- [ ] Add visual feedback when URL is detected
- [ ] Add tooltip/help text

### Testing
- [ ] Test with various Google Maps URL formats
- [ ] Verify Place ID extraction accuracy
- [ ] Test coordinate extraction
- [ ] Test text search fallback
- [ ] Verify caching works across all flows
- [ ] Test error handling for invalid URLs

---

## 6. Expected Behavior

### Example Flows

**User pastes:** `https://www.google.com/maps/place/Chick-fil-A/@37.7749,-122.4194,17z/data=!4m6!3m5!1sChIJK7c7FVZ9j4ARkJqt_g5FKSg!8m2!3d37.7749!4d-122.4194`

**Expected:** 
1. Parser extracts Place ID: `ChIJK7c7FVZ9j4ARkJqt_g5FKSg`
2. Calls `getPlaceDetails('ChIJK7c7FVZ9j4ARkJqt_g5FKSg')`
3. Returns exact Chick-fil-A location with full details
4. Cache hit on future requests

**User pastes:** `https://www.google.com/maps/search/coffee+near+san+francisco`

**Expected:**
1. Parser extracts search text: "coffee near san francisco"
2. Falls back to text search
3. Returns top 10 coffee shops in SF area

**User pastes:** `https://maps.app.goo.gl/ABC123`

**Expected:**
1. Recognize as shortened share link
2. Could optionally expand (requires extra API call)
3. Fall back to text search if expansion fails

---

## 7. Advantages of This Approach

1. **Reuses Existing API Integration**: `getPlaceDetails()` already exists and is production-ready
2. **Zero Additional API Costs**: Uses existing credentials, leverages caching
3. **Backward Compatible**: Text search still works as before
4. **Multiple URL Formats Supported**: Handles CID, place ID, coordinates, text search
5. **Cache-Aware**: Respects existing 30-day Place Details cache
6. **Graceful Fallback**: If URL parsing fails, defaults to text search
7. **No Front-End Changes Needed**: Works entirely on backend

---

## 8. Risk Mitigation

**Risk:** Place ID format changes in Google Maps URLs
**Mitigation:** Gracefully fall back to text search

**Risk:** Share link expansion requires API call
**Mitigation:** Make expansion optional, detect and skip if not available

**Risk:** URL parsing regex becomes brittle
**Mitigation:** Use `URL()` constructor for base parsing, only regex for parameters

**Risk:** Old CID format won't work with Google Places API v2
**Mitigation:** Try to use as search text or coordinates instead

---

## 9. Future Enhancements

1. **Batch URL Processing**: Handle multiple URLs in one request
2. **URL Validation**: Ping Google to validate place exists before returning
3. **Direct Maps Link Generation**: When creating activities, generate shareable Google Maps links
4. **Place Autocomplete**: Use Google Places Autocomplete for search suggestions (requires different API)
5. **Location Permissions**: Show venue on map directly instead of requiring second Maps lookup

