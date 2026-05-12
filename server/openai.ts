// Reference: javascript_openai blueprint
import OpenAI from "openai";
import { db } from "./db";
import { apiCallLogs, aiCategorizationCache } from "@shared/schema";
import { eq, gt, sql } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Log OpenAI API call for cost tracking and monitoring
 * Cost estimates based on OpenAI pricing (as of 2024)
 * GPT-4o: $2.50/1M input tokens, $10.00/1M output tokens
 * GPT-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens
 */
export async function logApiCall(params: {
  service: string;
  method: string;
  cacheStatus: 'hit' | 'miss' | 'write';
  status: 'success' | 'error';
  responseTimeMs?: number;
  costEstimate?: number;
  parameters?: any;
  errorMessage?: string;
  metadata?: any;
}) {
  try {
    await db.insert(apiCallLogs).values({
      service: params.service,
      method: params.method,
      cacheStatus: params.cacheStatus,
      status: params.status,
      responseTimeMs: params.responseTimeMs,
      costEstimate: params.costEstimate ? params.costEstimate.toString() : null,
      parameters: params.parameters || null,
      errorMessage: params.errorMessage,
      metadata: params.metadata || null,
      createdAt: new Date(),
    });
  } catch (error) {
    // Don't let logging failures break the main flow
    console.error('[API Logging] Failed to log API call:', error);
  }
}

/**
 * Calculate cost estimate for OpenAI API calls
 * Based on token counts and model pricing
 */
export function calculateOpenAICost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
    'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
  return (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
}

/**
 * Safely parse JSON from OpenAI response with fallback
 * Prevents crashes from malformed AI responses
 */
function safeParseJSON<T>(content: string | null | undefined, fallback: T, context: string): T {
  try {
    return JSON.parse(content || JSON.stringify(fallback));
  } catch (parseError) {
    console.error(`[OpenAI] JSON parse error in ${context}:`, parseError);
    return fallback;
  }
}

/**
 * Simple in-memory cache with TTL for AI responses
 * Reduces API costs by caching deterministic results
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const aiCache = new Map<string, CacheEntry<any>>();

// Clean expired entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  aiCache.forEach((entry, key) => {
    if (entry.expiresAt < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => aiCache.delete(key));
}, 5 * 60 * 1000);

/**
 * Get cached value if exists and not expired
 */
export function getAICache<T>(key: string): T | null {
  const entry = aiCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    aiCache.delete(key);
    return null;
  }
  return entry.value as T;
}

/**
 * Set cached value with TTL in seconds
 */
export function setAICache<T>(key: string, value: T, ttlSeconds: number): void {
  aiCache.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000),
  });
}

// Time category mapping based on venue type
export function categorizeByTime(venueType: string): 'quick' | 'standard' | 'large' {
  const type = venueType.toLowerCase();
  
  // Quick: Under 90 min - Drinks, bars, desserts, cafes
  const quickKeywords = [
    'bar', 'cocktail', 'wine', 'brewery', 'beer', 'pub',
    'cafe', 'coffee', 'boba', 'bubble tea', 'tea',
    'dessert', 'ice cream', 'gelato', 'bakery', 'pastry'
  ];
  
  // Large: 4+ hours - Activities, hikes, outdoor experiences, events
  const largeKeywords = [
    'hike', 'hiking', 'trail', 'park', 'outdoor', 'beach', 'nature',
    'museum', 'gallery', 'art', 'exhibit',
    'concert', 'show', 'festival', 'event', 'game', 'sporting',
    'activity', 'experience', 'adventure', 'tour'
  ];
  
  // Check quick first
  if (quickKeywords.some(keyword => type.includes(keyword))) {
    return 'quick';
  }
  
  // Check large
  if (largeKeywords.some(keyword => type.includes(keyword))) {
    return 'large';
  }
  
  // Default to standard (1-3 hours) - restaurants, meals, etc.
  return 'standard';
}

// Category detection based on keywords in venue name/type
// This filters AI suggestions BEFORE calling Google Places API to save quota
// Uses tokenizer-aware matching to handle both compound words and avoid false positives
export function detectCategory(venueName: string, venueType: string): 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences' {
  const combined = `${venueName} ${venueType}`.toLowerCase();
  
  // Tokenize by splitting on non-alphabetic characters
  // This creates tokens like: "craft brewery" → ["craft", "brewery"]
  // And handles compounds: "microbrewery" → ["microbrewery"]
  const tokens = combined.split(/[^a-z]+/).filter(t => t.length > 0);
  
  // Helper function to check if keyword matches any token or is contained in any token
  const containsKeyword = (keyword: string): boolean => {
    return tokens.some(token => {
      // Exact match (e.g., "bar" === "bar")
      if (token === keyword) return true;
      
      // Compound word match (e.g., "brewery" in "microbrewery")
      // Allow if keyword appears at the end of a token (common prefixes like "micro", "craft", "nano")
      if (token.endsWith(keyword) && token.length > keyword.length) {
        // Check if the prefix is a common modifier
        const prefix = token.substring(0, token.length - keyword.length);
        const commonPrefixes = ['micro', 'craft', 'nano', 'mini', 'local', 'dive', 'sports', 'wine', 'cocktail'];
        if (commonPrefixes.includes(prefix)) {
          return true;
        }
      }
      
      return false;
    });
  };
  
  // Helper to check if ANY keyword matches
  const matchesAny = (keywords: string[]): boolean => {
    return keywords.some(keyword => containsKeyword(keyword));
  };
  
  // CAFE keywords - coffee shops, cafes
  const cafeKeywords = [
    'cafe', 'coffee', 'espresso', 'latte', 'cappuccino', 'coffeehouse'
  ];
  
  // DRINKS keywords - bars, breweries, wine
  // Will match: "bar", "microbrewery", "winery", "craftbrewery", etc.
  // Won't match: "barbecue", "barista" (because "barbe" and "barist" aren't in commonPrefixes)
  const drinksKeywords = [
    'bar', 'cocktail', 'wine', 'brewery', 'beer', 'pub', 'tavern',
    'lounge', 'speakeasy', 'taproom', 'winery', 'brewhouse'
  ];
  
  // DESSERT keywords - sweets, ice cream, boba
  const dessertKeywords = [
    'dessert', 'gelato', 'boba', 'bakery', 'pastry', 'donut', 
    'cupcake', 'cookie', 'candy', 'creamery', 'froyo', 'churro'
  ];
  
  // EXPERIENCES keywords - activities, museums, outdoor
  const experiencesKeywords = [
    'museum', 'gallery', 'concert', 'theater', 'cinema',
    'hike', 'hiking', 'trail', 'park', 'beach', 'outdoor',
    'festival', 'event', 'sporting', 'karaoke', 'comedy',
    'activity', 'adventure', 'tour', 'aquarium', 'zoo', 'arcade',
    'bowling', 'escape', 'trivia'
  ];
  
  // MEAL keywords - restaurants and food establishments (including "bar" establishments)
  // Check these BEFORE drinks to catch sushi bars, ramen bars, etc.
  const restaurantBarKeywords = [
    'sushi', 'ramen', 'poke', 'taco', 'burrito', 'pizza', 'burger',
    'noodle', 'dumpling', 'bbq', 'barbecue', 'grill', 'steakhouse',
    'restaurant', 'diner', 'eatery', 'bistro', 'kitchen', 'gastropub',
    // Japanese/Asian food-first establishments
    'izakaya', 'omakase', 'robata', 'yakitori', 'yakiniku', 'shabu',
    'hotpot', 'dim sum', 'tapas', 'mezze', 'cantina', 'taqueria',
    // Italian food-first establishments
    'osteria', 'trattoria', 'enoteca'
  ];
  
  // Check in priority order (most specific first)
  
  // First check if it's a restaurant-type establishment (even if it has "bar" in the name)
  // This catches "sushi bar", "ramen bar", etc. before the drinks check
  if (matchesAny(restaurantBarKeywords)) {
    return 'meal';
  }
  
  if (matchesAny(cafeKeywords)) {
    return 'cafes';
  }
  
  if (matchesAny(drinksKeywords)) {
    return 'drinks';
  }
  
  if (matchesAny(dessertKeywords)) {
    return 'dessert';
  }
  
  if (matchesAny(experiencesKeywords)) {
    return 'experiences';
  }
  
  // Default to meal (restaurants, dining)
  return 'meal';
}

export interface ActivitySuggestion {
  venueName: string;
  venueType: string;
  description: string;
  reasoning: string;
  searchQuery: string; // For Google Places search
  priceEstimate?: string; // For events: "$25-50 per person", "Free", etc.
  timeConstraints?: string; // For events: "Only on Friday afternoons", "Weekends only", etc.
  complementaryFoodPlace?: string; // Optional nearby food suggestion (e.g., "coffee shop" for a park)
}

