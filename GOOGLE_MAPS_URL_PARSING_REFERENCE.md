# Google Maps URL Parsing - Quick Reference

## Function Location
**File:** `/home/runner/workspace/server/google-places.ts`
**Function:** `detectAndParseGoogleMapsUrl(query: string)`
**Lines:** 991-1137

## Supported URL Formats

### 1. Modern Place ID Format (RECOMMENDED)
**Pattern:** Place URLs with `data` parameter containing ChIJ format ID
```
https://www.google.com/maps/place/Restaurant+Name/@37.7749,-122.4194,17z/data=!4m6!3m5!1sChIJ...!...
https://maps.google.com/maps/place/Coffee+Shop/@40.7128,-74.0060/data=!4m6!3m5!1sChIJLJPh...!...
```
**Extraction:** Regex match on `data` parameter: `/!1s([^!&]+)/`
**Return:** `{ type: 'place_id', placeId: 'ChIJ...' }`
**Validation:** Must start with `ChIJ` and be > 10 characters

### 2. Coordinate-Based URLs
**Pattern:** URLs with coordinates in `@lat,lng` notation
```
https://www.google.com/maps/place/Cafe/@37.7749,-122.4194,17z/
https://maps.google.com/maps/place/Restaurant/@40.7128,-74.0060/
```
**Extraction:** Pathname regex: `/@([\d\.\-]+),([\d\.\-]+)/`
**Return:** `{ type: 'coordinates', lat: 37.7749, lng: -122.4194, placeName: 'Cafe' }`
**Validation:** lat [-90, 90], lng [-180, 180]

### 3. Text Search URLs
**Pattern:** `/maps/search/` endpoints with search terms
```
https://www.google.com/maps/search/coffee+shop+san+francisco
https://maps.google.com/maps/search/pizza+new+york
```
**Extraction:** Pathname regex: `/maps/search/([^/]+)/`
**Return:** `{ type: 'text_search', placeName: 'coffee shop san francisco' }`
**Decoding:** URL decode + replace `+` with spaces

### 4. Place Name URLs (Fallback)
**Pattern:** `/maps/place/{NAME}` format
```
https://www.google.com/maps/place/Chick-fil-A
https://maps.google.com/maps/place/Golden+Gate+Bridge
```
**Extraction:** Pathname regex: `/maps/place/([^/@]+)/`
**Return:** `{ type: 'text_search', placeName: 'Chick-fil-A' }`

### 5. Legacy CID-Based URLs
**Pattern:** CID query parameter (deprecated)
```
https://maps.google.com?cid=12345678901
```
**Extraction:** Search regex: `/cid=(\d+)/`
**Return:** `{ type: 'text_search', placeName: '12345678901' }`
**Note:** Treated as text search, not direct place ID

### 6. Shortened Share Links
**Pattern:** Google's shortened URLs
```
https://maps.app.goo.gl/ABC123XYZ
https://goo.gl/maps/ABC123XYZ
```
**Behavior:** Follows HTTP redirect and recursively parses full URL
**Return:** Result from expanded URL parsing
**Method:** HTTP HEAD request with `redirect: 'follow'`

## Return Type

```typescript
interface GoogleMapsUrlResult {
  type: 'place_id' | 'coordinates' | 'text_search' | 'share_link' | 'unknown';
  placeId?: string;        // Only for place_id type, format: ChIJ...
  lat?: number;             // Only for coordinates type
  lng?: number;             // Only for coordinates type
  placeName?: string;       // For text_search and coordinates types
  rawUrl: string;           // Original input URL
}
```

## Parsing Flow (Priority Order)

```
1. Check if string contains Google Maps domain
   ├─ Not a maps URL? Return null
   └─ Is a maps URL? Continue...

2. Try CID pattern
   ├─ Found? Return type: 'text_search'
   └─ Not found? Continue...

3. Try Place ID from data parameter
   ├─ Found ChIJ format? Return type: 'place_id'
   └─ Not found? Continue...

4. Try coordinate extraction from @ notation
   ├─ Found valid coordinates? Return type: 'coordinates'
   └─ Not found? Continue...

5. Try text search URL pattern
   ├─ Found /maps/search/? Return type: 'text_search'
   └─ Not found? Continue...

6. Try place name extraction (fallback)
   ├─ Found /maps/place/{NAME}? Return type: 'text_search'
   └─ Not found? Continue...

7. Try shortened URL redirect
   ├─ Is goo.gl or maps.app.goo.gl? Follow redirect, recursively parse
   └─ Not shortened? Return null
```

