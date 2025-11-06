# Activity Search Architecture - Visual Overview

## System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (React)                          │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Group Detail Page (group-detail.tsx)                        │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │ Activity Search Component (Lines 5950-6175)            │ │  │
│  │  │                                                         │ │  │
│  │  │ ┌─────────────────────────────────────────────────┐   │ │  │
│  │  │ │ Search Input (Search Bar)                       │   │ │  │
│  │  │ │ - State: venueSearchQuery                       │   │ │  │
│  │  │ │ - Debounced: debouncedVenueSearchQuery (500ms) │   │ │  │
│  │  │ │ - Min length: 2 characters                      │   │ │  │
│  │  │ │ - Placeholder: "Search for parks..."            │   │ │  │
│  │  │ └─────────────────────────────────────────────────┘   │ │  │
│  │  │                       │                                │ │  │
│  │  │                       ↓                                │ │  │
│  │  │ ┌─────────────────────────────────────────────────┐   │ │  │
│  │  │ │ React Query (Search Results)                    │   │ │  │
│  │  │ │ - Endpoint: /api/groups/:groupId/search-venues │   │ │  │
│  │  │ │ - Query: debouncedVenueSearchQuery              │   │ │  │
│  │  │ │ - Returns: PlaceResult[]                        │   │ │  │
│  │  │ └─────────────────────────────────────────────────┘   │ │  │
│  │  │                       │                                │ │  │
│  │  │                       ↓                                │ │  │
│  │  │ ┌─────────────────────────────────────────────────┐   │ │  │
│  │  │ │ Search Results Grid (3 columns on desktop)      │   │ │  │
│  │  │ │ For each result:                                │   │ │  │
│  │  │ │ - Photo, name, rating, review count, address   │   │ │  │
│  │  │ │ - Button: "Favorite" (creates voting_event)    │   │ │  │
│  │  │ │ - Button: "Add to Cart" (max 5 venues)         │   │ │  │
│  │  │ └─────────────────────────────────────────────────┘   │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  │                                                              │  │
│  │  Google Maps Link Generation (Multiple Pages)               │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │ URL Pattern: ?api=1&query={NAME}&query_place_id={ID}   │ │  │
│  │  │ Used in: Event Details, Dashboard, SwipeCard, etc.     │ │  │
│  │  │ Opens: https://www.google.com/maps/search/...          │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ Fetch request with query
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     SERVER LAYER (Express.js)                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Search Venues Endpoint (routes.ts:4618-4659)               │  │
│  │ GET /api/groups/:groupId/search-venues?query={Q}           │  │
│  │                                                              │  │
│  │ 1. Extract query parameter                                 │  │
│  │ 2. Get group context (location, radius, budget)            │  │
│  │ 3. Call searchPlaces(query, location, ...)                 │  │
│  │ 4. Return top 10 results                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│                               ↓                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ searchPlaces() (google-places.ts:1139-1492)                │  │
│  │                                                              │  │
│  │ CACHE-FIRST STRATEGY:                                       │  │
│  │ ┌────────────────────────────────────────────────────────┐ │  │
│  │ │ 1. Check Session Cache (fastest)                      │ │  │
│  │ │    Map<cacheKey, PlaceResult[]>                       │ │  │
│  │ │    → Returns results with shuffle for variety         │ │  │
│  │ └────────────────────────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────────────────────────┐ │  │
│  │ │ 2. Check Curated Venues (10-50ms for Bay Area)        │ │  │
│  │ │    searchCuratedVenues(query, location, ...)          │ │  │
│  │ │    - Geographic validation (bounding box)             │ │  │
│  │ │    - Category + type filtering                        │ │  │
│  │ │    - Distance calculation                             │ │  │
│  │ │    - Fresh venue prioritization                       │ │  │
│  │ │    → If ≥9 results: Return ALL (skip API)             │ │  │
│  │ └────────────────────────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────────────────────────┐ │  │
│  │ │ 3. Check Database Cache (persistent, 24h TTL)         │ │  │
│  │ │    getSearchResultsFromDB(query, location, radius)    │ │  │
│  │ │    → Stores full PlaceResult objects                  │ │  │
│  │ └────────────────────────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────────────────────────┐ │  │
│  │ │ 4. Google Places API (fallback)                       │ │  │
│  │ │    Endpoint: places.googleapis.com/v1/places:searchText
│  │ │    Method: POST with JSON body                        │ │  │
│  │ │    - Max results: 20                                  │ │  │
│  │ │    - Field mask: Optimized field selection            │ │  │
│  │ │    - Location bias: circular region if coordinates    │ │  │
│  │ │    - Results filtered:                                │ │  │
│  │ │      • Min 50 reviews (userRatingCount)               │ │  │
│  │ │      • Min distance (radiusMiles)                     │ │  │
│  │ │      • Budget max (priceLevel filtering)              │ │  │
│  │ │    → Auto-cache high-quality results (100+ reviews,   │ │  │
│  │ │      4.0+ rating) to curated_venues table            │ │  │
│  │ └────────────────────────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────────────────────────┐ │  │
│  │ │ MERGE & RETURN                                         │ │  │
│  │ │ - Deduplicate by placeId                             │ │  │
│  │ │ - Prioritize curated venues                          │ │  │
│  │ │ - Shuffle API results for variety                    │ │  │
│  │ │ - Slice to top 10 for client                         │ │  │
│  │ └────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                               │                                     │
│                               ↓                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Google Maps URL Parser (detectAndParseGoogleMapsUrl)        │  │
│  │ (Lines 991-1137) - OPTIONAL POST-PROCESSING                 │  │
│  │                                                              │  │
│  │ If user pastes Google Maps link:                            │  │
│  │ ┌────────────────────────────────────────────────────────┐ │  │
│  │ │ Pattern 1: Place ID (ChIJ format)                     │ │  │
│  │ │ → Extract from data parameter: /!1s(ChIJ[^!&]+)/      │ │  │
│  │ │ → Call getPlaceDetails(placeId)                       │ │  │
│  │ │                                                        │ │  │
│  │ │ Pattern 2: Coordinates (@lat,lng)                     │ │  │
│  │ │ → Extract from pathname: /@(coords)/                  │ │  │
│  │ │ → Use for location bias in searchPlaces()            │ │  │
│  │ │                                                        │ │  │
│  │ │ Pattern 3: Text Search                                │ │  │
│  │ │ → Extract from /maps/search/{QUERY}                   │ │  │
│  │ │ → Pass to searchPlaces(query, ...)                    │ │  │
│  │ │                                                        │ │  │
│  │ │ Pattern 4: Shortened Link (goo.gl)                    │ │  │
│  │ │ → Follow redirect                                     │ │  │
│  │ │ → Recursively parse full URL                         │ │  │
│  │ └────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ JSON response with results
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                               │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Caching Tables                                               │  │
│  │                                                              │  │
│  │ ┌──────────────────────────────────────────────────────┐   │  │
│  │ │ placesCache (30-day TTL)                             │   │  │
│  │ │ - Key: placeId                                       │   │  │
│  │ │ - Value: Full PlaceResult object                     │   │  │
│  │ │ - Used by: getPlaceDetails()                         │   │  │
│  │ └──────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │ ┌──────────────────────────────────────────────────────┐   │  │
│  │ │ searchCache (24-hour TTL)                            │   │  │
│  │ │ - Key: (query, location, radius)                     │   │  │
│  │ │ - Value: Array of PlaceResult objects               │   │  │
│  │ │ - Used by: searchPlaces()                            │   │  │
│  │ └──────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │ ┌──────────────────────────────────────────────────────┐   │  │
│  │ │ geocodingCache (30-day TTL)                          │   │  │
│  │ │ - Key: location string                               │   │  │
│  │ │ - Value: lat, lng, formattedAddress, timezone       │   │  │
│  │ │ - Used by: geocodeLocation()                         │   │  │
│  │ └──────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │ ┌──────────────────────────────────────────────────────┐   │  │
│  │ │ curatedVenues (Pre-loaded Bay Area)                  │   │  │
│  │ │ - Regions: SF, Oakland, San Jose, San Mateo, Bay Area
│  │ │ - Fields: name, address, lat, lng, category, tags,  │   │  │
│  │ │           rating, reviewCount, priceLevel,          │   │  │
│  │ │           googlePlaceId, photoUrl, etc.             │   │  │
│  │ │ - Updated: Auto-cache from high-quality API results │   │  │
│  │ │ - Used by: searchCuratedVenues()                     │   │  │
│  │ └──────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram: User Searches for "Pizza"

