# Activity Search Bar & Google Maps Link Implementation

## Overview
The application has a complete implementation for searching venues/activities and handling Google Maps links. The system supports both direct Google Maps URL parsing and traditional text search.

---

## 1. CLIENT-SIDE COMPONENTS

### Activity Search Component
**Location:** `/home/runner/workspace/client/src/pages/group-detail.tsx` (lines 5950-6175)

#### Search Input Field
```tsx
// Lines 5967-5977
<div className="relative max-w-xl">
  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    type="text"
    placeholder="Search for parks, restaurants, cafes, or any venue..."
    value={venueSearchQuery}
    onChange={(e) => setVenueSearchQuery(e.target.value)}
    className="pl-9"
    data-testid="input-venue-search"
  />
</div>
```

- Uses text input with search icon
- Placeholder text encourages various venue types
- Debounced search with `debouncedVenueSearchQuery` state
- Minimum 2 characters to trigger search

#### Search State Management
- **Search Query State:** `venueSearchQuery` (line 669)
- **Debounced Query:** `debouncedVenueSearchQuery` (lines 937-941)
- **Debounce Delay:** 500ms

#### React Query Integration
```tsx
// Lines 850-856
const { data: venueSearchResults = [] } = useQuery<any[]>({
  queryKey: ["/api/groups", groupId, "search-venues", debouncedVenueSearchQuery.trim()],
  enabled: debouncedVenueSearchQuery.trim().length >= 2,
  queryFn: async () => {
    const response = await fetch(`/api/groups/${groupId}/search-venues?query=${encodeURIComponent(debouncedVenueSearchQuery.trim())}`);
    if (!response.ok) throw new Error('Failed to fetch venues');
    return response.json().then(data => data.results || []);
  },
});
```

#### Search Results Display
- Grid layout (1 column on mobile, 2 on tablet, 3 on desktop)
- Shows venue photo, name, rating, review count, address
- Two action buttons per result:
  - **Favorite Button:** Adds to group favorites (voting event)
  - **Add to Cart Button:** Adds to itinerary cart (max 5 venues)

### Venue Links to Google Maps
The application generates Google Maps links in multiple places:

1. **Event Details Page** (`/home/runner/workspace/client/src/pages/event-details.tsx`, line 275-284)
```tsx
<a
  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.venueName || venue.venueAddress || 'Location')}&query_place_id=${venue.googlePlaceId}`}
  target="_blank"
  rel="noopener noreferrer"
  className="text-sm text-primary hover:underline flex items-center gap-1"
>
  <ExternalLink className="h-3 w-3" />
  View on Google Maps
</a>
```

2. **Dashboard** (line 1010)
3. **SwipeCard Component** (lines 64-66)
4. **Group Detail Page** (multiple locations: 565, 3026, 3029, 3210, 3213, 5060, 5261, 5617, 6495, 6582)

**URL Pattern:** 
```
https://www.google.com/maps/search/?api=1&query={PLACE_NAME}&query_place_id={PLACE_ID}
```

---

## 2. SERVER-SIDE IMPLEMENTATION

### API Endpoints

#### Search Venues Endpoint
**Location:** `/home/runner/workspace/server/routes.ts` (lines 4618-4659)

```typescript
app.get("/api/groups/:groupId/search-venues", async (req, res) => {
  // Extracts query parameter
  // Gets group location and radius context
  // Calls searchPlaces() with:
  //   - searchQuery: user input
  //   - location: group's locationBase
  //   - radius: group's searchRadius or 10 miles
  //   - coordinates: group lat/lng if available
  //   - forceComprehensiveSearch: true (user-initiated search)
  // Returns top 10 results with placeId, name, address, photoUrl, rating, reviewCount, types
})
```

### Google Places Integration

**Location:** `/home/runner/workspace/server/google-places.ts`

#### Key Functions

##### 1. detectAndParseGoogleMapsUrl()
**Lines 991-1137**

Parses various Google Maps URL formats to extract place IDs, coordinates, or search text:

**Supported URL Patterns:**

1. **CID-based URLs (Legacy)**
   - Format: `maps.google.com?cid=NUMERIC_ID`
   - Returns: `type: 'text_search'`

2. **Data-based Place IDs (Modern)**
   - Format: `maps.google.com/maps/place/Name/@lat,lng/data=!4m6!3m5!1s{PLACE_ID}`
   - Extracts: Place ID with `ChIJ` prefix (validates format)
   - Returns: `type: 'place_id'` with placeId

3. **Coordinate Extraction**
   - Format: `https://www.google.com/maps/place/Cafe/@37.7749,-122.4194,17z/`
   - Extracts: Coordinates from `@` notation
   - Returns: `type: 'coordinates'` with lat, lng, placeName

