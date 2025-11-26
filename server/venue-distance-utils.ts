/**
 * Venue Distance Utilities
 *
 * Functions for calculating geographic distances and validating venue proximity
 * Helps ensure venues are reasonably close together (not 20 miles apart!)
 */

export interface GeoLocation {
  latitude: number | string | null;
  longitude: number | string | null;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in miles
 *
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Parse latitude/longitude to number (handles string values)
 */
function parseCoordinate(coord: number | string | null): number | null {
  if (coord === null) return null;
  if (typeof coord === 'number') return coord;

  const parsed = parseFloat(coord);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Calculate distance between two venues
 * Returns distance in miles, or null if coordinates are missing
 */
export function calculateVenueDistance(
  venue1: GeoLocation,
  venue2: GeoLocation
): number | null {
  const lat1 = parseCoordinate(venue1.latitude);
  const lon1 = parseCoordinate(venue1.longitude);
  const lat2 = parseCoordinate(venue2.latitude);
  const lon2 = parseCoordinate(venue2.longitude);

  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return null; // Missing coordinates
  }

  return calculateDistance(lat1, lon1, lat2, lon2);
}

/**
 * Calculate center point (centroid) of multiple venues
 * Useful for finding venues near the group's center
 */
export function calculateCenterPoint(venues: GeoLocation[]): {
  latitude: number;
  longitude: number;
} | null {
  const validVenues = venues.filter(v => {
    const lat = parseCoordinate(v.latitude);
    const lon = parseCoordinate(v.longitude);
    return lat !== null && lon !== null;
  });

  if (validVenues.length === 0) return null;

  let totalLat = 0;
  let totalLon = 0;

  for (const venue of validVenues) {
    totalLat += parseCoordinate(venue.latitude)!;
    totalLon += parseCoordinate(venue.longitude)!;
  }

  return {
    latitude: totalLat / validVenues.length,
    longitude: totalLon / validVenues.length,
  };
}

/**
 * Filter venues within a maximum distance from a center point
 */
export function filterVenuesByDistance<T extends GeoLocation>(
  venues: T[],
  centerPoint: { latitude: number; longitude: number },
  maxDistanceMiles: number
): T[] {
  return venues.filter(venue => {
    const distance = calculateVenueDistance(
      centerPoint,
      venue
    );

    // Keep venues with missing coordinates (benefit of the doubt)
    if (distance === null) return true;

    return distance <= maxDistanceMiles;
  });
}

/**
 * Validate that all venues in a selection are reasonably close together
 * Returns true if all venues are within maxDistanceMiles of each other
 */
export function validateVenueProximity<T extends GeoLocation>(
  venues: T[],
  maxDistanceMiles: number = 5
): {
  isValid: boolean;
  maxDistance: number | null;
  issues: string[];
} {
  const issues: string[] = [];
  let maxDistance: number | null = null;

  // Check distance between each pair of venues
  for (let i = 0; i < venues.length; i++) {
    for (let j = i + 1; j < venues.length; j++) {
      const distance = calculateVenueDistance(venues[i], venues[j]);

      if (distance !== null) {
        if (maxDistance === null || distance > maxDistance) {
          maxDistance = distance;
        }

        if (distance > maxDistanceMiles) {
          issues.push(
            `Venues ${i + 1} and ${j + 1} are ${distance.toFixed(1)} miles apart (max: ${maxDistanceMiles})`
          );
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    maxDistance,
    issues,
  };
}

/**
 * Calculate total travel distance for an itinerary
 * Sum of distances between consecutive venues
 */
export function calculateTotalTravelDistance<T extends GeoLocation>(
  venues: T[]
): number | null {
  if (venues.length < 2) return 0;

  let totalDistance = 0;
  let hasValidDistances = false;

  for (let i = 0; i < venues.length - 1; i++) {
    const distance = calculateVenueDistance(venues[i], venues[i + 1]);
    if (distance !== null) {
      totalDistance += distance;
      hasValidDistances = true;
    }
  }

  return hasValidDistances ? totalDistance : null;
}

/**
 * Estimate travel time between venues (rough estimate)
 * Assumes 15 mph average in city (accounts for traffic, parking, walking)
 */
export function estimateTravelTime(distanceMiles: number): number {
  const avgSpeedMph = 15; // Conservative estimate for urban areas
  const travelTimeHours = distanceMiles / avgSpeedMph;
  return Math.round(travelTimeHours * 60); // Return minutes
}

/**
 * Get distance statistics for a set of venues
 * Useful for logging/debugging
 */
export function getDistanceStatistics<T extends GeoLocation>(
  venues: T[]
): {
  minDistance: number | null;
  maxDistance: number | null;
  avgDistance: number | null;
  totalDistance: number | null;
} {
  if (venues.length < 2) {
    return { minDistance: null, maxDistance: null, avgDistance: null, totalDistance: null };
  }

  const distances: number[] = [];

  // Calculate all pairwise distances
  for (let i = 0; i < venues.length; i++) {
    for (let j = i + 1; j < venues.length; j++) {
      const distance = calculateVenueDistance(venues[i], venues[j]);
      if (distance !== null) {
        distances.push(distance);
      }
    }
  }

  if (distances.length === 0) {
    return { minDistance: null, maxDistance: null, avgDistance: null, totalDistance: null };
  }

  const totalDistance = calculateTotalTravelDistance(venues);

  return {
    minDistance: Math.min(...distances),
    maxDistance: Math.max(...distances),
    avgDistance: distances.reduce((a, b) => a + b, 0) / distances.length,
    totalDistance,
  };
}

/**
 * Get context-aware distance threshold based on location type
 *
 * Returns appropriate maximum distance between venues based on:
 * - Dense urban areas (walkable): 0.5 miles
 * - Suburban/driving areas: 1.5 miles
 * - Rural/spread out areas: 3 miles
 *
 * Uses search radius as a proxy for area density:
 * - Small radius (≤2 mi) = dense/walkable
 * - Medium radius (2-5 mi) = suburban
 * - Large radius (>5 mi) = rural
 */
export function getDistanceThreshold(group: {
  searchRadius?: number | null;
  locationBase?: string | null;
}): number {
  const searchRadius = group.searchRadius || 2; // Default to 2 miles

  // Dense urban/walkable areas
  if (searchRadius <= 2) {
    return 0.5; // Walking distance - venues should be very close
  }

  // Suburban/mixed driving areas
  if (searchRadius <= 5) {
    return 1.5; // Short drive or long walk
  }

  // Rural/spread out areas
  return 3.0; // Driving required
}

/**
 * Find venues near a target venue
 * Useful for suggesting complementary venues nearby
 *
 * @param targetVenue - The anchor venue to find neighbors for
 * @param candidateVenues - Pool of venues to search
 * @param maxDistance - Maximum distance in miles
 * @returns Venues sorted by distance from target
 */
export function findNearbyVenues<T extends GeoLocation & { id?: string }>(
  targetVenue: GeoLocation,
  candidateVenues: T[],
  maxDistance: number = 0.5
): Array<T & { distance: number }> {
  const nearby: Array<T & { distance: number }> = [];

  for (const venue of candidateVenues) {
    // Skip if same venue (by ID if available)
    if ('id' in targetVenue && 'id' in venue && targetVenue.id === venue.id) {
      continue;
    }

    const distance = calculateVenueDistance(targetVenue, venue);

    if (distance !== null && distance <= maxDistance) {
      nearby.push({ ...venue, distance });
    }
  }

  // Sort by distance (closest first)
  return nearby.sort((a, b) => a.distance - b.distance);
}
