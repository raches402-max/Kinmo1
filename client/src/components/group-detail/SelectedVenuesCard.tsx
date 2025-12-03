import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, X } from "lucide-react";

export type VenueSelection = {
  sourceType: 'activity' | 'voting_event' | 'ad_hoc';
  sourceId: string;
  adHocData?: {
    name?: string;
    address?: string;
    googlePlaceId?: string;
    googleMapsUrl?: string;
    venueType?: string;
  };
};

interface ResolvedVenue {
  name: string;
  type: string;
  isAdHoc: boolean;
}

interface SelectedVenuesCardProps {
  selectedVenues: VenueSelection[];
  resolveVenue: (venue: VenueSelection) => ResolvedVenue;
  onAddCustomVenue: () => void;
  onClearSelection: () => void;
  onCreateItinerary: () => void;
  onRemoveVenue: (sourceType: VenueSelection['sourceType'], sourceId: string) => void;
  isCreating: boolean;
}

export function SelectedVenuesCard({
  selectedVenues,
  resolveVenue,
  onAddCustomVenue,
  onClearSelection,
  onCreateItinerary,
  onRemoveVenue,
  isCreating,
}: SelectedVenuesCardProps) {
  if (selectedVenues.length === 0) {
    return null;
  }

  return (
    <Card className="border-muted">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-medium">Selected Venues</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedVenues.length} of 5 venues
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              onClick={onAddCustomVenue}
              disabled={selectedVenues.length >= 5}
              variant="outline"
              size="sm"
              className="gap-1.5 h-8"
            >
              <MapPin className="h-3.5 w-3.5" />
              Custom
            </Button>
            <Button
              onClick={onClearSelection}
              variant="ghost"
              size="sm"
              className="h-8"
              data-testid="button-cancel-selection-build"
            >
              Clear
            </Button>
            <Button
              onClick={onCreateItinerary}
              disabled={isCreating || selectedVenues.length < 1}
              variant="default"
              size="sm"
              className="h-8"
              data-testid="button-validate-itinerary-build"
            >
              {isCreating ? "Creating..." : "Create Itinerary"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {selectedVenues.map((venue, index) => {
          const resolved = resolveVenue(venue);

          return (
            <div
              key={`${venue.sourceType}-${venue.sourceId}`}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/50 bg-background hover:border-border transition-colors"
              data-testid={`selected-venue-build-${venue.sourceId}`}
            >
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground font-medium text-xs">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">{resolved.name}</p>
                  {resolved.isAdHoc && (
                    <Badge variant="secondary" className="text-2xs h-4 px-1.5">
                      Custom
                    </Badge>
                  )}
                </div>
                {resolved.type && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {resolved.type}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveVenue(venue.sourceType, venue.sourceId)}
                className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                data-testid={`button-remove-venue-build-${venue.sourceId}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
