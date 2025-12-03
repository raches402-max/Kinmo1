import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Star, Check, Sparkles } from "lucide-react";

interface VenueSearchResult {
  placeId: string;
  name: string;
  address: string;
  photoUrl?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  types?: string[];
  location?: { lat: number; lng: number };
  city?: string;
}

interface AddMoreStopsCardProps {
  venueSearchQuery: string;
  onSearchQueryChange: (query: string) => void;
  venueSearchResults: VenueSearchResult[];
  isVenueInItinerary: (placeId: string) => boolean;
  isVenueAlreadyAdded: (placeId: string) => boolean;
  onAddVenue: (result: VenueSearchResult) => void;
  isAddingVenue: boolean;
  onGoToActivities: () => void;
}

export function AddMoreStopsCard({
  venueSearchQuery,
  onSearchQueryChange,
  venueSearchResults,
  isVenueInItinerary,
  isVenueAlreadyAdded,
  onAddVenue,
  isAddingVenue,
  onGoToActivities,
}: AddMoreStopsCardProps) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Search for More Venues
        </CardTitle>
        <CardDescription>
          Find additional stops to add to your itinerary
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for parks, restaurants, cafes, or any venue..."
            value={venueSearchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="pl-9"
            data-testid="input-add-more-stops-search"
          />
        </div>

        {/* Search Results */}
        {venueSearchQuery.trim() && venueSearchQuery.trim().length >= 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Search results for "{venueSearchQuery}"
            </p>
            {venueSearchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {venueSearchResults.map((result) => {
                  const alreadyInItinerary = isVenueInItinerary(result.placeId);
                  const alreadyAdded = isVenueAlreadyAdded(result.placeId);
                  const disabled = alreadyInItinerary || alreadyAdded || isAddingVenue;

                  return (
                    <button
                      key={result.placeId}
                      onClick={() => {
                        if (disabled) return;
                        onAddVenue(result);
                      }}
                      disabled={disabled}
                      className={`flex gap-3 p-3 rounded-md border text-left transition-all ${
                        disabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      data-testid={`search-result-add-more-${result.placeId}`}
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
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {result.address}
                        </p>
                        {(alreadyInItinerary || alreadyAdded) && (
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
        {!venueSearchQuery.trim() && (
          <div className="pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Or browse AI-generated suggestions
            </p>
            <Button
              onClick={onGoToActivities}
              variant="outline"
              data-testid="button-go-to-activities-from-add-more"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Browse Activities
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
