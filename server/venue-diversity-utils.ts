/**
 * Venue Diversity Utilities
 *
 * Functions for ensuring venue variety and preventing unrealistic combinations
 * (e.g., prevents "3 dinner spots" or duplicate categories in same itinerary)
 */

export interface DiversifiableVenue {
  category?: string | null;
  venueType?: string | null;
  venueName?: string;
  [key: string]: any;
}

/**
 * Get effective category for a venue
 * Uses explicit category if available, otherwise infers from venue type
 */
export function getVenueCategory(venue: DiversifiableVenue): string {
  if (venue.category) return venue.category.toLowerCase();

  // Fallback to venue type analysis
  const venueType = venue.venueType?.toLowerCase() || '';

  if (venueType.includes('restaurant') || venueType.includes('dining') || venueType.includes('food')) {
    return 'meal';
  }
  if (venueType.includes('bar') || venueType.includes('brewery') || venueType.includes('pub')) {
    return 'drinks';
  }
  if (venueType.includes('ice cream') || venueType.includes('dessert') || venueType.includes('bakery')) {
    return 'dessert';
  }
  if (venueType.includes('cafe') || venueType.includes('coffee')) {
    return 'cafes';
  }

  return 'experiences';
}

/**
 * Select diverse venues ensuring no duplicate categories when possible
 *
 * Prioritizes high-scoring venues while maintaining category diversity.
 * CRITICAL RULE: Never allows 2+ meals in same itinerary (prevents "two dinners" problem)
 *
 * @param venues - Venues sorted by score (highest first)
 * @param desiredCount - Number of venues to select
 * @returns Array of selected venues with maximum diversity
 */
export function selectDiverseVenues<T extends DiversifiableVenue>(
  venues: T[],
  desiredCount: number
): T[] {
  if (venues.length === 0) return [];
  if (venues.length <= 1) return venues.slice(0, 1);
  if (desiredCount <= 0) return [];
  if (desiredCount === 1) return [venues[0]];

  const selected: T[] = [];
  const usedCategories = new Set<string>();

  // First pass: select venues with unique categories
  for (const venue of venues) {
    if (selected.length >= desiredCount) break;

    const category = getVenueCategory(venue);
    if (!usedCategories.has(category)) {
      selected.push(venue);
      usedCategories.add(category);
    }
  }

  // Second pass: if we haven't filled the desired count, allow duplicates
  // BUT: Never allow duplicate meals/restaurants (prevents "two dinners" issue)
  if (selected.length < desiredCount) {
    for (const venue of venues) {
      if (selected.length >= desiredCount) break;
      if (!selected.includes(venue)) {
        const category = getVenueCategory(venue);

        // CRITICAL: Never allow 2+ meals in same itinerary
        // This prevents unrealistic combinations like "two dinners back to back"
        if (category === 'meal' && usedCategories.has('meal')) {
          console.log(`[Diversity] Skipping duplicate meal: ${venue.venueName || 'unknown'}`);
          continue; // Skip second meal
        }

        selected.push(venue);
        usedCategories.add(category);
      }
    }
  }

  return selected;
}

/**
 * Validate that venue selection has good diversity
 * Returns true if selection passes diversity checks
 */
export function validateVenueDiversity<T extends DiversifiableVenue>(venues: T[]): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const categories = venues.map(v => getVenueCategory(v));
  const categoryCounts = new Map<string, number>();

  // Count categories
  for (const category of categories) {
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  // Check for duplicate meals (CRITICAL ISSUE)
  const mealCount = categoryCounts.get('meal') || 0;
  if (mealCount > 1) {
    issues.push(`Has ${mealCount} meals - should only have 1 meal per event`);
  }

  // Warn about other duplicates (less critical, but still worth noting)
  for (const [category, count] of categoryCounts.entries()) {
    if (count > 1 && category !== 'meal') {
      issues.push(`Has ${count} ${category} venues - consider more variety`);
    }
  }

  // Check if all venues are the same category
  if (categoryCounts.size === 1 && venues.length > 1) {
    issues.push(`All venues are ${categories[0]} - no diversity`);
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Get category distribution for a set of venues
 * Useful for logging/debugging
 */
export function getCategoryDistribution<T extends DiversifiableVenue>(
  venues: T[]
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const venue of venues) {
    const category = getVenueCategory(venue);
    distribution[category] = (distribution[category] || 0) + 1;
  }

  return distribution;
}

/**
 * Check if adding a venue would violate diversity rules
 */
export function canAddVenue<T extends DiversifiableVenue>(
  currentSelection: T[],
  newVenue: T
): { canAdd: boolean; reason?: string } {
  const newCategory = getVenueCategory(newVenue);
  const categories = currentSelection.map(v => getVenueCategory(v));

  // Check for duplicate meal
  if (newCategory === 'meal' && categories.includes('meal')) {
    return {
      canAdd: false,
      reason: 'Cannot add second meal to itinerary',
    };
  }

  return { canAdd: true };
}