```
START: User types "pizza" in search input
         │
         ↓
State: venueSearchQuery = "pizza"
         │
         ↓ (After 500ms debounce)
State: debouncedVenueSearchQuery = "pizza"
         │
         ↓ (useQuery is triggered)
Client makes fetch request:
GET /api/groups/{groupId}/search-venues?query=pizza
         │
         ↓
SERVER: Search Venues Endpoint
  Get group: location="San Francisco", radius=10, budgetMax=60
  Call searchPlaces("pizza", "San Francisco", 10, coordinates, true)
         │
         ↓
searchPlaces() CACHE HIERARCHY:
         │
    ┌────┴────┬────┬────┐
    ↓         ↓    ↓    ↓
  Sess DB  Curat API
  cache cache venues
    │      │     │    │
    ✗      ✗     ✓    │ (No session/DB cache, found 15 curated)
    │                 │
    └──────┬──────────┘
           ↓
    searchCuratedVenues() found 15 results ≥9
         │
         ↓
    Since ≥9 results: Return ALL curated (skip API)
         │
         ↓
    Apply budget filter: $60 max price level
         │
         ↓
    Shuffle for variety (randomize order)
         │
         ↓
    Return to client: 15 results (PlaceResult[])
         │
         ↓
CLIENT: Receive results in React Query cache
         │
         ↓
DISPLAY: Grid of 15 venue cards in search results section
         │
         ↓
USER: Click "Favorite" on first result
         │
         ↓
CLIENT: Call addVotingEventMutation with:
  - title: "venue.name"
  - googlePlaceId: "venue.placeId"
  - venueAddress, rating, etc.
  - addToCart: false
         │
         ↓
SERVER: Create voting_event record
         │
         ↓
STORED: Venue added to group favorites

END
```