export async function generateActivitySuggestions(groupData: {
  locationBase: string;
  budgetMin: number;
  budgetMax: number;
  meetingFrequency: string;
  availability: any;
  closenessLevel: number;
  noveltyPreference: number;
  activityCategories?: string[];
  pastPreferences?: string;
  additionalInstructions?: string;
  searchRadius?: number; // Search radius in miles (2, 10, 30, 50)
  previousFeedback?: { venueName: string; venueType: string; feedback: string; description: string }[];
  votingFeedback?: { venueName: string; venueType: string; upvotes: number; downvotes: number; netVotes: number; description: string }[];
  provenWinners?: { venueName: string; venueType: string; avgRating: number; lastVisit: Date; daysSinceLastVisit: number }[]; // Highly-rated venues ready to revisit
  likedConcepts?: string[];
  passedConcepts?: string[];
  previouslySuggestedVenues?: string[];
  targetCategories?: string[]; // NEW: For category-specific generation
  memberConstraints?: { scheduleConflicts?: string[]; budgetConcern?: boolean; distanceConcern?: boolean; notes?: string }[]; // Member RSVP constraints
  rejectedVenues?: string[]; // Venues that don't exist in Google Places (blacklist)
  seenVenues?: string[]; // Venues already shown to the group (to prevent repetition)
  groupInsights?: any; // Group-level learned insights (budget, availability, activity types)
  // High-level category filters
  mealEnabled?: boolean;
  cafeEnabled?: boolean;
  drinksEnabled?: boolean;
  dessertEnabled?: boolean;
  experiencesEnabled?: boolean;
}): Promise<ActivitySuggestion[]> {
  try {
    // Generate 20 suggestions (4 per category)
    // Increased from 15 to provide more variety and reduce repetition
    
    // Calculate novelty split based on 20 suggestions
    // novelty 1 = 20 familiar, novelty 3 = 10-10 split, novelty 5 = 20 new
    // Formula: familiar = 20 - (noveltyPreference - 1) * 5, rounded
    const familiarCount = Math.round(20 - (groupData.noveltyPreference - 1) * 5);
    const newCount = 20 - familiarCount;

    // Format availability for display
    const formatAvailabilityForPrompt = (availability: any): string => {
      if (typeof availability === 'string') {
        return availability;
      }
      
      if (typeof availability === 'object' && availability !== null) {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const times = ['morning', 'afternoon', 'evening'];
        const selectedSlots: string[] = [];
        
        days.forEach(day => {
          if (availability[day]) {
            const dayTimes = times.filter(time => availability[day][time]);
            if (dayTimes.length > 0) {
              selectedSlots.push(`${day}: ${dayTimes.join(', ')}`);
            }
          }
        });
        
        return selectedSlots.length > 0 ? selectedSlots.join('; ') : 'Flexible';
      }
      
      return 'Flexible';
    };

    const availabilityText = formatAvailabilityForPrompt(groupData.availability);

    // Format previous feedback for the prompt
    let feedbackContext = '';
    if (groupData.previousFeedback && groupData.previousFeedback.length > 0) {
      const lovedActivities = groupData.previousFeedback.filter(f => f.feedback === 'love').map(f => `${f.venueName} (${f.venueType})`);
      const moreActivities = groupData.previousFeedback.filter(f => f.feedback === 'more').map(f => `${f.venueName} (${f.venueType})`);
      const lessActivities = groupData.previousFeedback.filter(f => f.feedback === 'less').map(f => `${f.venueName} (${f.venueType})`);
      
      feedbackContext = '\nPrevious Feedback:';
      if (lovedActivities.length > 0) {
        feedbackContext += `\n- LOVED (suggest more like these): ${lovedActivities.join(', ')}`;
      }
      if (moreActivities.length > 0) {
        feedbackContext += `\n- Want more like: ${moreActivities.join(', ')}`;
      }
      if (lessActivities.length > 0) {
        feedbackContext += `\n- Want less like: ${lessActivities.join(', ')}`;
      }
    }

    // Format voting feedback from Favorites list
    let votingContext = '';
    if (groupData.votingFeedback && groupData.votingFeedback.length > 0) {
      const popularVenues = groupData.votingFeedback
        .filter(v => v.netVotes > 0)
        .sort((a, b) => b.netVotes - a.netVotes)
        .map(v => `${v.venueName} (${v.venueType}) [+${v.upvotes}/-${v.downvotes}]`);
      
      const unpopularVenues = groupData.votingFeedback
        .filter(v => v.netVotes < 0)
        .sort((a, b) => a.netVotes - b.netVotes)
        .map(v => `${v.venueName} (${v.venueType}) [+${v.upvotes}/-${v.downvotes}]`);
      
      votingContext = '\nFavorites List Voting:';
      if (popularVenues.length > 0) {
        votingContext += `\n- POPULAR (high net votes - suggest more like these): ${popularVenues.join(', ')}`;
      }
      if (unpopularVenues.length > 0) {
        votingContext += `\n- UNPOPULAR (negative net votes - avoid similar): ${unpopularVenues.join(', ')}`;
      }
    }

    // Format swipe session feedback
    let swipeContext = '';
    if ((groupData.likedConcepts && groupData.likedConcepts.length > 0) ||
        (groupData.passedConcepts && groupData.passedConcepts.length > 0)) {
      swipeContext = '\nSwipe Session Preferences:';
      if (groupData.likedConcepts && groupData.likedConcepts.length > 0) {
        swipeContext += `\n- LIKED concepts (prioritize these types): ${groupData.likedConcepts.join(', ')}`;
      }
      if (groupData.passedConcepts && groupData.passedConcepts.length > 0) {
        swipeContext += `\n- PASSED concepts (avoid these types): ${groupData.passedConcepts.join(', ')}`;
      }
    }

    // Format proven winners from post-event feedback
    let provenWinnersContext = '';
    if (groupData.provenWinners && groupData.provenWinners.length > 0) {
      const winnersFormatted = groupData.provenWinners.map(w =>
        `${w.venueName} (${w.venueType}) [${w.avgRating}/5 ⭐, last visit ${Math.floor(w.daysSinceLastVisit / 30)} months ago]`
      );
      provenWinnersContext = '\n\n⭐ PROVEN WINNERS - Highly-Rated Venues Ready to Revisit:';
      provenWinnersContext += `\n- The group LOVED these venues (rated 4-5 stars) and it\'s been 60+ days since visiting`;
      provenWinnersContext += `\n- PRIORITIZE including some of these in your suggestions: ${winnersFormatted.join(', ')}`;
      provenWinnersContext += `\n- These are guaranteed crowd-pleasers based on actual group feedback`;
    }

    // Format member constraints from RSVP feedback
    let constraintsContext = '';
    if (groupData.memberConstraints && groupData.memberConstraints.length > 0) {
      const allScheduleConflicts = new Set<string>();
      let budgetConcernCount = 0;
      let distanceConcernCount = 0;
      const notes: string[] = [];

      groupData.memberConstraints.forEach(constraint => {
        if (constraint.scheduleConflicts) {
          constraint.scheduleConflicts.forEach(conflict => allScheduleConflicts.add(conflict));
        }
        if (constraint.budgetConcern) budgetConcernCount++;
        if (constraint.distanceConcern) distanceConcernCount++;
        if (constraint.notes) notes.push(constraint.notes);
      });

      constraintsContext = '\n🚨 CRITICAL - Member Constraints (Auto-Avoid):';
      if (allScheduleConflicts.size > 0) {
        constraintsContext += `\n- SCHEDULE CONFLICTS: Multiple members can't do ${Array.from(allScheduleConflicts).join(', ')} - AVOID suggesting events at these times`;
      }
      if (budgetConcernCount > 0) {
        constraintsContext += `\n- BUDGET CONCERNS: ${budgetConcernCount} member(s) mentioned budget is tight - prioritize lower-cost options within the budget range`;
      }
      if (distanceConcernCount > 0) {
        constraintsContext += `\n- DISTANCE CONCERNS: ${distanceConcernCount} member(s) mentioned distance/location is an issue - prioritize venues within the closer search radius`;
      }
      if (notes.length > 0) {
        constraintsContext += `\n- MEMBER FEEDBACK: ${notes.join(' | ')}`;
      }
    }

    // Format group-level insights from learning system
    let insightsContext = '';
    if (groupData.groupInsights) {
      const insights = groupData.groupInsights;
      const insightsParts: string[] = [];

      // Budget insights
      if (insights.budget && !insights.budget.dismissed) {
        if (insights.budget.membersConcerned > 0) {
          insightsParts.push(`💰 BUDGET: ${insights.budget.membersConcerned} members prefer budget-friendly options`);
        }
      }

      // Availability insights
      if (insights.availability && !insights.availability.dismissed) {
        if (insights.availability.lowTurnoutDays && insights.availability.lowTurnoutDays.length > 0) {
          const lowDays = insights.availability.lowTurnoutDays.map((d: any) => `${d.day} (${d.averageAttendance}% attendance)`);
          insightsParts.push(`📅 LOW ATTENDANCE DAYS: ${lowDays.join(', ')} - Consider scheduling on other days`);
        }
        if (insights.availability.bestDays && insights.availability.bestDays.length > 0) {
          const bestDays = insights.availability.bestDays.slice(0, 2).map((d: any) => d.day).join(', ');
          insightsParts.push(`📅 BEST DAYS: ${bestDays} have highest attendance`);
        }
      }

      // Activity type insights
      if (insights.activityTypes && !insights.activityTypes.dismissed) {
        if (insights.activityTypes.distribution && insights.activityTypes.distribution.length > 0) {
          const dominantCategory = insights.activityTypes.distribution[0];
          if (dominantCategory.percentage > 40) {
            insightsParts.push(`🎯 ACTIVITY DIVERSITY: Group has done lots of ${dominantCategory.category} (${dominantCategory.percentage}%) - consider suggesting variety from other categories`);
          }
        }
      }

      if (insightsParts.length > 0) {
        insightsContext = '\n\n📊 GROUP LEARNING INSIGHTS (What we\'ve learned about this group):\n' + insightsParts.map(p => `- ${p}`).join('\n');
      }
    }

    // Format activity categories for the prompt
    const categoryLabels: Record<string, string> = {
      'concerts': 'Concerts',
      'karaoke': 'Karaoke',
      'dancing': 'Dancing / Clubs',
      'comedy': 'Comedy Shows',
      'movies': 'Movie Theaters',
      'museums': 'Museums / Art Galleries',
      'sports': 'Sports Games',
      'outdoors': 'Hikes / Outdoors',
      'game-nights': 'Game Nights',
      'trivia': 'Trivia Nights'
    };
    
    let categoriesContext = '';
    if (groupData.activityCategories && groupData.activityCategories.length > 0) {
      const selectedCategories = groupData.activityCategories.map(id => categoryLabels[id] || id).join(', ');
      categoriesContext = `\nActivity Interests: ${selectedCategories}`;
    }

    // Format previously suggested venues to avoid repeats.
    // Cap at the 10 most-recent — older entries bloat prompt tokens for little gain.
    let avoidVenuesContext = '';
    if (groupData.previouslySuggestedVenues && groupData.previouslySuggestedVenues.length > 0) {
      const recent = groupData.previouslySuggestedVenues.slice(-10);
      avoidVenuesContext = `\n\nIMPORTANT - DO NOT suggest these venues again (recently suggested): ${recent.join(', ')}`;
    }

    // Format seen venues to prevent repetitive suggestions. Cap at 10 most-recent.
    let seenVenuesContext = '';
    if (groupData.seenVenues && groupData.seenVenues.length > 0) {
      const recent = groupData.seenVenues.slice(-10);
      seenVenuesContext = `\n\n🚫 ALREADY SHOWN TO GROUP - do not suggest again: ${recent.join(', ')}`;
    }

    // Format rejected venues (venues that don't exist in Google Places).
    // Keep more of these (25) — re-suggesting one wastes a Places API call.
    let rejectedVenuesContext = '';
    if (groupData.rejectedVenues && groupData.rejectedVenues.length > 0) {
      const recent = groupData.rejectedVenues.slice(-25);
      rejectedVenuesContext = `\n\nThese venues DO NOT EXIST in Google Places. NEVER suggest them: ${recent.join(', ')}`;
    }

    // Format target categories for focused generation
    let targetCategoriesContext = '';
    if (groupData.targetCategories && groupData.targetCategories.length > 0) {
      const categoryDescriptions: Record<string, string> = {
        'meal': 'MEAL venues (restaurants, brunch spots, dining)',
        'cafes': 'CAFES (coffee shops, cafes)',
        'drinks': 'DRINKS (alcohol-focused bars, cocktail lounges, breweries, wine bars - NOT restaurants or sushi bars)',
        'dessert': 'DESSERT (boba, ice cream, dessert shops)',
        'experiences': 'EXPERIENCES (museums, parks, concerts, activities)'
      };
      
      const targetDescriptions = groupData.targetCategories
        .map(cat => categoryDescriptions[cat] || cat)
        .join(', ');
      
      targetCategoriesContext = `\n\n🎯 CRITICAL - TARGETED CATEGORY GENERATION:
- We need MORE suggestions in these specific categories: ${targetDescriptions}
- Generate ALL 15 suggestions focused ONLY on these categories
- Distribute the 15 suggestions across ONLY the target categories (ignore balanced distribution)
- This is a retry to fill gaps - prioritize these categories above all else`;
    }

    // Format high-level category filters - hard exclusions
    let categoryFilterContext = '';
    const enabledBuckets: string[] = [];
    const disabledBuckets: string[] = [];
    
    // Check which buckets are enabled (default true if not specified)
    if (groupData.mealEnabled !== false) enabledBuckets.push('MEAL');
    else disabledBuckets.push('MEAL (restaurants, brunch, dining)');
    
    if (groupData.cafeEnabled !== false) enabledBuckets.push('CAFE');
    else disabledBuckets.push('CAFE (cafes, coffee shops)');
    
    if (groupData.drinksEnabled !== false) enabledBuckets.push('DRINKS');
    else disabledBuckets.push('DRINKS (alcohol-focused bars, cocktail lounges, breweries, beer gardens - NOT restaurants)');
    
    if (groupData.dessertEnabled !== false) enabledBuckets.push('DESSERT');
    else disabledBuckets.push('DESSERT (dessert shops, ice cream, boba, bakeries)');
    
    if (groupData.experiencesEnabled !== false) enabledBuckets.push('EXPERIENCES');
    else disabledBuckets.push('EXPERIENCES (concerts, museums, outdoor activities, games, shows, etc.)');
    
    // Calculate category distribution based on enabled categories
    const enabledCount = enabledBuckets.length;
    const suggestionsPerCategory = Math.floor(20 / enabledCount);
    const distributionText = enabledBuckets.map(cat => `${suggestionsPerCategory} ${cat}`).join(' + ');
    
    if (disabledBuckets.length > 0) {
      categoryFilterContext = `\n\n🚫 CRITICAL - HARD CATEGORY EXCLUSIONS (ABSOLUTE REQUIREMENT):
- The group has DISABLED these categories - you MUST generate ZERO suggestions from them:
  ${disabledBuckets.map(b => `  ❌ ${b}`).join('\n')}
- ONLY generate suggestions from these ENABLED categories: ${enabledBuckets.join(', ')}
- Distribute ALL 20 suggestions like this: ${distributionText} = 20 total
- Generate ${suggestionsPerCategory} suggestions for EACH enabled category
- If you suggest ANY venue from a disabled category, that suggestion will be REJECTED
- Example: If CAFE is disabled, DO NOT suggest any cafes or coffee shops - suggest ${suggestionsPerCategory} meals + ${suggestionsPerCategory} drinks + ${suggestionsPerCategory} dessert + ${suggestionsPerCategory} experiences instead`;
    }

    // Format search radius for prompt - ensure valid value
    const searchRadius = groupData.searchRadius && [2, 10, 30, 50].includes(groupData.searchRadius) 
      ? groupData.searchRadius 
      : 2; // Default to 2 miles (Nearby)
    
    if (!groupData.searchRadius) {

    } else if (![2, 10, 30, 50].includes(groupData.searchRadius)) {
      console.warn(`[AI Generation] Invalid search radius ${groupData.searchRadius}, defaulting to 2 miles (Nearby)`);
    }
    
    const radiusTier = 
      searchRadius <= 2 ? 'Nearby (< 2 miles)' :
      searchRadius <= 10 ? 'Citywide (< 10 miles)' :
      searchRadius <= 30 ? 'Special Trip (< 30 miles)' :
      'Road Trip (< 50 miles)';

    // Detect if this is category-specific generation (fast path)
    const isCategorySpecific = groupData.targetCategories && groupData.targetCategories.length > 0;
    const suggestionCount = isCategorySpecific ? 10 : 20;
    const useSimplifiedPrompt = isCategorySpecific;

    // Category-specific simplified prompt (70% shorter, 3-5x faster)
    if (useSimplifiedPrompt) {
      const categoryDescriptions: Record<string, string> = {
        'meal': 'MEAL venues (restaurants, brunch spots, dining)',
        'cafes': 'CAFES (coffee shops, cafes)',
        'drinks': 'DRINKS (alcohol-focused bars, cocktail lounges, breweries, wine bars - NOT restaurants or sushi bars)',
        'dessert': 'DESSERT (boba, ice cream, dessert shops)',
        'experiences': 'EXPERIENCES (museums, parks, concerts, activities)'
      };
      
      const targetCategory = groupData.targetCategories![0];
      const categoryName = categoryDescriptions[targetCategory] || targetCategory;

      const simplifiedPrompt = `Generate ${suggestionCount} ${categoryName} suggestions.

Location: ${groupData.locationBase} (${radiusTier})
Budget: $${groupData.budgetMin}-${groupData.budgetMax}/person
Category: ${categoryName}${avoidVenuesContext}${seenVenuesContext}${rejectedVenuesContext}

Requirements:
1. ONLY ${categoryName}
2. venueName: Real venue (e.g. "Foreign Cinema", "Tartine Bakery" - NOT "restaurant")
3. venueType: Specific (e.g. "cocktail bar", "sushi restaurant")
4. Fits budget
5. searchQuery: MUST include actual venue name + city (e.g. "Tartine Bakery San Francisco" NOT "bakery San Francisco")
6. Description: 1-4 words
7. Reasoning: 2-5 words

Return JSON:
{
  "suggestions": [
    {
      "venueName": "Real venue name",
      "venueType": "specific type",
      "description": "1-4 words",
      "reasoning": "2-5 words",
      "searchQuery": "Real venue name city"
    }
  ]
}`;

      console.log(`[OpenAI] Category-specific generation: Using simplified prompt (${suggestionCount} ${categoryName})`);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Faster and cheaper for category-specific
        messages: [
          {
            role: "system",
            content: `You are an activity suggestion generator. Return EXACTLY ${suggestionCount} suggestions in valid JSON format.`
          },
          {
            role: "user",
            content: simplifiedPrompt
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      const result = safeParseJSON(response.choices[0].message.content, { suggestions: [] }, 'category-specific suggestions');
      console.log(`[OpenAI] ✅ Category-specific: Received ${result.suggestions?.length || 0} suggestions`);
      
      if (!result.suggestions || result.suggestions.length === 0) {
        throw new Error("OpenAI returned no suggestions");
      }
      
      return result.suggestions;
    }

    // Extract city name from locationBase for strict geographic filtering
    const cityMatch = groupData.locationBase.match(/^([^,]+)/);
    const cityName = cityMatch ? cityMatch[1].trim() : groupData.locationBase;
    
    // Build location enforcement based on search radius
    const locationEnforcement = searchRadius <= 2 
      ? `🚨 CRITICAL LOCATION RULE: ALL venues MUST be located in ${cityName} ONLY. DO NOT suggest venues from neighboring cities (e.g., San Mateo, Oakland, Berkeley, Palo Alto, etc.). Stay within ${cityName} city limits.`
      : searchRadius <= 10
      ? `LOCATION: Venues should be within ${cityName} and immediate metro area (< 10 miles).`
      : `LOCATION: Venues within ${radiusTier} of ${cityName}.`;

    // Build exact distribution requirements with hard math
    const enabledCategoryNames = enabledBuckets.map(cat => {
      const nameMap: Record<string, string> = {
        'MEAL': 'MEAL',
        'CAFE': 'CAFE', 
        'DRINKS': 'DRINKS',
        'DESSERT': 'DESSERT',
        'EXPERIENCES': 'EXPERIENCES'
      };
      return nameMap[cat] || cat;
    });
    
    const exactDistribution = disabledBuckets.length > 0 
      ? `EXACT DISTRIBUTION REQUIRED:\n${enabledCategoryNames.map(cat => `- ${cat}: EXACTLY ${suggestionsPerCategory} suggestions`).join('\n')}\nTOTAL: ${suggestionsPerCategory} × ${enabledBuckets.length} = ${suggestionCount} suggestions`
      : `EXACT DISTRIBUTION REQUIRED:\n- MEAL: EXACTLY 4\n- CAFE: EXACTLY 4\n- DRINKS: EXACTLY 4\n- DESSERT: EXACTLY 4\n- EXPERIENCES: EXACTLY 4\nTOTAL: 20 suggestions`;
    
    // Build disabled categories warning
    const disabledWarning = disabledBuckets.length > 0 
      ? `\n\n🚨 DISABLED CATEGORIES (DO NOT SUGGEST):\n${disabledBuckets.map(cat => `- ${cat}: FORBIDDEN - Any suggestion from this category will be REJECTED`).join('\n')}\n\nIf you suggest ANY venue from disabled categories (${disabledBuckets.join(', ')}), those suggestions will be immediately deleted.`
      : '';
    
    const prompt = `Generate ${suggestionCount} activity suggestions.

${exactDistribution}
${locationEnforcement}${disabledWarning}

Location: ${groupData.locationBase} (${radiusTier})
Budget: $${groupData.budgetMin}-${groupData.budgetMax}/person
Availability: ${availabilityText}
${groupData.additionalInstructions ? `\nUSER REQUEST: ${groupData.additionalInstructions}` : `${categoriesContext}
${groupData.pastPreferences ? `Past: ${groupData.pastPreferences}` : ''}${feedbackContext}${votingContext}${swipeContext}${provenWinnersContext}`}${constraintsContext}${insightsContext}${avoidVenuesContext}${seenVenuesContext}${rejectedVenuesContext}${targetCategoriesContext}${categoryFilterContext}

${groupData.additionalInstructions ? `Follow user request. Ignore other context if conflicts.` : `Use feedback to guide. ${familiarCount > 0 ? `${familiarCount} familiar + ${newCount} new (mark "NEW:" in reasoning).` : ''}`}

Rules:
1. ${locationEnforcement}
2. ${exactDistribution.replace('EXACT DISTRIBUTION REQUIRED:\n', '')}
3. venueName: Real venue (e.g. "Foreign Cinema", "Tartine Bakery" - NOT "restaurant", "bakery")
4. venueType: Specific (e.g. "sushi restaurant" NOT "Asian food")
5. No duplicates${groupData.previouslySuggestedVenues && groupData.previouslySuggestedVenues.length > 0 ? ` (avoid: ${groupData.previouslySuggestedVenues.slice(0, 6).join(', ')}${groupData.previouslySuggestedVenues.length > 6 ? '...' : ''})` : ''}${groupData.rejectedVenues && groupData.rejectedVenues.length > 0 ? ` (banned: ${groupData.rejectedVenues.join(', ')})` : ''}
6. Description: 1-4 words
7. Reasoning: 2-5 words
8. searchQuery: MUST include actual venue name + city (e.g. "Tartine Bakery San Francisco" NOT "bakery San Francisco")

Return JSON:
{
  "suggestions": [
    {
      "venueName": "Real venue name",
      "venueType": "specific type",
      "description": "1-4 words",
      "reasoning": "2-5 words",
      "searchQuery": "Real venue name city"
    }
  ]
}`;

    console.log(`[OpenAI] Sending prompt with availability: ${availabilityText}`);

    // Use GPT-4o for activity suggestions - better at understanding complex preferences and constraints
    // All other AI features use gpt-4o-mini for cost efficiency
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert activity planner who creates personalized suggestions based on group preferences. CRITICAL: You MUST always return EXACTLY 20 suggestions in the suggestions array. Always respond with valid JSON containing exactly 20 items."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4000, // Supports 20 suggestions (~200 tokens each = ~4000 total)
    });
    const responseTimeMs = Date.now() - startTime;

    const result = safeParseJSON(response.choices[0].message.content, { suggestions: [] }, 'activity suggestions');
    const suggestionsCount = result.suggestions?.length || 0;
    console.log(`[OpenAI] ✅ Received response with ${suggestionsCount} suggestions (target: 20)`);

    // Log token usage for debugging
    console.log(`[OpenAI] Token usage: ${response.usage?.completion_tokens || 0} completion tokens (max: 4000)`);

    // Log API call
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    await logApiCall({
      service: 'openai',
      method: 'generateActivitySuggestions',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: calculateOpenAICost('gpt-4o', inputTokens, outputTokens),
      parameters: { location: groupData.locationBase, budget: `$${groupData.budgetMin}-${groupData.budgetMax}` },
      metadata: {
        model: 'gpt-4o',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        suggestionCount: suggestionsCount
      },
    });
    
    if (!result.suggestions || result.suggestions.length === 0) {
      throw new Error("OpenAI returned no activity suggestions. The response may be empty or malformed.");
    }
    
    if (result.suggestions.length < 20) {
      console.log(`[OpenAI] ℹ️  Received ${result.suggestions.length}/20 suggestions (OpenAI sometimes returns fewer than requested - this is normal)`);
    }
    
    if (result.suggestions.length < 15) {
      console.warn(`[OpenAI] ⚠️ Very low suggestion count (${result.suggestions.length}) - may need additional retries for balanced categories`);
    }
    
    return result.suggestions;
  } catch (error) {
    console.error("Error generating activity suggestions:", error);
    // Log API call failure
    await logApiCall({
      service: 'openai',
      method: 'generateActivitySuggestions',
      cacheStatus: 'miss',
      status: 'error',
      parameters: { location: groupData.locationBase },
      errorMessage: (error as Error).message,
    });
    throw new Error("Failed to generate activity suggestions: " + (error as Error).message);
  }
}

