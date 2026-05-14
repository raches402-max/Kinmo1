/**
 * Event Utilities
 *
 * Functions for merging, deduplicating, and sorting events from multiple sources.
 * Used to fix duplicate events and ensure chronological ordering.
 */

import { isPast } from "date-fns";

// Unified event interface that works across all event sources
export interface UnifiedEvent {
  id: string;
  name: string;
  eventDate: string | null;
  eventTime?: string;
  status: EventStatus;
  source: EventSource;
  items: EventVenueItem[];
  rsvpCount?: {
    yes: number;
    maybe: number;
    no: number;
    pending: number;
  };
  confidenceScore?: number;
  autoSendAt?: string;
  inviteSentAt?: string;
  hostMemberName?: string;
  // Original data for click-through
  originalItineraryId?: string;
  originalAutoEventId?: string;
}

export interface EventVenueItem {
  id: string;
  venueName: string;
  venueAddress?: string;
  venueType?: string;
  photoUrl?: string;
}

export type EventStatus =
  | 'draft'
  | 'saved'
  | 'proposed'
  | 'scheduled'
  | 'confirmed'
  | 'rejected'
  | 'past'
  | 'tbd';

export type EventSource = 'manual' | 'auto' | 'imported';

// Input types from existing queries
export interface ItineraryInput {
  id: string;
  name?: string | null;
  status: string;
  eventDate?: string | null;
  inviteSentAt?: string | null;
  hostMemberName?: string | null;
  items?: Array<{
    id: string;
    venueName: string;
    venueAddress?: string | null;
    venueType?: string | null;
    photoUrl?: string | null;
  }>;
  rsvpCount?: {
    yes: number;
    maybe: number;
    no: number;
    pending: number;
  };
  confidenceScore?: number | null;
  autoSendAt?: string | null;
}

export interface AutoScheduledEventInput {
  id: string;
  itineraryId?: string | null;
  proposedDate?: string | null;
  status: string;
  confidenceScore?: number | null;
  autoSendAt?: string | null;
  itinerary?: {
    id: string;
    name?: string | null;
    items?: Array<{
      id: string;
      venueName: string;
      venueAddress?: string | null;
      venueType?: string | null;
      photoUrl?: string | null;
    }>;
  } | null;
}

/**
 * Transform an itinerary to a unified event
 */
function transformItinerary(
  itinerary: ItineraryInput,
  statusOverride?: EventStatus
): UnifiedEvent {
  const effectiveStatus = statusOverride || determineStatus(itinerary);

  return {
    id: itinerary.id,
    name: itinerary.name || "Untitled Event",
    eventDate: itinerary.eventDate || null,
    status: effectiveStatus,
    source: 'manual',
    items: (itinerary.items || []).map(item => ({
      id: item.id,
      venueName: item.venueName,
      venueAddress: item.venueAddress || undefined,
      venueType: item.venueType || undefined,
      photoUrl: item.photoUrl || undefined,
    })),
    rsvpCount: itinerary.rsvpCount,
    confidenceScore: itinerary.confidenceScore ?? undefined,
    autoSendAt: itinerary.autoSendAt || undefined,
    inviteSentAt: itinerary.inviteSentAt || undefined,
    hostMemberName: itinerary.hostMemberName || undefined,
    originalItineraryId: itinerary.id,
  };
}

/**
 * Transform an auto-scheduled event to a unified event
 */
function transformAutoEvent(autoEvent: AutoScheduledEventInput): UnifiedEvent {
  return {
    id: autoEvent.itineraryId || autoEvent.id,
    name: autoEvent.itinerary?.name || "Auto-scheduled Event",
    eventDate: autoEvent.proposedDate || null,
    status: autoEvent.status === 'pending' ? 'draft' : (autoEvent.status as EventStatus),
    source: 'auto',
    items: (autoEvent.itinerary?.items || []).map(item => ({
      id: item.id,
      venueName: item.venueName,
      venueAddress: item.venueAddress || undefined,
      venueType: item.venueType || undefined,
      photoUrl: item.photoUrl || undefined,
    })),
    confidenceScore: autoEvent.confidenceScore ?? undefined,
    autoSendAt: autoEvent.autoSendAt || undefined,
    originalItineraryId: autoEvent.itineraryId || undefined,
    originalAutoEventId: autoEvent.id,
  };
}

/**
 * Determine effective status from itinerary data
 */
function determineStatus(itinerary: ItineraryInput): EventStatus {
  // Check if past
  if (itinerary.eventDate && isPast(new Date(itinerary.eventDate))) {
    return 'past';
  }

  // Map status string to EventStatus
  const statusMap: Record<string, EventStatus> = {
    'draft': 'draft',
    'saved': 'saved',
    'proposed': 'proposed',
    'scheduled': 'scheduled',
    'confirmed': 'confirmed',
    'rejected': 'rejected',
  };

  return statusMap[itinerary.status] || 'draft';
}

