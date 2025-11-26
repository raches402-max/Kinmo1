import { useState } from "react";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogFooter } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Star, DollarSign, Heart, Loader2, ExternalLink, RefreshCw, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VenuePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: VenueResult[];
  category: string;
  searchLocation: string;
  searchRadius: number;
  groupId: string;
  onComplete: () => void;
}

interface VenueResult {
  venueName: string;
  googlePlaceId: string;
  venueAddress: string;
  rating?: number | string;
  reviewCount?: number | string;
  priceLevel?: number | string;
  photoUrl?: string;
  venueType?: string;
  googleMapsUrl?: string;
  personalizedScore?: number;
  badges?: string[];
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  meal: { label: "Restaurants & Meals", icon: "🍽️" },
  cafes: { label: "Cafes & Coffee", icon: "☕" },
  drinks: { label: "Bars & Drinks", icon: "🍷" },
  dessert: { label: "Desserts & Sweets", icon: "🍰" },
  experiences: { label: "Activities & Experiences", icon: "🎉" },
};

function VenueCard({
  venue,
  selected,
  onToggle
}: {
  venue: VenueResult;
  selected: boolean;
  onToggle: () => void;
}) {
  // Construct Google Maps URL with multiple fallback options:
  // 1. Use provided googleMapsUrl
  // 2. Construct from googlePlaceId if available
  // 3. Fallback to search by name and address
  const googleMapsUrl = venue.googleMapsUrl ||
    (venue.googlePlaceId
      ? `https://www.google.com/maps/place/?q=place_id:${venue.googlePlaceId}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.venueName} ${venue.venueAddress}`)}`
    );

  return (
    <Card
      className={`overflow-hidden transition-all ${
        selected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"
      }`}
    >
      <div className="aspect-video w-full bg-muted relative">
        {venue.photoUrl ? (
          <img
            src={venue.photoUrl}
            alt={venue.venueName}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <MapPin className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <button
          type="button"
          className={`absolute top-2 right-2 p-2 rounded-full transition-colors ${
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-white/90 text-gray-600 hover:bg-white"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <Heart className={`h-5 w-5 ${selected ? "fill-current" : ""}`} />
        </button>
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-2">
          <h3 className="font-semibold text-base line-clamp-1 flex-1">{venue.venueName}</h3>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(googleMapsUrl, "_blank");
            }}
            className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
            title="View on Google Maps"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 flex items-start gap-1">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{venue.venueAddress}</span>
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {venue.rating && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{Number(venue.rating).toFixed(1)}</span>
              {venue.reviewCount && (
                <span className="text-muted-foreground">({Number(venue.reviewCount).toLocaleString()})</span>
              )}
            </div>
          )}
          {venue.priceLevel && (
            <div className="flex items-center gap-1 text-sm">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span>{"$".repeat(Number(venue.priceLevel))}</span>
            </div>
          )}
        </div>

        {/* Learning Badges */}
        {venue.badges && venue.badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {venue.badges.map((badge, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {badge}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function VenuePreviewModal({
  open,
  onOpenChange,
  venues,
  category,
  searchLocation,
  searchRadius,
  groupId,
  onComplete,
}: VenuePreviewModalProps) {
  const { toast } = useToast();
  const [selectedVenues, setSelectedVenues] = useState<Set<string>>(new Set());

  // Filter state
  const [currentVenues, setCurrentVenues] = useState<VenueResult[]>(venues);
  const [searchText, setSearchText] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>(category);
  const [filterBudget, setFilterBudget] = useState<number | null>(null);
  const [filterRadiusMiles, setFilterRadiusMiles] = useState<number>(5); // Default 5 miles
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  const categoryConfig = CATEGORY_LABELS[filterCategory] || { label: filterCategory, icon: "📍" };

  // Convert miles to meters for API
  const milesToMeters = (miles: number) => Math.round(miles * 1609.34);

  const toggleVenue = (placeId: string) => {
    setSelectedVenues((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) {
        next.delete(placeId);
      } else {
        next.add(placeId);
      }
      return next;
    });
  };

  // Mutation to refresh venues with new filters
  const refreshVenuesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/groups/${groupId}/generate-category`, {
        category: filterCategory,
        searchLocation,
        searchRadius: milesToMeters(filterRadiusMiles),
        budgetOverride: filterBudget,
        searchQuery: searchText || undefined,
      });
    },
    onSuccess: (data) => {
      setCurrentVenues(data.results || []);
      setSelectedVenues(new Set()); // Clear selections when refreshing
      toast({
        title: "Results refreshed!",
        description: `Found ${data.results?.length || 0} venues`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error refreshing results",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addVenuesMutation = useMutation({
    mutationFn: async () => {
      const selected = currentVenues.filter((v) => selectedVenues.has(v.googlePlaceId));
      return apiRequest("POST", `/api/groups/${groupId}/add-venues-to-library`, {
        category: filterCategory,
        searchLocation,
        searchRadius: milesToMeters(filterRadiusMiles),
        selectedVenues: selected,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Venues added!",
        description: data.message || `Added ${selectedVenues.size} venues to your library`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/activities`] });
      onComplete();
      onOpenChange(false);
      setSelectedVenues(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Error adding venues",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = () => {
    if (selectedVenues.size === currentVenues.length) {
      setSelectedVenues(new Set());
    } else {
      setSelectedVenues(new Set(currentVenues.map(v => v.googlePlaceId)));
    }
  };

  const getBudgetPriceLevels = (budget: number | null) => {
    if (!budget) return "Using group default";
    if (budget <= 30) return "Allows: $";
    if (budget <= 60) return "Allows: $, $$";
    if (budget < 100) return "Allows: $, $$, $$$";
    return "Allows: All price levels";
  };

  const handleCancel = () => {
    setSelectedVenues(new Set());
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{categoryConfig.icon}</span>
            Preview Generated {categoryConfig.label}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Select venues to add to your library, or adjust filters to refine your search
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* Filters Section - Collapsible */}
          <Card className="border">
            <CardContent className="p-3">
              <button
                type="button"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="flex items-center justify-between w-full text-sm font-medium hover:opacity-70 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Adjust Filters</span>
                  {!filtersOpen && (
                    <span className="text-xs text-muted-foreground">
                      ({categoryConfig.icon} {categoryConfig.label}, {filterRadiusMiles} mi, {filterBudget ? `$${filterBudget}` : 'default budget'})
                    </span>
                  )}
                </div>
                {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {filtersOpen && (
                <div className="mt-3 space-y-3">
                  {/* Category Buttons */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(CATEGORY_LABELS).map(([key, config]) => (
                        <Button
                          key={key}
                          type="button"
                          variant={filterCategory === key ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilterCategory(key)}
                          className="gap-1 h-8 text-xs px-2"
                        >
                          <span>{config.icon}</span>
                          <span className="hidden sm:inline">{config.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Search Text */}
                  <div className="space-y-1.5">
                    <Label htmlFor="search-text" className="text-xs">Search Query (optional)</Label>
                    <Input
                      id="search-text"
                      placeholder="E.g., 'cozy brunch spots'"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Budget Override */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="budget-slider" className="text-xs">
                          Budget: {filterBudget ? `$${filterBudget}` : "Default"}
                        </Label>
                        {filterBudget && (
                          <button
                            type="button"
                            onClick={() => setFilterBudget(null)}
                            className="text-xs text-primary hover:underline"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <Slider
                        id="budget-slider"
                        min={20}
                        max={150}
                        step={10}
                        value={[filterBudget || 60]}
                        onValueChange={(value) => setFilterBudget(value[0])}
                        className="py-1"
                      />
                      <p className="text-xs text-muted-foreground">
                        {getBudgetPriceLevels(filterBudget)}
                      </p>
                    </div>

                    {/* Radius */}
                    <div className="space-y-1.5">
                      <Label htmlFor="radius-select" className="text-xs">
                        Search Radius
                      </Label>
                      <Select
                        value={filterRadiusMiles.toString()}
                        onValueChange={(value) => setFilterRadiusMiles(Number(value))}
                      >
                        <SelectTrigger id="radius-select" className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 miles</SelectItem>
                          <SelectItem value="5">5 miles</SelectItem>
                          <SelectItem value="10">10 miles</SelectItem>
                          <SelectItem value="30">30 miles</SelectItem>
                          <SelectItem value="50">50 miles</SelectItem>
                          <SelectItem value="100">100 miles</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Refresh Button */}
                  <Button
                    type="button"
                    onClick={() => refreshVenuesMutation.mutate()}
                    disabled={refreshVenuesMutation.isPending}
                    className="w-full gap-2 h-8 text-sm"
                    size="sm"
                  >
                    {refreshVenuesMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Refresh Results
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedVenues.size} of {currentVenues.length} selected
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedVenues.size === currentVenues.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          {/* Venue Grid */}
          {refreshVenuesMutation.isPending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : currentVenues.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentVenues.map((venue) => (
                <VenueCard
                  key={venue.googlePlaceId}
                  venue={venue}
                  selected={selectedVenues.has(venue.googlePlaceId)}
                  onToggle={() => toggleVenue(venue.googlePlaceId)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No venues found. Try adjusting your filters and refreshing.
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className="flex gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={addVenuesMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => addVenuesMutation.mutate()}
            disabled={selectedVenues.size === 0 || addVenuesMutation.isPending}
          >
            {addVenuesMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                Add {selectedVenues.size} {selectedVenues.size === 1 ? "Venue" : "Venues"} to Library
              </>
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