export interface SwipeConcept {
  conceptType: string; // e.g., "coffee-shop", "cocktail-bar", "italian-restaurant"
  conceptDescription: string; // User-friendly description: "Try a Cozy Coffee Shop", "Explore Cocktail Bars"
  searchQuery: string; // Google Places query: "coffee shop", "cocktail bar", "Italian restaurant"
}

export async function generateSwipeConcepts(groupData: {
  locationBase: string;
  budgetMin: number;
  budgetMax: number;
  activityCategories?: string[];
  pastPreferences?: string;
  previouslySeenConcepts?: string[];
  mealEnabled?: boolean;
  cafeEnabled?: boolean;
  drinksEnabled?: boolean;
  dessertEnabled?: boolean;
  experiencesEnabled?: boolean;
}): Promise<SwipeConcept[]> {
  try {
    // Format activity categories for the prompt
    const categoryLabels: Record<string, string> = {
      'concerts': 'Concerts',
      'karaoke': 'Karaoke',
      'dancing': 'Dancing / Clubs',
      'comedy': 'Comedy Shows',
      'movies': 'Movie Theaters',
      'museums': 'Museums / Art Galleries',
      'sports': 'Sports Games',
      'outdoors': 'Hikes / Outdoors',
      'game-nights': 'Game Nights',
      'trivia': 'Trivia Nights'
    };
    
    let categoriesContext = '';
    if (groupData.activityCategories && groupData.activityCategories.length > 0) {
      const selectedCategories = groupData.activityCategories.map(id => categoryLabels[id] || id).join(', ');
      categoriesContext = `\nActivity Interests: ${selectedCategories}`;
    }

    // Format previously seen concepts to avoid repeats
    let avoidContext = '';
    if (groupData.previouslySeenConcepts && groupData.previouslySeenConcepts.length > 0) {
      avoidContext = `\n\nIMPORTANT - DO NOT suggest these types again (already shown): ${groupData.previouslySeenConcepts.join(', ')}`;
    }

    // Format high-level category filters - hard exclusions
    let categoryFilterContext = '';
    const enabledBuckets: string[] = [];
    const disabledBuckets: string[] = [];
    
    // Check which buckets are enabled (default true if not specified)
    if (groupData.mealEnabled !== false) enabledBuckets.push('MEAL');
    else disabledBuckets.push('MEAL (restaurants, dining, brunch)');
    
    if (groupData.cafeEnabled !== false) enabledBuckets.push('CAFE');
    else disabledBuckets.push('CAFE (cafes, coffee shops)');
    
    if (groupData.drinksEnabled !== false) enabledBuckets.push('DRINKS');
    else disabledBuckets.push('DRINKS (bars, breweries, wine bars)');
    
    if (groupData.dessertEnabled !== false) enabledBuckets.push('DESSERT');
    else disabledBuckets.push('DESSERT (ice cream, boba, dessert shops)');
    
    if (groupData.experiencesEnabled !== false) enabledBuckets.push('EXPERIENCES');
    else disabledBuckets.push('EXPERIENCES (concerts, museums, activities)');
    
    if (disabledBuckets.length > 0) {
      categoryFilterContext = `\n\n🚫 CRITICAL - HARD CATEGORY EXCLUSIONS (ABSOLUTE REQUIREMENT):
- The group has DISABLED these categories - you MUST generate ZERO suggestions from them:
  ${disabledBuckets.map(b => `  ❌ ${b}`).join('\n')}
- ONLY generate suggestions from these ENABLED categories: ${enabledBuckets.join(', ')}
- If you suggest ANY venue from a disabled category, that suggestion will be REJECTED`;
    }

    const prompt = `Generate 20 diverse venue types for exploration.

Location: ${groupData.locationBase}
Budget: $${groupData.budgetMin}-${groupData.budgetMax}/person${categoriesContext}
${groupData.pastPreferences ? `Past: ${groupData.pastPreferences}` : ''}${avoidContext}${categoryFilterContext}

Requirements:
1. 20 venue TYPES (not specific venues)
2. Fit budget range
3. ${groupData.activityCategories && groupData.activityCategories.length > 0 ? `Prioritize listed interests` : 'Mix of food/drink/entertainment/activities'}
4. ${disabledBuckets.length > 0 ? `Only enabled: ${enabledBuckets.join(', ')}` : 'Diverse mix'}
5. Searchable on Google Maps

Examples:
- Good: "Try Coffee Shop" / "coffee shop", "Explore Cocktail Bars" / "cocktail bar"
- Bad: "Pottery Workshop" (too specific), "Sunset Hike" (not venue), "Bar Hopping" (vague)

Return JSON:
{
  "concepts": [
    {
      "conceptType": "slug",
      "conceptDescription": "Description",
      "searchQuery": "search term"
    }
  ]
}`;

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at suggesting venue types for groups to explore. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500,
    });
    const responseTimeMs = Date.now() - startTime;

    const result = safeParseJSON(response.choices[0].message.content, { concepts: [] }, 'swipe concepts');

    if (!result.concepts || result.concepts.length === 0) {
      throw new Error("OpenAI returned no swipe concepts. The response may be empty or malformed.");
    }

    // Log successful API call
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    await logApiCall({
      service: 'openai',
      method: 'generateSwipeConcepts',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: calculateOpenAICost('gpt-4o-mini', inputTokens, outputTokens),
      parameters: { location: groupData.locationBase, budget: `$${groupData.budgetMin}-${groupData.budgetMax}` },
      metadata: {
        model: 'gpt-4o-mini',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        conceptCount: result.concepts.length,
      },
    });

    return result.concepts;
  } catch (error) {
    console.error("Error generating swipe concepts:", error);

    // Log API call failure
    await logApiCall({
      service: 'openai',
      method: 'generateSwipeConcepts',
      cacheStatus: 'miss',
      status: 'error',
      parameters: { location: groupData.locationBase },
      errorMessage: (error as Error).message,
    });

    throw new Error("Failed to generate swipe concepts: " + (error as Error).message);
  }
}

