/**
 * AI Readiness Check Utility
 * Determines if a group has provided enough signal for AI to make good venue picks
 */

export interface AIReadiness {
  ready: boolean;
  hasLocation: boolean;
  hasCategories: boolean;
  hasPreferences: boolean;
  totalVenues: number;
  location?: string;
  categories?: string[];
  missingItems: ("location" | "categories" | "preferences")[];
  message: string;
}

interface Group {
  id: string;
  location?: string | null;
  locationBase?: string | null;
  activityTypes?: string[] | null;
  mealEnabled?: boolean;
  cafeEnabled?: boolean;
  drinksEnabled?: boolean;
  dessertEnabled?: boolean;
  experienceEnabled?: boolean;
}

// Minimum thresholds
const MIN_VENUES_FOR_AI = 5;

/**
 * Check if a group is ready for AI-powered event creation
 */
export function checkAIReadiness(
  group: Group | null | undefined,
  favoritesCount: number,
  activitiesCount: number
): AIReadiness {
  if (!group) {
    return {
      ready: false,
      hasLocation: false,
      hasCategories: false,
      hasPreferences: false,
      totalVenues: 0,
      missingItems: ["location", "categories", "preferences"],
      message: "Group data not available",
    };
  }

  // Check location
  const location = group.location || group.locationBase;
  const hasLocation = !!location && location.trim().length > 0;

  // Check categories - either from activityTypes array or individual flags
  const categoriesFromArray = group.activityTypes || [];
  const categoriesFromFlags = [
    group.mealEnabled && "meal",
    group.cafeEnabled && "cafe",
    group.drinksEnabled && "drinks",
    group.dessertEnabled && "dessert",
    group.experienceEnabled && "experience",
  ].filter(Boolean) as string[];

  const categories =
    categoriesFromArray.length > 0 ? categoriesFromArray : categoriesFromFlags;
  const hasCategories = categories.length > 0;

  // Check preferences (venues liked/saved)
  const totalVenues = favoritesCount + activitiesCount;
  const hasPreferences = totalVenues >= MIN_VENUES_FOR_AI;

  // Determine what's missing
  const missingItems: ("location" | "categories" | "preferences")[] = [];
  if (!hasLocation) missingItems.push("location");
  if (!hasCategories) missingItems.push("categories");
  if (!hasPreferences) missingItems.push("preferences");

  // Overall readiness
  const ready = hasLocation && hasCategories && hasPreferences;

  // Generate helpful message
  let message: string;
  if (ready) {
    message = `AI is ready! Using ${totalVenues} venues from your library.`;
  } else if (missingItems.length === 1) {
    const item = missingItems[0];
    if (item === "location") {
      message = "Set your group's location to enable AI.";
    } else if (item === "categories") {
      message = "Select activity types to help AI find relevant venues.";
    } else {
      message = `Add ${MIN_VENUES_FOR_AI - totalVenues} more venues for better AI suggestions.`;
    }
  } else if (missingItems.length === 2) {
    message = "Complete 2 quick steps to unlock AI-powered planning.";
  } else {
    message = "Set up your group to enable AI-powered event planning.";
  }

  return {
    ready,
    hasLocation,
    hasCategories,
    hasPreferences,
    totalVenues,
    location: location || undefined,
    categories: categories.length > 0 ? categories : undefined,
    missingItems,
    message,
  };
}

/**
 * Get a short status label for AI readiness
 */
export function getAIReadinessLabel(readiness: AIReadiness): string {
  if (readiness.ready) {
    return "Ready";
  }
  const remaining = readiness.missingItems.length;
  return `${remaining} step${remaining !== 1 ? "s" : ""} left`;
}

/**
 * Get badge variant based on readiness
 */
export function getAIReadinessBadgeVariant(
  readiness: AIReadiness
): "default" | "secondary" | "outline" {
  if (readiness.ready) {
    return "default";
  }
  if (readiness.missingItems.length === 1) {
    return "secondary";
  }
  return "outline";
}