4. **Text Search URLs**
   - Format: `https://www.google.com/maps/search/coffee+shop+san+francisco`
   - Extracts: Search query from pathname
   - Returns: `type: 'text_search'` with placeName

5. **Place Name Extraction (Fallback)**
   - Format: `https://www.google.com/maps/place/Chick-fil-A/@37.777,-122.419`
   - Extracts: Place name from `/maps/place/{NAME}`
   - Returns: `type: 'text_search'` with placeName

6. **Shortened Share Links**
   - Format: `https://maps.app.goo.gl/ABC123`
   - Behavior: Follows redirect and recursively parses full URL
   - Returns: Result from full URL parsing

**Return Type:**
```typescript
interface GoogleMapsUrlResult {
  type: 'place_id' | 'coordinates' | 'text_search' | 'share_link' | 'unknown';
  placeId?: string;
  lat?: number;
  lng?: number;
  placeName?: string;
  rawUrl: string;
}
```

**Example Parsing:**
```
Input:  "https://www.google.com/maps/place/Supreme+Dumplings/@37.7947,-122.3960,17z/data=!4m6!3m5!1sChIJnx-fPM-AhYAR_H-cHOAM_gQ!8m4!3d37.7947!4d-122.3960!16s%2Fg%2F11....."
Output: { type: 'place_id', placeId: 'ChIJnx-fPM-AhYAR_H-cHOAM_gQ', rawUrl: "..." }
```

##### 2. searchPlaces()
**Lines 1139-1492**

Main search function with multi-layer caching strategy:

**Cache Hierarchy:**
1. Session cache (fastest, in-memory)
2. Database cache (persistent, 24-hour TTL for searches)
3. Curated venues table (10-50ms for Bay Area searches)
4. Google Places API (fallback)

**Parameters:**
- `query`: Search query or place name
- `location`: Geographic context (city/region name)
- `radiusMiles`: Search radius (default: 2 miles)
- `coordinates`: Optional lat/lng for location bias
- `skipCurated`: Force API call, skip cache
- `venueType`: Optional venue type filter
- `budgetMax`: Price level filter
- `seenVenues`: Venues to deprioritize
- `forceComprehensiveSearch`: Flag for user-initiated searches

**New Google Places API Integration:**
- **Endpoint:** `https://places.googleapis.com/v1/places:searchText` (POST)
- **Field Mask:** Requests only required fields (cost optimization)
- **Key Fields:** id, displayName, formattedAddress, rating, userRatingCount, priceLevel, photos, types, location

**Features:**
- Price level filtering by budget
- Location bias using circular region
- Minimum review count filtering (50 reviews)
- Photo URL generation via proxy endpoint
- Distance calculation from search center
- Variety optimization with venue shuffling

##### 3. getPlaceDetails()
**Lines 1790-1922**

Retrieves detailed information for a specific place:

**Cache Strategy:**
1. Session cache (immediate)
2. Database cache (30-day TTL)
3. Google Places API

**Uses:**
- Extract city from address components
- Get full venue details for favorites

##### 4. searchNearbyPlaces()
**Lines 1494-1673**

Performs nearby search around coordinates:

**Parameters:**
- `query`: Activity type (e.g., "restaurant")
- `nearLocation`: Center coordinates
- `radiusMeters`: Search radius
- `minRating`: Minimum rating filter

### Place ID Extraction and Validation