## Data Flow Diagram: User Pastes Google Maps Link

```
START: User pastes Maps link in search input
       "https://www.google.com/maps/place/Pizza+Hut/@37.7749,-122.4194/data=!4m6!3m5!1sChIJ123..."
         │
         ↓
Client sends to: /api/groups/{groupId}/search-venues?query={URL}
         │
         ↓
SERVER: searchPlaces() receives full URL string
         │
         ↓
[OPTIONAL] detectAndParseGoogleMapsUrl(url)
         │
    ┌────┴────┬────┬───┐
    ↓         ↓    ↓   ↓
  Data Coord Text CID
  param nota search
    │         │     │   │
    ✓         │     │   │ (Found ChIJ place ID)
    │
    ↓
detectAndParseGoogleMapsUrl() returns:
{
  type: 'place_id',
  placeId: 'ChIJ123...',
  rawUrl: url
}
         │
         ↓ (If implemented)
Call getPlaceDetails('ChIJ123...')
         │
         ↓
Return place details to client
         │
         ↓
CLIENT: Display in search results
         │
         ↓
USER: Click "Add to Cart"
         │
         ↓
Venue added to itinerary

[CURRENTLY: URL is passed as query string to Google Places API,
            parseLocation happens implicitly]

END
```

## Cache Hierarchy Visualization

