/**
 * NearbySuggestionsCard
 * Shows contextual nearby venue suggestions based on selected venues.
 * Suggests complementary stops (e.g., dessert after meals, meals if only drinks selected).
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, Star } from "lucide-react";

// ========== TYPES ==========

interface VenueSuggestion {
  placeId: string;
  name: string;
  address: string;
  photoUrl?: string | null;
  rating?: number | null;
  types?: string[];
}

interface VenueSelection {
  sourceType: 'activity' | 'voting_event' | 'ad_hoc';
  sourceId: string;
}

interface Activity {
  id: string;
  venueType?: string | null;
  googlePlaceId?: string | null;
  archivedAt?: Date | null;
}

interface VotingEvent {
  id: string;
  venueType?: string | null;
  googlePlaceId?: string | null;
}

interface ItineraryItem {
  venueType?: string | null;
}

interface Itinerary {
  items?: ItineraryItem[];
}

interface NearbySuggestionsCardProps {
  /**
   * Array of nearby venue suggestions
   */
  suggestions: VenueSuggestion[];
  /**
   * Currently selected venues
   */
  selectedVenues: VenueSelection[];
  /**
   * Existing itineraries
   */
  itineraries: Itinerary[];
  /**
   * All activities
   */
  activities: Activity[];
  /**
   * All voting events
   */
  votingEvents: VotingEvent[];
  /**
   * Set of already added suggestion place IDs
   */
  addedSuggestionPlaceIds: Set<string>;
  /**
   * Callback when a suggestion is clicked
   */
  onAddSuggestion: (suggestion: VenueSuggestion) => void;
  /**
   * Whether add mutation is pending
   */
  isAdding: boolean;
  /**
   * Maximum venues allowed
   */
  maxVenues?: number;
  /**
   * Callback when max venues reached
   */
  onMaxVenuesReached: () => void;
}

// ========== COMPONENT ==========

export function NearbySuggestionsCard({
  suggestions,
  selectedVenues,
  itineraries,
  activities,
  votingEvents,
  addedSuggestionPlaceIds,
  onAddSuggestion,
  isAdding,
  maxVenues = 5,
  onMaxVenuesReached,
}: NearbySuggestionsCardProps) {
  // Determine contextual message based on venue types (from selected or itinerary)
  let venueTypes: string[] = [];

  if (selectedVenues.length > 0) {
    // Get types from selected venues
    venueTypes = selectedVenues
      .map((venue) => {
        if (venue.sourceType === "activity") {
          const activity = activities.find((a) => a.id === venue.sourceId);
          return activity?.venueType?.toLowerCase() || "";
        } else {
          const event = votingEvents.find((e) => e.id === venue.sourceId);
          return event?.venueType?.toLowerCase() || "";
        }
      })
      .filter(Boolean);
  } else if (itineraries.length > 0) {
    // Get types from itinerary items
    venueTypes = itineraries[0].items?.map((item) => item.venueType?.toLowerCase() || "").filter(Boolean) || [];
  }

  const hasMeal = venueTypes.some(
    (type) =>
      type.includes("restaurant") ||
      type.includes("food") ||
      type.includes("meal") ||
      type.includes("dining") ||
      type.includes("breakfast") ||
      type.includes("lunch") ||
      type.includes("dinner")
  );
  const hasDrinksDessert = venueTypes.some(
    (type) =>
      type.includes("bar") ||
      type.includes("drink") ||
      type.includes("cocktail") ||
      type.includes("dessert") ||
      type.includes("ice cream") ||
      type.includes("boba") ||
      type.includes("cafe")
  );

  let contextualMessage = "Round it out with these nearby spots?";
  if (hasMeal && !hasDrinksDessert) {
    contextualMessage = "Feeling like dessert or drinks after?";
  } else if (hasDrinksDessert && !hasMeal) {
    contextualMessage = "Want to add a meal stop?";
  }

  return (
    <Card className="mt-8 border-2 border-primary/20 bg-primary/15" data-testid="enhanced-nearby-suggestions">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/25 flex items-center justify-center flex-shrink-0">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{contextualMessage}</CardTitle>
            <CardDescription>High-rated spots within 0.5 miles • Click to add to your itinerary</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {suggestions.map((suggestion) => {
            const alreadySelected =
              activities.some((a) => !a.archivedAt && a.googlePlaceId === suggestion.placeId) ||
              votingEvents.some((e) => e.googlePlaceId === suggestion.placeId) ||
              addedSuggestionPlaceIds.has(suggestion.placeId);

            return (
              <button
                key={suggestion.placeId}
                onClick={() => {
                  if (alreadySelected || isAdding) return;
                  if (selectedVenues.length >= maxVenues) {
                    onMaxVenuesReached();
                    return;
                  }

                  onAddSuggestion(suggestion);
                }}
                disabled={alreadySelected || isAdding}
                className={`flex gap-3 p-3 rounded-md border text-left transition-all ${
                  alreadySelected || isAdding ? "opacity-50 cursor-not-allowed" : ""
                }`}
                data-testid={`suggestion-${suggestion.placeId}`}
              >
                {suggestion.photoUrl && (
                  <img
                    src={suggestion.photoUrl}
                    alt={suggestion.name}
                    className="w-16 h-16 rounded object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{suggestion.name}</p>
                  {suggestion.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{suggestion.rating}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{suggestion.address}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