// AI-based venue categorization for edge cases
const categorizationCache = new Map<string, string>();

// Clear categorization cache (useful when categorization logic changes)
export function clearCategorizationCache() {
  const size = categorizationCache.size;
  categorizationCache.clear();
  console.log(`[AI Categorization] Cleared ${size} cached categorizations`);
}

// Deterministic categorization shared by single + batch paths.
// First tries Google Place Types (most reliable), then falls back to keyword
// matching on the venueType string.
function categorizeDeterministic(
  venueName: string,
  venueType: string,
  googleTypes?: string[],
): 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences' {
  if (googleTypes && googleTypes.length > 0) {
    const typeString = googleTypes.join(',').toLowerCase();

    const dessertTypes = ['ice_cream_shop', 'dessert_shop', 'bakery', 'candy_store', 'chocolate_shop', 'donut_shop', 'frozen_yogurt_shop', 'bubble_tea_shop'];
    if (dessertTypes.some((t) => typeString.includes(t))) return 'dessert';

    if (typeString.includes('cafe') || typeString.includes('coffee_shop')) return 'cafes';

    // Experiences before drinks so a performing-arts venue with a `night_club` tag still lands here
    const experienceTypes = ['museum', 'art_gallery', 'amusement_park', 'aquarium', 'zoo', 'bowling_alley', 'movie_theater', 'park', 'tourist_attraction', 'stadium', 'performing_arts_theater'];
    if (experienceTypes.some((t) => typeString.includes(t))) return 'experiences';

    const drinksTypes = ['bar', 'night_club', 'brewery', 'winery', 'wine_bar', 'cocktail_bar', 'tapas_bar', 'sports_bar'];
    if (drinksTypes.some((t) => typeString.includes(t))) {
      // sushi_bar / ramen_bar / "bar+restaurant" should be meal, not drinks
      if (typeString.includes('sushi') || typeString.includes('ramen') || typeString.includes('restaurant')) return 'meal';
      return 'drinks';
    }

    if (typeString.includes('restaurant')) return 'meal';
  }

  return keywordCategorize(venueType);
}

// Keyword-based fallback categorization
function keywordCategorize(venueType: string): 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences' {
  const lowerType = venueType.toLowerCase();
  
  const mealKeywords = ['restaurant', 'food hall', 'food market', 'kitchen', 'diner', 
                       'eatery', 'bistro', 'grill', 'bbq', 'pizzeria', 'steakhouse', 'izakaya'];
  if (mealKeywords.some(keyword => lowerType.includes(keyword))) {
    return 'meal';
  }
  
  if (lowerType.includes('cafe') || lowerType.includes('coffee')) {
    return 'cafes';
  }
  
  if (lowerType.includes('boba') || lowerType.includes('ice cream') || 
      lowerType.includes('dessert') || lowerType.includes('bakery') ||
      lowerType.includes('sweet') || lowerType.includes('milk bar') ||
      lowerType.includes('tea shop') || lowerType.includes('bubble tea') || 
      lowerType.includes('milk tea') || lowerType.includes('gelato')) {
    return 'dessert';
  }
  
  const drinksKeywords = ['drink', 'brewery', 'wine bar', 'cocktail', 'pub', 'lounge', 'taproom', 'speakeasy', 'sake bar', 'taphouse', 'tasting room'];
  const hasStandaloneBar = /\bbar\b/.test(lowerType);
  if (drinksKeywords.some(keyword => lowerType.includes(keyword)) || hasStandaloneBar) {
    return 'drinks';
  }
  
  return 'experiences';
}

export async function categorizeVenue(
  venueName: string,
  venueType: string,
  googleTypes?: string[]
): Promise<'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences'> {
  // Create cache key from venue name + type for more accurate caching
  const cacheKey = `${venueName.toLowerCase()}::${venueType.toLowerCase()}`;

  // Check in-memory cache first (fastest)
  const memCached = categorizationCache.get(cacheKey);
  if (memCached) {
    // Log cache hit
    await logApiCall({
      service: 'openai',
      method: 'categorizeVenue',
      cacheStatus: 'hit',
      status: 'success',
      responseTimeMs: 0,
      costEstimate: 0,
      parameters: { venueName, venueType },
      metadata: { cacheType: 'in-memory', category: memCached },
    });
    return memCached as 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences';
  }

  // Check database cache (persistent across restarts)
  try {
    const dbCached = await db
      .select()
      .from(aiCategorizationCache)
      .where(eq(aiCategorizationCache.cacheKey, cacheKey))
      .limit(1);

    if (dbCached.length > 0) {
      const cached = dbCached[0];
      // Check if cache entry is still valid (not expired)
      const now = new Date();
      if (cached.expiresAt > now) {
        // Cache hit! Store in memory cache and return
        const category = cached.category as 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences';
        categorizationCache.set(cacheKey, category);

        await logApiCall({
          service: 'openai',
          method: 'categorizeVenue',
          cacheStatus: 'hit',
          status: 'success',
          responseTimeMs: 0,
          costEstimate: 0,
          parameters: { venueName, venueType },
          metadata: { cacheType: 'database', category },
        });

        return category;
      } else {
        // Cache expired, delete it
        await db
          .delete(aiCategorizationCache)
          .where(eq(aiCategorizationCache.cacheKey, cacheKey));
      }
    }
  } catch (error) {
    console.error('[AI Categorization] Database cache lookup failed:', error);
    // Continue to API call on cache error
  }

  // Cache miss — categorize deterministically (Google Place Types first,
  // then keyword fallback on venueType). Used to be a paid gpt-4o call;
  // removed because the rule-based path handles the long tail well enough
  // and a single AI call per venue was not justified by quality gains.
  const category = categorizeDeterministic(venueName, venueType, googleTypes);
  categorizationCache.set(cacheKey, category);

  await logApiCall({
    service: 'openai',
    method: 'categorizeVenue',
    cacheStatus: 'miss',
    status: 'success',
    responseTimeMs: 0,
    costEstimate: 0,
    parameters: { venueName, venueType },
    metadata: {
      strategy: 'deterministic',
      hasGoogleTypes: !!googleTypes && googleTypes.length > 0,
      category,
    },
  });

  return category;
}