## Key Validation Rules

### Place ID Validation
- Must start with `ChIJ` (Google's modern format)
- Must be > 10 characters
- Regex: `/!1s(ChIJ[^!&]+)/`
- Legacy `0x` format is NOT supported

### Coordinate Validation
- Latitude: -90 to 90
- Longitude: -180 to 180
- Must be numeric values
- Both values required

### URL Detection
- Must contain one of:
  - `google.com/maps`
  - `goo.gl/maps`
  - `maps.app.goo.gl`

## Usage Examples

### Example 1: Place ID Extraction
```typescript
const url = "https://www.google.com/maps/place/Supreme+Dumplings/@37.7947,-122.3960,17z/data=!4m6!3m5!1sChIJnx-fPM-AhYAR_H-cHOAM_gQ!8m4!3d37.7947!4d-122.3960!16s%2Fg%2F11...";
const result = await detectAndParseGoogleMapsUrl(url);
// Returns: {
//   type: 'place_id',
//   placeId: 'ChIJnx-fPM-AhYAR_H-cHOAM_gQ',
//   rawUrl: url
// }

// Use place ID to get details
const details = await getPlaceDetails('ChIJnx-fPM-AhYAR_H-cHOAM_gQ');
```

### Example 2: Coordinate Extraction
```typescript
const url = "https://www.google.com/maps/place/Cafe/@37.7749,-122.4194,17z/";
const result = await detectAndParseGoogleMapsUrl(url);
// Returns: {
//   type: 'coordinates',
//   lat: 37.7749,
//   lng: -122.4194,
//   placeName: 'Cafe',
//   rawUrl: url
// }

// Use coordinates to search nearby
const results = await searchNearbyPlaces('cafe', { lat: 37.7749, lng: -122.4194 });
```

### Example 3: Text Search Extraction
```typescript
const url = "https://www.google.com/maps/search/pizza+near+mission+district";
const result = await detectAndParseGoogleMapsUrl(url);
// Returns: {
//   type: 'text_search',
//   placeName: 'pizza near mission district',
//   rawUrl: url
// }

// Use search text
const results = await searchPlaces('pizza near mission district', 'San Francisco');
```

### Example 4: Shortened Link
```typescript
const url = "https://maps.app.goo.gl/ABC123XYZ";
const result = await detectAndParseGoogleMapsUrl(url);
// Follows redirect to actual URL, then parses and returns result
// Example: { type: 'place_id', placeId: 'ChIJ...' }
```

## Integration Points

### In `searchPlaces()` function
The parsing is NOT explicitly called in searchPlaces. Instead:
1. User input is treated as raw query string
2. If input is a URL, it's passed as-is to Google Places API
3. API handles URL parsing implicitly

### Where Parsing IS Used
- **Future Enhancement:** Could be used for:
  - Direct place ID lookups when user pastes Maps link
  - Automatic coordinate detection for location bias
  - Pre-processing user input before API call

## Important Notes

1. **Error Handling:** Returns `null` if URL cannot be parsed
2. **Redirect Following:** Only for shortened links (goo.gl)
3. **Place ID Format:** Only `ChIJ` format is supported (new API)
4. **URL Decoding:** Automatically decodes URL-encoded characters
5. **Logging:** All parsing steps logged with `[URL Parser]` prefix
6. **Performance:** Synchronous except for redirect following (async)

## Testing

Common URLs to test:
```
// Place ID
https://www.google.com/maps/place/Waterbar/@37.7747,-122.3947,15z/data=!4m6!3m5!1sChIJ4zQaYxSAhYARp2SXNLlPHfw!8m4!3d37.7747!4d-122.3947!16s%2Fg%2F11...

// Coordinates only
https://www.google.com/maps/@37.7749,-122.4194,15z

// Search
https://www.google.com/maps/search/coffee+shops+san+francisco

// Shortened
https://maps.app.goo.gl/2T5B7vDM2b2XPQ3R6

// Place name
https://www.google.com/maps/place/Golden+Gate+Bridge/@37.8199,-122.4783
```

