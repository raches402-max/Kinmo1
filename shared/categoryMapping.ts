// Category mapping utility - maps detailed activity categories to high-level buckets
// This ensures consistent category filtering across frontend and backend

export type HighLevelCategory = 'meal' | 'cafe' | 'drinks' | 'dessert' | 'experiences';

export interface CategoryMapping {
  [key: string]: HighLevelCategory;
}

// Map each detailed category to its high-level bucket
export const CATEGORY_TO_BUCKET: CategoryMapping = {
  // Meal bucket
  'restaurants': 'meal',
  'brunch': 'meal',
  'food-markets': 'meal',
  'potlucks': 'meal',
  
  // Cafe bucket
  'cafes': 'cafe',
  
  // Drinks bucket
  'wine-bars': 'drinks',
  'breweries': 'drinks',
  
  // Experiences bucket (everything else)
  'concerts': 'experiences',
  'karaoke': 'experiences',
  'dancing': 'experiences',
  'comedy': 'experiences',
  'movies': 'experiences',
  'museums': 'experiences',
  'sports': 'experiences',
  'outdoor': 'experiences',
  'games': 'experiences',
  'trivia': 'experiences',
};

// Reverse mapping: get all detailed categories for a high-level bucket
export function getCategoriesForBucket(bucket: HighLevelCategory): string[] {
  return Object.entries(CATEGORY_TO_BUCKET)
    .filter(([_, b]) => b === bucket)
    .map(([category]) => category);
}

// Get the high-level bucket for a detailed category
export function getBucketForCategory(category: string): HighLevelCategory | undefined {
  return CATEGORY_TO_BUCKET[category];
}

// Check if a category belongs to a specific bucket
export function isCategoryInBucket(category: string, bucket: HighLevelCategory): boolean {
  return CATEGORY_TO_BUCKET[category] === bucket;
}

// Get enabled buckets from group settings
export interface BucketStatus {
  meal: boolean;
  cafe: boolean;
  drinks: boolean;
  dessert: boolean;
  experiences: boolean;
}

export function getEnabledBuckets(status: BucketStatus): HighLevelCategory[] {
  return (Object.entries(status) as [HighLevelCategory, boolean][])
    .filter(([_, enabled]) => enabled)
    .map(([bucket]) => bucket);
}

// Filter categories by enabled buckets
export function filterCategoriesByBuckets(
  categories: string[], 
  enabledBuckets: HighLevelCategory[]
): string[] {
  return categories.filter(category => {
    const bucket = getBucketForCategory(category);
    return bucket && enabledBuckets.includes(bucket);
  });
}