/**
 * Helper function to retry API calls with exponential backoff
 * Handles rate limiting (429) and temporary errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Only retry on rate limit (429) or temporary errors (5xx)
      const isRateLimitError = error.status === 429 || error.message?.includes('429');
      const isTemporaryError = error.status >= 500 && error.status < 600;

      if (!isRateLimitError && !isTemporaryError) {
        // Don't retry on other errors (auth, invalid request, etc.)
        throw error;
      }

      // Don't delay after last attempt
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('Max retries exceeded');
}

/**
 * LAYER 2: Smart AI Quality Validation
 * Validates if a venue is appropriate for a specific category
 * This is run AFTER Google Place type filtering to catch edge cases
 */
export async function validateVenueForCategory(
  venueName: string,
  venueAddress: string,
  googleTypes: string[],
  requestedCategory: 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences'
): Promise<{ isValid: boolean; reasoning: string }> {
  try {
    const categoryExamples = {
      meal: {
        valid: 'Full-service restaurants, casual dining, ethnic cuisine, food halls, meal takeaway',
        invalid: 'Ice cream shops, dessert-only bakeries, liquor stores, convenience stores, grocery stores'
      },
      cafes: {
        valid: 'Coffee shops, cafes, tea houses, coffee roasters with seating',
        invalid: 'Full restaurants, bars, grocery stores with coffee, gas station coffee'
      },
      drinks: {
        valid: 'Bars, pubs, wine bars, cocktail lounges, breweries, nightclubs',
        invalid: 'Restaurants (unless primarily a bar), liquor stores, convenience stores'
      },
      dessert: {
        valid: 'Ice cream shops, dessert cafes, bakeries with seating, specialty sweets shops, boba tea',
        invalid: 'Full restaurants, convenience stores, grocery store bakeries'
      },
      experiences: {
        valid: 'Museums, parks, theaters, activities, entertainment venues, tourist attractions',
        invalid: 'Restaurants, bars, shops, services, infrastructure'
      }
    };

    const examples = categoryExamples[requestedCategory];
    const systemPrompt = `You are validating whether a venue is appropriate for the "${requestedCategory}" category in a social activity planning app.

A venue is VALID for "${requestedCategory}" if:
- It primarily serves the purpose of ${requestedCategory}
- It's a good match for what users expect when searching for ${requestedCategory}
- Examples: ${examples.valid}

A venue is INVALID for "${requestedCategory}" if:
- It's primarily a different type of business
- It would confuse or disappoint users looking for ${requestedCategory}
- Examples: ${examples.invalid}

IMPORTANT EDGE CASES:
- Ice cream shops should ONLY be valid for "dessert", NOT "meal"
- Liquor stores are NEVER valid for "meal", "drinks", or "dessert"
- Convenience stores with food are NEVER valid for "meal"
- Grocery stores are NEVER valid for any category
- Full restaurants are NOT valid for "dessert" even if they serve dessert

You MUST respond with a JSON object in this exact format:
{
  "isValid": true/false,
  "reasoning": "Brief explanation (one sentence) of why this venue is or isn't appropriate for ${requestedCategory}"
}`;

    const startTime = Date.now();

    // Wrap OpenAI API call with retry logic to handle rate limiting
    const response = await retryWithBackoff(() =>
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1, // Low temperature for consistent validation
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Venue Name: ${venueName}
Address: ${venueAddress}
Google Place Types: ${googleTypes.join(', ')}
Requested Category: ${requestedCategory}

Is this venue appropriate for the "${requestedCategory}" category?`
          }
        ],
        response_format: { type: "json_object" }
      })
    );

    const duration = Date.now() - startTime;
    const result = safeParseJSON(response.choices[0].message.content, { isValid: false, reasoning: "No response" }, 'venue category validation');

    console.log(`[AI Validation] ${venueName} for category "${requestedCategory}": ${result.isValid ? '✅ VALID' : '❌ INVALID'} - ${result.reasoning} (${duration}ms)`);

    // Track token usage and API costs
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    await logApiCall({
      service: 'openai',
      method: 'validateVenueForCategory',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs: duration,
      costEstimate: calculateOpenAICost('gpt-4o-mini', inputTokens, outputTokens),
      parameters: { venueName, requestedCategory },
      metadata: {
        model: 'gpt-4o-mini',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        isValid: result.isValid,
        reasoning: result.reasoning,
        googleTypes: googleTypes.join(', '),
      },
    });

    return {
      isValid: result.isValid === true,
      reasoning: result.reasoning || 'No reasoning provided'
    };
  } catch (error) {
    console.error(`[AI Validation] Error validating ${venueName}:`, error);

    // Log failed API call
    await logApiCall({
      service: 'openai',
      method: 'validateVenueForCategory',
      cacheStatus: 'miss',
      status: 'error',
      errorMessage: (error as Error).message,
      parameters: { venueName, requestedCategory },
    });

    // On error, default to valid (don't block venues due to AI errors)
    // The Google type filtering should have already caught most issues
    return {
      isValid: true,
      reasoning: 'AI validation failed, defaulting to allow'
    };
  }
}

export interface PreferencePattern {
  pattern: string;
  icon: string;
  description: string;
}

export async function analyzePreferencePatterns(data: {
  notThisFeedback: { venueName: string; venueType: string; description: string }[];
  votingFeedback: { venueName: string; venueType: string; upvotes: number; downvotes: number; netVotes: number }[];
  likedConcepts: string[];
  passedConcepts: string[];
}): Promise<PreferencePattern[]> {
  try {
    const { notThisFeedback, votingFeedback, likedConcepts, passedConcepts } = data;

    // Calculate total feedback actions
    const totalActions = 
      notThisFeedback.length + 
      votingFeedback.length + 
      likedConcepts.length + 
      passedConcepts.length;

    // Don't generate insights if there's not enough data
    if (totalActions < 5) {

      return [];
    }

    // Build context for AI
    let feedbackContext = '';
    
    if (notThisFeedback.length > 0) {
      feedbackContext += '\n\n"Not This" Feedback (venues rejected):';
      notThisFeedback.forEach(f => {
        feedbackContext += `\n- ${f.venueName} (${f.venueType}): ${f.description}`;
      });
    }

    if (votingFeedback.length > 0) {
      const upvoted = votingFeedback.filter(v => v.netVotes > 0);
      const downvoted = votingFeedback.filter(v => v.netVotes < 0);
      
      if (upvoted.length > 0) {
        feedbackContext += '\n\nUpvoted Favorites (group loves):';
        upvoted.forEach(v => {
          feedbackContext += `\n- ${v.venueName} (${v.venueType}): +${v.upvotes} votes`;
        });
      }
      
      if (downvoted.length > 0) {
        feedbackContext += '\n\nDownvoted Venues (group dislikes):';
        downvoted.forEach(v => {
          feedbackContext += `\n- ${v.venueName} (${v.venueType}): ${v.downvotes} downvotes`;
        });
      }
    }

    if (likedConcepts.length > 0) {
      feedbackContext += '\n\nLiked Concepts (from swipe sessions):';
      likedConcepts.forEach(c => {
        feedbackContext += `\n- ${c}`;
      });
    }

    if (passedConcepts.length > 0) {
      feedbackContext += '\n\nPassed Concepts (from swipe sessions):';
      passedConcepts.forEach(c => {
        feedbackContext += `\n- ${c}`;
      });
    }

    const prompt = `Analyze group preferences. Identify 3-5 clear patterns.

${feedbackContext}

Total actions: ${totalActions}

Rules:
1. 2-3 examples minimum per pattern
2. Specific & actionable (e.g. "Avoiding loud venues" not "likes quiet")
3. Strongest signals only
4. 10-15 words max
5. Appropriate emoji
6. 3-5 patterns max

Examples:
- 🎵 "Passed on 4 nightclubs and live music"
- ✨ "Museums and galleries get most upvotes"
- 💰 "Expensive venues marked 'not this'"

Return JSON:
[
  {
    "pattern": "Title",
    "icon": "emoji",
    "description": "10-15 words"
  }
]`;

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing group preferences and identifying behavioral patterns. Be specific and actionable. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });
    const responseTimeMs = Date.now() - startTime;

    const result = safeParseJSON(response.choices[0].message.content, { patterns: [] }, 'preference patterns');
    const patterns = result.patterns || [];

    // Log successful API call
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    await logApiCall({
      service: 'openai',
      method: 'analyzePreferencePatterns',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: calculateOpenAICost('gpt-4o-mini', inputTokens, outputTokens),
      parameters: { totalActions },
      metadata: {
        model: 'gpt-4o-mini',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        patternCount: patterns.length,
      },
    });

    return patterns;
  } catch (error) {
    console.error("Error analyzing preference patterns:", error);

    // Log API call failure
    await logApiCall({
      service: 'openai',
      method: 'analyzePreferencePatterns',
      cacheStatus: 'miss',
      status: 'error',
      errorMessage: (error as Error).message,
    });

    return [];
  }
}

export interface SchedulingParams {
  activityType: string; // e.g., "tacos", "coffee", "bottomless brunch"
  category: 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences'; // Mapped category
  location?: string; // e.g., "Mission", "downtown", "Mission, San Francisco"
  timePreference?: 'morning' | 'afternoon' | 'evening' | 'night'; // e.g., "at night"
  dayConstraints?: 'weekday' | 'weekend' | 'any'; // e.g., "on weekday"
  timeframe?: string; // e.g., "next week", "this weekend", "next month"
  specificDates?: string[]; // Parsed specific dates if mentioned
  mealModifiers?: string; // e.g., "bottomless", "prix fixe" - for more specific venue filtering
  contextKeywords?: string[]; // e.g., ["romantic", "intimate"] for context-aware search
  venueAttributes?: string[]; // e.g., ["outdoor seating", "live music", "vegetarian"]
  // A/B testing metadata
  aiModel?: string; // Which model was used: 'gpt-4o' or 'gpt-4o-mini'
  cached?: boolean; // Was this result from cache?
  responseTimeMs?: number; // How long did the API call take?
}

// Basic scheduling prompt parser - uses GPT-4o-mini for speed and cost efficiency
// For enhanced parsing with group history, use parseSchedulingPromptWithHistory() which uses GPT-4o
export async function parseSchedulingPrompt(prompt: string, groupLocation: string): Promise<SchedulingParams> {
  try {
    console.log(`[AI Scheduling w/ mini] Parsing prompt: "${prompt}"`);

    const systemPrompt = `You are an expert at parsing natural language scheduling requests for group activities.
Extract the following information from the user's prompt and return a JSON object:
1. Activity type (what they want to do) - be SPECIFIC and preserve important modifiers
2. Category (map to: meal, cafes, drinks, dessert, or experiences)
3. Location (where, if specified - preserve neighborhood names like "Mission", "Castro", etc.)
4. Time preference (morning/afternoon/evening/night - if specified)
5. Day constraints (weekday/weekend/any)
6. Timeframe (when: "next week", "this weekend", "in 2 days", etc.)
7. Meal type specific modifiers (for brunch/breakfast/lunch/dinner: "bottomless", "prix fixe", etc.)
8. Context keywords - identify the EVENT CONTEXT and extract relevant atmosphere/vibe keywords:
   - "date night" → ["romantic", "intimate", "quiet"]
   - "family" or "kids" → ["family-friendly", "casual", "kids"]
   - "celebration" or "birthday" → ["upscale", "special occasion"]
   - "quick bite" or "grab food" → ["fast", "casual", "quick"]
   - "business" or "work" → ["professional", "quiet", "wifi"]
9. Venue attributes - extract SPECIFIC FEATURES requested:
   - "outdoor", "patio", "rooftop" → ["outdoor seating"]
   - "live music", "DJ" → ["live music"]
   - "vegetarian", "vegan" → ["vegetarian"]
   - "dog-friendly" → ["dog-friendly"]
   - "good for groups" → ["large tables"]

IMPORTANT for activity types:
- Preserve specific meal modifiers: "bottomless brunch" NOT just "brunch"
- Preserve venue type details: "bottomless brunch" NOT "restaurant"
- For brunch specifically: if user says "bottomless brunch", activityType should be "bottomless brunch"

Examples:
"date night this weekend - somewhere romantic in Mission" →
  activityType: "date night", category: "meal", location: "Mission", contextKeywords: ["romantic", "intimate", "quiet"], venueAttributes: null

"family brunch Saturday with outdoor seating" →
  activityType: "family brunch", category: "meal", dayConstraints: "weekend", contextKeywords: ["family-friendly", "casual"], venueAttributes: ["outdoor seating"]

"bottomless brunch on Saturday in SF around the Mission" →
  activityType: "bottomless brunch", category: "meal", location: "Mission, San Francisco", timePreference: null, dayConstraints: "weekend", timeframe: "next Saturday", mealModifiers: "bottomless", contextKeywords: null, venueAttributes: null

"quick lunch near work with vegetarian options" →
  activityType: "quick lunch", category: "meal", timePreference: null, contextKeywords: ["fast", "casual"], venueAttributes: ["vegetarian"]

"celebration dinner somewhere nice with live music" →
  activityType: "celebration dinner", category: "meal", contextKeywords: ["upscale", "special occasion"], venueAttributes: ["live music"]

Return your response as a JSON object with these fields.`;

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Parse this scheduling request: "${prompt}"\n\nGroup's default location: ${groupLocation}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 300,
    });
    const responseTimeMs = Date.now() - startTime;

    const result = safeParseJSON(response.choices[0].message.content, {} as Record<string, any>, 'scheduling prompt');

    // Log successful API call
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    await logApiCall({
      service: 'openai',
      method: 'parseSchedulingPrompt',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: calculateOpenAICost('gpt-4o-mini', inputTokens, outputTokens),
      parameters: { prompt, groupLocation },
      metadata: {
        model: 'gpt-4o-mini',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    });

    return {
      activityType: result.activityType || 'activity',
      category: result.category || 'meal',
      location: result.location || undefined,
      timePreference: result.timePreference || undefined,
      dayConstraints: result.dayConstraints || 'any',
      timeframe: result.timeframe || 'next week',
      specificDates: result.specificDates || undefined,
      mealModifiers: result.mealModifiers || undefined,
      contextKeywords: result.contextKeywords || undefined,
      venueAttributes: result.venueAttributes || undefined,
    };
  } catch (error) {
    console.error("Error parsing scheduling prompt:", error);

    // Log API call failure
    await logApiCall({
      service: 'openai',
      method: 'parseSchedulingPrompt',
      cacheStatus: 'miss',
      status: 'error',
      parameters: { prompt, groupLocation },
      errorMessage: (error as Error).message,
    });

    // Return sensible defaults
    return {
      activityType: 'activity',
      category: 'meal',
      dayConstraints: 'any',
      timeframe: 'next week',
    };
  }
}

// Simple in-memory cache for prompt parsing results
// Reduces costs by caching GPT-4o results for similar prompts
interface CachedPromptResult {
  result: SchedulingParams & { historyApplied?: string[] };
  timestamp: number;
  model: string;
  promptHash: string;
}

const promptCache = new Map<string, CachedPromptResult>();
const PROMPT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
const MAX_PROMPT_CACHE_SIZE = 1000;

// A/B test scaffolding kept for `forceModel` escape hatch, but the A/B
// itself is closed: 0 = always use gpt-4o-mini for prompt parsing.
// Parsing extracts structured intent from a short natural-language scheduling
// prompt; mini handles this fine. Venue discovery and itinerary planning stay
// on gpt-4o per the "decision quality budget" framing — those shape what users
// see, parsing does not.
const AB_TEST_GPT4O_PERCENTAGE = 0;

function generatePromptCacheKey(prompt: string, groupHistory: any): string {
  // Create a hash from prompt + relevant history
  const historyString = JSON.stringify({
    insights: groupHistory.preferenceInsights?.substring(0, 200), // Truncate for cache key
    prefs: groupHistory.schedulingPreferences?.substring(0, 200),
    closeness: groupHistory.closenessLevel
  });

  // Simple hash function
  const str = `${prompt.toLowerCase().trim()}|${historyString}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `prompt_${hash}`;
}

function cleanPromptCache() {
  const now = Date.now();
  const entries = Array.from(promptCache.entries());

  // Remove expired entries
  for (const [key, value] of entries) {
    if (now - value.timestamp > PROMPT_CACHE_TTL_MS) {
      promptCache.delete(key);
    }
  }

  // If still over size limit, remove oldest entries
  if (promptCache.size > MAX_PROMPT_CACHE_SIZE) {
    const sortedByAge = entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, promptCache.size - MAX_PROMPT_CACHE_SIZE);

    for (const [key] of sortedByAge) {
      promptCache.delete(key);
    }
  }
}

/**
 * Enhanced version that incorporates group history for smarter parsing
 *
 * MODEL STRATEGY (Hybrid Approach with A/B Testing):
 * - A/B testing enabled: randomly assigns GPT-4o vs mini based on AB_TEST_GPT4O_PERCENTAGE
 * - Results are cached to reduce costs
 * - Metrics logged for quality comparison
 *
 * WHY A/B TEST:
 * - Measure actual quality difference between GPT-4o and mini
 * - Track cost vs quality trade-off with real data
 * - Determine optimal model for production use
 *
 * COST COMPARISON:
 * - GPT-4o-mini: ~$0.0002 per event (fast, cheap, good for explicit prompts)
 * - GPT-4o: ~$0.0010-0.0014 per event (smart, contextual, best for history)
 * - With cache: 30-50% cost reduction on repeated/similar prompts
 *
 * A/B TEST METRICS TRACKED:
 * - Model used (gpt-4o vs gpt-4o-mini)
 * - Cost difference
 * - Response time difference
 * - Enhancements applied (context, attributes, history)
 * - Cache hit/miss
 */
export async function parseSchedulingPromptWithHistory(
  prompt: string,
  groupLocation: string,
  groupHistory: {
    preferenceInsights?: string | null;
    schedulingPreferences?: string | null;
    closenessLevel?: number | null;
  },
  forceModel?: 'gpt-4o' | 'gpt-4o-mini' // Optional: force specific model for testing/comparison
): Promise<SchedulingParams & { historyApplied?: string[] }> {
  try {
    // Check cache first
    const cacheKey = generatePromptCacheKey(prompt, groupHistory);
    const cached = promptCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < PROMPT_CACHE_TTL_MS)) {

      await logApiCall({
        service: 'openai',
        method: 'parseSchedulingPromptWithHistory',
        cacheStatus: 'hit',
        status: 'success',
        responseTimeMs: 0,
        costEstimate: 0,
        parameters: { prompt, cached: true, model: cached.model },
        metadata: {
          model: cached.model,
          cacheKey,
          cacheAge: Date.now() - cached.timestamp,
        },
      });

      // Add metadata to cached result
      return {
        ...cached.result,
        aiModel: cached.model,
        cached: true,
        responseTimeMs: 0,
      };
    }

    // A/B Test: Randomly assign to GPT-4o or mini (unless forceModel is specified)
    let selectedModel: 'gpt-4o' | 'gpt-4o-mini';
    let randomValue: number | null = null;
    let useGPT4o: boolean;

    if (forceModel) {
      selectedModel = forceModel;
      useGPT4o = forceModel === 'gpt-4o';

    } else {
      randomValue = Math.random() * 100;
      useGPT4o = randomValue < AB_TEST_GPT4O_PERCENTAGE;
      selectedModel = useGPT4o ? 'gpt-4o' : 'gpt-4o-mini';
      console.log(`[AI Scheduling A/B Test] Assigned to ${selectedModel} (random: ${randomValue.toFixed(2)}, threshold: ${AB_TEST_GPT4O_PERCENTAGE})`);
    }

    // Build context from group history
    let historyContext = '';
    const historyApplied: string[] = [];

    if (groupHistory.preferenceInsights) {
      historyContext += `\n\n**Group Preferences** (use these to enhance your parsing):\n${groupHistory.preferenceInsights}`;
      historyApplied.push('Applied group preference insights');
    }

    if (groupHistory.schedulingPreferences) {
      historyContext += `\n\n**Scheduling Preferences** (apply these when relevant):\n${groupHistory.schedulingPreferences}`;
      historyApplied.push('Applied scheduling preferences');
    }

    if (groupHistory.closenessLevel) {
      const closenessDescriptions = {
        1: 'Acquaintances - suggest professional, structured settings',
        2: 'Friendly - suggest casual, comfortable settings',
        3: 'Close friends - suggest fun, relaxed settings',
        4: 'Very close - suggest intimate, special settings',
        5: 'Best friends/family - suggest any setting, prioritize group favorites'
      };
      const closenessDesc = closenessDescriptions[groupHistory.closenessLevel as keyof typeof closenessDescriptions] || '';
      if (closenessDesc) {
        historyContext += `\n\n**Group Closeness**: ${closenessDesc}`;
        historyApplied.push(`Considered group closeness level (${groupHistory.closenessLevel}/5)`);
      }
    }

    const systemPrompt = `You are an expert at parsing natural language scheduling requests for group activities.
Extract the following information from the user's prompt and return a JSON object:
1. Activity type (what they want to do) - be SPECIFIC and preserve important modifiers (e.g., "chill dinner", "bottomless brunch", "happy hour")
2. Category (map to: meal, cafes, drinks, dessert, or experiences)
3. Location (where, if specified - preserve neighborhood names like "Mission", "Castro", etc.)
4. Time preference (morning/afternoon/evening/night) - **IMPORTANT TIME MAPPING RULES**:
   - **ONLY set timePreference if the user explicitly mentions a time** ("7pm", "morning", "evening", etc.)
   - **DO NOT infer timePreference from meal types** - let the system handle this
   - If user says "breakfast" or "brunch" but specifies "afternoon", use "afternoon"
   - If no explicit time is mentioned, **leave timePreference undefined** (null/empty)
5. Day constraints (weekday/weekend/any) - map "weeknight" to "weekday"
6. Timeframe (when: "next week", "this weekend", "in 2 days", etc.)
7. Meal type specific modifiers (for brunch/breakfast/lunch/dinner: "bottomless", "prix fixe", etc.)
8. Context keywords - identify the EVENT CONTEXT and extract relevant atmosphere/vibe keywords:
   - "chill" → ["casual", "relaxed"]
   - "date night" → ["romantic", "intimate", "quiet"]
   - "family" or "kids" → ["family-friendly", "casual", "kids"]
   - "celebration" or "birthday" → ["upscale", "special occasion"]
   - "quick bite" or "grab food" → ["fast", "casual", "quick"]
   - "business" or "work" → ["professional", "quiet", "wifi"]
9. Venue attributes - extract SPECIFIC FEATURES requested:
   - "outdoor", "patio", "rooftop" → ["outdoor seating"]
   - "live music", "DJ" → ["live music"]
   - "vegetarian", "vegan" → ["vegetarian"]
   - "dog-friendly" → ["dog-friendly"]
   - "good for groups" → ["large tables"]${historyContext}

**IMPORTANT**: Use the group's history to ENHANCE the request when the user's prompt is vague:
- If preferences mention "loves outdoor venues" and user says "brunch", add ["outdoor seating"] to venueAttributes
- If scheduling preferences say "always 8 PM for dinner" and user says "dinner", you MAY set timePreference to "evening"
- If closeness level suggests intimate settings and user says "dinner", add ["intimate"] to contextKeywords

**CRITICAL**: Preserve the meal type in activityType (e.g., "dinner", "brunch", "lunch") so the system can apply proper time inference.

Return your response as a JSON object with these fields: activityType, category, location, timePreference, dayConstraints, timeframe, mealModifiers, contextKeywords, venueAttributes`;

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: selectedModel, // A/B test: randomly GPT-4o or mini
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Parse this scheduling request: "${prompt}"\n\nGroup's default location: ${groupLocation}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });
    const responseTimeMs = Date.now() - startTime;

    const result = safeParseJSON(response.choices[0].message.content, {} as Record<string, any>, 'scheduling prompt with history');

    console.log(`[AI Scheduling A/B w/ ${selectedModel}] Parsed params with history:`, result);
    console.log(`[AI Scheduling A/B w/ ${selectedModel}] Response time: ${responseTimeMs}ms`);

    // Log successful API call with A/B test metrics
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const estimatedCost = calculateOpenAICost(selectedModel as 'gpt-4o' | 'gpt-4o-mini', inputTokens, outputTokens);

    // Calculate cost comparison for A/B analysis
    const gpt4oCost = calculateOpenAICost('gpt-4o', inputTokens, outputTokens);
    const miniCost = calculateOpenAICost('gpt-4o-mini', inputTokens, outputTokens);
    const costDiff = gpt4oCost - miniCost;

    console.log(`[AI Scheduling A/B w/ ${selectedModel}] Cost: $${estimatedCost.toFixed(6)} (${inputTokens} in + ${outputTokens} out)`);
    console.log(`[AI Scheduling A/B] Cost diff: $${costDiff.toFixed(6)} (GPT-4o would cost ${(costDiff / miniCost * 100).toFixed(1)}% more)`);

    await logApiCall({
      service: 'openai',
      method: 'parseSchedulingPromptWithHistory',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: estimatedCost,
      parameters: {
        prompt,
        groupLocation,
        hasHistory: !!groupHistory.preferenceInsights || !!groupHistory.schedulingPreferences,
        hasPreferences: !!groupHistory.preferenceInsights,
        hasSchedulingPrefs: !!groupHistory.schedulingPreferences,
        hasClosenessLevel: !!groupHistory.closenessLevel,
        abTestAssignment: selectedModel, // Track A/B assignment
        abTestRandomValue: randomValue,
      },
      metadata: {
        model: selectedModel,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        // A/B test comparison metrics
        abTest: {
          assignedModel: selectedModel,
          randomValue: randomValue,
          threshold: AB_TEST_GPT4O_PERCENTAGE,
          gpt4oCost: gpt4oCost,
          miniCost: miniCost,
          costDifference: costDiff,
          costSavingsPercent: useGPT4o ? 0 : ((costDiff / gpt4oCost) * 100),
        },
      },
    });

    const finalResult = {
      activityType: result.activityType || 'activity',
      category: result.category || 'meal',
      location: result.location || undefined,
      timePreference: result.timePreference || undefined,
      dayConstraints: result.dayConstraints || 'any',
      timeframe: result.timeframe || 'next week',
      specificDates: result.specificDates || undefined,
      mealModifiers: result.mealModifiers || undefined,
      contextKeywords: result.contextKeywords || undefined,
      venueAttributes: result.venueAttributes || undefined,
      historyApplied: historyApplied.length > 0 ? historyApplied : undefined,
      // A/B test metadata
      aiModel: selectedModel,
      cached: false,
      responseTimeMs: responseTimeMs,
    };

    // Cache the result to reduce future costs
    promptCache.set(cacheKey, {
      result: finalResult,
      timestamp: Date.now(),
      model: selectedModel,
      promptHash: cacheKey,
    });

    // Clean cache periodically (every 100th call)
    if (Math.random() < 0.01) {
      cleanPromptCache();
      console.log(`[AI Scheduling Cache] Cleaned cache, current size: ${promptCache.size}`);
    }

    console.log(`[AI Scheduling Cache] Cached result for future requests (key: ${cacheKey})`);

    return finalResult;
  } catch (error) {
    console.error("[AI Scheduling A/B] Error parsing scheduling prompt with history:", error);

    // Log API call failure
    await logApiCall({
      service: 'openai',
      method: 'parseSchedulingPromptWithHistory',
      cacheStatus: 'miss',
      status: 'error',
      parameters: {
        prompt,
        groupLocation,
        hasHistory: !!groupHistory.preferenceInsights || !!groupHistory.schedulingPreferences
      },
      errorMessage: (error as Error).message,
      metadata: {
        model: 'unknown', // Error before model selection
      },
    });

    // Return sensible defaults
    return {
      activityType: 'activity',
      category: 'meal',
      dayConstraints: 'any',
      timeframe: 'next week',
    };
  }
}

