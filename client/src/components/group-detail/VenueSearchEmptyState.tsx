/**
 * VenueSearchEmptyState
 * Search UI for finding and adding venues when no venues are selected.
 * Shows search input, results, and browse activities CTA.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Star, Check, Sparkles } from "lucide-react";

// ========== TYPES ==========

export interface VenueSearchResult {
  placeId: string;
  name: string;
  address: string;
  photoUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
  types?: string[];
  location?: {
    lat: number;
    lng: number;
  } | null;
  city?: string | null;
}

interface VenueSearchEmptyStateProps {
  /**
   * Current search query
   */
  searchQuery: string;
  /**
   * Callback when search query changes
   */
  onSearchQueryChange: (query: string) => void;
  /**
   * Search results
   */
  searchResults: VenueSearchResult[];
  /**
   * Callback when venue is added
   */
  onAddVenue: (result: VenueSearchResult) => void;
  /**
   * Check if a venue is already added (by place ID)
   */
  isVenueAlreadyAdded: (placeId: string) => boolean;
  /**
   * Whether the add mutation is pending
   */
  isAddingVenue: boolean;
  /**
   * Callback to navigate to activities tab
   */
  onGoToActivities: () => void;
  /**
   * Callback to open custom venue dialog
   */
  onAddCustomVenue: () => void;
  /**
   * Maximum number of venues that can be selected
   */
  maxVenues?: number;
  /**
   * Current number of selected venues
   */
  selectedVenuesCount: number;
  /**
   * Callback for when max venues limit is reached
   */
  onMaxVenuesReached: () => void;
}

// ========== COMPONENT ==========

export function VenueSearchEmptyState({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onAddVenue,
  isVenueAlreadyAdded,
  isAddingVenue,
  onGoToActivities,
  onAddCustomVenue,
  maxVenues = 5,
  selectedVenuesCount,
  onMaxVenuesReached,
}: VenueSearchEmptyStateProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search for Venues
            </CardTitle>
            <CardDescription>
              Search for restaurants, cafes, parks, or any venue to add to your itinerary
            </CardDescription>
          </div>
          <Button onClick={onAddCustomVenue} variant="outline" size="sm" className="gap-2 shrink-0">
            <MapPin className="h-4 w-4" />
            Add Custom
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for parks, restaurants, cafes, or any venue..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="pl-9"
            data-testid="input-venue-search-build"
          />
        </div>

        {/* Search Results */}
        {searchQuery.trim() && searchQuery.trim().length >= 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Search results for "{searchQuery}"</p>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((result) => {
                  const alreadyAdded = isVenueAlreadyAdded(result.placeId);

                  return (
                    <button
                      key={result.placeId}
                      onClick={() => {
                        if (alreadyAdded || isAddingVenue) return;
                        if (selectedVenuesCount >= maxVenues) {
                          onMaxVenuesReached();
                          return;
                        }

                        onAddVenue(result);
                      }}
                      disabled={alreadyAdded || isAddingVenue}
                      className={`flex gap-3 p-3 rounded-md border text-left transition-all ${
                        alreadyAdded || isAddingVenue ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      data-testid={`search-result-build-${result.placeId}`}
                    >
                      {result.photoUrl && (
                        <img
                          src={result.photoUrl}
                          alt={result.name}
                          className="w-16 h-16 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.name}</p>
                        {result.rating && (
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium">{result.rating}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{result.address}</p>
                        {alreadyAdded && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Added
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No venues found. Try a different search.</p>
              </div>
            )}
          </div>
        )}

        {/* Or Browse Activities CTA */}
        {!searchQuery.trim() && (
          <div className="pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground mb-3">Or browse AI-generated suggestions</p>
            <Button onClick={onGoToActivities} variant="outline" data-testid="button-go-to-activities">
              <Sparkles className="h-4 w-4 mr-2" />
              Browse Activities
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
