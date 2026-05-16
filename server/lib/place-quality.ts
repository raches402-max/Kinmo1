export function getQualityThresholds(searchRadius: number): { minRating: number; minReviews: number } {
  if (searchRadius <= 2) {
    // Very local (2-mile radius) - moderate standards
    return { minRating: 3.5, minReviews: 10 };
  }

  if (searchRadius <= 10) {
    // Citywide (10-mile radius) - slightly stricter
    return { minRating: 3.5, minReviews: 15 };
  }

  // Regional (30-50 mile radius) - more lenient for wider search
  return { minRating: 3.3, minReviews: 15 };
}

/**
 * Parse Google Places price level (handles both enum strings and legacy numbers)
 * Google's new API returns: "PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", etc.
 * Legacy API returned: 0, 1, 2, 3, 4
 * @returns number 0-4, or null if unavailable
 */
export function parsePriceLevel(priceLevel: string | number | null | undefined): number | null {
  if (!priceLevel) return null;

  if (typeof priceLevel === "number") return priceLevel;

  const priceLevelStr = priceLevel.toString().toUpperCase();

  if (priceLevelStr.includes("FREE")) return 0;
  if (priceLevelStr.includes("INEXPENSIVE")) return 1;
  if (priceLevelStr.includes("MODERATE")) return 2;
  if (priceLevelStr.includes("VERY_EXPENSIVE")) return 4;
  if (priceLevelStr.includes("EXPENSIVE")) return 3;

  const parsed = parseInt(priceLevelStr, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