// Get cache statistics for monitoring
export function getPromptCacheStats() {
  const now = Date.now();
  const entries = Array.from(promptCache.values());

  const stats = {
    totalEntries: promptCache.size,
    maxSize: MAX_PROMPT_CACHE_SIZE,
    ttlMs: PROMPT_CACHE_TTL_MS,
    modelDistribution: {
      'gpt-4o': 0,
      'gpt-4o-mini': 0,
    },
    averageAge: 0,
    oldestEntry: 0,
    newestEntry: 0,
  };

  if (entries.length > 0) {
    const ages = entries.map(e => now - e.timestamp);
    stats.averageAge = ages.reduce((a, b) => a + b, 0) / ages.length;
    stats.oldestEntry = Math.max(...ages);
    stats.newestEntry = Math.min(...ages);

    for (const entry of entries) {
      if (entry.model === 'gpt-4o') {
        stats.modelDistribution['gpt-4o']++;
      } else {
        stats.modelDistribution['gpt-4o-mini']++;
      }
    }
  }

  return stats;
}

// Rule-based filter for obvious non-social venues (NO API CALLS)
export function isObviouslyInvalidVenue(
  venueName: string,
  address: string,
  googleTypes: string[]
): { isInvalid: boolean; reasoning: string } | null {
  const nameLower = venueName.toLowerCase();
  const addressLower = address.toLowerCase();
  const typesStr = googleTypes.join(' ').toLowerCase();

  // Medical professionals (credentials in name)
  if (/\b(m\.d\.|o\.d\.|d\.d\.s\.|d\.o\.|pharm\.d\.|d\.c\.|dds|optometrist|dentist|chiropractor)\b/i.test(venueName)) {
    return { isInvalid: true, reasoning: 'Medical professional (credentials in name)' };
  }

  // Medical/healthcare facilities
  if (nameLower.includes('clinic') || nameLower.includes('medical') || 
      nameLower.includes('hospital') || nameLower.includes('urgent care') ||
      nameLower.includes('med spa') || nameLower.includes('medspa') ||
      typesStr.includes('doctor') || typesStr.includes('health')) {
    return { isInvalid: true, reasoning: 'Medical/healthcare facility' };
  }

  // Grocery stores and supermarkets
  if (nameLower.includes('supermarket') || nameLower.includes('grocery') ||
      nameLower.includes('safeway') || nameLower.includes('whole foods market') ||
      nameLower.includes('trader joe') || nameLower.includes('nijiya market') ||
      typesStr.includes('supermarket') || typesStr.includes('grocery')) {
    return { isInvalid: true, reasoning: 'Grocery store/supermarket' };
  }

  // Liquor stores (retail, not bars)
  if ((nameLower.includes('bevmo') || nameLower.includes('liquor store')) &&
      typesStr.includes('liquor_store')) {
    return { isInvalid: true, reasoning: 'Liquor store (retail, not social venue)' };
  }

  // Service businesses
  if (nameLower.includes('realtor') || nameLower.includes('real estate') ||
      nameLower.includes('insurance') || nameLower.includes('attorney') ||
      nameLower.includes('lawyer') || nameLower.includes('repair') ||
      nameLower.includes('mortgage')) {
    return { isInvalid: true, reasoning: 'Professional service business' };
  }

  // Pet stores
  if ((nameLower.includes('pet store') || nameLower.includes('aquarium inc')) &&
      typesStr.includes('pet_store')) {
    return { isInvalid: true, reasoning: 'Pet store (retail)' };
  }

  // Catering/takeout only (no dine-in)
  if (nameLower.includes('catering') && nameLower.includes('takeout') &&
      !nameLower.includes('restaurant') && !nameLower.includes('cafe')) {
    return { isInvalid: true, reasoning: 'Catering/takeout only (no dine-in space)' };
  }

  // Wholesalers and food stores (not restaurants)
  if (typesStr.includes('wholesaler') || typesStr.includes('food_store')) {
    return { isInvalid: true, reasoning: 'Wholesale/food store (not a restaurant/cafe)' };
  }

  // Infrastructure
  if (nameLower.includes('restroom') || nameLower.includes('parking') ||
      nameLower.includes('charging station') || nameLower.includes('chargepoint')) {
    return { isInvalid: true, reasoning: 'Infrastructure/utility facility' };
  }

  return null; // Not obviously invalid - needs AI validation
}