```
                    REQUEST FOR "pizza"
                           │
                           ↓
                ┌───────────────────────┐
                │ Memory Hit?           │
                │ (Session Cache)       │
                └────────┬──────────────┘
                         │
                    ┌────┴────┐
                    ↓         ↓
                   YES        NO
                    │         │
                    │         ↓
                    │     ┌───────────────────────────┐
                    │     │ Curated Venues Hit?       │
                    │     │ (Bay Area only)           │
                    │     └────────┬──────────────────┘
                    │              │
                    │         ┌────┴────────┐
                    │         ↓             ↓
                    │        YES            NO
                    │         │             │
                    │         │         ┌───────────────────┐
                    │         │         │ Database Hit?     │
                    │         │         │ (Search Cache)    │
                    │         │         └────────┬──────────┘
                    │         │                  │
                    │         │         ┌────────┴────┐
                    │         │         ↓             ↓
                    │         │        YES            NO
                    │         │         │             │
                    └─────────┼─────────┼────┬────────┘
                              │         │    │
                              ↓         ↓    ↓
                        ┌──────────────────────────┐
                        │ Call Google Places API   │
                        │ (Fallback)               │
                        └────────┬─────────────────┘
                                 │
                                 ↓
                        ┌──────────────────────────┐
                        │ Parse Results:           │
                        │ - Min 50 reviews         │
                        │ - Filter by budget       │
                        │ - Validate distance      │
                        │ - Extract city           │
                        └────────┬─────────────────┘
                                 │
                                 ↓
                        ┌──────────────────────────┐
                        │ Cache Results:           │
                        │ - Session (immediate)    │
                        │ - Database (24h TTL)     │
                        │ - Auto-cache to curated  │
                        └────────┬─────────────────┘
                                 │
                                 ↓
                        ┌──────────────────────────┐
                        │ Return Results           │
                        │ (Merged & deduped)       │
                        └──────────────────────────┘
```

## Place Result Flow

```
PlaceResult Interface:
{
  placeId: string              // Google Place ID (ChIJ format)
  name: string                 // Venue name
  address: string              // Full address
  city?: string               // Extracted from addressComponents
  rating?: string             // Numerical rating as string
  reviewCount?: number        // Total Google reviews (userRatingCount)
  priceLevel?: string         // '$', '$$', '$$$', '$$$$'
  photoUrl?: string           // Proxy endpoint URL
  types: string[]             // Google place types
  location?: {                // Coordinates
    lat: number
    lng: number
  }
  review?: string            // Short positive review highlight
  distance?: number          // Distance in miles from search center
}
```

## Component Integration

```
group-detail.tsx (Main Page)
  │
  ├─ venueSearchQuery (state)
  ├─ debouncedVenueSearchQuery (derived)
  │
  ├─ useQuery: /api/groups/:groupId/search-venues
  │  └─ venueSearchResults: PlaceResult[]
  │
  ├─ Render: Search input
  │  └─ onChange: setVenueSearchQuery()
  │
  ├─ Render: Search results grid
  │  └─ For each result:
  │     ├─ Display venue card
  │     ├─ Button "Favorite": addVotingEventMutation
  │     └─ Button "Add to Cart": setSelectedVenues()
  │
  └─ Other components:
     ├─ SwipeCard (uses googlePlaceId for Maps links)
     ├─ FavoritesMap (displays voting events on map)
     └─ Event Details (shows itinerary venues with Maps links)
```

## Performance Characteristics

```
Latency Estimates:
┌──────────────────────────────────┬──────────────┐
│ Cache Type                       │ Latency      │
├──────────────────────────────────┼──────────────┤
│ Session Cache (memory)           │ 0-10ms       │
│ Curated Venues (Bay Area search) │ 10-50ms      │
│ Database Cache (searchCache)     │ 50-200ms     │
│ Google Places API                │ 500-2000ms   │
├──────────────────────────────────┼──────────────┤
│ With Cache-First Strategy:       │              │
│ - Bay Area, ≥9 results          │ 10-50ms      │
│ - Cache hit (session/DB)        │ 0-200ms      │
│ - Cache miss (API required)      │ 500-2000ms   │
└──────────────────────────────────┴──────────────┘

API Call Reduction:
- Without caching: Every search = 1 API call
- With caching:   ~70% of searches = 0 API calls
- Auto-cache:     Growing cache → improving hit rate over time
```

