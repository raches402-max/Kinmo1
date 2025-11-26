/**
 * Venue Ordering Utilities
 *
 * Functions for arranging venues in logical flow (meal → drinks → dessert)
 * Ensures realistic event sequences (e.g., dinner before ice cream, not vice versa)
 */

export interface OrderableVenue {
  category?: string | null;
  venueType?: string | null;
  name?: string;
  [key: string]: any;
}

/**
 * Get priority for venue ordering (lower = earlier in sequence)
 * Priority 1: Meals/restaurants (dinner first)
 * Priority 2: Drinks/bars (drinks after dinner)
 * Priority 3: Dessert/cafes (dessert last)
 * Priority 1.5: Experiences/activities (flexible, typically middle)
 */
export function getVenuePriority(venue: OrderableVenue): number {
  const category = venue.category?.toLowerCase() || '';
  const venueType = venue.venueType?.toLowerCase() || '';

  // Meals/restaurants first (priority 1)
  if (
    category === 'meal' ||
    venueType.includes('restaurant') ||
    venueType.includes('dining') ||
    venueType.includes('food')
  ) {
    return 1;
  }

  // Drinks/bars second (priority 2)
  if (
    category === 'drinks' ||
    venueType.includes('bar') ||
    venueType.includes('brewery') ||
    venueType.includes('pub') ||
    venueType.includes('wine') ||
    venueType.includes('cocktail')
  ) {
    return 2;
  }

  // Dessert/cafes/ice cream last (priority 3)
  if (
    category === 'dessert' ||
    category === 'cafes' ||
    venueType.includes('dessert') ||
    venueType.includes('ice cream') ||
    venueType.includes('bakery') ||
    venueType.includes('cafe') ||
    venueType.includes('coffee')
  ) {
    return 3;
  }

  // Experiences/activities in the middle (priority 1.5)
  return 1.5;
}

/**
 * Order venues in logical flow for event itinerary
 * Example: [Ice Cream, Restaurant, Bar] → [Restaurant, Bar, Ice Cream]
 */
export function orderVenuesLogically<T extends OrderableVenue>(venues: T[]): T[] {
  if (venues.length <= 1) return venues;

  // Sort by priority (lower number = earlier in sequence)
  return [...venues].sort((a, b) => getVenuePriority(a) - getVenuePriority(b));
}

/**
 * Categorize venue by time of day appropriateness
 * Returns array of suitable times: ['morning', 'afternoon', 'evening', 'night']
 */
export function categorizeVenueTimeOfDay(venueType: string): string[] {
  const type = venueType.toLowerCase();
  const suitableTimes: string[] = [];

  // Morning (8am-12pm)
  if (
    type.includes('coffee') ||
    type.includes('cafe') ||
    type.includes('breakfast') ||
    type.includes('brunch') ||
    type.includes('bakery')
  ) {
    suitableTimes.push('morning');
  }

  // Afternoon (12pm-5pm)
  if (
    type.includes('lunch') ||
    type.includes('cafe') ||
    type.includes('museum') ||
    type.includes('park') ||
    type.includes('activity') ||
    type.includes('shopping')
  ) {
    suitableTimes.push('afternoon');
  }

  // Evening (5pm-10pm) - most versatile
  if (
    type.includes('restaurant') ||
    type.includes('dinner') ||
    type.includes('bar') ||
    type.includes('brewery') ||
    type.includes('pub') ||
    type.includes('wine') ||
    type.includes('cocktail') ||
    type.includes('nightlife')
  ) {
    suitableTimes.push('evening');
  }

  // Night (10pm+)
  if (
    type.includes('bar') ||
    type.includes('club') ||
    type.includes('nightclub') ||
    type.includes('late')
  ) {
    suitableTimes.push('night');
  }

  // Default to evening if unclear (most common for social events)
  if (suitableTimes.length === 0) {
    suitableTimes.push('evening');
  }

  return suitableTimes;
}

/**
 * Check if venue is appropriate for given time of day
 * @param venueType - Type of venue
 * @param hour - Hour in 24-hour format (0-23)
 * @returns true if venue is suitable for that time
 */
export function isVenueAppropriateForTime(venueType: string, hour: number): boolean {
  const suitableTimes = categorizeVenueTimeOfDay(venueType);

  if (hour >= 8 && hour < 12 && suitableTimes.includes('morning')) return true;
  if (hour >= 12 && hour < 17 && suitableTimes.includes('afternoon')) return true;
  if (hour >= 17 && hour < 22 && suitableTimes.includes('evening')) return true;
  if (hour >= 22 || hour < 8) {
    if (suitableTimes.includes('night')) return true;
  }

  return false;
}

/**
 * Get the time period for a given hour
 */
export function getTimePeriod(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}