/**
 * Get status priority for deduplication (higher wins)
 */
function getStatusPriority(status: EventStatus): number {
  const priorities: Record<EventStatus, number> = {
    'past': 0,
    'rejected': 1,
    'draft': 2,
    'tbd': 3,
    'saved': 4,
    'proposed': 5,
    'scheduled': 6,
    'confirmed': 7,
  };
  return priorities[status] ?? 0;
}

/**
 * Sort events chronologically with future events first
 */
export function sortByEventDate(events: UnifiedEvent[]): UnifiedEvent[] {
  const now = new Date();

  return [...events].sort((a, b) => {
    const aDate = a.eventDate ? new Date(a.eventDate) : null;
    const bDate = b.eventDate ? new Date(b.eventDate) : null;

    // Determine if past
    const aIsPast = aDate && aDate < now;
    const bIsPast = bDate && bDate < now;

    // Past events go to bottom
    if (aIsPast && !bIsPast) return 1;
    if (!aIsPast && bIsPast) return -1;

    // Both past or both future: TBD (no date) after dated events
    if (!aDate && bDate) return 1;
    if (aDate && !bDate) return -1;
    if (!aDate && !bDate) return 0;

    // Chronological order for dated events
    return aDate!.getTime() - bDate!.getTime();
  });
}

/**
 * Merge and deduplicate events from multiple sources
 *
 * Priority:
 * 1. Itineraries (base data)
 * 2. Proposed itineraries (upgrade status)
 * 3. Auto-scheduled events (add if not present)
 *
 * Deduplication uses itinerary ID as the primary key.
 * When duplicates exist, the higher status wins.
 */
export function mergeAndDeduplicateEvents(
  itineraries: ItineraryInput[],
  proposedItineraries: ItineraryInput[],
  autoScheduledEvents: AutoScheduledEventInput[]
): UnifiedEvent[] {
  const eventMap = new Map<string, UnifiedEvent>();

  // 1. Process base itineraries
  itineraries.forEach(it => {
    eventMap.set(it.id, transformItinerary(it));
  });

  // 2. Process proposed itineraries - upgrade status if same ID exists
  proposedItineraries.forEach(it => {
    const existing = eventMap.get(it.id);
    const transformed = transformItinerary(it, 'proposed');

    if (existing) {
      // Keep the one with higher status priority
      if (getStatusPriority(transformed.status) > getStatusPriority(existing.status)) {
        eventMap.set(it.id, transformed);
      }
    } else {
      eventMap.set(it.id, transformed);
    }
  });

  // 3. Process auto-scheduled events - only add if not already present
  autoScheduledEvents.forEach(auto => {
    const key = auto.itineraryId || auto.id;
    if (!eventMap.has(key)) {
      eventMap.set(key, transformAutoEvent(auto));
    }
  });

  // 4. Sort chronologically
  return sortByEventDate(Array.from(eventMap.values()));
}

/**
 * Check if an event needs user attention
 */
export function needsAction(event: UnifiedEvent): boolean {
  // Draft with date but no invites sent
  if (event.status === 'draft' && event.eventDate && !event.inviteSentAt) {
    return true;
  }
  // Low confidence auto-scheduled events
  if (event.confidenceScore !== undefined && event.confidenceScore < 60) {
    return true;
  }
  // TBD events that are coming up soon (no venue selected)
  if (event.items.length === 0 && event.eventDate) {
    const daysUntil = Math.ceil(
      (new Date(event.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil <= 3) {
      return true;
    }
  }
  return false;
}

/**
 * Format venue type for display, filtering out generic/unhelpful terms
 * Returns null if the type shouldn't be displayed
 */
export function formatVenueTypeForDisplay(venueType?: string | null): string | null {
  if (!venueType) return null;

  // Normalize the type
  const normalized = venueType.toLowerCase().replace(/_/g, ' ').trim();

  // Generic terms that aren't helpful to show
  const genericTerms = [
    'venue',
    'place',
    'establishment',
    'point of interest',
    'meal',
    'food',
    'store',
    'shop',
    'business',
    'local business',
    'premise',
    'general contractor',
    'subpremise',
  ];

  if (genericTerms.includes(normalized)) {
    return null;
  }

  // Format nicely for display (title case)
  return normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Status badge configuration (for consistent styling)
export const STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  draft: {
    label: "Draft",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
  saved: {
    label: "Saved",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  proposed: {
    label: "Voting",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  scheduled: {
    label: "Confirmed",
    color: "bg-green-100 text-green-700 border-green-200",
  },
  confirmed: {
    label: "Confirmed",
    color: "bg-green-100 text-green-700 border-green-200",
  },
  rejected: {
    label: "Cancelled",
    color: "bg-red-100 text-red-700 border-red-200",
  },
  past: {
    label: "Completed",
    color: "bg-slate-100 text-slate-500 border-slate-200",
  },
  tbd: {
    label: "Venue TBD",
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
};