// Batched AI validation (100 venues per API call)
export async function validateVenuesBatch(
  venues: Array<{ id: string; name: string; address: string; googleTypes: string[] }>
): Promise<Map<string, { isValid: boolean; reasoning: string }>> {
  const results = new Map<string, { isValid: boolean; reasoning: string }>();
  
  try {
    const systemPrompt = `You are evaluating venues in bulk to determine if they're suitable for friends to gather for social activities.

A venue is VALID if it's a place where people can reasonably:
- Meet up with friends
- Hang out together
- Have a social experience
- Share an activity or meal

A venue is INVALID if it's:
- A service business (realtors, repair services)
- A utility facility (restrooms, parking lots)
- A professional service (dentists, lawyers)
- A pure retail store (grocery, liquor store, unless experience-based)
- Infrastructure (transit, airports)
- Medical facilities

You MUST respond with a JSON array where each object has:
{
  "id": "venue_id",
  "isValid": true/false,
  "reasoning": "Brief explanation"
}`;

    const venueList = venues.map(v =>
      `ID: ${v.id}\nName: ${v.name}\nAddress: ${v.address}\nTypes: ${v.googleTypes.join(', ')}`
    ).join('\n\n');

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Evaluate these ${venues.length} venues and return a JSON object with a "venues" array:\n\n${venueList}\n\nIMPORTANT: Ensure all JSON strings are properly escaped. Return format: {"venues": [...]}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 5000,
    });
    const responseTimeMs = Date.now() - startTime;

    const rawContent = response.choices[0].message.content || '{}';
    let result: any;
    
    try {
      result = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('[Batch Validation] JSON parse error, attempting to fix:', parseError);
      // Try to fix common JSON issues
      const fixed = rawContent
        .replace(/\n/g, ' ')  // Remove newlines
        .replace(/\r/g, '')   // Remove carriage returns
        .replace(/\t/g, ' ')  // Replace tabs with spaces
        .replace(/\\"/g, '"') // Fix escaped quotes
        .replace(/([^\\])"/g, '$1\\"'); // Escape unescaped quotes
      
      try {
        result = JSON.parse(fixed);
      } catch (secondError) {
        console.error('[Batch Validation] Failed to fix JSON, defaulting all to invalid');
        result = { venues: [] };
      }
    }
    
    const validations = result.venues || result.results || [];
    
    // Map results by ID
    for (const validation of validations) {
      if (validation.id && typeof validation.isValid === 'boolean') {
        results.set(validation.id, {
          isValid: validation.isValid,
          reasoning: validation.reasoning || 'No reasoning provided'
        });
      }
    }

    // Fill in missing results (default to invalid for safety)
    for (const venue of venues) {
      if (!results.has(venue.id)) {
        results.set(venue.id, {
          isValid: false,
          reasoning: 'No AI response - defaulting to invalid for safety'
        });
      }
    }

    // Log successful API call
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    await logApiCall({
      service: 'openai',
      method: 'validateVenuesBatch',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: calculateOpenAICost('gpt-4o-mini', inputTokens, outputTokens),
      parameters: { batchSize: venues.length },
      metadata: {
        model: 'gpt-4o-mini',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        venueCount: venues.length,
        validCount: Array.from(results.values()).filter(r => r.isValid).length,
      },
    });

    return results;
  } catch (error) {
    console.error("Error in batched venue validation:", error);

    // Log API call failure
    await logApiCall({
      service: 'openai',
      method: 'validateVenuesBatch',
      cacheStatus: 'miss',
      status: 'error',
      parameters: { batchSize: venues.length },
      errorMessage: (error as Error).message,
    });

    // On error, mark all as invalid for safety
    for (const venue of venues) {
      results.set(venue.id, {
        isValid: false,
        reasoning: 'Batch validation error - treating as invalid for safety'
      });
    }
    return results;
  }
}

