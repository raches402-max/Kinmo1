/**
 * Design System Tokens
 * Centralized color and style constants for consistent UI
 *
 * Usage:
 *   import { RSVP_COLORS, STATUS_COLORS } from '@/lib/tokens';
 *   <Badge className={RSVP_COLORS.yes}>Going</Badge>
 */

// =============================================================================
// STATUS COLORS
// For general status indicators (alerts, badges, notifications)
// =============================================================================

export const STATUS_COLORS = {
  success: 'bg-green-100 text-green-700 border-green-300',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  danger: 'bg-red-100 text-red-700 border-red-300',
  info: 'bg-blue-100 text-blue-700 border-blue-300',
  neutral: 'bg-gray-100 text-gray-600 border-gray-300',
} as const;

// Subtle variants (less prominent)
export const STATUS_COLORS_SUBTLE = {
  success: 'bg-green-50 text-green-600',
  warning: 'bg-yellow-50 text-yellow-600',
  danger: 'bg-red-50 text-red-600',
  info: 'bg-blue-50 text-blue-600',
  neutral: 'bg-gray-50 text-gray-500',
} as const;

// =============================================================================
// RSVP COLORS
// For RSVP response status (yes, maybe, no, pending)
// =============================================================================

export const RSVP_COLORS = {
  yes: 'bg-green-100 text-green-700 border-green-300',
  maybe: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  no: 'bg-gray-100 text-gray-600 border-gray-300',
  pending: 'bg-gray-50 text-gray-500 border-gray-200',
} as const;

// Icon colors for RSVP (use with lucide icons)
export const RSVP_ICON_COLORS = {
  yes: 'text-green-600',
  maybe: 'text-yellow-600',
  no: 'text-gray-500',
  pending: 'text-gray-400',
} as const;

// =============================================================================
// FEASIBILITY COLORS
// For distance/time feasibility indicators
// =============================================================================

export const FEASIBILITY_COLORS = {
  good: 'text-green-600',      // < 3 miles or < 3 hours
  caution: 'text-yellow-600',  // 3-5 miles or 3-4 hours
  alert: 'text-red-600',       // > 5 miles or > 4 hours
} as const;

export const FEASIBILITY_BG_COLORS = {
  good: 'bg-green-100 text-green-700',
  caution: 'bg-yellow-100 text-yellow-700',
  alert: 'bg-red-100 text-red-700',
} as const;

/**
 * Get feasibility level based on distance in miles
 */
export function getDistanceFeasibility(miles: number): keyof typeof FEASIBILITY_COLORS {
  if (miles < 3) return 'good';
  if (miles < 5) return 'caution';
  return 'alert';
}

/**
 * Get feasibility level based on time in hours
 */
export function getTimeFeasibility(hours: number): keyof typeof FEASIBILITY_COLORS {
  if (hours < 3) return 'good';
  if (hours < 4) return 'caution';
  return 'alert';
}

// =============================================================================
// ACTIVITY CATEGORY COLORS
// For venue/activity type indicators
// =============================================================================

export const ACTIVITY_COLORS = {
  meal: 'bg-orange-100 text-orange-700 border-orange-300',
  cafes: 'bg-amber-100 text-amber-700 border-amber-300',
  drinks: 'bg-purple-100 text-purple-700 border-purple-300',
  dessert: 'bg-pink-100 text-pink-700 border-pink-300',
  experiences: 'bg-blue-100 text-blue-700 border-blue-300',
} as const;

// =============================================================================
// VOTING/RATING COLORS
// For thumbs up/down, star ratings, etc.
// =============================================================================

export const VOTE_COLORS = {
  positive: 'text-green-600 hover:text-green-700',
  negative: 'text-red-500 hover:text-red-600',
  neutral: 'text-gray-400 hover:text-gray-500',
} as const;

// =============================================================================
// BADGE COLORS
// For generic badges and labels
// =============================================================================

export const BADGE_COLORS = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  accent: 'bg-accent text-accent-foreground',
  muted: 'bg-muted text-muted-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  // Semantic
  new: 'bg-blue-100 text-blue-700 border-blue-300',
  featured: 'bg-purple-100 text-purple-700 border-purple-300',
  popular: 'bg-orange-100 text-orange-700 border-orange-300',
  favorite: 'bg-pink-100 text-pink-700 border-pink-300',
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get RSVP color classes for a response type
 */
export function getRsvpColor(response: 'yes' | 'maybe' | 'no' | 'pending' | string): string {
  return RSVP_COLORS[response as keyof typeof RSVP_COLORS] || RSVP_COLORS.pending;
}

/**
 * Get status color classes for a status type
 */
export function getStatusColor(status: 'success' | 'warning' | 'danger' | 'info' | 'neutral'): string {
  return STATUS_COLORS[status] || STATUS_COLORS.neutral;
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type RsvpResponse = keyof typeof RSVP_COLORS;
export type StatusType = keyof typeof STATUS_COLORS;
export type FeasibilityLevel = keyof typeof FEASIBILITY_COLORS;
export type ActivityCategory = keyof typeof ACTIVITY_COLORS;