**Place ID Format:** `ChIJ` prefix (Google's new Places API format)
- **Validation:** Must be > 10 characters and start with `ChIJ`
- **Legacy Format Not Supported:** `0x` format (deprecated)
- **Lines:** 1030-1040

**City Extraction from Address Components:**
```typescript
// Helper function at lines 524-554
function extractCityFromAddressComponents(addressComponents: any[]): string | undefined
```

Hierarchy:
1. Try "locality" component (most common - actual city)
2. Fallback: "sublocality" (neighborhood in large cities)
3. Fallback: "administrative_area_level_3"

---

## 3. DATABASE CACHING

**Cached Tables:**
- `placesCache`: Individual place details (30-day TTL)
- `searchCache`: Search result sets (24-hour TTL)
- `geocodingCache`: Address to coordinates (30-day TTL)
- `curatedVenues`: Pre-loaded Bay Area venues (auto-refreshed)

**Cache Functions:**
- `getPlaceDetailsFromDB()` / `savePlaceDetailsToDB()`
- `getSearchResultsFromDB()` / `saveSearchResultsToDB()`
- `getGeocodingFromDB()` / `saveGeocodingToDB()`

---

## 4. CURATED VENUES (Bay Area Specific)

**Location:** `searchCuratedVenues()` at lines 587-823

**Features:**
- Pre-loaded high-quality venues for Bay Area
- Geographic validation (bounding box checks)
- Category filtering (meal, drinks, cafes, dessert, experiences)
- Venue type filtering via tags
- Distance calculation and filtering
- Fresh venue prioritization (deprioritize seen venues)
- Randomization for variety

**Regions Supported:**
- san_francisco
- san_mateo
- oakland
- san_jose
- bay_area

**Auto-Caching:**
High-quality API results (100+ reviews, 4.0+ rating) are automatically cached to curated_venues table for future searches.

---

## 5. DATA FLOW

### User Adds Venue via Google Maps Link

```
User pastes Google Maps link into search input
                    ↓
Client sends link to /api/groups/:groupId/search-venues
                    ↓
Server calls searchPlaces(link, ...)
                    ↓
detectAndParseGoogleMapsUrl() parses URL
                    ↓
Extracts: placeId OR coordinates OR place name
                    ↓
If place_id: getPlaceDetails(placeId)
If coordinates: searchPlaces(placeName, coordinates)
If text_search: searchPlaces(placeName, location)
                    ↓
Returns place details to client
                    ↓
Client displays in search results
                    ↓
User clicks "Favorite" or "Add to Cart"
                    ↓
Place stored as voting_event or activity
```

### User Searches for Text

```
User types "pizza near Mission" in search input
                    ↓
Client debounces (500ms)
                    ↓
Calls /api/groups/:groupId/search-venues?query=pizza+near+Mission
                    ↓
Server calls searchPlaces("pizza near Mission", group.location, ...)
                    ↓
Check curated venues first (cache-first strategy)
If insufficient results (<9): Call Google Places API
                    ↓
Returns combined results (curated + API)
                    ↓
Cache in session and database
                    ↓
Auto-cache high-quality results to curated_venues
```

---

## 6. KEY FEATURES

### Multi-Format URL Support
- Place IDs (modern `ChIJ` format)
- Coordinates with place names
- Text search URLs
- CID-based URLs (legacy)
- Shortened share links (with redirect following)

### Smart Caching
- 3-layer cache (session → database → API)
- Budget-aware filtering
- Variety optimization with shuffling
- Auto-learning system (API results cached as curated venues)

### Location Awareness
- Group location context
- Radius-based filtering (default 10 miles for searches)
- Timezone detection
- City extraction from address components

### Result Filtering
- Minimum review count (50 reviews)
- Price level filtering by budget
- Distance validation
- Rating-based sorting

### Google Maps Link Generation
Two URL formats used in the app:
1. **Query + Place ID:** `?api=1&query={NAME}&query_place_id={ID}`
2. **Query only:** `?api=1&query={NAME}`

---

## 7. FILE LOCATIONS SUMMARY

| Component | File | Lines |
|-----------|------|-------|
| Activity Search Input | `client/src/pages/group-detail.tsx` | 5967-5977 |
| Search Results Display | `client/src/pages/group-detail.tsx` | 5980-6160 |
| Google Maps URL Parsing | `server/google-places.ts` | 991-1137 |
| Search Places Function | `server/google-places.ts` | 1139-1492 |
| API Endpoint | `server/routes.ts` | 4618-4659 |
| Google Maps Links (Event Details) | `client/src/pages/event-details.tsx` | 275-284 |
| Google Maps Links (Dashboard) | `client/src/pages/dashboard.tsx` | 1010 |
| Google Maps Links (SwipeCard) | `client/src/components/SwipeCard.tsx` | 64-66 |
| Database Caching | `server/google-places.ts` | 226-406 |
| Curated Venues | `server/google-places.ts` | 587-823 |

---

## 8. EXAMPLE USAGE

### Parsing a Google Maps Place Link
```typescript
const result = await detectAndParseGoogleMapsUrl(
  "https://www.google.com/maps/place/Capo's+Restaurant/@37.7947,-122.3960,17z/data=!4m6!3m5!1sChIJnx-fPM-AhYAR_H-cHOAM_gQ"
);
// Returns: { type: 'place_id', placeId: 'ChIJnx-fPM-AhYAR_H-cHOAM_gQ' }

// Then search for place details
const details = await getPlaceDetails('ChIJnx-fPM-AhYAR_H-cHOAM_gQ');
```

### Searching for Venues
```typescript
const results = await searchPlaces(
  "pizza",
  "San Francisco",
  10, // 10 mile radius
  { lat: 37.7749, lng: -122.4194 },
  false, // don't skip curated
  undefined, // no venue type filter
  60 // $60 budget max
);
```

