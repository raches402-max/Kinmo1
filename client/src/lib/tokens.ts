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
export type ActivityCategory = keyof typeof ACTIVITY_COLORS;