/**
 * Batch categorize multiple venues in a single API call
 * Much more efficient than calling categorizeVenue() individually
 * Returns a map of cacheKey -> category
 */
export async function categorizeVenuesBatch(
  venues: Array<{ venueName: string; venueType: string; googleTypes?: string[] }>
): Promise<Map<string, 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences'>> {
  const results = new Map<string, 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences'>();
  const uncachedVenues: Array<{ venueName: string; venueType: string; googleTypes?: string[]; cacheKey: string }> = [];

  // Check caches for all venues first
  for (const venue of venues) {
    const cacheKey = `${venue.venueName.toLowerCase()}::${venue.venueType.toLowerCase()}`;

    // Check in-memory cache
    const memCached = categorizationCache.get(cacheKey);
    if (memCached) {
      results.set(cacheKey, memCached as 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences');
      continue;
    }

    // Check database cache
    try {
      const dbCached = await db
        .select()
        .from(aiCategorizationCache)
        .where(eq(aiCategorizationCache.cacheKey, cacheKey))
        .limit(1);

      if (dbCached.length > 0) {
        const cached = dbCached[0];
        const now = new Date();
        if (cached.expiresAt > now) {
          const category = cached.category as 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences';
          categorizationCache.set(cacheKey, category);
          results.set(cacheKey, category);
          continue;
        } else {
          // Cache expired, delete it
          await db
            .delete(aiCategorizationCache)
            .where(eq(aiCategorizationCache.cacheKey, cacheKey));
        }
      }
    } catch (error) {
      console.error('[Batch Categorization] Database cache lookup failed:', error);
    }

    // Not in cache, needs API call
    uncachedVenues.push({ ...venue, cacheKey });
  }

  console.log(`[Batch Categorization] ${results.size} cached, ${uncachedVenues.length} need API call`);

  // If all venues were cached, return early
  if (uncachedVenues.length === 0) {
    await logApiCall({
      service: 'openai',
      method: 'categorizeVenuesBatch',
      cacheStatus: 'hit',
      status: 'success',
      responseTimeMs: 0,
      costEstimate: 0,
      parameters: { totalVenues: venues.length },
      metadata: { allCached: true },
    });
    return results;
  }

  // Categorize uncached venues deterministically (no AI call).
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

  for (const venue of uncachedVenues) {
    const category = categorizeDeterministic(venue.venueName, venue.venueType, venue.googleTypes);
    results.set(venue.cacheKey, category);
    categorizationCache.set(venue.cacheKey, category);

    try {
      await db.insert(aiCategorizationCache).values({
        cacheKey: venue.cacheKey,
        category,
        venueName: venue.venueName,
        venueType: venue.venueType,
        expiresAt,
      }).onConflictDoUpdate({
        target: aiCategorizationCache.cacheKey,
        set: {
          category,
          venueName: venue.venueName,
          venueType: venue.venueType,
          expiresAt,
        },
      });
    } catch (error) {
      console.error('[Batch Categorization] Failed to write to database cache:', error);
    }
  }

  console.log(`[Batch Categorization] Categorized ${uncachedVenues.length} venues deterministically`);

  await logApiCall({
    service: 'openai',
    method: 'categorizeVenuesBatch',
    cacheStatus: 'miss',
    status: 'success',
    responseTimeMs: 0,
    costEstimate: 0,
    parameters: { totalVenues: venues.length, uncachedVenues: uncachedVenues.length },
    metadata: {
      strategy: 'deterministic',
      categorizedCount: uncachedVenues.length,
    },
  });

  return results;
}

// Validate if a venue is suitable for social gatherings using AI
export async function isValidSocialVenue(
  venueName: string,
  address: string,
  googleTypes: string[]
): Promise<{ isValid: boolean; reasoning: string }> {
  try {
    const systemPrompt = `You are evaluating whether a venue is suitable for friends to gather for social activities.

A venue is VALID if it's a place where people can reasonably:
- Meet up with friends
- Hang out together
- Have a social experience
- Share an activity or meal

A venue is INVALID if it's:
- A service business (realtors, mortgage companies, repair services)
- A utility facility (restrooms, parking lots, charging stations)
- A professional service (dentists, lawyers, accountants)
- A retail store (unless it's an experience-based venue like a bookstore cafe)
- Infrastructure (transit stations, airports)
- Medical facilities (hospitals, clinics)

Examples of VALID venues:
- Restaurants, cafes, bars, bakeries, ice cream shops
- Museums, galleries, theaters, concert venues
- Parks, beaches, hiking trails
- Bowling alleys, arcades, game cafes
- Bookstores with cafes, specialty shops with tasting rooms

Examples of INVALID venues:
- "John Smith, Realtor" (real estate agent)
- "Hillsdale Restroom" (public bathroom)
- "ChargePoint Charging Station" (EV charger)
- "Fifth Avenue Aesthetics" (medical spa)
- "Quick Fix Repair" (repair service)

You MUST respond with a JSON object in this exact format:
{
  "isValid": true/false,
  "reasoning": "Brief explanation of why this venue is or isn't suitable for social gatherings"
}`;

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Venue Name: ${venueName}
Address: ${address}
Google Place Types: ${googleTypes.join(', ')}

Is this a valid venue for social gatherings? Respond with JSON containing "isValid" (boolean) and "reasoning" (string).`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 150,
    });
    const responseTimeMs = Date.now() - startTime;

    const result = safeParseJSON(response.choices[0].message.content, {} as { isValid?: boolean; reasoning?: string }, 'social venue validation');

    // Strict validation: isValid MUST be a boolean
    if (typeof result.isValid !== 'boolean') {
      console.error(`[AI Validation] Invalid response format for ${venueName}:`, result);
      console.error(`[AI Validation] Expected { isValid: boolean, reasoning: string }, got:`, typeof result.isValid);
      // Default to INVALID if response format is wrong to be safe
      return {
        isValid: false,
        reasoning: `Invalid AI response format - treating as non-social venue for safety`
      };
    }

    // Log successful API call
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    await logApiCall({
      service: 'openai',
      method: 'isValidSocialVenue',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: calculateOpenAICost('gpt-4o-mini', inputTokens, outputTokens),
      parameters: { venueName },
      metadata: {
        model: 'gpt-4o-mini',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        isValid: result.isValid,
      },
    });

    return {
      isValid: result.isValid,
      reasoning: result.reasoning || "No reasoning provided"
    };
  } catch (error) {
    console.error("Error validating social venue:", error);

    // Log API call failure
    await logApiCall({
      service: 'openai',
      method: 'isValidSocialVenue',
      cacheStatus: 'miss',
      status: 'error',
      parameters: { venueName },
      errorMessage: (error as Error).message,
    });

    // On error, default to INVALID to prevent bad venues from slipping through
    return {
      isValid: false,
      reasoning: "Error during validation - treating as non-social venue for safety"
    };
  }
}

/**
 * Assess the "niche level" of a relationship word/phrase for the landing page rotation
 * Returns a score from 1-5:
 * 1 = Very generic (friends, family)
 * 2 = Common casual (crew, squad)
 * 3 = Activity-based (book club, hiking crew)
 * 4 = Specific niche (Sunday football fam, fantasy league)
 * 5 = Ultra-niche/quirky (Costco run crew, pickleball posse)
 */
export async function assessWordNicheLevel(word: string): Promise<{
  nicheScore: number;
  suggestedCategory: string;
  reasoning: string;
}> {
  try {
    const systemPrompt = `You are evaluating relationship words/phrases for a landing page that says "See your [X] more."

Rate the word's "niche level" from 1-5:
1 = Very generic - applies to almost everyone (friends, family, people)
2 = Common casual - widely used slang/terms (crew, squad, besties)
3 = Activity-based - people who share a hobby (book club, gym buddies)
4 = Specific niche - narrower subcultures (Sunday football fam, fantasy league)
5 = Ultra-niche/quirky - very specific or humorous (Costco run crew, pickleball posse)

Also suggest a category:
- "core" (generic relationship terms)
- "casual" (common slang)
- "activity" (hobby-based)
- "sports" (sports/fitness related)
- "lifeStage" (life-stage specific like "mom friends")
- "ultraNiche" (very specific/humorous)

Respond with JSON: { "nicheScore": number, "suggestedCategory": string, "reasoning": string }`;

    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Word/phrase: "${word}"

Assess the niche level (1-5) and suggest a category for this relationship term.`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 200,
    });
    const responseTimeMs = Date.now() - startTime;

    const result = safeParseJSON(response.choices[0].message.content, { nicheScore: 3, suggestedCategory: 'activity', reasoning: '' }, 'word niche assessment');

    // Log API call
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    await logApiCall({
      service: 'openai',
      method: 'assessWordNicheLevel',
      cacheStatus: 'miss',
      status: 'success',
      responseTimeMs,
      costEstimate: calculateOpenAICost('gpt-4o-mini', inputTokens, outputTokens),
      parameters: { word },
      metadata: {
        model: 'gpt-4o-mini',
        inputTokens,
        outputTokens,
        result,
      },
    });

    return {
      nicheScore: result.nicheScore || 3,
      suggestedCategory: result.suggestedCategory || 'activity',
      reasoning: result.reasoning || "No reasoning provided"
    };
  } catch (error) {
    console.error("Error assessing word niche level:", error);

    await logApiCall({
      service: 'openai',
      method: 'assessWordNicheLevel',
      cacheStatus: 'miss',
      status: 'error',
      parameters: { word },
      errorMessage: (error as Error).message,
    });

    // Default to medium niche on error
    return {
      nicheScore: 3,
      suggestedCategory: 'activity',
      reasoning: "Error during assessment - defaulting to medium niche level"
    };
  }
}
