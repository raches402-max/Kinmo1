/**
 * Activity and venue utility functions
 * Extracted from group-detail.tsx for reuse and performance
 */

import { Music, Mic2, PartyPopper, Laugh, Film, Palette, Trophy, Mountain, Gamepad2, GraduationCap, Users } from "lucide-react";

export type ActivityCategory = 'meal' | 'cafes' | 'drinks' | 'dessert' | 'experiences';

/**
 * Determine the category of an activity based on venue type
 */
export function getActivityCategory(activity: { venueType: string; category?: string | null }): ActivityCategory {
  // Use stored AI category if available
  if (activity.category) {
    return activity.category as ActivityCategory;
  }

  // Fallback to keyword matching for backwards compatibility
  const lowerType = activity.venueType.toLowerCase();

  // Strong meal indicators - if these exist, it's definitely a meal venue
  const mealKeywords = ['restaurant', 'food hall', 'food market', 'kitchen', 'diner',
                       'eatery', 'bistro', 'grill', 'bbq', 'pizzeria', 'steakhouse'];
  const isMealVenue = mealKeywords.some(keyword => lowerType.includes(keyword));

  if (isMealVenue) {
    return 'meal';
  }

  // CAFES - coffee shops, cafes
  if (lowerType.includes('cafe') || lowerType.includes('coffee')) {
    return 'cafes';
  }

  // DESSERT - boba, ice cream, dessert shops, tea shops (check BEFORE drinks to catch "boba bar", "dessert bar")
  if (lowerType.includes('boba') || lowerType.includes('ice cream') ||
      lowerType.includes('dessert') || lowerType.includes('bakery') ||
      lowerType.includes('sweet') || lowerType.includes('milk bar') ||
      lowerType.includes('tea shop') || lowerType.includes('bubble tea') ||
      lowerType.includes('milk tea') || lowerType.includes('gelato')) {
    return 'dessert';
  }

  // DRINKS - bars, breweries, wine bars, cocktail lounges, and generic "drink"
  // Check AFTER meal and dessert to avoid false positives
  const drinksKeywords = ['drink', 'brewery', 'wine bar', 'cocktail', 'pub', 'lounge', 'taproom', 'speakeasy', 'sake bar', 'taphouse', 'tasting room'];
  const hasDrinkKeyword = drinksKeywords.some(keyword => lowerType.includes(keyword));

  // Use regex for standalone "bar" but be careful with punctuation
  const hasStandaloneBar = /\bbar\b/.test(lowerType);

  if (hasDrinkKeyword || hasStandaloneBar) {
    return 'drinks';
  }

  // EXPERIENCES - everything else (museums, parks, concerts, etc.)
  return 'experiences';
}

/**
 * Activity category configuration for UI
 */
export const activityCategories = [
  { id: "concerts", label: "Concerts", icon: Music },
  { id: "karaoke", label: "Karaoke", icon: Mic2 },
  { id: "dancing", label: "Dancing / Clubs", icon: PartyPopper },
  { id: "comedy", label: "Comedy Shows", icon: Laugh },
  { id: "movies", label: "Movie Theaters", icon: Film },
  { id: "museums", label: "Museums / Art Galleries", icon: Palette },
  { id: "sports", label: "Sports Games", icon: Trophy },
  { id: "outdoors", label: "Hikes / Outdoors", icon: Mountain },
  { id: "game-nights", label: "Game Nights", icon: Gamepad2 },
  { id: "trivia", label: "Trivia Nights", icon: GraduationCap },
  { id: "family", label: "Family Activities", icon: Users },
];

/**
 * Labels for closeness slider (1-5)
 */
export const closenessLabels = [
  "Acquaintances",
  "Friends",
  "Good Friends",
  "Close Friends",
  "Best Friends"
];

/**
 * Labels for novelty slider (1-5)
 */
export const noveltyLabels = [
  "We like our usual spots",
  "Leaning familiar",
  "Open sometimes",
  "Pretty adventurous",
  "Always up for new things!"
];

/**
 * Default group emoji options
 */
export const groupEmojis = [
  "🎉", "🎊", "🎈", "🍕", "🍔", "🍰", "🎮", "🎬",
  "🎵", "🎨", "🏀", "⚽", "🎯", "🎭", "🎪", "🎤"
];
